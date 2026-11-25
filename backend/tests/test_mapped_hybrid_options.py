"""Hybrid mapped-portfolio options: local dashboard rows + connected DB rows.

A mapped Custom Portfolio keeps bot non-option orders in the connected
database while manual option orders live in dashboard PostgreSQL. These tests
use the in-memory foreign engine seam from the mapped write tests plus direct
main-DB seeds, so no network access is involved.
"""

import os
import sys
from datetime import datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import delete, select, text
from sqlalchemy.exc import DataError, OperationalError, StatementError
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.dirname(__file__))
from conftest import get_test_engine  # noqa: E402
from test_mapped_order_writes import (  # noqa: E402
    ORDER_HISTORY_DDL,
    OPENED_ORDERS_DDL,
    write_config,
)

import app.routers.active_orders as active_orders_router  # noqa: E402
import app.routers.analytics as analytics_router  # noqa: E402
import app.routers.performance as performance_router  # noqa: E402
import app.routers.trade_history as trade_history_router  # noqa: E402
from app.models import (  # noqa: E402
    ActiveOrder,
    CustomPortfolioConnection,
    Portfolio,
    TradeHistory,
    TradePlan,
)
from app.services.hybrid_portfolio import (  # noqa: E402
    merge_history_rows,
    merge_order_rows,
    mapped_history_row,
    normalise_contract_type,
)
from app.mapping_templates import get_template  # noqa: E402

SOURCE_REQUIRED = (
    "Order source is required for a mapped portfolio: dashboard or mapped"
)

ACCOUNT_HISTORY_DDL = """
CREATE TABLE account_history (
    ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    equity REAL,
    excessequity REAL,
    initialmargin REAL
)
"""

OPTION_SYMBOL = "OPTQ26"
OPTION_MULTIPLIER = 100.0
OPTION_MARGIN_RATE = 0.2


# ---------------------------------------------------------------------------
# Seeding helpers
# ---------------------------------------------------------------------------

def mapped_config() -> dict:
    """The template with schema-less tables for the SQLite fixture."""
    config = get_template("tfex-settrade-v1")
    for entity in config["entities"].values():
        entity["schema"] = None
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
        await conn.execute(text(ACCOUNT_HISTORY_DDL))
    return engine


async def foreign_rows(engine, sql: str, params: dict | None = None) -> list[dict]:
    async with engine.connect() as conn:
        result = await conn.execute(text(sql), params or {})
        return [dict(row) for row in result.mappings().all()]


async def seed_foreign_order(
    engine,
    order_id: str,
    *,
    symbol: str = "FUTQ26",
    side: str = "LONG",
    volume: float = 1.0,
    price: float = 100.0,
    tm: str = "2024-01-01T00:00:00",
) -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO opened_orders "
                "(id, tm, symbol, orderno, position, side, volume, price, status) "
                "VALUES (:id, :tm, :symbol, :orderno, 'OPEN', :side, :volume, :price, 'M')"
            ),
            {
                "id": order_id,
                "tm": tm,
                "symbol": symbol,
                "orderno": f"REF-{order_id}",
                "side": side,
                "volume": volume,
                "price": price,
            },
        )


async def seed_foreign_history(
    engine,
    *,
    history_id: int | None,
    symbol: str,
    side: str,
    volume: float,
    price: float,
    pl: float,
    c_tm: str,
    tm: str = "2024-01-01T00:00:00",
) -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO order_history "
                "(id, c_tm, symbol, orderno, position, side, volume, price, "
                "status, pl, c_status) "
                "VALUES (:id, :c_tm, :symbol, :orderno, 'OPEN', :side, :volume, "
                ":price, 'M', :pl, 'M')"
            ),
            {
                "id": history_id,
                "c_tm": c_tm,
                "symbol": symbol,
                "orderno": f"REF-{symbol}-{c_tm}",
                "side": side,
                "volume": volume,
                "price": price,
                "pl": pl,
            },
        )


async def seed_foreign_account(
    engine, *, margin_locked: float, available_cash: float, equity: float
) -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO account_history (ts, equity, excessequity, initialmargin) "
                "VALUES (CURRENT_TIMESTAMP, :equity, :cash, :margin)"
            ),
            {"equity": equity, "cash": available_cash, "margin": margin_locked},
        )


def _dt(value):
    """ISO string -> datetime for SQLAlchemy DateTime columns."""
    if value is None or isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


async def seed_main_order(
    portfolio_id: int,
    order_id: str,
    *,
    contract_type: str = "future",
    asset_type: str = "BTC",
) -> None:
    """Directly insert a main active row (bypasses the mapped create routing)."""
    _, Session = get_test_engine()
    async with Session() as session:
        plan = TradePlan(portfolio_id=portfolio_id)
        session.add(plan)
        await session.flush()
        session.add(
            ActiveOrder(
                order_id=order_id,
                plan_id=plan.plan_id,
                portfolio_id=portfolio_id,
                asset_type=asset_type,
                side="BUY",
                qty=1.0,
                entry_price=100.0,
                order_status="open",
                contract_type=contract_type,
            )
        )
        await session.commit()


async def seed_local_history(portfolio_id: int, **overrides) -> int:
    _, Session = get_test_engine()
    async with Session() as session:
        history = TradeHistory(
            portfolio_id=portfolio_id,
            type=overrides.pop("type", "Sell"),
            asset=overrides.pop("asset", "BTC"),
            amount=overrides.pop("amount", 1.0),
            entry_price=overrides.pop("entry_price", 100.0),
            exit_price=overrides.pop("exit_price", 110.0),
            realized_pl=overrides.pop("realized_pl", 10.0),
            executed_by=overrides.pop("executed_by", "Manual"),
            entry_date=_dt(overrides.pop("entry_date", None)),
            exit_date=_dt(overrides.pop("exit_date", None)),
            **overrides,
        )
        session.add(history)
        await session.commit()
        await session.refresh(history)
        return history.history_id


async def create_portfolio(
    client, name: str, broker_id: int | None = None, cash: float = 5000.0
) -> int:
    payload = {
        "portfolio_name": name,
        "port_type": "Active Trading",
        "available_cash": cash,
    }
    if broker_id is not None:
        payload["broker_id"] = broker_id
    resp = await client.post("/api/v1/portfolios", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()["portfolio_id"]


async def mark_mapped(portfolio_id: int, config: dict | None = None) -> None:
    _, Session = get_test_engine()
    async with Session() as session:
        portfolio = await session.get(Portfolio, portfolio_id)
        assert portfolio is not None
        portfolio.is_custom = True
        portfolio.port_type = "Custom Portfolio"
        session.add(
            CustomPortfolioConnection(
                portfolio_id=portfolio_id,
                db_host="foreign.invalid",
                db_port=5432,
                db_name="foreign",
                db_user="reader",
                encrypted_password="unused",
                mapping_config=config or mapped_config(),
            )
        )
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


async def cleanup_portfolio(portfolio_id: int) -> None:
    _, Session = get_test_engine()
    async with Session() as session:
        await session.execute(
            delete(ActiveOrder).where(ActiveOrder.portfolio_id == portfolio_id)
        )
        await session.execute(
            delete(TradeHistory).where(TradeHistory.portfolio_id == portfolio_id)
        )
        await session.execute(
            delete(TradePlan).where(TradePlan.portfolio_id == portfolio_id)
        )
        await session.execute(
            delete(CustomPortfolioConnection).where(
                CustomPortfolioConnection.portfolio_id == portfolio_id
            )
        )
        await session.execute(
            delete(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
        )
        await session.commit()


async def create_broker_contract(client) -> dict:
    suffix = uuid4().hex[:6].upper()
    broker_resp = await client.post(
        "/api/v1/brokers", json={"code": f"HB{suffix}", "name": "Hybrid Broker"}
    )
    assert broker_resp.status_code == 201, broker_resp.text
    broker_id = broker_resp.json()["id"]
    product_resp = await client.post(
        "/api/v1/assets/products",
        json={
            "ticker": f"OPT{suffix}",
            "broker_id": broker_id,
            "asset_type": "option",
            "multiplier": OPTION_MULTIPLIER,
            "margin_rate": OPTION_MARGIN_RATE,
            "margin_mode": "notional",
        },
    )
    assert product_resp.status_code == 201, product_resp.text
    product_id = product_resp.json()["product_id"]
    symbol_resp = await client.post(
        f"/api/v1/assets/products/{product_id}/symbols",
        json={
            "price_symbol": OPTION_SYMBOL,
            "sync_symbol": OPTION_SYMBOL,
            "contract_kind": "option",
            "option_type": "Call",
        },
    )
    assert symbol_resp.status_code == 201, symbol_resp.text
    return {"broker_id": broker_id, "product_id": product_id}


def patch_engine(monkeypatch, engine) -> None:
    async def fake(*_args, **_kwargs):
        return engine

    monkeypatch.setattr(active_orders_router, "mapped_engine", fake)
    monkeypatch.setattr(analytics_router, "get_or_create_custom_engine", fake)
    monkeypatch.setattr(trade_history_router, "get_or_create_custom_engine", fake)
    monkeypatch.setattr(performance_router, "mapped_engine", fake)


def refuse_engine(monkeypatch) -> None:
    async def refuse(*_args, **_kwargs):
        raise ConnectionRefusedError(111, "Connect call failed ('foreign.invalid')")

    monkeypatch.setattr(active_orders_router, "mapped_engine", refuse)
    monkeypatch.setattr(analytics_router, "get_or_create_custom_engine", refuse)
    monkeypatch.setattr(trade_history_router, "get_or_create_custom_engine", refuse)
    monkeypatch.setattr(performance_router, "mapped_engine", refuse)


def _looks_like_uuid(value) -> bool:
    try:
        UUID(str(value))
        return True
    except (TypeError, ValueError, AttributeError):
        return False


def _invalid_uuid_data_error(key) -> DataError:
    """The driver error asyncpg raises for a non-UUID value in a UUID column."""
    return DataError(
        "SELECT id FROM opened_orders WHERE id = :key",
        {"key": key},
        Exception(
            f"invalid input for query argument $1: '{key}' "
            f"(expected UUID, got '{key}')"
        ),
    )


async def guard_uuid_key_failures(monkeypatch) -> None:
    """Make the mapped single-row helpers fail like a foreign UUID key column."""
    real_fetch = active_orders_router.fetch_mapped_order
    real_update = active_orders_router.update_mapped_order
    real_move = active_orders_router.move_mapped_order_to_history

    async def fetch(engine, config, key):
        if not _looks_like_uuid(key):
            raise _invalid_uuid_data_error(key)
        return await real_fetch(engine, config, key)

    async def update(engine, config, key, changes):
        if not _looks_like_uuid(key):
            raise _invalid_uuid_data_error(key)
        return await real_update(engine, config, key, changes)

    async def move(engine, config, key, **kwargs):
        if not _looks_like_uuid(key):
            raise _invalid_uuid_data_error(key)
        return await real_move(engine, config, key, **kwargs)

    monkeypatch.setattr(active_orders_router, "fetch_mapped_order", fetch)
    monkeypatch.setattr(active_orders_router, "update_mapped_order", update)
    monkeypatch.setattr(active_orders_router, "move_mapped_order_to_history", move)


@pytest.fixture
async def hybrid(async_client, monkeypatch):
    engine = await foreign_engine()
    contract = await create_broker_contract(async_client)
    portfolio_id = await create_portfolio(
        async_client, "Hybrid Options", broker_id=contract["broker_id"]
    )
    await mark_mapped(portfolio_id)
    patch_engine(monkeypatch, engine)
    state = SimpleNamespace(
        engine=engine,
        portfolio_id=portfolio_id,
        broker_id=contract["broker_id"],
        product_id=contract["product_id"],
    )
    try:
        yield state
    finally:
        await cleanup_portfolio(portfolio_id)
        await engine.dispose()


async def create_option_order(client, portfolio_id: int, **overrides) -> dict:
    payload = {
        "portfolio_id": portfolio_id,
        "asset_type": OPTION_SYMBOL,
        "side": "SHORT",
        "qty": 2.0,
        "entry_price": 5.0,
        "current_price": 6.0,
        "contract_type": "option",
        "option_type": "call",
        "strike_price": 100.0,
        "expiry_date": "2026-03-31T00:00:00",
    }
    payload.update(overrides)
    resp = await client.post("/api/v1/orders", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Merge helpers (pure)
# ---------------------------------------------------------------------------

def row(order_id: str, source: str, created_at: str | None) -> dict:
    return {
        "order_id": order_id,
        "order_source": source,
        "created_at": created_at,
    }


def test_merge_order_rows_orders_created_desc_then_source_then_id():
    rows = merge_order_rows(
        [
            row("b", "dashboard", "2024-01-02T00:00:00"),
            row("a", "dashboard", None),
            row("d", "dashboard", "2024-01-02T00:00:00"),
        ],
        [
            row("c", "mapped", "2024-01-03T00:00:00"),
            row("e", "mapped", "2024-01-02T00:00:00"),
            row("f", "mapped", None),
        ],
    )
    assert [item["order_id"] for item in rows] == ["c", "b", "d", "e", "a", "f"]
    assert [item["order_source"] for item in rows] == [
        "mapped",
        "dashboard",
        "dashboard",
        "mapped",
        "dashboard",
        "mapped",
    ]


def test_merge_history_rows_tie_breaks_and_fingerprint_ordinals():
    def mapped(**overrides):
        data = {
            "history_id": None,
            "type": "Sell",
            "asset": "OPTQ26",
            "amount": 2.0,
            "entry_price": 5.0,
            "exit_price": 6.0,
            "realized_pl": 100.0,
            "order_id": "X1",
            "entry_date": "2024-01-01T00:00:00",
            "exit_date": "2024-01-03T00:00:00",
        }
        data.update(overrides)
        return mapped_history_row(data, 8, "Hybrid")

    local = {
        "history_id": 5,
        "type": "Sell",
        "asset": "BTC",
        "amount": 1.0,
        "entry_price": 1.0,
        "exit_price": 2.0,
        "realized_pl": 3.0,
        "order_id": "L1",
        "entry_date": "2024-01-01T00:00:00",
        "exit_date": "2024-01-03T00:00:00",
        "history_source": "dashboard",
        "_raw_history_id": 5,
    }
    first = merge_history_rows([dict(local)], [mapped(), mapped()])
    assert [item["history_source"] for item in first] == [
        "dashboard",
        "mapped",
        "mapped",
    ]
    keys = [item["history_key"] for item in first]
    assert keys[0] == "5"
    assert keys[1] != keys[2]
    assert keys[1].startswith("mapped:") and keys[1].endswith("#0")
    assert keys[2].endswith("#1")

    second = merge_history_rows([dict(local)], [mapped(), mapped()])
    assert [item["history_key"] for item in second] == keys


def test_mapped_history_key_uses_supplied_zero_id():
    row = mapped_history_row(
        {
            "history_id": 0,
            "type": "Sell",
            "asset": "OPTQ26",
            "amount": 1.0,
            "entry_price": 5.0,
            "exit_price": 6.0,
            "realized_pl": 100.0,
            "order_id": "Z1",
            "entry_date": "2024-01-01T00:00:00",
            "exit_date": "2024-01-02T00:00:00",
        },
        8,
        "Hybrid",
    )
    merged = merge_history_rows([], [row])
    assert merged[0]["history_key"] == "0"
    assert merged[0]["history_id"] == 0


def test_contract_type_normalisation_is_lowercase_trim():
    assert normalise_contract_type(" Option ") == "option"
    assert normalise_contract_type(None) == ""
    assert normalise_contract_type("future") != "option"


# ---------------------------------------------------------------------------
# Create routing
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mapped_option_create_is_dashboard_local(
    async_client, hybrid, monkeypatch
):
    body = await create_option_order(async_client, hybrid.portfolio_id)
    assert body["order_source"] == "dashboard"
    assert body["contract_type"] == "option"
    assert body["plan_id"] is not None

    _, Session = get_test_engine()
    async with Session() as session:
        local = (
            await session.execute(
                select(ActiveOrder).where(ActiveOrder.order_id == body["order_id"])
            )
        ).scalar_one()
        assert local.contract_type == "option"
        assert local.portfolio_id == hybrid.portfolio_id

    foreign = await foreign_rows(hybrid.engine, "SELECT id FROM opened_orders")
    assert foreign == []


@pytest.mark.asyncio
async def test_mapped_non_option_create_keeps_the_foreign_writer(
    async_client, hybrid
):
    resp = await async_client.post(
        "/api/v1/orders",
        json={
            "portfolio_id": hybrid.portfolio_id,
            "asset_type": "FUTQ26",
            "side": "BUY",
            "qty": 1.0,
            "entry_price": 900.0,
            "order_ref": "HYBRID-REF-1",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["order_source"] == "mapped"
    assert body["order_ref"] == "HYBRID-REF-1"

    foreign = await foreign_rows(hybrid.engine, "SELECT symbol FROM opened_orders")
    assert [item["symbol"] for item in foreign] == ["FUTQ26"]


@pytest.mark.asyncio
async def test_option_create_ignores_foreign_write_capabilities(
    async_client, hybrid
):
    readonly = mapped_config()
    readonly["entities"]["orders"].pop("write", None)
    await set_mapping(hybrid.portfolio_id, readonly)

    non_option = await async_client.post(
        "/api/v1/orders",
        json={
            "portfolio_id": hybrid.portfolio_id,
            "asset_type": "FUTQ26",
            "side": "BUY",
            "qty": 1.0,
            "entry_price": 900.0,
        },
    )
    assert non_option.status_code == 409

    body = await create_option_order(async_client, hybrid.portfolio_id)
    assert body["order_source"] == "dashboard"


# ---------------------------------------------------------------------------
# Strict broker/spec guard
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mapped_option_requires_broker_and_broker_scoped_spec(
    async_client, monkeypatch
):
    engine = await foreign_engine()
    patch_engine(monkeypatch, engine)
    portfolio_id = await create_portfolio(async_client, "Hybrid guard")
    await mark_mapped(portfolio_id)
    try:
        no_broker = await async_client.post(
            "/api/v1/orders",
            json={
                "portfolio_id": portfolio_id,
                "asset_type": OPTION_SYMBOL,
                "side": "BUY",
                "qty": 1.0,
                "entry_price": 5.0,
                "contract_type": "option",
            },
        )
        assert no_broker.status_code == 400
        assert no_broker.json()["detail"] == (
            "Assign a broker in Edit portfolio before adding orders"
        )

        contract = await create_broker_contract(async_client)
        _, Session = get_test_engine()
        async with Session() as session:
            portfolio = await session.get(Portfolio, portfolio_id)
            portfolio.broker_id = contract["broker_id"]
            await session.commit()

        missing_spec = await async_client.post(
            "/api/v1/orders",
            json={
                "portfolio_id": portfolio_id,
                "asset_type": "NOSPEC",
                "side": "BUY",
                "qty": 1.0,
                "entry_price": 5.0,
                "contract_type": "option",
            },
        )
        assert missing_spec.status_code == 400
        assert "No contract spec for NOSPEC on broker" in missing_spec.json()["detail"]

        created = await async_client.post(
            "/api/v1/orders",
            json={
                "portfolio_id": portfolio_id,
                "asset_type": OPTION_SYMBOL,
                "side": "BUY",
                "qty": 1.0,
                "entry_price": 5.0,
                "contract_type": "option",
            },
        )
        assert created.status_code == 201, created.text
        assert created.json()["order_source"] == "dashboard"
    finally:
        await cleanup_portfolio(portfolio_id)
        await engine.dispose()


# ---------------------------------------------------------------------------
# Dual-source reads and source identity
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mapped_order_list_unions_both_sources(async_client, hybrid):
    await seed_foreign_order(hybrid.engine, "MAPPED-1", tm="2024-01-01T00:00:00")
    local = await create_option_order(async_client, hybrid.portfolio_id)

    resp = await async_client.get(
        f"/api/v1/orders?portfolio_id={hybrid.portfolio_id}"
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert [item["order_source"] for item in rows] == ["dashboard", "mapped"]
    assert [item["order_id"] for item in rows] == [local["order_id"], "MAPPED-1"]


@pytest.mark.asyncio
async def test_local_non_option_rows_are_never_exposed(async_client, hybrid):
    await seed_foreign_order(hybrid.engine, "MAPPED-ONLY", tm="2024-01-01T00:00:00")
    await seed_foreign_account(
        hybrid.engine, margin_locked=0.0, available_cash=1000.0, equity=1000.0
    )
    await seed_main_order(
        hybrid.portfolio_id, "LOCAL-FUTURE", contract_type="future"
    )

    listed = await async_client.get(
        f"/api/v1/orders?portfolio_id={hybrid.portfolio_id}"
    )
    assert listed.status_code == 200, listed.text
    assert [item["order_id"] for item in listed.json()] == ["MAPPED-ONLY"]

    analytics = await async_client.get(
        f"/api/v1/analytics/portfolio/{hybrid.portfolio_id}"
    )
    assert analytics.status_code == 200, analytics.text
    assert [
        item["order_id"] for item in analytics.json()["active_orders"]
    ] == ["MAPPED-ONLY"]


@pytest.mark.asyncio
async def test_same_id_rows_are_isolated_by_order_source(async_client, hybrid):
    await seed_foreign_order(
        hybrid.engine, "COLLIDE1", symbol="FUTQ26", price=100.0
    )
    local = await create_option_order(
        async_client, hybrid.portfolio_id, order_id="COLLIDE1"
    )
    assert local["order_id"] == "COLLIDE1"

    listed = await async_client.get(
        f"/api/v1/orders?portfolio_id={hybrid.portfolio_id}"
    )
    assert listed.status_code == 200, listed.text
    assert [item["order_source"] for item in listed.json()] == [
        "dashboard",
        "mapped",
    ]

    missing_source = await async_client.get(
        f"/api/v1/orders/COLLIDE1?portfolio_id={hybrid.portfolio_id}"
    )
    assert missing_source.status_code == 400
    assert missing_source.json()["detail"] == SOURCE_REQUIRED

    dashboard = await async_client.get(
        f"/api/v1/orders/COLLIDE1?portfolio_id={hybrid.portfolio_id}"
        "&order_source=dashboard"
    )
    assert dashboard.status_code == 200, dashboard.text
    assert dashboard.json()["asset_type"] == OPTION_SYMBOL

    mapped = await async_client.get(
        f"/api/v1/orders/COLLIDE1?portfolio_id={hybrid.portfolio_id}"
        "&order_source=mapped"
    )
    assert mapped.status_code == 200, mapped.text
    assert mapped.json()["asset_type"] == "FUTQ26"

    dashboard_edit = await async_client.put(
        f"/api/v1/orders/COLLIDE1?portfolio_id={hybrid.portfolio_id}"
        "&order_source=dashboard",
        json={"entry_price": 55.0},
    )
    assert dashboard_edit.status_code == 200, dashboard_edit.text
    foreign = await foreign_rows(
        hybrid.engine,
        "SELECT price FROM opened_orders WHERE id = 'COLLIDE1'",
    )
    assert foreign[0]["price"] == 100.0

    mapped_edit = await async_client.put(
        f"/api/v1/orders/COLLIDE1?portfolio_id={hybrid.portfolio_id}"
        "&order_source=mapped",
        json={"entry_price": 101.0},
    )
    assert mapped_edit.status_code == 200, mapped_edit.text
    _, Session = get_test_engine()
    async with Session() as session:
        stored = (
            await session.execute(
                select(ActiveOrder).where(ActiveOrder.order_id == "COLLIDE1")
            )
        ).scalar_one()
        assert float(stored.entry_price) == 55.0

    wrong_store = await async_client.get(
        f"/api/v1/orders/ONLY-MAPPED?portfolio_id={hybrid.portfolio_id}"
        "&order_source=dashboard"
    )
    assert wrong_store.status_code == 404


def test_key_type_errors_classify_as_missing_rows_not_outages():
    assert active_orders_router._is_invalid_store_key(
        _invalid_uuid_data_error("511c799a2e")
    )
    assert active_orders_router._is_invalid_store_key(
        StatementError(
            "invalid UUID", "SELECT 1", {}, Exception("invalid UUID")
        )
    )
    assert not active_orders_router._is_invalid_store_key(
        ConnectionRefusedError(111, "refused")
    )
    assert not active_orders_router._is_invalid_store_key(
        OperationalError(
            "SELECT 1", {}, ConnectionRefusedError(111, "refused")
        )
    )


@pytest.mark.asyncio
async def test_mapped_store_result_maps_key_errors_only():
    async def key_failure():
        raise _invalid_uuid_data_error("511c799a2e")

    with pytest.raises(HTTPException) as info:
        await active_orders_router._mapped_store_result(key_failure())
    assert info.value.status_code == 404
    assert info.value.detail == "Order not found"

    async def outage():
        raise OperationalError(
            "SELECT 1", {}, ConnectionRefusedError(111, "refused")
        )

    with pytest.raises(OperationalError):
        await active_orders_router._mapped_store_result(outage())


@pytest.mark.asyncio
async def test_local_id_on_mapped_source_is_404_not_500(
    async_client, hybrid, monkeypatch
):
    await guard_uuid_key_failures(monkeypatch)
    foreign_uuid = "7d3b1f8e-1f0f-4f0e-9c6d-0b4a6f1e2a11"
    await seed_foreign_order(hybrid.engine, foreign_uuid)
    local = await create_option_order(async_client, hybrid.portfolio_id)
    local_id = local["order_id"]
    assert not _looks_like_uuid(local_id)

    query = f"?portfolio_id={hybrid.portfolio_id}&order_source=mapped"
    path = f"/api/v1/orders/{local_id}"

    responses = [
        await async_client.get(f"{path}{query}"),
        await async_client.put(f"{path}{query}", json={"entry_price": 101.0}),
        await async_client.patch(
            f"{path}/status{query}", json={"new_status": "CANCELED"}
        ),
        await async_client.post(f"{path}/close{query}", json={}),
    ]
    for resp in responses:
        assert resp.status_code == 404, resp.text
        assert resp.json()["detail"] == "Order not found"

    # The failed mapped-source operations never touched either store.
    still_local = await async_client.get(
        f"{path}?portfolio_id={hybrid.portfolio_id}&order_source=dashboard"
    )
    assert still_local.status_code == 200, still_local.text
    foreign_open = await foreign_rows(
        hybrid.engine, "SELECT id FROM opened_orders WHERE id = :id", {"id": foreign_uuid}
    )
    assert [row["id"] for row in foreign_open] == [foreign_uuid]

    # A real foreign UUID still works through the same route.
    valid = await async_client.get(
        f"/api/v1/orders/{foreign_uuid}{query}"
    )
    assert valid.status_code == 200, valid.text
    assert valid.json()["order_id"] == foreign_uuid


@pytest.mark.asyncio
async def test_dashboard_close_and_cancel_write_only_main_history(
    async_client, hybrid
):
    await seed_foreign_order(hybrid.engine, "MAPPED-KEEP")
    closed = await create_option_order(
        async_client, hybrid.portfolio_id, order_id="LOCAL-CLOSE"
    )

    close_resp = await async_client.post(
        f"/api/v1/orders/{closed['order_id']}/close"
        f"?portfolio_id={hybrid.portfolio_id}&order_source=dashboard",
        json={"exit_price": 7.0, "realized_pl": 400.0},
    )
    assert close_resp.status_code == 200, close_resp.text
    assert close_resp.json()["order_status"] == "CLOSE"

    _, Session = get_test_engine()
    async with Session() as session:
        assert (
            await session.execute(
                select(ActiveOrder).where(
                    ActiveOrder.order_id == closed["order_id"]
                )
            )
        ).scalar_one_or_none() is None
        history = (
            await session.execute(
                select(TradeHistory).where(
                    TradeHistory.order_id == closed["order_id"]
                )
            )
        ).scalar_one()
        assert history.portfolio_id == hybrid.portfolio_id

    foreign_open = await foreign_rows(
        hybrid.engine, "SELECT id FROM opened_orders"
    )
    assert [row["id"] for row in foreign_open] == ["MAPPED-KEEP"]
    foreign_history = await foreign_rows(
        hybrid.engine, "SELECT id FROM order_history"
    )
    assert foreign_history == []

    canceled = await create_option_order(
        async_client, hybrid.portfolio_id, order_id="LOCAL-CANCEL"
    )
    cancel_resp = await async_client.patch(
        f"/api/v1/orders/{canceled['order_id']}/status"
        f"?portfolio_id={hybrid.portfolio_id}&order_source=dashboard",
        json={"new_status": "CANCELED"},
    )
    assert cancel_resp.status_code == 200, cancel_resp.text
    assert cancel_resp.json()["order_status"] == "CANCELED"

    async with Session() as session:
        assert (
            await session.execute(
                select(ActiveOrder).where(
                    ActiveOrder.order_id == canceled["order_id"]
                )
            )
        ).scalar_one_or_none() is None
        canceled_history = (
            await session.execute(
                select(TradeHistory).where(
                    TradeHistory.order_id == canceled["order_id"]
                )
            )
        ).scalar_one()
        assert canceled_history.remark == {"note": "Canceled"}


# ---------------------------------------------------------------------------
# History union / pagination
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_trade_history_merges_sources_before_pagination(
    async_client, hybrid
):
    await seed_foreign_history(
        hybrid.engine,
        history_id=101,
        symbol="FUTQ26",
        side="LONG",
        volume=1.0,
        price=100.0,
        pl=3.0,
        c_tm="2024-03-01T00:00:00",
    )
    await seed_foreign_history(
        hybrid.engine,
        history_id=102,
        symbol="FUTQ26",
        side="LONG",
        volume=1.0,
        price=100.0,
        pl=4.0,
        c_tm="2024-02-01T00:00:00",
    )
    await seed_local_history(
        hybrid.portfolio_id,
        asset="OPTQ26",
        realized_pl=1.0,
        exit_date="2024-03-01T00:00:00",
    )
    await seed_local_history(
        hybrid.portfolio_id,
        asset="OPTQ26",
        realized_pl=2.0,
        exit_date="2024-01-01T00:00:00",
    )

    resp = await async_client.get(
        f"/api/v1/trade-history?portfolio_id={hybrid.portfolio_id}"
        "&offset=1&limit=2"
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    # 2024-03-01 dashboard, 2024-03-01 mapped, 2024-02-01 mapped, 2024-01-01
    assert [row["history_source"] for row in rows] == ["mapped", "mapped"]
    assert [row["history_id"] for row in rows] == [101, 102]
    assert all(row["history_key"] == str(row["history_id"]) for row in rows)

    full = await async_client.get(
        f"/api/v1/trade-history?portfolio_id={hybrid.portfolio_id}"
    )
    assert full.status_code == 200, full.text
    assert [row["history_source"] for row in full.json()] == [
        "dashboard",
        "mapped",
        "mapped",
        "dashboard",
    ]
    keys = [(row["history_source"], row["history_key"]) for row in full.json()]
    assert len(set(keys)) == len(keys)


@pytest.mark.asyncio
async def test_mapped_history_without_id_gets_unique_fingerprint_keys(
    async_client, hybrid
):
    config = mapped_config()
    config["entities"]["history"]["columns"].pop("history_id", None)
    await set_mapping(hybrid.portfolio_id, config)

    for _ in range(2):
        await seed_foreign_history(
            hybrid.engine,
            history_id=None,
            symbol="FUTQ26",
            side="LONG",
            volume=1.0,
            price=100.0,
            pl=5.0,
            c_tm="2024-02-01T00:00:00",
            tm="2024-01-01T00:00:00",
        )

    resp = await async_client.get(
        f"/api/v1/trade-history?portfolio_id={hybrid.portfolio_id}"
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert len(rows) == 2
    keys = [row["history_key"] for row in rows]
    assert keys[0] != keys[1]
    assert keys[0].startswith("mapped:") and keys[0].endswith("#0")
    assert keys[1].endswith("#1")
    assert [row["history_id"] for row in rows] == [0, 0]


# ---------------------------------------------------------------------------
# Analytics: union, capabilities, margin and risk
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mapped_analytics_unions_orders_and_margin_once(
    async_client, hybrid
):
    await seed_foreign_order(
        hybrid.engine, "MAPPED-AN", symbol="FUTQ26", price=100.0
    )
    await seed_foreign_account(
        hybrid.engine, margin_locked=1000.0, available_cash=5000.0, equity=6000.0
    )
    local = await create_option_order(async_client, hybrid.portfolio_id)

    resp = await async_client.get(
        f"/api/v1/analytics/portfolio/{hybrid.portfolio_id}"
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["available_cash"] == 5000.0
    # Foreign account margin + local option margin, computed once:
    # 6.0 mark x 100 multiplier x 2 qty x 0.2 rate = 240.
    assert data["margin_locked"] == 1240.0

    sources = {
        (item["order_source"], item["order_id"]) for item in data["active_orders"]
    }
    assert ("dashboard", local["order_id"]) in sources
    assert ("mapped", "MAPPED-AN") in sources

    risk = data["risk"]
    assert risk["margin_locked"] == 1240.0
    assert risk["available_cash"] == 5000.0
    assert risk["eq"]["orders"] == 1
    assert risk["options"]["buckets"]["short_call"]["orders"] == 1
    assert risk["options"]["buckets"]["short_call"]["lots"] == 2.0
    assert risk["options"]["buckets"]["short_call"]["pl"] == -200.0
    assert risk["pl_total"] == -200.0

    assert data["order_writes"]["mapped"] == {
        "insert": True,
        "update": True,
        "delete": True,
        "fields": [
            "asset_type",
            "entry_price",
            "fee",
            "order_ref",
            "qty",
            "remark",
            "side",
            "tp_price",
        ],
        "key_generated": True,
    }
    assert data["order_writes"]["dashboard_options"] == {
        "insert": True,
        "update": True,
        "delete": True,
    }


@pytest.mark.asyncio
async def test_mapped_recent_trades_use_the_same_union(async_client, hybrid):
    await seed_foreign_history(
        hybrid.engine,
        history_id=201,
        symbol="FUTQ26",
        side="LONG",
        volume=1.0,
        price=100.0,
        pl=20.0,
        c_tm="2024-02-01T00:00:00",
    )
    await seed_foreign_account(
        hybrid.engine, margin_locked=0.0, available_cash=1000.0, equity=1000.0
    )
    await seed_local_history(
        hybrid.portfolio_id,
        asset="OPTQ26",
        realized_pl=5.0,
        exit_date="2024-03-01T00:00:00",
    )

    resp = await async_client.get(
        f"/api/v1/analytics/portfolio/{hybrid.portfolio_id}"
    )
    assert resp.status_code == 200, resp.text
    recent = resp.json()["recent_trades"]
    assert [item["history_source"] for item in recent] == [
        "dashboard",
        "mapped",
    ]
    assert all(item["history_key"] for item in recent)


# ---------------------------------------------------------------------------
# Performance union and degradation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mapped_performance_aggregates_the_union(async_client, hybrid):
    await seed_local_history(
        hybrid.portfolio_id,
        asset="OPTQ26",
        realized_pl=10.0,
        exit_date="2024-01-01T00:00:00",
    )
    await seed_foreign_history(
        hybrid.engine,
        history_id=301,
        symbol="FUTQ26",
        side="LONG",
        volume=1.0,
        price=100.0,
        pl=20.0,
        c_tm="2024-02-01T00:00:00",
    )

    resp = await async_client.get(
        f"/api/v1/analytics/performance/{hybrid.portfolio_id}"
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total_pl"] == 30.0
    assert [point["cumulative_pl"] for point in data["equity_curve"]] == [
        0.0,
        10.0,
        30.0,
    ]


@pytest.mark.asyncio
async def test_mapped_performance_falls_back_to_local_rows(
    async_client, hybrid, monkeypatch
):
    await seed_local_history(
        hybrid.portfolio_id,
        asset="OPTQ26",
        realized_pl=10.0,
        exit_date="2024-01-01T00:00:00",
    )
    refuse_engine(monkeypatch)

    resp = await async_client.get(
        f"/api/v1/analytics/performance/{hybrid.portfolio_id}"
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total_pl"] == 10.0


@pytest.mark.asyncio
async def test_degraded_mapped_reads_keep_local_rows_and_capabilities(
    async_client, hybrid, monkeypatch
):
    local = await create_option_order(async_client, hybrid.portfolio_id)
    await seed_local_history(
        hybrid.portfolio_id,
        asset="OPTQ26",
        realized_pl=7.0,
        exit_date="2024-01-05T00:00:00",
    )
    await seed_foreign_order(hybrid.engine, "HIDDEN-WHILE-DOWN")
    refuse_engine(monkeypatch)

    analytics = await async_client.get(
        f"/api/v1/analytics/portfolio/{hybrid.portfolio_id}"
    )
    assert analytics.status_code == 200, analytics.text
    data = analytics.json()
    assert "Mapped database unreachable" in data["load_error"]
    assert [item["order_id"] for item in data["active_orders"]] == [
        local["order_id"]
    ]
    assert data["active_orders"][0]["order_source"] == "dashboard"
    assert [item["history_source"] for item in data["recent_trades"]] == [
        "dashboard"
    ]
    assert data["recent_trades"][0]["history_key"]
    assert data["order_writes"] == {
        "mapped": None,
        "dashboard_options": {"insert": True, "update": True, "delete": True},
    }
    assert data["risk"] is None

    listing = await async_client.get(
        f"/api/v1/orders?portfolio_id={hybrid.portfolio_id}"
    )
    assert listing.status_code == 200, listing.text
    assert [item["order_source"] for item in listing.json()] == ["dashboard"]

    history = await async_client.get(
        f"/api/v1/trade-history?portfolio_id={hybrid.portfolio_id}"
    )
    assert history.status_code == 200, history.text
    assert [row["history_source"] for row in history.json()] == ["dashboard"]

    performance = await async_client.get(
        f"/api/v1/analytics/performance/{hybrid.portfolio_id}"
    )
    assert performance.status_code == 200, performance.text
    assert performance.json()["total_pl"] == 7.0
