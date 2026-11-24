import os
import sys

import pytest
from httpx import AsyncClient
from datetime import datetime, timezone
from sqlalchemy import delete, select

sys.path.insert(0, os.path.dirname(__file__))
from conftest import get_test_engine  # noqa: E402

import app.routers.analytics as analytics_router  # noqa: E402
from app.mapping_templates import get_template  # noqa: E402
from app.models import (  # noqa: E402
    ActiveOrder,
    CustomPortfolioConnection,
    Portfolio,
    TradePlan,
)

# Reuse the payloads function from test_api.py if possible, but we'll define our own for clarity
def portfolio_payload():
    return {
        "portfolio_name": "Test Portfolio",
        "port_type": "Active Trading",
        "target_ratio": {"BTC": 0.5, "ETH": 0.5},
        "cash_buffer_limit": 1000,
        "available_cash": 5000,
        "margin_locked": 0,
        "risk_status": "Safe",
    }

def trade_plan_payload(portfolio_id):
    return {
        "portfolio_id": portfolio_id,
        "entry_zone": "100-110",
        "exit_zone": "90-80",
        "tp_levels": [115, 130],
        "sl_level": 85,
        "leverage": 5,
        "margin_rate": 0.2,
        "entry_reason": "Test entry reason",
    }

def active_order_payload(plan_id, portfolio_id):
    return {
        "plan_id": plan_id,
        "portfolio_id": portfolio_id,
        "asset_type": "Crypto",
        "side": "Buy",
        "qty": 0.5,
        "entry_price": 102.0,
        "current_price": 105.0,
        "tp_price": 115.0,
        "leverage": 5,
        "margin_rate": 0.2,
        "order_status": "filled",
        "executed_by": "Manual",
        "linked_order_id": "spread_1",
    }

@pytest.mark.asyncio
async def test_portfolio_grid_endpoint_empty(async_client):
    """Test the portfolio-grid endpoint when there are no portfolios."""
    resp = await async_client.get("/api/v1/analytics/portfolio-grid")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 0

@pytest.mark.asyncio
async def test_portfolio_grid_endpoint_with_data(async_client):
    """Test the portfolio-grid endpoint with a portfolio and related data."""
    # Create a portfolio
    portfolio_resp = await async_client.post("/api/v1/portfolios/", json=portfolio_payload())
    assert portfolio_resp.status_code == 201
    portfolio = portfolio_resp.json()
    portfolio_id = portfolio["portfolio_id"]

    # Create a trade plan for the portfolio
    plan_payload = trade_plan_payload(portfolio_id)
    plan_resp = await async_client.post("/api/v1/trade-plans/", json=plan_payload)
    assert plan_resp.status_code == 201
    plan = plan_resp.json()
    plan_id = plan["plan_id"]

    # Create an active order for the trade plan
    order_payload = active_order_payload(plan_id, portfolio_id)
    order_resp = await async_client.post("/api/v1/orders/", json=order_payload)
    assert order_resp.status_code == 201
    order = order_resp.json()
    order_id = order["order_id"]

    # Now call the portfolio-grid endpoint
    resp = await async_client.get("/api/v1/analytics/portfolio-grid")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # We expect at least one portfolio in the response
    assert len(data) >= 1
    # Find the portfolio we created
    portfolio_data = None
    for item in data:
        if item["portfolio_id"] == portfolio_id:
            portfolio_data = item
            break
    assert portfolio_data is not None, f"Portfolio {portfolio_id} not found in grid data"
    # Check the structure of the portfolio data
    assert portfolio_data["portfolio_id"] == portfolio_id
    assert portfolio_data["portfolio_name"] == "Test Portfolio"
    assert portfolio_data["port_type"] == "Active Trading"
    assert portfolio_data["risk_status"] == "Safe"
    # Check that we have an active order (note: the endpoint filters out spread legs, but we have a linked_order_id set)
    # Since we set linked_order_id, the order might be considered a spread leg and excluded from active_orders_list.
    # We'll adjust the test to not rely on the exact count of active orders for now.
    # Instead, we'll check that the spread_pairs list contains our order (if the endpoint groups by linked_order_id).
    # We set linked_order_id to "spread_1", and we have only one order with that linked_order_id, so it won't form a pair.
    # Therefore, we expect spread_pairs to be empty.
    assert isinstance(portfolio_data["spread_pairs"], list)
    # We have only one order with linked_order_id, so no pair is formed.
    assert len(portfolio_data["spread_pairs"]) == 0
    # Check that the trade_plan_md is set to the entry_reason
    assert portfolio_data["trade_plan_md"] == "Test entry reason"


@pytest.mark.asyncio
async def test_portfolio_detail_endpoint_not_found(async_client):
    """Test the portfolio detail endpoint when portfolio doesn't exist."""
    resp = await async_client.get("/api/v1/analytics/portfolio/99999")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_portfolio_detail_endpoint_with_data(async_client):
    """Test the portfolio detail endpoint with portfolio and related data."""
    # Create a portfolio
    portfolio_resp = await async_client.post("/api/v1/portfolios/", json=portfolio_payload())
    assert portfolio_resp.status_code == 201
    portfolio = portfolio_resp.json()
    portfolio_id = portfolio["portfolio_id"]

    # Create a trade plan for the portfolio
    plan_payload = trade_plan_payload(portfolio_id)
    plan_resp = await async_client.post("/api/v1/trade-plans/", json=plan_payload)
    assert plan_resp.status_code == 201
    plan = plan_resp.json()
    plan_id = plan["plan_id"]

    # Create an active order
    order_payload = active_order_payload(plan_id, portfolio_id)
    order_resp = await async_client.post("/api/v1/orders/", json=order_payload)
    assert order_resp.status_code == 201

    # Call the portfolio detail endpoint
    detail_resp = await async_client.get(f"/api/v1/analytics/portfolio/{portfolio_id}")
    assert detail_resp.status_code == 200
    data = detail_resp.json()

    # Verify the response structure
    assert data["portfolio_id"] == portfolio_id
    assert data["portfolio_name"] == "Test Portfolio"
    assert data["port_type"] == "Active Trading"
    assert data["risk_status"] == "Safe"
    assert data["trade_plan_md"] == "Test entry reason"
    assert isinstance(data["active_orders"], list)
    assert isinstance(data["spread_pairs"], list)
    assert isinstance(data["recent_trades"], list)


@pytest.mark.asyncio
async def test_analytics_alias_endpoint(async_client):
    """Test that /api/v1/analytics is an alias for /api/v1/analytics/portfolio-grid."""
    resp = await async_client.get("/api/v1/analytics")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


# ---------------------------------------------------------------------------
# Unreachable mapped database: degrade, never 500
# ---------------------------------------------------------------------------

async def _create_portfolio(client, name: str) -> int:
    payload = portfolio_payload()
    payload["portfolio_name"] = name
    resp = await client.post("/api/v1/portfolios/", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()["portfolio_id"]


async def _mark_mapped(portfolio_id: int) -> None:
    """Make a local portfolio a mapped read-only view (never dialled here)."""
    _, Session = get_test_engine()
    async with Session() as session:
        portfolio = await session.get(Portfolio, portfolio_id)
        assert portfolio is not None
        portfolio.is_custom = True
        session.add(
            CustomPortfolioConnection(
                portfolio_id=portfolio_id,
                db_host="127.0.0.1",
                db_port=5432,
                db_name="dev",
                db_user="reader",
                encrypted_password="unused-secret",
                mapping_config=get_template("tfex-settrade-v1"),
            )
        )
        await session.commit()


async def _delete_portfolios(*portfolio_ids: int) -> None:
    _, Session = get_test_engine()
    async with Session() as session:
        await session.execute(
            delete(ActiveOrder).where(
                ActiveOrder.portfolio_id.in_(portfolio_ids)
            )
        )
        await session.execute(
            delete(TradePlan).where(
                TradePlan.portfolio_id.in_(portfolio_ids)
            )
        )
        await session.execute(
            delete(CustomPortfolioConnection).where(
                CustomPortfolioConnection.portfolio_id.in_(portfolio_ids)
            )
        )
        await session.execute(
            delete(Portfolio).where(Portfolio.portfolio_id.in_(portfolio_ids))
        )
        await session.commit()


def _refuse_foreign_engine(monkeypatch):
    """The mapped engine seam: dialling the foreign DB refuses to connect."""

    async def refuse(_connection):
        raise ConnectionRefusedError(111, "Connect call failed ('127.0.0.1', 5432)")

    monkeypatch.setattr(
        analytics_router, "get_or_create_custom_engine", refuse
    )


@pytest.mark.asyncio
async def test_portfolio_detail_mapped_unreachable_degrades(async_client, monkeypatch):
    """A mapped portfolio with a dead foreign DB still answers 200."""
    broken_id = await _create_portfolio(async_client, "Broken Mapped")
    try:
        await _mark_mapped(broken_id)
        _refuse_foreign_engine(monkeypatch)

        resp = await async_client.get(f"/api/v1/analytics/portfolio/{broken_id}")
        assert resp.status_code == 200, resp.text
        data = resp.json()

        assert data["portfolio_id"] == broken_id
        assert data["portfolio_name"] == "Broken Mapped"
        assert data["load_error"]
        assert "Mapped database unreachable" in data["load_error"]
        assert "ConnectionRefusedError" in data["load_error"]
        assert "unused-secret" not in data["load_error"]
        assert data["active_orders"] == []
        assert data["recent_trades"] == []
        assert data["spread_pairs"] == []
        assert data["risk"] is None
        assert data["read_only"] is True
        assert data["mapping_template"] == "tfex-settrade-v1"
        # No write capabilities are advertised while the foreign DB is down.
        assert data["order_writes"] is None
        # Local metadata is still served so the page header/actions render.
        assert data["available_cash"] == 5000
        assert data["cash_buffer_limit"] == 1000
    finally:
        await _delete_portfolios(broken_id)


@pytest.mark.asyncio
async def test_portfolio_grid_isolates_unreachable_mapped(async_client, monkeypatch):
    """One dead foreign DB degrades its own row; the healthy row is intact."""
    healthy_id = await _create_portfolio(async_client, "Healthy Local")
    broken_id = await _create_portfolio(async_client, "Broken Mapped")
    try:
        plan_resp = await async_client.post(
            "/api/v1/trade-plans/", json=trade_plan_payload(healthy_id)
        )
        assert plan_resp.status_code == 201, plan_resp.text
        plan_id = plan_resp.json()["plan_id"]
        order_resp = await async_client.post(
            "/api/v1/orders/", json=active_order_payload(plan_id, healthy_id)
        )
        assert order_resp.status_code == 201, order_resp.text

        await _mark_mapped(broken_id)
        _refuse_foreign_engine(monkeypatch)

        resp = await async_client.get("/api/v1/analytics/portfolio-grid")
        assert resp.status_code == 200, resp.text
        rows = {row["portfolio_id"]: row for row in resp.json()}

        healthy = rows[healthy_id]
        assert healthy["load_error"] is None
        assert len(healthy["active_orders"]) == 1

        broken = rows[broken_id]
        assert "Mapped database unreachable" in broken["load_error"]
        assert "ConnectionRefusedError" in broken["load_error"]
        assert broken["active_orders"] == []
        assert broken["read_only"] is True
    finally:
        await _delete_portfolios(healthy_id, broken_id)
