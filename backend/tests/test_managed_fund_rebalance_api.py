"""Managed-fund neutral allocation: underlying groups, rebalance, alerts.

The allocation unit is the registry underlying (``asset_products.ticker``),
never the broker: holdings of the same underlying from different brokers form
one group. Neutral mode gives every group ``100 / N`` percent of NAV — cash plus
holdings market value — and splits the global profit threshold to ``global / N``
per group.
"""

import itertools
import os
import sys
from decimal import Decimal

import pytest
from sqlalchemy import delete

sys.path.insert(0, os.path.dirname(__file__))
from conftest import get_test_engine  # noqa: E402

from app.models import (  # noqa: E402
    AssetProduct,
    AssetQuote,
    AssetSymbol,
    Broker,
    Portfolio,
)
from app.managed_fund_models import (  # noqa: E402
    ManagedFundHolding,
    ManagedFundSetting,
)

_SEQ = itertools.count(1)


class _Fund:
    def __init__(self, portfolio_id, broker_ids, product_ids, symbol_ids, quote_keys):
        self.portfolio_id = portfolio_id
        self.broker_ids = broker_ids
        self.product_ids = product_ids
        self.symbol_ids = symbol_ids
        self.quote_keys = quote_keys


async def seed_neutral_fund(
    *,
    products,
    holdings,
    quotes=(),
    global_profit_threshold=0.0,
    target_ratio=None,
    portfolio_broker_index=0,
    current_nav=None,
    available_cash=0,
):
    """Seed one managed fund.

    ``products`` items: ``(underlying, price_symbol, sync_symbol, source)``.
    Each product gets its own broker so two products can share one underlying
    across brokers; the portfolio binds to the first broker.
    ``holdings`` items: ``(asset, qty, current_price, unrealized_pl_pct)``.
    ``quotes`` items: ``(source, sync_symbol, price)``.
    """
    _, Session = get_test_engine()
    broker_ids = []
    product_ids = []
    symbol_ids = []
    async with Session() as session:
        brokers = []
        for _ in products:
            broker = Broker(code=f"MFRB{next(_SEQ)}", name="MF rebalance broker", currency="THB")
            session.add(broker)
            brokers.append(broker)
        await session.flush()
        broker_ids = [broker.id for broker in brokers]

        portfolio = Portfolio(
            portfolio_name="Neutral fund",
            port_type="Managed Fund",
            risk_status="Safe",
            broker_id=broker_ids[portfolio_broker_index] if broker_ids else None,
            x_amount=Decimal("0"),
            available_cash=Decimal(str(available_cash)),
            current_nav=None if current_nav is None else Decimal(str(current_nav)),
            margin_locked=Decimal("0"),
        )
        session.add(portfolio)
        await session.flush()

        for index, (underlying, price_symbol, sync_symbol, source) in enumerate(products):
            broker = brokers[index]
            product = AssetProduct(
                ticker=underlying,
                broker_id=broker.id,
                asset_type="mutual_fund",
                multiplier=Decimal("1"),
                margin_rate=Decimal("0"),
                source=source,
                margin_mode="notional",
            )
            session.add(product)
            await session.flush()
            symbol = AssetSymbol(
                product_id=product.product_id,
                broker_id=broker.id,
                price_symbol=price_symbol,
                sync_symbol=sync_symbol,
                contract_kind="stock",
            )
            session.add(symbol)
            await session.flush()
            product_ids.append(product.product_id)
            symbol_ids.append(symbol.symbol_id)

        for asset, qty, current_price, pl_pct in holdings:
            session.add(
                ManagedFundHolding(
                    portfolio_id=portfolio.portfolio_id,
                    asset=asset,
                    qty=Decimal(str(qty)),
                    avg_entry_price=Decimal(str(current_price)),
                    current_price=Decimal(str(current_price)),
                    market_value=Decimal(str(qty)) * Decimal(str(current_price)),
                    unrealized_pl=Decimal("0"),
                    unrealized_pl_pct=Decimal(str(pl_pct)),
                    profit_threshold=Decimal("0"),
                )
            )

        session.add(
            ManagedFundSetting(
                portfolio_id=portfolio.portfolio_id,
                allocation_mode="neutral",
                global_profit_threshold=Decimal(str(global_profit_threshold)),
                target_ratio=target_ratio,
            )
        )

        quote_keys = []
        for source, sync_symbol, price in quotes:
            session.add(
                AssetQuote(
                    source=source,
                    sync_symbol=sync_symbol,
                    price=Decimal(str(price)),
                    change_24h=Decimal("0"),
                )
            )
            quote_keys.append((source, sync_symbol))

        await session.commit()
        return _Fund(
            portfolio.portfolio_id, broker_ids, product_ids, symbol_ids, quote_keys
        )


async def drop_fund(fund: _Fund) -> None:
    _, Session = get_test_engine()
    async with Session() as session:
        await session.execute(
            delete(ManagedFundHolding).where(
                ManagedFundHolding.portfolio_id == fund.portfolio_id
            )
        )
        await session.execute(
            delete(ManagedFundSetting).where(
                ManagedFundSetting.portfolio_id == fund.portfolio_id
            )
        )
        await session.execute(
            delete(Portfolio).where(Portfolio.portfolio_id == fund.portfolio_id)
        )
        for source, sync_symbol in fund.quote_keys:
            await session.execute(
                delete(AssetQuote).where(
                    AssetQuote.source == source,
                    AssetQuote.sync_symbol == sync_symbol,
                )
            )
        if fund.symbol_ids:
            await session.execute(
                delete(AssetSymbol).where(AssetSymbol.symbol_id.in_(fund.symbol_ids))
            )
        if fund.product_ids:
            await session.execute(
                delete(AssetProduct).where(
                    AssetProduct.product_id.in_(fund.product_ids)
                )
            )
        if fund.broker_ids:
            await session.execute(delete(Broker).where(Broker.id.in_(fund.broker_ids)))
        await session.commit()


def live_fund_kwargs():
    """The live portfolio-2 shape: S&P500 (two brokers) vs CHA.

    NAV 4230.00 = holdings 1970 (520 + 550 + 900) + cash 2260.
    """
    return dict(
        products=[
            ("S&P500", "VOO", "VOO", "yfinance"),
            ("S&P500", "ABC", "ABC", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[
            ("VOO", 20, 26, 30),
            ("ABC", 22, 25, 25),
            ("SCBCHAE", 50, 18, 0),
        ],
        quotes=[
            ("yfinance", "VOO", 26),
            ("yfinance", "ABC", 25),
            ("yfinance", "SCBCHAE", 18),
        ],
        global_profit_threshold=50,
        target_ratio={"VOO": 0, "ABC": 0},
        current_nav=4230,
        available_cash=2260,
    )


@pytest.mark.asyncio
async def test_neutral_rebalance_groups_by_underlying(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()

        # Broker is ignored: VOO and ABC (different brokers) are one S&P500
        # group. Shares are measured against NAV (holdings + cash), so the
        # 2260 of idle cash dilutes both groups below 50%.
        assert data["current_allocations"] == {"S&P500": 25.3, "CHA": 21.28}
        assert data["target_allocations"] == {"S&P500": 50.0, "CHA": 50.0}
        # 24.7045 + 28.7234 (unrounded group drifts).
        assert data["total_drift"] == 53.43

        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        assert set(recs) == {"VOO", "ABC", "SCBCHAE"}

        # Each group buys up to NAV x 50%: 1045.00 for S&P500, 1215.00 for
        # CHA — 2260.00 in total, exactly the available cash.
        voo = recs["VOO"]
        assert voo["underlying"] == "S&P500"
        assert voo["side"] == "Buy"
        assert voo["estimated_price"] == 26
        assert voo["qty"] == pytest.approx(19.53271028, abs=1e-8)
        assert voo["current_allocation"] == 25.3
        assert voo["target_allocation"] == 50.0
        assert voo["drift"] == 24.7

        abc = recs["ABC"]
        assert abc["underlying"] == "S&P500"
        assert abc["side"] == "Buy"
        assert abc["estimated_price"] == 25
        assert abc["qty"] == pytest.approx(21.48598131, abs=1e-8)

        cha = recs["SCBCHAE"]
        assert cha["underlying"] == "CHA"
        assert cha["side"] == "Buy"
        assert cha["estimated_price"] == 18
        assert cha["qty"] == pytest.approx(67.5, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_rebalance_base_is_nav_not_holdings_value(async_client):
    # Holdings 300 (200 + 100), but NAV is 1000 with 700 of cash. Shares are
    # measured against the 1000 NAV: 20% / 10%, so each group buys up to 500.
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "VOO", "VOO", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[("VOO", 10, 20, 0), ("SCBCHAE", 10, 10, 0)],
        quotes=[("yfinance", "VOO", 20), ("yfinance", "SCBCHAE", 10)],
        current_nav=1000,
        available_cash=700,
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["current_nav"] == 1000
        assert data["current_allocations"] == {"S&P500": 20.0, "CHA": 10.0}
        assert data["target_allocations"] == {"S&P500": 50.0, "CHA": 50.0}
        assert data["total_drift"] == 70.0

        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        # 300.00 / 20 = 15, 400.00 / 10 = 40 — funded by the 700 cash.
        assert recs["VOO"]["side"] == "Buy"
        assert recs["VOO"]["qty"] == pytest.approx(15.0, abs=1e-8)
        assert recs["SCBCHAE"]["side"] == "Buy"
        assert recs["SCBCHAE"]["qty"] == pytest.approx(40.0, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_zero_nav_falls_back_to_holdings_plus_cash(async_client):
    # NAV unset (0) -> base = holdings 1970 + cash 1030 = 3000.
    kwargs = live_fund_kwargs()
    kwargs["current_nav"] = 0
    kwargs["available_cash"] = 1030
    fund = await seed_neutral_fund(**kwargs)
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["current_nav"] == 3000
        assert data["current_allocations"] == {"S&P500": 35.67, "CHA": 30.0}
        assert data["target_allocations"] == {"S&P500": 50.0, "CHA": 50.0}
        assert data["total_drift"] == 34.33

        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        assert recs["VOO"]["qty"] == pytest.approx(8.03738318, abs=1e-8)
        assert recs["ABC"]["qty"] == pytest.approx(8.84112150, abs=1e-8)
        assert recs["SCBCHAE"]["qty"] == pytest.approx(33.33333333, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_unregistered_holding_joins_unassigned_group(async_client):
    kwargs = live_fund_kwargs()
    kwargs["holdings"] = kwargs["holdings"] + [("NEWX", 10, 10, 0)]
    fund = await seed_neutral_fund(**kwargs)
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert set(data["current_allocations"]) == {"S&P500", "CHA", "Unassigned"}
        assert data["target_allocations"]["Unassigned"] == 33.33
        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        assert recs["NEWX"]["underlying"] == "Unassigned"
        assert recs["NEWX"]["side"] == "Buy"
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_zero_holdings_returns_empty_not_400(async_client):
    fund = await seed_neutral_fund(
        products=[], holdings=[], global_profit_threshold=50
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["recommendations"] == []
        assert data["target_allocations"] == {}
        assert data["current_allocations"] == {}
        assert data["total_drift"] == 0
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_drift_below_half_percent_is_ignored(async_client):
    # Two groups, equal market value: zero drift, no recommendations.
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "VOO", "VOO", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[("VOO", 10, 20, 0), ("SCBCHAE", 20, 10, 0)],
        quotes=[("yfinance", "VOO", 20), ("yfinance", "SCBCHAE", 10)],
        global_profit_threshold=50,
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["current_allocations"] == {"S&P500": 50.0, "CHA": 50.0}
        assert data["recommendations"] == []
        assert data["total_drift"] == 0
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_missing_registry_quote_falls_back_to_holding_price(async_client):
    kwargs = live_fund_kwargs()
    # SCBCHAE has no registry quote; its stored current price (18) sizes the buy.
    kwargs["quotes"] = [("yfinance", "VOO", 26), ("yfinance", "ABC", 25)]
    fund = await seed_neutral_fund(**kwargs)
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        recs = {rec["symbol"]: rec for rec in resp.json()["recommendations"]}
        assert recs["SCBCHAE"]["estimated_price"] == 18
        assert recs["SCBCHAE"]["qty"] == pytest.approx(67.5, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_alerts_split_global_threshold_across_groups(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    try:
        resp = await async_client.get(
            f"/api/v1/managed-funds/{fund.portfolio_id}/alerts"
        )
        assert resp.status_code == 200, resp.text
        alerts = {alert["asset"]: alert for alert in resp.json()["alerts"]}

        # global 50 / 2 groups = 25 per group.
        assert set(alerts) == {"VOO", "ABC"}
        assert alerts["VOO"]["threshold"] == 25
        assert alerts["VOO"]["unrealized_pl_pct"] == 30
        assert alerts["ABC"]["threshold"] == 25
        assert "SCBCHAE" not in alerts
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_settings_expose_and_validate_allocation_mode(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    try:
        resp = await async_client.get(
            f"/api/v1/managed-funds/{fund.portfolio_id}/settings"
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["allocation_mode"] == "neutral"

        accepted = await async_client.put(
            f"/api/v1/managed-funds/{fund.portfolio_id}/settings",
            json={"allocation_mode": "neutral"},
        )
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["allocation_mode"] == "neutral"

        rejected = await async_client.put(
            f"/api/v1/managed-funds/{fund.portfolio_id}/settings",
            json={"allocation_mode": "target_percent"},
        )
        assert rejected.status_code == 400
        assert rejected.json()["detail"] == "Unsupported allocation mode"
    finally:
        await drop_fund(fund)
