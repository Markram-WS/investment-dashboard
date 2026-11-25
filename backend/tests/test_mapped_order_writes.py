"""Mapped order writes: insert / update / close / cancel against a foreign schema.

The foreign broker database is an in-memory SQLite engine with the same shape
as ``usd_pct_abc.opened_orders`` / ``order_history``; the router's
``mapped_engine`` is monkeypatched to return it, so nothing dials out.
"""

import os
import sys

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.dirname(__file__))
from conftest import get_test_engine  # noqa: E402

from app.custom_mapping import READ_ONLY_DETAIL, validate_mapping  # noqa: E402
from app.mapping_templates import get_template  # noqa: E402
from app.models import CustomPortfolioConnection, Portfolio  # noqa: E402

MARKER = "QA-mapping-write-probe"

OPENED_ORDERS_DDL = """
CREATE TABLE opened_orders (
    id TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))) PRIMARY KEY,
    tm TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    symbol TEXT,
    orderno TEXT,
    position TEXT NOT NULL,
    side TEXT NOT NULL,
    volume REAL NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL,
    tp REAL,
    fee REAL,
    pl REAL,
    remark TEXT,
    mark_price REAL
)
"""

ORDER_HISTORY_DDL = """
CREATE TABLE order_history (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    c_tm TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    symbol TEXT,
    orderno TEXT,
    position TEXT NOT NULL,
    side TEXT NOT NULL,
    volume REAL NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL,
    tp REAL,
    fee REAL,
    pl REAL,
    remark TEXT,
    mark_price REAL,
    c_price REAL,
    c_status TEXT
)
"""


def write_config() -> dict:
    """The settled template with schema-less tables for the SQLite fixture."""
    config = get_template("tfex-settrade-v1")
    for entity in config["entities"].values():
        entity["schema"] = None
    return config


def readonly_config() -> dict:
    config = write_config()
    config["entities"]["orders"].pop("write", None)
    return config


async def foreign_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.execute(text(OPENED_ORDERS_DDL))
        await conn.execute(text(ORDER_HISTORY_DDL))
    return engine


async def foreign_rows(engine, sql: str, params: dict | None = None) -> list[dict]:
    async with engine.connect() as conn:
        result = await conn.execute(text(sql), params or {})
        return [dict(row) for row in result.mappings().all()]


async def create_portfolio(client, name: str, cash: float = 1000.0) -> int:
    resp = await client.post(
        "/api/v1/portfolios",
        json={
            "portfolio_name": name,
            "port_type": "Active Trading",
            "available_cash": cash,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["portfolio_id"]


async def mark_mapped(portfolio_id: int, config: dict) -> None:
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
                mapping_config=config,
            )
        )
        await session.commit()


async def unmark_mapped(portfolio_id: int) -> None:
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
            await session.delete(portfolio)
        await session.commit()


async def set_mapping(portfolio_id: int, config: dict) -> None:
    _, Session = get_test_engine()
    async with Session() as session:
        connection = (
            await session.execute(
                select(CustomPortfolioConnection).where(
                    CustomPortfolioConnection.portfolio_id == portfolio_id
                )
            )
        ).scalar_one()
        connection.mapping_config = config
        await session.commit()


@pytest.fixture
async def mapped_engine(async_client, monkeypatch):
    engine = await foreign_engine()

    async def fake_mapped_engine(_connection):
        return engine

    monkeypatch.setattr(
        "app.routers.active_orders.mapped_engine", fake_mapped_engine
    )
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture
async def mapped_portfolio(async_client, mapped_engine):
    portfolio_id = await create_portfolio(async_client, "Mapped writes")
    await mark_mapped(portfolio_id, write_config())
    try:
        yield portfolio_id
    finally:
        await unmark_mapped(portfolio_id)


async def create_mapped_order(client, portfolio_id: int, **overrides) -> dict:
    payload = {
        "portfolio_id": portfolio_id,
        "asset_type": "S50Z26",
        "side": "BUY",
        "qty": 2.0,
        "entry_price": 900.0,
        "tp_price": 950.0,
        "order_ref": "ORD-TEST-1",
        "fee": 1.25,
        "remark": MARKER,
    }
    payload.update(overrides)
    resp = await client.post("/api/v1/orders", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Contract validation
# ---------------------------------------------------------------------------

def test_template_with_write_block_is_valid():
    assert validate_mapping(write_config()) == []


def test_write_block_rejects_bad_identifiers_and_duplicates():
    config = write_config()
    write = config["entities"]["orders"]["write"]
    write["columns"]["remark"] = "remark; DROP TABLE x"
    write["columns"]["fee"] = "volume"
    errors = validate_mapping(config)
    assert any("write.columns.remark" in error for error in errors)
    assert any("same column" in error for error in errors)


def test_write_block_rejects_generated_key_column():
    config = write_config()
    write = config["entities"]["orders"]["write"]
    write["columns"]["order_id"] = "id"
    errors = validate_mapping(config)
    assert any("generated key column" in error for error in errors)


def test_readonly_config_reports_no_capabilities():
    from app.custom_mapping import mapped_orders_write_capabilities

    assert mapped_orders_write_capabilities(readonly_config()) is None
    caps = mapped_orders_write_capabilities(write_config())
    assert caps == {
        "insert": True,
        "update": True,
        "delete": True,
        "fields": sorted(
            [
                "asset_type",
                "order_ref",
                "side",
                "qty",
                "entry_price",
                "tp_price",
                "fee",
                "remark",
            ]
        ),
        "key_generated": True,
    }


# ---------------------------------------------------------------------------
# Insert / update / close / cancel
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_insert_returns_generated_key_and_writes_row(
    async_client, mapped_engine, mapped_portfolio
):
    body = await create_mapped_order(async_client, mapped_portfolio)

    assert body["order_id"]
    assert body["order_ref"] == "ORD-TEST-1"
    assert body["portfolio_id"] == mapped_portfolio
    assert body["plan_id"] is None
    assert body["side"] == "LONG"
    assert body["fee"] == 1.25

    rows = await foreign_rows(
        mapped_engine, "SELECT * FROM opened_orders WHERE id = :id", {"id": body["order_id"]}
    )
    assert len(rows) == 1
    row = rows[0]
    assert row["symbol"] == "S50Z26"
    assert row["orderno"] == "ORD-TEST-1"
    assert row["side"] == "LONG"
    assert row["position"] == "OPEN"
    assert row["status"] == "M"
    assert row["volume"] == 2.0
    assert row["price"] == 900.0
    assert row["tp"] == 950.0
    assert row["remark"] == MARKER


@pytest.mark.asyncio
async def test_update_changes_mapped_row(
    async_client, mapped_engine, mapped_portfolio
):
    created = await create_mapped_order(async_client, mapped_portfolio)

    resp = await async_client.put(
        f"/api/v1/orders/{created['order_id']}?portfolio_id={mapped_portfolio}",
        json={"entry_price": 901.5, "remark": "updated note"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["entry_price"] == 901.5
    assert body["remark"] == "updated note"

    rows = await foreign_rows(
        mapped_engine,
        "SELECT price, remark FROM opened_orders WHERE id = :id",
        {"id": created["order_id"]},
    )
    assert rows[0]["price"] == 901.5
    assert rows[0]["remark"] == "updated note"


@pytest.mark.asyncio
async def test_close_moves_row_to_history(
    async_client, mapped_engine, mapped_portfolio
):
    created = await create_mapped_order(async_client, mapped_portfolio)

    resp = await async_client.post(
        f"/api/v1/orders/{created['order_id']}/close"
        f"?portfolio_id={mapped_portfolio}",
        json={"exit_price": 910.0, "realized_pl": 20.0},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body == {
        "order_id": created["order_id"],
        "order_status": "CLOSE",
        "history_id": None,
    }

    open_rows = await foreign_rows(
        mapped_engine,
        "SELECT id FROM opened_orders WHERE id = :id",
        {"id": created["order_id"]},
    )
    assert open_rows == []

    history = await foreign_rows(
        mapped_engine,
        "SELECT * FROM order_history WHERE orderno = :orderno",
        {"orderno": "ORD-TEST-1"},
    )
    assert len(history) == 1
    row = history[0]
    assert row["symbol"] == "S50Z26"
    assert row["side"] == "LONG"
    assert row["position"] == "OPEN"
    assert row["status"] == "M"
    assert row["c_status"] == "M"
    assert row["c_price"] == 910.0
    assert row["pl"] == 20.0


@pytest.mark.asyncio
async def test_cancel_moves_row_to_history_with_cx(
    async_client, mapped_engine, mapped_portfolio
):
    created = await create_mapped_order(
        async_client, mapped_portfolio, order_ref="ORD-TEST-2"
    )

    resp = await async_client.patch(
        f"/api/v1/orders/{created['order_id']}/status"
        f"?portfolio_id={mapped_portfolio}",
        json={"new_status": "CANCELED"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["order_status"] == "CANCELED"

    history = await foreign_rows(
        mapped_engine,
        "SELECT c_status FROM order_history WHERE orderno = :orderno",
        {"orderno": "ORD-TEST-2"},
    )
    assert [row["c_status"] for row in history] == ["CX"]
    open_rows = await foreign_rows(
        mapped_engine,
        "SELECT id FROM opened_orders WHERE id = :id",
        {"id": created["order_id"]},
    )
    assert open_rows == []


@pytest.mark.asyncio
async def test_get_returns_mapped_order_with_ref(
    async_client, mapped_engine, mapped_portfolio
):
    created = await create_mapped_order(async_client, mapped_portfolio)
    resp = await async_client.get(
        f"/api/v1/orders/{created['order_id']}?portfolio_id={mapped_portfolio}"
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["order_id"] == created["order_id"]
    assert resp.json()["order_ref"] == "ORD-TEST-1"


# ---------------------------------------------------------------------------
# Refusals
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_readonly_config_rejects_insert(
    async_client, mapped_engine, mapped_portfolio
):
    await set_mapping(mapped_portfolio, readonly_config())
    resp = await async_client.post(
        "/api/v1/orders",
        json={
            "portfolio_id": mapped_portfolio,
            "asset_type": "S50Z26",
            "side": "BUY",
            "qty": 1.0,
            "entry_price": 900.0,
        },
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == READ_ONLY_DETAIL


@pytest.mark.asyncio
async def test_unwritable_update_field_is_a_400(
    async_client, mapped_engine, mapped_portfolio
):
    created = await create_mapped_order(async_client, mapped_portfolio)
    resp = await async_client.put(
        f"/api/v1/orders/{created['order_id']}?portfolio_id={mapped_portfolio}",
        json={"leverage": 5.0},
    )
    assert resp.status_code == 400
    assert "leverage" in resp.json()["detail"]
