"""Per-symbol contract specs for order creation and risk.

A portfolio may hold several futures symbols: the order-create guard only
requires a broker-scoped ``asset_symbols.price_symbol`` spec for the order's own
symbol, and the risk model resolves multiplier/margin_rate per order symbol.
"""

import os
import sys
from decimal import Decimal

import pytest
from sqlalchemy import delete, select

sys.path.insert(0, os.path.dirname(__file__))
from conftest import get_test_engine  # noqa: E402

from app.models import (  # noqa: E402
    ActiveOrder,
    AssetProduct,
    AssetSymbol,
    Broker,
    Portfolio,
    TradePlan,
)
from app.risk_calc import compute_margin_locked, compute_risk  # noqa: E402


def order_payload(portfolio_id: int, symbol: str) -> dict:
    return {
        "portfolio_id": portfolio_id,
        "asset_type": symbol,
        "side": "Buy",
        "qty": 2,
        "entry_price": 100.0,
        "current_price": 110.0,
        "contract_type": "futures",
    }


async def seed_portfolio(
    name: str,
    broker_code: str,
    product: str = "AAA",
    specs: dict[str, tuple[Decimal, Decimal]] | None = None,
) -> tuple[int, int]:
    """Create a broker, a product-configured portfolio and its contract specs."""
    _, Session = get_test_engine()
    async with Session() as session:
        broker = Broker(code=broker_code, name=f"Broker {broker_code}")
        session.add(broker)
        await session.flush()
        portfolio = Portfolio(
            portfolio_name=name,
            port_type="Active Trading",
            risk_status="Safe",
            broker_id=broker.id,
            product_ticker=product,
            product_tickers=[product],
            x_amount=Decimal("50"),
            available_cash=Decimal("10000"),
            margin_locked=Decimal("999"),
        )
        session.add(portfolio)
        await session.flush()
        for ticker, (multiplier, margin_rate) in (specs or {}).items():
            product_row = AssetProduct(
                ticker=ticker,
                broker_id=broker.id,
                asset_type="future",
                multiplier=multiplier,
                margin_rate=margin_rate,
                source="-",
                margin_mode="notional",
            )
            session.add(product_row)
            await session.flush()
            session.add(
                AssetSymbol(
                    product_id=product_row.product_id,
                    broker_id=broker.id,
                    price_symbol=ticker,
                    sync_symbol=ticker,
                    contract_kind="future",
                )
            )
        await session.commit()
        return portfolio.portfolio_id, broker.id


async def cleanup_portfolio(portfolio_id: int, broker_id: int) -> None:
    _, Session = get_test_engine()
    async with Session() as session:
        await session.execute(
            delete(AssetSymbol).where(AssetSymbol.broker_id == broker_id)
        )
        await session.execute(
            delete(AssetProduct).where(AssetProduct.broker_id == broker_id)
        )
        await session.execute(
            delete(ActiveOrder).where(ActiveOrder.portfolio_id == portfolio_id)
        )
        await session.execute(
            delete(TradePlan).where(TradePlan.portfolio_id == portfolio_id)
        )
        await session.execute(
            delete(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
        )
        await session.execute(delete(Broker).where(Broker.id == broker_id))
        await session.commit()


@pytest.mark.asyncio
async def test_order_for_second_symbol_with_spec_is_accepted(async_client):
    portfolio_id, broker_id = await seed_portfolio(
        "Per-symbol accept",
        "PSA",
        product="AAA",
        specs={
            "AAA": (Decimal("1"), Decimal("0.1")),
            "BBB": (Decimal("10"), Decimal("0.2")),
        },
    )
    try:
        resp = await async_client.post(
            "/api/v1/orders/", json=order_payload(portfolio_id, "BBB")
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["asset_type"] == "BBB"
    finally:
        await cleanup_portfolio(portfolio_id, broker_id)


@pytest.mark.asyncio
async def test_order_symbol_without_spec_returns_400(async_client):
    portfolio_id, broker_id = await seed_portfolio(
        "Per-symbol reject",
        "PSR",
        product="AAA",
        specs={"AAA": (Decimal("1"), Decimal("0.1"))},
    )
    try:
        resp = await async_client.post(
            "/api/v1/orders/", json=order_payload(portfolio_id, "CCC")
        )
        assert resp.status_code == 400, resp.text
        assert (
            resp.json()["detail"]
            == "No contract spec for CCC on broker PSR — add it in All-assets first"
        )
    finally:
        await cleanup_portfolio(portfolio_id, broker_id)


async def seed_orders(portfolio_id: int) -> None:
    _, Session = get_test_engine()
    async with Session() as session:
        plan = TradePlan(portfolio_id=portfolio_id)
        session.add(plan)
        await session.flush()
        session.add_all(
            [
                ActiveOrder(
                    plan_id=plan.plan_id,
                    portfolio_id=portfolio_id,
                    asset_type="BBB",
                    side="Buy",
                    qty=Decimal("2"),
                    entry_price=Decimal("100"),
                    current_price=Decimal("110"),
                    contract_type="futures",
                ),
                ActiveOrder(
                    plan_id=plan.plan_id,
                    portfolio_id=portfolio_id,
                    asset_type="AAA",
                    side="Buy",
                    qty=Decimal("1"),
                    entry_price=Decimal("90"),
                    current_price=Decimal("95"),
                    contract_type="futures",
                ),
            ]
        )
        await session.commit()


@pytest.mark.asyncio
async def test_margin_locked_uses_per_symbol_multiplier():
    portfolio_id, broker_id = await seed_portfolio(
        "Per-symbol margin",
        "PSM",
        product="AAA",
        specs={
            "AAA": (Decimal("1"), Decimal("0.1")),
            "BBB": (Decimal("10"), Decimal("0.2")),
        },
    )
    try:
        await seed_orders(portfolio_id)
        _, Session = get_test_engine()
        async with Session() as session:
            portfolio = await session.get(Portfolio, portfolio_id)
            margin = await compute_margin_locked(session, portfolio)

        # BBB: 110 * 10 * 2 * 0.2 = 440; AAA: 95 * 1 * 1 * 0.1 = 9.5.
        assert margin == pytest.approx(449.5)
    finally:
        await cleanup_portfolio(portfolio_id, broker_id)


@pytest.mark.asyncio
async def test_risk_uses_per_symbol_multiplier():
    portfolio_id, broker_id = await seed_portfolio(
        "Per-symbol risk",
        "PSK",
        product="AAA",
        specs={
            "AAA": (Decimal("1"), Decimal("0.1")),
            "BBB": (Decimal("10"), Decimal("0.2")),
        },
    )
    try:
        await seed_orders(portfolio_id)
        _, Session = get_test_engine()
        async with Session() as session:
            portfolio = await session.get(Portfolio, portfolio_id)
            orders = (
                await session.execute(
                    select(ActiveOrder).where(
                        ActiveOrder.portfolio_id == portfolio_id
                    )
                )
            ).scalars().all()
            risk = await compute_risk(session, portfolio, orders)

        # BBB uses multiplier 10, AAA uses the product multiplier 1.
        assert risk["eq"]["orders"] == 2
        assert risk["eq"]["lots"] == 3.0
        assert risk["eq"]["size0"] == pytest.approx(2200.0 + 95.0)
        assert risk["eq"]["size_at_x_mark"] == pytest.approx(1200.0 + 45.0)
        assert risk["eq"]["size_at_x_entry"] == pytest.approx(1000.0 + 40.0)
        assert risk["eq"]["pl"] == pytest.approx(200.0 + 5.0)
        # Top-level values come only from the first product_tickers entry.
        assert risk["multiplier"] == 1.0
        assert risk["margin_rate"] == 0.1
        assert risk["margin_locked"] == pytest.approx(449.5)
    finally:
        await cleanup_portfolio(portfolio_id, broker_id)
