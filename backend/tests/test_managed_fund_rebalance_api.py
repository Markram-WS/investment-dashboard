"""Managed-fund two-mode allocation: underlying groups and rebalance.

The allocation unit is the registry underlying (``asset_products.ticker``),
never the broker: holdings of the same underlying from different brokers form
one group. Neutral mode gives every group ``100 / N`` percent of the live
allocation base — holdings market value plus available cash plus the optional
calculation-only cash top-up. Weight mode gives every group its stored
label-keyed target percentage instead, and the stored weights must sum to 100.
"""

import itertools
import os
import sys
from decimal import Decimal

import pytest
from sqlalchemy import delete, func, select

sys.path.insert(0, os.path.dirname(__file__))
from conftest import get_test_engine  # noqa: E402

from app.models import (  # noqa: E402
    AssetProduct,
    AssetQuote,
    AssetSymbol,
    Broker,
    Portfolio,
    PortfolioNavHistory,
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
    allocation_mode="neutral",
    target_ratio=None,
    portfolio_broker_index=0,
    current_nav=None,
    available_cash=0,
):
    """Seed one managed fund.

    ``products`` items: ``(underlying, price_symbol, sync_symbol, source)``.
    Each product gets its own broker so two products can share one underlying
    across brokers; the portfolio binds to the first broker.
    ``holdings`` items: ``(asset, qty, current_price, unrealized_pl_pct)`` or
    ``(asset, qty, current_price, unrealized_pl_pct, rebalance_weight)``.
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

        for holding in holdings:
            asset, qty, current_price, pl_pct = holding[:4]
            weight = holding[4] if len(holding) > 4 else None
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
                    rebalance_weight=(
                        None if weight is None else Decimal(str(weight))
                    ),
                )
            )

        session.add(
            ManagedFundSetting(
                portfolio_id=portfolio.portfolio_id,
                allocation_mode=allocation_mode,
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
        current_nav=4230,
        available_cash=2260,
    )


def _net_estimated_value(data):
    """Signed sum of recommendation values: buys minus sells."""
    return sum(
        rec["estimated_value"] if rec["side"] == "Buy" else -rec["estimated_value"]
        for rec in data["recommendations"]
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
        # group. Shares are measured against live NAV (holdings + cash), so the
        # 2260 of idle cash dilutes both groups below 50%.
        assert data["current_nav"] == 4230
        assert data["allocation_base"] == 4230
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
        assert voo["estimated_value"] == pytest.approx(507.85046729, abs=1e-8)
        assert voo["qty"] == pytest.approx(19.53271028, abs=1e-8)
        assert voo["current_allocation"] == 25.3
        assert voo["target_allocation"] == 50.0
        assert voo["drift"] == 24.7

        abc = recs["ABC"]
        assert abc["underlying"] == "S&P500"
        assert abc["side"] == "Buy"
        assert abc["estimated_price"] == 25
        assert abc["estimated_value"] == pytest.approx(537.14953271, abs=1e-8)
        assert abc["qty"] == pytest.approx(21.48598131, abs=1e-8)

        cha = recs["SCBCHAE"]
        assert cha["underlying"] == "CHA"
        assert cha["side"] == "Buy"
        assert cha["estimated_price"] == 18
        assert cha["estimated_value"] == pytest.approx(1215.0, abs=1e-8)
        assert cha["qty"] == pytest.approx(67.5, abs=1e-8)

        # Buys net exactly the available cash.
        assert _net_estimated_value(data) == pytest.approx(2260.0, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_base_is_live_holdings_plus_cash_not_stored_nav(async_client):
    # Holdings 300 (200 + 100) and cash 700 make the live base 1000, while the
    # stored NAV is deliberately stale. Shares use the live 1000: 20% / 10%,
    # so each group buys up to 500.
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "VOO", "VOO", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[("VOO", 10, 20, 0), ("SCBCHAE", 10, 10, 0)],
        quotes=[("yfinance", "VOO", 20), ("yfinance", "SCBCHAE", 10)],
        current_nav=9999,
        available_cash=700,
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["current_nav"] == 1000
        assert data["allocation_base"] == 1000
        assert data["current_allocations"] == {"S&P500": 20.0, "CHA": 10.0}
        assert data["target_allocations"] == {"S&P500": 50.0, "CHA": 50.0}
        assert data["total_drift"] == 70.0

        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        # 300.00 / 20 = 15, 400.00 / 10 = 40 — funded by the 700 cash.
        assert recs["VOO"]["side"] == "Buy"
        assert recs["VOO"]["estimated_value"] == pytest.approx(300.0, abs=1e-8)
        assert recs["VOO"]["qty"] == pytest.approx(15.0, abs=1e-8)
        assert recs["SCBCHAE"]["side"] == "Buy"
        assert recs["SCBCHAE"]["estimated_value"] == pytest.approx(400.0, abs=1e-8)
        assert recs["SCBCHAE"]["qty"] == pytest.approx(40.0, abs=1e-8)
        assert _net_estimated_value(data) == pytest.approx(700.0, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_live_base_ignores_zero_stored_nav(async_client):
    # Stored NAV 0 -> base is still live holdings 1970 + cash 1030 = 3000.
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
        assert data["allocation_base"] == 3000
        assert data["current_allocations"] == {"S&P500": 35.67, "CHA": 30.0}
        assert data["target_allocations"] == {"S&P500": 50.0, "CHA": 50.0}
        assert data["total_drift"] == 34.33

        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        assert recs["VOO"]["qty"] == pytest.approx(8.03738318, abs=1e-8)
        assert recs["ABC"]["qty"] == pytest.approx(8.84112150, abs=1e-8)
        assert recs["SCBCHAE"]["qty"] == pytest.approx(33.33333333, abs=1e-8)
        assert _net_estimated_value(data) == pytest.approx(1030.0, abs=1e-8)
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
        # The unregistered holding participates in the live base.
        assert data["allocation_base"] == 4330
        assert data["current_nav"] == 4330
        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        assert recs["NEWX"]["underlying"] == "Unassigned"
        assert recs["NEWX"]["side"] == "Buy"
        assert _net_estimated_value(data) == pytest.approx(2260.0, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_nonzero_cash_without_groups_is_422(async_client):
    fund = await seed_neutral_fund(
        products=[], holdings=[], available_cash=100
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["detail"] == "No underlying groups to allocate cash to"
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_zero_holdings_returns_empty_not_400(async_client):
    fund = await seed_neutral_fund(
        products=[], holdings=[]
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["recommendations"] == []
        assert data["groups"] == []
        assert data["target_allocations"] == {}
        assert data["current_allocations"] == {}
        assert data["current_nav"] == 0
        assert data["allocation_base"] == 0
        assert data["total_drift"] == 0
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_exactly_balanced_groups_return_no_orders(async_client):
    # Two groups, equal market value: zero drift, no recommendations.
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "VOO", "VOO", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[("VOO", 10, 20, 0), ("SCBCHAE", 20, 10, 0)],
        quotes=[("yfinance", "VOO", 20), ("yfinance", "SCBCHAE", 10)],
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
async def test_rebalance_groups_balanced_group_has_zero_order_value(async_client):
    # Equal group values: both groups need no trade and must still appear.
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "VOO", "VOO", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[("VOO", 10, 20, 0), ("SCBCHAE", 20, 10, 0)],
        quotes=[("yfinance", "VOO", 20), ("yfinance", "SCBCHAE", 10)],
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["groups"] == [
            {
                "label": "S&P500",
                "current_value": 200.0,
                "target_value": 200.0,
                "current_pct": 50.0,
                "target_pct": 50.0,
                "drift": 0.0,
                "order_value": 0.0,
            },
            {
                "label": "CHA",
                "current_value": 200.0,
                "target_value": 200.0,
                "current_pct": 50.0,
                "target_pct": 50.0,
                "drift": 0.0,
                "order_value": 0.0,
            },
        ]
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_rebalance_groups_values_and_drift_match_allocation(async_client):
    # Live base 1000 (holdings 300 + cash 700); equal targets of 500.
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "VOO", "VOO", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[("VOO", 10, 20, 0), ("SCBCHAE", 10, 10, 0)],
        quotes=[("yfinance", "VOO", 20), ("yfinance", "SCBCHAE", 10)],
        available_cash=700,
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        base = data["allocation_base"]
        assert base == 1000
        groups = {row["label"]: row for row in data["groups"]}
        assert list(groups) == ["S&P500", "CHA"]

        sp = groups["S&P500"]
        assert sp["current_value"] == 200.0
        assert sp["target_value"] == 500.0
        assert sp["current_value"] == pytest.approx(base * sp["current_pct"] / 100)
        assert sp["target_value"] == pytest.approx(base * sp["target_pct"] / 100)
        assert sp["current_pct"] == 20.0
        assert sp["target_pct"] == 50.0
        assert sp["drift"] == 30.0
        assert sp["order_value"] == 300.0

        cha = groups["CHA"]
        assert cha["current_value"] == 100.0
        assert cha["target_value"] == 500.0
        assert cha["current_value"] == pytest.approx(base * cha["current_pct"] / 100)
        assert cha["target_value"] == pytest.approx(base * cha["target_pct"] / 100)
        assert cha["current_pct"] == 10.0
        assert cha["target_pct"] == 50.0
        assert cha["drift"] == 40.0
        assert cha["order_value"] == 400.0
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_rebalance_group_order_values_conserve_cash_neutral(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate",
            json={"cash_top_up": 1000},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        groups = {row["label"]: row for row in data["groups"]}
        assert list(groups) == ["S&P500", "CHA"]
        # Live base 5230 with equal 50% targets of 2615: groups buy 1545 and
        # 1715, which conserves cash 2260 plus the 1000 top-up.
        assert groups["S&P500"]["current_value"] == 1070.0
        assert groups["S&P500"]["target_value"] == 2615.0
        assert groups["S&P500"]["order_value"] == pytest.approx(1545.0, abs=1e-8)
        assert groups["CHA"]["current_value"] == 900.0
        assert groups["CHA"]["target_value"] == 2615.0
        assert groups["CHA"]["order_value"] == pytest.approx(1715.0, abs=1e-8)
        assert sum(row["order_value"] for row in data["groups"]) == pytest.approx(
            2260.0 + 1000.0, abs=1e-8
        )
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_rebalance_group_order_values_conserve_cash_weighted(async_client):
    fund = await seed_neutral_fund(
        **weight_fund_kwargs({"S&P500": 60, "CHA": 40})
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        groups = {row["label"]: row for row in data["groups"]}
        # Base 1000: 200/100 current against 600/400 targets.
        assert groups["S&P500"]["current_value"] == 200.0
        assert groups["S&P500"]["target_value"] == 600.0
        assert groups["S&P500"]["current_pct"] == 20.0
        assert groups["S&P500"]["target_pct"] == 60.0
        assert groups["S&P500"]["drift"] == 40.0
        assert groups["S&P500"]["order_value"] == pytest.approx(400.0, abs=1e-8)
        assert groups["CHA"]["current_value"] == 100.0
        assert groups["CHA"]["target_value"] == 400.0
        assert groups["CHA"]["current_pct"] == 10.0
        assert groups["CHA"]["target_pct"] == 40.0
        assert groups["CHA"]["drift"] == 30.0
        assert groups["CHA"]["order_value"] == pytest.approx(300.0, abs=1e-8)
        assert sum(row["order_value"] for row in data["groups"]) == pytest.approx(
            700.0, abs=1e-8
        )
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_rebalance_groups_follow_first_seen_order(async_client):
    fund = await seed_neutral_fund(
        products=[
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
            ("S&P500", "VOO", "VOO", "yfinance"),
            ("gold", "SCBGOLDE", "SCBGOLDE", "yfinance"),
        ],
        holdings=[
            ("SCBCHAE", 10, 10, 0),
            ("VOO", 10, 10, 0),
            ("SCBGOLDE", 10, 10, 0),
        ],
        quotes=[
            ("yfinance", "SCBCHAE", 10),
            ("yfinance", "VOO", 10),
            ("yfinance", "SCBGOLDE", 10),
        ],
        available_cash=700,
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        labels = [row["label"] for row in data["groups"]]
        assert labels == ["CHA", "S&P500", "gold"]
        assert labels == list(data["current_allocations"])
        assert labels == list(data["target_allocations"])
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_small_nonzero_drift_emits_orders(async_client):
    # A sub-0.5-percentage-point drift used to be suppressed; conservation now
    # requires every nonzero group delta to produce an order.
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "VOO", "VOO", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[("VOO", 10, 10, 0), ("SCBCHAE", 101, 1, 0)],
        quotes=[("yfinance", "VOO", 10), ("yfinance", "SCBCHAE", 1)],
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["allocation_base"] == 201
        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        assert set(recs) == {"VOO", "SCBCHAE"}
        assert recs["VOO"]["side"] == "Buy"
        assert recs["VOO"]["estimated_value"] == pytest.approx(0.5, abs=1e-8)
        assert recs["SCBCHAE"]["side"] == "Sell"
        assert recs["SCBCHAE"]["estimated_value"] == pytest.approx(0.5, abs=1e-8)
        assert _net_estimated_value(data) == pytest.approx(0.0, abs=1e-8)
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
        data = resp.json()
        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        assert recs["SCBCHAE"]["estimated_price"] == 18
        assert recs["SCBCHAE"]["estimated_value"] == pytest.approx(1215.0, abs=1e-8)
        assert recs["SCBCHAE"]["qty"] == pytest.approx(67.5, abs=1e-8)
        assert _net_estimated_value(data) == pytest.approx(2260.0, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_alerts_and_threshold_fields_are_removed(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    try:
        alerts = await async_client.get(
            f"/api/v1/managed-funds/{fund.portfolio_id}/alerts"
        )
        assert alerts.status_code == 404, alerts.text

        settings = await async_client.get(
            f"/api/v1/managed-funds/{fund.portfolio_id}/settings"
        )
        assert settings.status_code == 200, settings.text
        assert "global_profit_threshold" not in settings.json()

        holdings = await _holding_map(async_client, fund.portfolio_id)
        for holding in holdings.values():
            assert "profit_threshold" not in holding
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_settings_expose_and_validate_allocation_mode(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    url = f"/api/v1/managed-funds/{fund.portfolio_id}/settings"
    try:
        resp = await async_client.get(url)
        assert resp.status_code == 200, resp.text
        assert resp.json()["allocation_mode"] == "neutral"
        assert "global_profit_threshold" not in resp.json()

        accepted = await async_client.put(url, json={"allocation_mode": "neutral"})
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["allocation_mode"] == "neutral"

        rejected = await async_client.put(
            url, json={"allocation_mode": "target_percent"}
        )
        assert rejected.status_code == 400
        assert rejected.json()["detail"] == "Unsupported allocation mode"

        # Weight mode without stored targets cannot sum to 100.
        no_targets = await async_client.put(url, json={"allocation_mode": "weight"})
        assert no_targets.status_code == 400, no_targets.text
        assert no_targets.json()["detail"] == "Target weights must sum to 100"

        weighted = await async_client.put(
            url,
            json={
                "allocation_mode": "weight",
                "target_ratio": {"S&P500": 60, "CHA": 40},
            },
        )
        assert weighted.status_code == 200, weighted.text
        assert weighted.json()["allocation_mode"] == "weight"
        assert weighted.json()["target_ratio"] == {"S&P500": 60.0, "CHA": 40.0}

        short = await async_client.put(
            url,
            json={
                "allocation_mode": "weight",
                "target_ratio": {"S&P500": 60, "CHA": 30},
            },
        )
        assert short.status_code == 400, short.text
        assert short.json()["detail"] == "Target weights must sum to 100"

        for bad in (
            {"S&P500": 100.0001, "CHA": 0},
            {"S&P500": -0.0001, "CHA": 100.0001},
            {"S&P500": 99.99999, "CHA": 0.00001},
            {"S&P500": "NaN", "CHA": 100},
            {"S&P500": "Infinity", "CHA": 100},
        ):
            invalid = await async_client.put(url, json={"target_ratio": bad})
            assert invalid.status_code == 400, (bad, invalid.text)

        # Neutral mode has no sum requirement.
        neutral_targets = await async_client.put(
            url,
            json={
                "allocation_mode": "neutral",
                "target_ratio": {"S&P500": 60, "CHA": 10},
            },
        )
        assert neutral_targets.status_code == 200, neutral_targets.text
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_put_weight_keeps_omitted_ratio_and_null_clears(async_client):
    fund = await seed_neutral_fund(
        **{**live_fund_kwargs(), "target_ratio": {"S&P500": 50, "CHA": 50}}
    )
    url = f"/api/v1/managed-funds/{fund.portfolio_id}/settings"
    try:
        switched = await async_client.put(url, json={"allocation_mode": "weight"})
        assert switched.status_code == 200, switched.text
        assert switched.json()["target_ratio"] == {"S&P500": 50.0, "CHA": 50.0}

        cleared = await async_client.put(
            url,
            json={"allocation_mode": "neutral", "target_ratio": None},
        )
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()["target_ratio"] is None
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_legacy_symbol_targets_return_group_labels(async_client):
    # Legacy keys are registry price symbols; VOO and ABC both collapse onto
    # the S&P500 group, and GHOST has no registry row so it is dropped.
    fund = await seed_neutral_fund(
        **{
            **live_fund_kwargs(),
            "target_ratio": {
                "VOO": 30,
                "ABC": 20,
                "SCBCHAE": 50,
                "GHOST": 10,
            },
        }
    )
    try:
        resp = await async_client.get(
            f"/api/v1/managed-funds/{fund.portfolio_id}/settings"
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["target_ratio"] == {"S&P500": 50.0, "CHA": 50.0}
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_fractional_legacy_targets_are_scaled_before_mapping(async_client):
    fund = await seed_neutral_fund(
        **{
            **live_fund_kwargs(),
            "target_ratio": {"VOO": 0.3, "ABC": 0.2, "SCBCHAE": 0.5},
        }
    )
    try:
        resp = await async_client.get(
            f"/api/v1/managed-funds/{fund.portfolio_id}/settings"
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["target_ratio"] == {"S&P500": 50.0, "CHA": 50.0}
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_legacy_fractional_symbol_targets_scale_to_percent(async_client):
    # Symbol-keyed fractions are still legacy even when every key resolves:
    # VOO 0.5 and ABC 0.5 scale to 50 + 50 and collapse onto S&P500.
    fund = await seed_neutral_fund(
        **{
            **live_fund_kwargs(),
            "target_ratio": {"VOO": 0.5, "ABC": 0.5},
        }
    )
    try:
        resp = await async_client.get(
            f"/api/v1/managed-funds/{fund.portfolio_id}/settings"
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["target_ratio"] == {"S&P500": 100.0}
    finally:
        await drop_fund(fund)


# ─── Holding rebalance weight: GET / PUT semantics ───

async def _holding_map(async_client, portfolio_id):
    resp = await async_client.get(
        f"/api/v1/managed-funds/{portfolio_id}/holdings"
    )
    assert resp.status_code == 200, resp.text
    return {holding["asset"]: holding for holding in resp.json()}


@pytest.mark.asyncio
async def test_holding_weight_get_set_preserve_and_clear(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    try:
        voo = (await _holding_map(async_client, fund.portfolio_id))["VOO"]
        assert voo["rebalance_weight"] is None
        url = (
            f"/api/v1/managed-funds/{fund.portfolio_id}/holdings/"
            f"{voo['holding_id']}"
        )

        assigned = await async_client.put(url, json={"rebalance_weight": 37.5})
        assert assigned.status_code == 200, assigned.text
        assert assigned.json()["rebalance_weight"] == 37.5
        assert (await _holding_map(async_client, fund.portfolio_id))["VOO"][
            "rebalance_weight"
        ] == 37.5

        # Omitting the field keeps the stored value; qty/price still update.
        preserved = await async_client.put(url, json={"qty": 21})
        assert preserved.status_code == 200, preserved.text
        assert preserved.json()["qty"] == 21
        assert preserved.json()["rebalance_weight"] == 37.5

        # Explicit null clears it.
        cleared = await async_client.put(url, json={"rebalance_weight": None})
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()["rebalance_weight"] is None
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_new_holding_starts_with_null_weight(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    try:
        created = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/holdings",
            json={"asset": "NEWFUND", "side": "Buy", "qty": 5, "price": 7},
        )
        assert created.status_code == 201, created.text
        assert created.json()["rebalance_weight"] is None
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_holding_weight_accepts_zero_and_hundred(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    try:
        voo = (await _holding_map(async_client, fund.portfolio_id))["VOO"]
        url = (
            f"/api/v1/managed-funds/{fund.portfolio_id}/holdings/"
            f"{voo['holding_id']}"
        )
        for value in (0, 100):
            resp = await async_client.put(url, json={"rebalance_weight": value})
            assert resp.status_code == 200, resp.text
            assert resp.json()["rebalance_weight"] == float(value)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_holding_weight_rejects_invalid_values(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    try:
        voo = (await _holding_map(async_client, fund.portfolio_id))["VOO"]
        url = (
            f"/api/v1/managed-funds/{fund.portfolio_id}/holdings/"
            f"{voo['holding_id']}"
        )
        for value in (-0.0001, 100.0001, 0.00001, "NaN", "Infinity"):
            resp = await async_client.put(url, json={"rebalance_weight": value})
            assert resp.status_code == 422, (value, resp.text)
        # Invalid writes never touched the stored (null) value.
        assert (await _holding_map(async_client, fund.portfolio_id))["VOO"][
            "rebalance_weight"
        ] is None
    finally:
        await drop_fund(fund)


# ─── Weighted drift split ───

@pytest.mark.asyncio
async def test_mixed_weights_normalize_within_group(async_client):
    # S&P500 weights 2 / null / 0 -> the first holding takes 100% of the
    # group drift; the null and zero siblings get nothing.
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "AAA", "AAA", "yfinance"),
            ("S&P500", "BBB", "BBB", "yfinance"),
            ("S&P500", "CCC", "CCC", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[
            ("AAA", 10, 10, 0, 2),
            ("BBB", 10, 10, 0, None),
            ("CCC", 10, 10, 0, 0),
            ("SCBCHAE", 10, 10, 0, None),
        ],
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["allocation_base"] == 400
        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        assert set(recs) == {"AAA", "SCBCHAE"}
        # S&P500 is 300 of the 400 base, so its 100 drift is a sell; CHA buys.
        assert recs["AAA"]["side"] == "Sell"
        assert recs["AAA"]["estimated_value"] == pytest.approx(100.0, abs=1e-8)
        assert recs["SCBCHAE"]["side"] == "Buy"
        assert recs["SCBCHAE"]["estimated_value"] == pytest.approx(100.0, abs=1e-8)
        assert _net_estimated_value(data) == pytest.approx(0.0, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_weighted_drift_goes_to_small_holding(async_client):
    # The small holding owns 50 of a 900 group yet receives the group's whole
    # +50 drift because its weight is the only positive one.
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "BIG", "BIG", "yfinance"),
            ("S&P500", "SMALL", "SMALL", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[
            ("BIG", 85, 10, 0, 0),
            ("SMALL", 5, 10, 0, 100),
            ("SCBCHAE", 100, 10, 0, None),
        ],
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        assert set(recs) == {"SMALL", "SCBCHAE"}
        assert recs["SMALL"]["side"] == "Buy"
        assert recs["SMALL"]["estimated_value"] == pytest.approx(50.0, abs=1e-8)
        assert recs["SCBCHAE"]["side"] == "Sell"
        assert recs["SCBCHAE"]["estimated_value"] == pytest.approx(50.0, abs=1e-8)
        assert _net_estimated_value(data) == pytest.approx(0.0, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_impossible_weighted_sell_is_422(async_client):
    # The weighted holding owns only 50 but the group's sell drift is 100.
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "BIG", "BIG", "yfinance"),
            ("S&P500", "SMALL", "SMALL", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[
            ("BIG", 105, 10, 0, 0),
            ("SMALL", 5, 10, 0, 100),
            ("SCBCHAE", 90, 10, 0, None),
        ],
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 422, resp.text
        assert "Refusing to sell" in resp.json()["detail"]
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_unpriced_weighted_buy_is_422(async_client):
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "PRICED", "PRICED", "yfinance"),
            ("S&P500", "UNPRICED", "UNPRICED", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[
            ("PRICED", 90, 10, 0, 0),
            ("UNPRICED", 10, 0, 0, 100),
            ("SCBCHAE", 100, 10, 0, None),
        ],
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 422, resp.text
        assert "No usable price" in resp.json()["detail"]
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_zero_value_group_without_weight_is_422(async_client):
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "VOO", "VOO", "yfinance"),
            ("ZERO", "ZERO", "ZERO", "yfinance"),
        ],
        holdings=[("VOO", 20, 10, 0), ("ZERO", 0, 0, 0)],
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 422, resp.text
        assert "No rebalance recipient for ZERO" in resp.json()["detail"]
    finally:
        await drop_fund(fund)


# ─── Weight-mode allocation ───

def weight_fund_kwargs(target_ratio):
    """Two groups over a live base of 1000: VOO 200, SCBCHAE 100, cash 700."""
    return dict(
        products=[
            ("S&P500", "VOO", "VOO", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[("VOO", 10, 20, 0), ("SCBCHAE", 10, 10, 0)],
        quotes=[("yfinance", "VOO", 20), ("yfinance", "SCBCHAE", 10)],
        allocation_mode="weight",
        target_ratio=target_ratio,
        available_cash=700,
    )


def ab_weight_fund_kwargs(target_ratio):
    """Two label-keyed groups A/B over a live base of 1000."""
    return dict(
        products=[
            ("A", "AAA", "AAA", "yfinance"),
            ("B", "BBB", "BBB", "yfinance"),
        ],
        holdings=[("AAA", 10, 20, 0), ("BBB", 10, 10, 0)],
        quotes=[("yfinance", "AAA", 20), ("yfinance", "BBB", 10)],
        allocation_mode="weight",
        target_ratio=target_ratio,
        available_cash=700,
    )


@pytest.mark.asyncio
async def test_weight_mode_uses_per_group_targets(async_client):
    fund = await seed_neutral_fund(
        **weight_fund_kwargs({"S&P500": 60, "CHA": 40})
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["allocation_base"] == 1000
        assert data["current_allocations"] == {"S&P500": 20.0, "CHA": 10.0}
        assert data["target_allocations"] == {"S&P500": 60.0, "CHA": 40.0}
        # |60 - 20| + |40 - 10|.
        assert data["total_drift"] == 70.0

        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        assert set(recs) == {"VOO", "SCBCHAE"}
        assert recs["VOO"]["side"] == "Buy"
        assert recs["VOO"]["estimated_value"] == pytest.approx(400.0, abs=1e-8)
        assert recs["VOO"]["qty"] == pytest.approx(20.0, abs=1e-8)
        assert recs["VOO"]["target_allocation"] == 60.0
        assert recs["SCBCHAE"]["side"] == "Buy"
        assert recs["SCBCHAE"]["estimated_value"] == pytest.approx(300.0, abs=1e-8)
        assert recs["SCBCHAE"]["qty"] == pytest.approx(30.0, abs=1e-8)
        assert recs["SCBCHAE"]["target_allocation"] == 40.0
        assert "to 60.0%" in recs["VOO"]["reason"]
        assert _net_estimated_value(data) == pytest.approx(700.0, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_weight_mode_splits_group_drift_by_holding_weight(async_client):
    # Both S&P500 holdings belong to one group; the configured weight sends
    # the group's whole buy to SMALL, while CHA falls back to market value.
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "BIG", "BIG", "yfinance"),
            ("S&P500", "SMALL", "SMALL", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
        ],
        holdings=[
            ("BIG", 10, 10, 0, 0),
            ("SMALL", 5, 10, 0, 100),
            ("SCBCHAE", 10, 10, 0),
        ],
        allocation_mode="weight",
        target_ratio={"S&P500": 50, "CHA": 50},
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["allocation_base"] == 250
        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        # S&P500 holds 150 (60% of base) vs a 125 target: sell 25 from SMALL.
        # CHA holds 100 (40%) vs 125: buy 25.
        assert set(recs) == {"SMALL", "SCBCHAE"}
        assert recs["SMALL"]["side"] == "Sell"
        assert recs["SMALL"]["estimated_value"] == pytest.approx(25.0, abs=1e-8)
        assert recs["SCBCHAE"]["side"] == "Buy"
        assert recs["SCBCHAE"]["estimated_value"] == pytest.approx(25.0, abs=1e-8)
        assert _net_estimated_value(data) == pytest.approx(0.0, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_weight_mode_sum_not_100_is_422(async_client):
    fund = await seed_neutral_fund(
        **weight_fund_kwargs({"S&P500": 60, "CHA": 30})
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["detail"] == "Target weights must sum to 100"
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_weight_mode_missing_group_target_is_422(async_client):
    fund = await seed_neutral_fund(**weight_fund_kwargs({"S&P500": 100}))
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["detail"] == "No target weight for CHA"
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_weight_mode_stale_target_key_is_ignored(async_client):
    # Ghost names no current group, so it is dropped before the sum check:
    # the current labels already sum to 100 and only they are allocated.
    fund = await seed_neutral_fund(
        **ab_weight_fund_kwargs({"A": 60, "B": 40, "Ghost": 10})
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["target_allocations"] == {"A": 60.0, "B": 40.0}
        assert "Ghost" not in data["target_allocations"]
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_weight_mode_stale_target_hiding_shortfall_is_422(async_client):
    # Ghost is ignored, so the current labels only sum to 60.
    fund = await seed_neutral_fund(
        **ab_weight_fund_kwargs({"A": 60, "Ghost": 40})
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["detail"] == "Target weights must sum to 100"
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_sub_one_percent_target_is_used_verbatim(async_client):
    # Label-keyed values are already percentages: 0.5 stays 0.5, never 50.
    fund = await seed_neutral_fund(
        **ab_weight_fund_kwargs({"A": 0.5, "B": 99.5})
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["target_allocations"] == {"A": 0.5, "B": 99.5}
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_unassigned_target_round_trips(async_client):
    # "Unassigned" is the group for holdings without a registry identity, so
    # it has no registry row. It is still a valid target key and must survive
    # GET /settings and be enforced by weight-mode calculate.
    fund = await seed_neutral_fund(
        products=[],
        holdings=[("NEWX", 10, 10, 0)],
        allocation_mode="weight",
        target_ratio={"Unassigned": 100},
    )
    try:
        settings = await async_client.get(
            f"/api/v1/managed-funds/{fund.portfolio_id}/settings"
        )
        assert settings.status_code == 200, settings.text
        assert settings.json()["target_ratio"] == {"Unassigned": 100.0}

        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["target_allocations"] == {"Unassigned": 100.0}
        assert data["current_allocations"] == {"Unassigned": 100.0}
        assert data["total_drift"] == 0.0
    finally:
        await drop_fund(fund)


# ─── cash_top_up request handling ───

@pytest.mark.asyncio
async def test_no_body_and_empty_body_mean_zero_top_up(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    url = f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
    try:
        no_body = await async_client.post(url)
        empty_body = await async_client.post(url, json={})
        explicit_zero = await async_client.post(url, json={"cash_top_up": 0})
        for resp in (no_body, empty_body, explicit_zero):
            assert resp.status_code == 200, resp.text
            data = resp.json()
            assert data["current_nav"] == 4230
            assert data["allocation_base"] == 4230
            assert _net_estimated_value(data) == pytest.approx(2260.0, abs=1e-8)
        assert no_body.json()["recommendations"] == empty_body.json()["recommendations"]
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_cash_top_up_extends_base_and_conserves(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate",
            json={"cash_top_up": 1000},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        # current_nav excludes the virtual top-up; allocation_base includes it.
        assert data["current_nav"] == 4230
        assert data["allocation_base"] == 5230
        assert data["current_allocations"] == {"S&P500": 20.46, "CHA": 17.21}
        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        # 2615 target per group: +1545 for S&P500, +1715 for CHA.
        assert recs["VOO"]["estimated_value"] == pytest.approx(1545 * 520 / 1070, abs=1e-8)
        assert recs["ABC"]["estimated_value"] == pytest.approx(1545 * 550 / 1070, abs=1e-8)
        assert recs["SCBCHAE"]["estimated_value"] == pytest.approx(1715.0, abs=1e-8)
        assert _net_estimated_value(data) == pytest.approx(3260.0, abs=1e-8)
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_calculate_is_calculation_only(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate",
            json={"cash_top_up": 1000},
        )
        assert resp.status_code == 200, resp.text

        _, Session = get_test_engine()
        async with Session() as session:
            stored = await session.get(Portfolio, fund.portfolio_id)
            assert stored.available_cash == Decimal("2260")
            assert stored.current_nav == Decimal("4230")
            nav_rows = (
                await session.execute(
                    select(func.count()).select_from(PortfolioNavHistory).where(
                        PortfolioNavHistory.portfolio_id == fund.portfolio_id
                    )
                )
            ).scalar()
            assert nav_rows == 0
    finally:
        await drop_fund(fund)


@pytest.mark.asyncio
async def test_calculate_rejects_invalid_top_up(async_client):
    fund = await seed_neutral_fund(**live_fund_kwargs())
    url = f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate"
    try:
        for payload in (
            {"cash_top_up": -1},
            {"cash_top_up": None},
            {"cash_top_up": True},
            {"cash_top_up": "NaN"},
            {"cash_top_up": "Infinity"},
            {"cash_top_up": "0.000000001"},
        ):
            resp = await async_client.post(url, json=payload)
            assert resp.status_code == 422, (payload, resp.text)
    finally:
        await drop_fund(fund)


# ─── Workbook parity ───

@pytest.mark.asyncio
async def test_workbook_parity_five_recommendations(async_client):
    """ExampleFundAllocationCal.xlsx: five groups, 10,000 top-up.

    Holdings total 385,267.07, so the live base with the top-up is 395,267.07
    and each group's equal target is 79,053.414. The S&P500 group has two
    holdings; the expected recipient carries 100% of its drift and its sibling
    zero. Every other group has one holding and uses the market-value fallback.
    """
    fund = await seed_neutral_fund(
        products=[
            ("S&P500", "SCBS&P500E", "SCBS&P500E", "yfinance"),
            ("S&P500", "SCBS&P500A", "SCBS&P500A", "yfinance"),
            ("CHA", "SCBCHAE", "SCBCHAE", "yfinance"),
            ("SEMI", "SCBSEMI(E)", "SCBSEMI(E)", "yfinance"),
            ("S50", "SCBS50E", "SCBS50E", "yfinance"),
            ("gold", "SCBGOLDE", "SCBGOLDE", "yfinance"),
        ],
        holdings=[
            ("SCBS&P500E", 116.02, 10, 0, 100),
            ("SCBS&P500A", 7542.632, 10, 0, 0),
            ("SCBCHAE", 7178.557, 10, 0),
            ("SCBSEMI(E)", 8692.602, 10, 0),
            ("SCBS50E", 7615.632, 10, 0),
            ("SCBGOLDE", 7381.264, 10, 0),
        ],
        available_cash=0,
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/rebalance/calculate",
            json={"cash_top_up": 10000},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["current_nav"] == pytest.approx(385267.07, abs=1e-8)
        assert data["allocation_base"] == pytest.approx(395267.07, abs=1e-8)
        assert data["target_allocations"] == {
            "S&P500": 20.0,
            "CHA": 20.0,
            "SEMI": 20.0,
            "S50": 20.0,
            "gold": 20.0,
        }

        recs = {rec["symbol"]: rec for rec in data["recommendations"]}
        assert set(recs) == {
            "SCBS&P500E",
            "SCBCHAE",
            "SCBSEMI(E)",
            "SCBS50E",
            "SCBGOLDE",
        }
        expected = {
            "SCBS&P500E": ("Buy", 2466.894),
            "SCBCHAE": ("Buy", 7267.844),
            "SCBSEMI(E)": ("Sell", 7872.606),
            "SCBS50E": ("Buy", 2897.094),
            "SCBGOLDE": ("Buy", 5240.774),
        }
        for symbol, (side, value) in expected.items():
            assert recs[symbol]["side"] == side, symbol
            assert recs[symbol]["estimated_value"] == pytest.approx(
                value, abs=1e-8
            ), symbol
            assert recs[symbol]["estimated_price"] == 10
            assert recs[symbol]["qty"] == pytest.approx(value / 10, abs=1e-8)
        assert _net_estimated_value(data) == pytest.approx(10000.0, abs=1e-8)
    finally:
        await drop_fund(fund)
