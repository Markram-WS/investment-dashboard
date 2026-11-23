"""Mapped (read-only foreign schema) read-side and write-guard API tests.

A mapped portfolio has no tables of ours in the foreign database, so every
read-side endpoint must return an empty result without querying our tables and
every affected write must answer 409. These tests seed the mapping directly
because the endpoints under test never open the foreign connection.
"""

import os
import sys

import pytest
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(__file__))
from conftest import get_test_engine  # noqa: E402

from app.custom_mapping import READ_ONLY_DETAIL  # noqa: E402
from app.mapping_templates import get_template  # noqa: E402
from app.models import CustomPortfolioConnection, Portfolio  # noqa: E402
from app.routers.performance import empty_performance_response  # noqa: E402


async def create_portfolio(client, name: str, cash: float = 1000.0) -> int:
    resp = await client.post(
        "/api/v1/portfolios/",
        json={
            "portfolio_name": name,
            "port_type": "Active Trading",
            "available_cash": cash,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["portfolio_id"]


async def mark_mapped(portfolio_id: int) -> None:
    """Make an existing local portfolio a mapped read-only view."""
    _, Session = get_test_engine()
    async with Session() as session:
        portfolio = await session.get(Portfolio, portfolio_id)
        assert portfolio is not None
        portfolio.is_custom = True
        session.add(
            CustomPortfolioConnection(
                portfolio_id=portfolio_id,
                db_host="foreign.invalid",
                db_port=5432,
                db_name="foreign",
                db_user="reader",
                encrypted_password="unused",
                mapping_config=get_template("tfex-settrade-v1"),
            )
        )
        await session.commit()


async def unmark_mapped(portfolio_id: int, *, delete_portfolio: bool = True) -> None:
    _, Session = get_test_engine()
    async with Session() as session:
        connections = (
            await session.execute(
                select(CustomPortfolioConnection).where(
                    CustomPortfolioConnection.portfolio_id == portfolio_id
                )
            )
        ).scalars().all()
        for connection in connections:
            await session.delete(connection)
        portfolio = await session.get(Portfolio, portfolio_id)
        if portfolio is not None:
            if delete_portfolio:
                await session.delete(portfolio)
            else:
                portfolio.is_custom = False
        await session.commit()


@pytest.fixture
async def mapped_portfolio(async_client):
    portfolio_id = await create_portfolio(async_client, "Mapped Portfolio")
    await mark_mapped(portfolio_id)
    try:
        yield portfolio_id
    finally:
        await unmark_mapped(portfolio_id)


# ---------------------------------------------------------------------------
# Read side: empty, not a 500
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_orders_groups_mapped_returns_empty(async_client, mapped_portfolio):
    resp = await async_client.get(
        f"/api/v1/orders-groups/?portfolio_id={mapped_portfolio}"
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_assets_mapped_returns_empty(async_client, mapped_portfolio):
    resp = await async_client.get(f"/api/v1/assets?portfolio_id={mapped_portfolio}")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_asset_groups_mapped_returns_empty(async_client, mapped_portfolio):
    resp = await async_client.get(
        f"/api/v1/asset-groups?portfolio_id={mapped_portfolio}"
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_performance_mapped_returns_empty_series(
    async_client, mapped_portfolio
):
    resp = await async_client.get(
        f"/api/v1/analytics/performance/{mapped_portfolio}"
    )
    assert resp.status_code == 200
    assert resp.json() == {
        "equity_curve": [],
        "payoff_data": [],
        "total_pl": 0.0,
    }


def test_empty_performance_response_shape_is_the_model_defaults():
    assert empty_performance_response().model_dump() == {
        "equity_curve": [],
        "payoff_data": [],
        "total_pl": 0.0,
    }


# ---------------------------------------------------------------------------
# Write side: mapped portfolios are read-only
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_asset_group_writes_reject_mapped_portfolio(
    async_client, mapped_portfolio
):
    create_resp = await async_client.post(
        f"/api/v1/asset-groups?portfolio_id={mapped_portfolio}",
        json={"name": "Blocked"},
    )
    update_resp = await async_client.put(
        f"/api/v1/asset-groups/1?portfolio_id={mapped_portfolio}",
        json={"name": "Blocked"},
    )
    delete_resp = await async_client.delete(
        f"/api/v1/asset-groups/1?portfolio_id={mapped_portfolio}"
    )

    for resp in (create_resp, update_resp, delete_resp):
        assert resp.status_code == 409
        assert resp.json()["detail"] == READ_ONLY_DETAIL


@pytest.mark.asyncio
async def test_transfer_from_mapped_source_is_rejected(
    async_client, mapped_portfolio
):
    destination = await create_portfolio(async_client, "Local destination", 0.0)
    resp = await async_client.post(
        "/api/v1/transfers",
        json={
            "source_portfolio_id": mapped_portfolio,
            "destination_portfolio_id": destination,
            "amount": 100.0,
        },
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == READ_ONLY_DETAIL


@pytest.mark.asyncio
async def test_transfer_to_mapped_destination_is_rejected(
    async_client, mapped_portfolio
):
    source = await create_portfolio(async_client, "Local source", 1000.0)
    resp = await async_client.post(
        "/api/v1/transfers",
        json={
            "source_portfolio_id": source,
            "destination_portfolio_id": mapped_portfolio,
            "amount": 100.0,
        },
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == READ_ONLY_DETAIL


@pytest.mark.asyncio
async def test_confirm_transfer_rejected_when_a_side_becomes_mapped(async_client):
    source = await create_portfolio(async_client, "Confirm source", 1000.0)
    destination = await create_portfolio(async_client, "Confirm destination", 0.0)
    init_resp = await async_client.post(
        "/api/v1/transfers",
        json={
            "source_portfolio_id": source,
            "destination_portfolio_id": destination,
            "amount": 100.0,
        },
    )
    assert init_resp.status_code == 201, init_resp.text
    transaction_id = init_resp.json()["transaction_id"]

    await mark_mapped(source)
    try:
        resp = await async_client.post(
            f"/api/v1/transfers/{transaction_id}/confirm",
            json={"confirmation_token": "test-token", "confirmed_by": "qa"},
        )
        assert resp.status_code == 409
        assert resp.json()["detail"] == READ_ONLY_DETAIL
    finally:
        # The pending transaction references the portfolio; keep the row but
        # make it local again so later scheduled tests never dial out.
        await unmark_mapped(source, delete_portfolio=False)


# ---------------------------------------------------------------------------
# Journal writes stay allowed (local notes, not foreign data)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_journal_write_allowed_for_mapped_portfolio(
    async_client, mapped_portfolio
):
    resp = await async_client.post(
        "/api/v1/journal/",
        json={"portfolio_id": mapped_portfolio, "entry_text": "Local note"},
    )
    assert resp.status_code == 201, resp.text


# ---------------------------------------------------------------------------
# Non-mapped portfolios keep their existing contracts
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_non_mapped_reads_still_return_local_rows(async_client):
    portfolio_id = await create_portfolio(async_client, "Local reads")

    create_group = await async_client.post(
        f"/api/v1/orders-groups/?portfolio_id={portfolio_id}",
        json={"name": "Zone A", "max_orders": 2},
    )
    assert create_group.status_code == 201, create_group.text

    orders_groups = await async_client.get(
        f"/api/v1/orders-groups/?portfolio_id={portfolio_id}"
    )
    assert orders_groups.status_code == 200
    assert [group["name"] for group in orders_groups.json()] == ["Zone A"]

    asset_group = await async_client.post(
        f"/api/v1/asset-groups?portfolio_id={portfolio_id}",
        json={"name": "Equities"},
    )
    assert asset_group.status_code == 201, asset_group.text

    asset_groups = await async_client.get(
        f"/api/v1/asset-groups?portfolio_id={portfolio_id}"
    )
    assert asset_groups.status_code == 200
    assert "Equities" in [group["name"] for group in asset_groups.json()]

    assets = await async_client.get(f"/api/v1/assets?portfolio_id={portfolio_id}")
    assert assets.status_code == 200
    assert isinstance(assets.json(), list)

    performance = await async_client.get(
        f"/api/v1/analytics/performance/{portfolio_id}"
    )
    assert performance.status_code == 200
    assert performance.json()["total_pl"] == 0.0
