"""Managed-fund price sync: registry resolution, provider refresh, reporting."""

import os
import sys
from decimal import Decimal

import pytest
from sqlalchemy import delete, select

sys.path.insert(0, os.path.dirname(__file__))
from conftest import get_test_engine  # noqa: E402

from app.models import (  # noqa: E402
    AssetProduct,
    AssetQuote,
    AssetSymbol,
    Broker,
    Portfolio,
)
from app.managed_fund_models import ManagedFundHolding  # noqa: E402


class _Fund:
    """A seeded managed fund plus a cleanup handle."""

    def __init__(self, portfolio_id, holding_ids, symbol_ids, product_ids, quote_keys):
        self.portfolio_id = portfolio_id
        self.holding_ids = holding_ids
        self.symbol_ids = symbol_ids
        self.product_ids = product_ids
        self.quote_keys = quote_keys


async def make_broker(code: str) -> int:
    _, Session = get_test_engine()
    async with Session() as session:
        broker = Broker(code=code, name=f"Broker {code}", currency="THB")
        session.add(broker)
        await session.commit()
        return broker.id


async def seed_fund(
    *,
    broker_id: int,
    symbols=(),
    holdings=(),
    quotes=(),
):
    """Seed one managed fund.

    ``symbols`` items: ``(product_broker_id, price_symbol, sync_symbol, source)``.
    ``holdings`` items: ``(asset, qty, avg_entry_price)``.
    ``quotes`` items: ``(source, sync_symbol, price)``.
    """
    _, Session = get_test_engine()
    async with Session() as session:
        portfolio = Portfolio(
            portfolio_name=f"Fund broker {broker_id}",
            port_type="Managed Fund",
            risk_status="Safe",
            broker_id=broker_id,
            x_amount=Decimal("0"),
            available_cash=Decimal("0"),
            margin_locked=Decimal("0"),
        )
        session.add(portfolio)
        await session.flush()

        product_ids, symbol_ids = [], []
        for product_broker_id, price_symbol, sync_symbol, source in symbols:
            product = AssetProduct(
                ticker=f"{price_symbol}-{product_broker_id}",
                broker_id=product_broker_id,
                asset_type="stock",
                multiplier=Decimal("1"),
                margin_rate=Decimal("0"),
                source=source,
                margin_mode="notional",
            )
            session.add(product)
            await session.flush()
            symbol = AssetSymbol(
                product_id=product.product_id,
                broker_id=product_broker_id,
                price_symbol=price_symbol,
                sync_symbol=sync_symbol,
                contract_kind="stock",
            )
            session.add(symbol)
            await session.flush()
            product_ids.append(product.product_id)
            symbol_ids.append(symbol.symbol_id)

        holding_ids = []
        for asset, qty, avg_entry_price in holdings:
            holding = ManagedFundHolding(
                portfolio_id=portfolio.portfolio_id,
                asset=asset,
                qty=Decimal(str(qty)),
                avg_entry_price=Decimal(str(avg_entry_price)),
            )
            session.add(holding)
            await session.flush()
            holding_ids.append(holding.holding_id)

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
            portfolio.portfolio_id, holding_ids, symbol_ids, product_ids, quote_keys
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
        await session.commit()


async def drop_brokers(*broker_ids: int) -> None:
    _, Session = get_test_engine()
    async with Session() as session:
        await session.execute(delete(Broker).where(Broker.id.in_(broker_ids)))
        await session.commit()


async def load_holding(holding_id: int) -> ManagedFundHolding:
    _, Session = get_test_engine()
    async with Session() as session:
        return (
            await session.execute(
                select(ManagedFundHolding).where(
                    ManagedFundHolding.holding_id == holding_id
                )
            )
        ).scalars().one()


async def load_quote(source: str, sync_symbol: str):
    _, Session = get_test_engine()
    async with Session() as session:
        return (
            await session.execute(
                select(AssetQuote).where(
                    AssetQuote.source == source,
                    AssetQuote.sync_symbol == sync_symbol,
                )
            )
        ).scalars().one_or_none()


def patch_provider(monkeypatch, prices: dict[str, float]):
    """Patch the provider fetch and record every ``(source, sync_symbol)`` call."""
    calls: list[tuple[str, str]] = []

    def fake_fetch(source: str, sync_symbol: str) -> tuple[float, float]:
        calls.append((source, sync_symbol))
        return prices[sync_symbol], 0.5

    monkeypatch.setattr("app.services.asset_registry._fetch_quote", fake_fetch)
    return calls


@pytest.mark.asyncio
async def test_sync_prices_refreshes_registry_quote(async_client, monkeypatch):
    broker_id = await make_broker("MFP1")
    fund = await seed_fund(
        broker_id=broker_id,
        symbols=[(broker_id, "PTT", "PTT.BK", "yfinance")],
        holdings=[(" ptt ", 10, 20)],
        quotes=[("yfinance", "PTT.BK", 21)],
    )
    calls = patch_provider(monkeypatch, {"PTT.BK": 30.0})
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/sync-prices"
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        print("SYNC_PAYLOAD", body)
        assert body == {"synced": 1, "total": 1, "missing": [], "failed": []}
        assert calls == [("yfinance", "PTT.BK")]

        holding = await load_holding(fund.holding_ids[0])
        assert float(holding.current_price) == 30.0
        assert float(holding.market_value) == 300.0
        assert float(holding.unrealized_pl) == 100.0
        assert float(holding.unrealized_pl_pct) == 50.0

        quote = await load_quote("yfinance", "PTT.BK")
        assert float(quote.price) == 30.0
    finally:
        await drop_fund(fund)
        await drop_brokers(broker_id)


@pytest.mark.asyncio
async def test_sync_prices_prefers_fund_broker_row(async_client, monkeypatch):
    fund_broker_id = await make_broker("MFP2A")
    other_broker_id = await make_broker("MFP2B")
    fund = await seed_fund(
        broker_id=fund_broker_id,
        symbols=[
            (other_broker_id, "ADVANC", "ADVANC.BK", "yfinance"),
            (fund_broker_id, "ADVANC", "ADVANC-FUND.BK", "yfinance"),
        ],
        holdings=[("ADVANC", 1, 10)],
        quotes=[
            ("yfinance", "ADVANC.BK", 99),
            ("yfinance", "ADVANC-FUND.BK", 50),
        ],
    )
    calls = patch_provider(monkeypatch, {"ADVANC.BK": 88.0, "ADVANC-FUND.BK": 55.0})
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/sync-prices"
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        print("SYNC_PAYLOAD", body)
        assert body == {"synced": 1, "total": 1, "missing": [], "failed": []}
        assert calls == [("yfinance", "ADVANC-FUND.BK")]

        holding = await load_holding(fund.holding_ids[0])
        assert float(holding.current_price) == 55.0

        # The other broker's quote was never fetched and never overwritten.
        other_quote = await load_quote("yfinance", "ADVANC.BK")
        assert float(other_quote.price) == 99.0
    finally:
        await drop_fund(fund)
        await drop_brokers(fund_broker_id, other_broker_id)


@pytest.mark.asyncio
async def test_sync_prices_reports_missing_symbol(async_client, monkeypatch):
    broker_id = await make_broker("MFP3")
    calls = patch_provider(monkeypatch, {})
    fund = await seed_fund(
        broker_id=broker_id,
        holdings=[("NOSUCH", 5, 10)],
    )
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/sync-prices"
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        print("SYNC_PAYLOAD", body)
        assert body == {
            "synced": 0,
            "total": 1,
            "missing": ["NOSUCH"],
            "failed": [],
        }
        assert calls == []
        holding = await load_holding(fund.holding_ids[0])
        assert float(holding.current_price) == 0.0
    finally:
        await drop_fund(fund)
        await drop_brokers(broker_id)


@pytest.mark.asyncio
async def test_sync_prices_provider_failure_keeps_stored_quote(async_client, monkeypatch):
    broker_id = await make_broker("MFP4")
    fund = await seed_fund(
        broker_id=broker_id,
        symbols=[
            (broker_id, "FAIL", "FAIL.BK", "yfinance"),
            (broker_id, "OKAY", "OKAY.BK", "yfinance"),
        ],
        holdings=[("FAIL", 2, 10), ("OKAY", 4, 5)],
        quotes=[("yfinance", "FAIL.BK", 15), ("yfinance", "OKAY.BK", 6)],
    )
    calls: list[tuple[str, str]] = []

    def flaky_fetch(source: str, sync_symbol: str) -> tuple[float, float]:
        calls.append((source, sync_symbol))
        if sync_symbol == "FAIL.BK":
            raise RuntimeError("provider exploded")
        return 8.0, 0.2

    monkeypatch.setattr("app.services.asset_registry._fetch_quote", flaky_fetch)
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/sync-prices"
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        print("SYNC_PAYLOAD", body)
        assert calls == [("yfinance", "FAIL.BK"), ("yfinance", "OKAY.BK")]
        assert body == {
            "synced": 2,
            "total": 2,
            "missing": [],
            "failed": ["FAIL"],
        }

        failed_holding = await load_holding(fund.holding_ids[0])
        assert float(failed_holding.current_price) == 15.0
        okay_holding = await load_holding(fund.holding_ids[1])
        assert float(okay_holding.current_price) == 8.0

        # The previously stored quote survived the provider failure.
        quote = await load_quote("yfinance", "FAIL.BK")
        assert float(quote.price) == 15.0
    finally:
        await drop_fund(fund)
        await drop_brokers(broker_id)


@pytest.mark.asyncio
async def test_sync_prices_fetches_once_for_duplicate_holdings(async_client, monkeypatch):
    broker_id = await make_broker("MFP5")
    fund = await seed_fund(
        broker_id=broker_id,
        symbols=[(broker_id, "PTT", "PTT.BK", "yfinance")],
        holdings=[("PTT", 1, 10), (" ptt ", 2, 10)],
        quotes=[("yfinance", "PTT.BK", 10)],
    )
    calls = patch_provider(monkeypatch, {"PTT.BK": 12.0})
    try:
        resp = await async_client.post(
            f"/api/v1/managed-funds/{fund.portfolio_id}/sync-prices"
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        print("SYNC_PAYLOAD", body)
        assert body == {"synced": 2, "total": 2, "missing": [], "failed": []}
        assert calls == [("yfinance", "PTT.BK")]

        for holding_id in fund.holding_ids:
            holding = await load_holding(holding_id)
            assert float(holding.current_price) == 12.0
    finally:
        await drop_fund(fund)
        await drop_brokers(broker_id)


@pytest.mark.asyncio
async def test_quote_write_reprices_fund_holding(async_client):
    broker_id = await make_broker("MFP6")
    fund = await seed_fund(
        broker_id=broker_id,
        symbols=[(broker_id, "PTT", "PTT.BK", "yfinance")],
        holdings=[(" ptt ", 10, 20)],
        quotes=[("yfinance", "PTT.BK", 21)],
    )
    try:
        resp = await async_client.put(
            f"/api/v1/assets/symbols/{fund.symbol_ids[0]}/quote",
            json={"price": 42.0},
        )
        assert resp.status_code == 200, resp.text
        print("QUOTE_RESPONSE", resp.json())
        assert resp.json()["price"] == 42.0

        holding = await load_holding(fund.holding_ids[0])
        assert float(holding.current_price) == 42.0
        assert float(holding.market_value) == 420.0
        assert float(holding.unrealized_pl) == 220.0
    finally:
        await drop_fund(fund)
        await drop_brokers(broker_id)


@pytest.mark.asyncio
async def test_batch_update_reprices_fund_holding(async_client, monkeypatch):
    broker_id = await make_broker("MFP7")
    fund = await seed_fund(
        broker_id=broker_id,
        symbols=[(broker_id, "BATCH", "BATCH.BK", "yfinance")],
        holdings=[("BATCH", 4, 20)],
        quotes=[("yfinance", "BATCH.BK", 10)],
    )
    fetch_prices = {"BATCH.BK": 33.5}
    fallback = patch_provider(monkeypatch, fetch_prices)
    try:
        resp = await async_client.post("/api/v1/assets/symbols/batch-update-prices")
        assert resp.status_code == 200, resp.text
        print("BATCH_RESPONSE", resp.json())
        assert ("yfinance", "BATCH.BK") in fallback
        assert fallback.count(("yfinance", "BATCH.BK")) == 1

        holding = await load_holding(fund.holding_ids[0])
        assert float(holding.current_price) == 33.5
        assert float(holding.market_value) == 134.0
        assert float(holding.unrealized_pl) == 54.0
    finally:
        await drop_fund(fund)
        await drop_brokers(broker_id)
