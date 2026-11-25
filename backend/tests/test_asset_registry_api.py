"""Asset registry API contract: products, symbols, quotes, proposal/apply, rename."""

import os
import sys
from decimal import Decimal

import pytest
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.dirname(__file__))
from conftest import get_test_engine  # noqa: E402

from app.custom_models import (  # noqa: E402
    CustomActiveOrder,
    CustomAsset,
    CustomTransaction,
    custom_metadata,
)
from app.models import (  # noqa: E402
    ActiveOrder,
    AssetProduct,
    AssetQuote,
    AssetSymbol,
    Broker,
    Portfolio,
    TradePlan,
)
from app.managed_fund_models import (  # noqa: E402
    ManagedFundHolding,
    ManagedFundOrder,
)
from app.risk_calc import compute_margin_locked, compute_risk  # noqa: E402
from app.services import asset_registry as registry  # noqa: E402
from app.routers import assets as assets_router  # noqa: E402


PRODUCT_KEYS = {
    "product_id", "ticker", "broker_id", "broker_code", "asset_type",
    "multiplier", "margin_rate", "margin_mode", "margin_per_contract",
    "source", "group_id", "name", "symbol_count",
}
SYMBOL_KEYS = {
    "symbol_id", "product_id", "price_symbol", "sync_symbol", "contract_kind",
    "option_type", "expiry_date", "strike_price", "multiplier_override",
    "margin_rate_override", "multiplier_effective", "margin_rate_effective",
    "multiplier_inherited", "margin_rate_inherited", "margin_per_contract",
    "price", "change_24h", "updated_at",
}


async def create_broker(client, code: str, currency: str = "USD") -> int:
    resp = await client.post(
        "/api/v1/brokers",
        json={"code": code, "name": f"Broker {code}", "currency": currency},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def create_product(client, **payload):
    resp = await client.post("/api/v1/assets/products", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def create_symbol(client, product_id: int, **payload):
    resp = await client.post(
        f"/api/v1/assets/products/{product_id}/symbols", json=payload
    )
    return resp


async def cleanup_brokers(*broker_ids: int) -> None:
    _, Session = get_test_engine()
    async with Session() as session:
        symbols = (
            await session.execute(
                select(AssetSymbol).where(AssetSymbol.broker_id.in_(broker_ids))
            )
        ).scalars().all()
        for symbol in symbols:
            await session.delete(symbol)
        products = (
            await session.execute(
                select(AssetProduct).where(AssetProduct.broker_id.in_(broker_ids))
            )
        ).scalars().all()
        for product in products:
            await session.delete(product)
        await session.execute(delete(Broker).where(Broker.id.in_(broker_ids)))
        await session.commit()


@pytest.mark.asyncio
async def test_product_symbol_crud_exact_contract(async_client):
    broker_id = await create_broker(async_client, "REG1")

    root = await async_client.get("/api/v1/assets")
    assert root.status_code == 404
    assert root.json()["detail"] == "Use /assets/products for the main asset registry"

    # Legacy sync writers are gone.
    for path in ("/api/v1/assets/sync-from-orders", "/api/v1/assets/sync-from-all"):
        resp = await async_client.post(path)
        assert resp.status_code == 404

    product = await create_product(
        async_client,
        ticker=" ptt ",
        broker_id=broker_id,
        asset_type="stock",
        multiplier=2,
        margin_rate=0.1,
        margin_mode="notional",
        source="yfinance",
        name="PTT",
    )
    assert set(product) == PRODUCT_KEYS
    assert product["ticker"] == "PTT"
    assert product["symbol_count"] == 0

    # Duplicate identity and validation errors.
    duplicate = await async_client.post(
        "/api/v1/assets/products",
        json={"ticker": "PTT", "broker_id": broker_id, "asset_type": "stock"},
    )
    assert duplicate.status_code == 400
    assert duplicate.json()["detail"] == "An asset with this ticker already exists"
    blank = await async_client.post("/api/v1/assets/products", json={"ticker": "  "})
    assert blank.status_code == 400
    assert blank.json()["detail"] == "Ticker is required"
    for payload, detail in (
        ({"ticker": "X1", "multiplier": 0}, "multiplier must be greater than 0"),
        ({"ticker": "X2", "margin_rate": 2}, "margin_rate must be between 0 and 1"),
        (
            {"ticker": "X3", "margin_mode": "cash"},
            "margin_mode must be one of notional, premium, span",
        ),
    ):
        resp = await async_client.post("/api/v1/assets/products", json=payload)
        assert resp.status_code == 400
        assert resp.json()["detail"] == detail

    symbol_resp = await create_symbol(
        async_client,
        product["product_id"],
        price_symbol=" ptt.bk ",
        sync_symbol="PTT.BK",
        contract_kind="stock",
    )
    assert symbol_resp.status_code == 201, symbol_resp.text
    symbol = symbol_resp.json()
    assert set(symbol) == SYMBOL_KEYS
    assert symbol["price_symbol"] == "ptt.bk"
    assert symbol["sync_symbol"] == "PTT.BK"

    detail = await async_client.get(f"/api/v1/assets/products/{product['product_id']}")
    assert set(detail.json()) == PRODUCT_KEYS | {"symbols"}
    assert detail.json()["symbol_count"] == 1
    assert detail.json()["symbols"][0]["symbol_id"] == symbol["symbol_id"]

    listed = await async_client.get(f"/api/v1/assets/symbols?product_id={product['product_id']}")
    assert listed.status_code == 200
    assert set(listed.json()[0]) == SYMBOL_KEYS

    # Broker change with an attached symbol is rejected with its count.
    broker_change = await async_client.put(
        f"/api/v1/assets/products/{product['product_id']}",
        json={"broker_id": 999999},
    )
    assert broker_change.status_code == 400
    assert broker_change.json()["detail"] == (
        f"Cannot change broker_id for product PTT "
        f"(product_id={product['product_id']}) while 1 symbols are attached"
    )

    # Blank sync key.
    blank_sync = await create_symbol(
        async_client, product["product_id"], price_symbol="X", sync_symbol="  "
    )
    assert blank_sync.status_code == 400
    assert blank_sync.json()["detail"] == "sync_symbol is required"

    # Normalized collision across products on the same broker.
    other = await create_product(
        async_client, ticker="OTHER", broker_id=broker_id, asset_type="stock"
    )
    collision = await create_symbol(
        async_client, other["product_id"], price_symbol="PTT.BK", sync_symbol="O.BK"
    )
    assert collision.status_code == 400
    assert collision.json()["detail"] == (
        f"Symbol PTT.BK on broker REG1 already belongs to product PTT "
        f"(product_id={product['product_id']})"
    )

    # Default product is excluded, never editable or deletable, no symbols.
    _, Session = get_test_engine()
    async with Session() as session:
        default_product = (
            await session.execute(
                select(AssetProduct).where(
                    AssetProduct.ticker.is_(None),
                    AssetProduct.broker_id.is_(None),
                    AssetProduct.asset_type.is_(None),
                )
            )
        ).scalars().first()
    assert default_product is not None
    assert all(
        item["product_id"] != default_product.product_id
        for item in (await async_client.get("/api/v1/assets/products")).json()
    )
    put_default = await async_client.put(
        f"/api/v1/assets/products/{default_product.product_id}", json={}
    )
    delete_default = await async_client.delete(
        f"/api/v1/assets/products/{default_product.product_id}"
    )
    for response in (put_default, delete_default):
        assert response.status_code == 400
        assert response.json()["detail"] == "The default product is not editable"
    # The default identity itself is immutable, but it accepts symbols: its
    # contracts carry no broker-scoped spec.
    default_symbol = await create_symbol(
        async_client, default_product.product_id, sync_symbol="BAD"
    )
    assert default_symbol.status_code == 201, default_symbol.text
    default_symbol_body = default_symbol.json()
    assert default_symbol_body["multiplier_effective"] == 1.0
    assert default_symbol_body["margin_rate_effective"] == 0.0
    assert default_symbol_body["multiplier_inherited"] is True
    assert default_symbol_body["margin_rate_inherited"] is True
    removed = await async_client.delete(
        f"/api/v1/assets/symbols/{default_symbol_body['symbol_id']}"
    )
    assert removed.status_code == 204

    # Missing lookups.
    assert (await async_client.get("/api/v1/assets/products/999999")).status_code == 404
    assert (await async_client.put("/api/v1/assets/symbols/999999", json={})).status_code == 404
    assert (await async_client.delete("/api/v1/assets/symbols/999999")).status_code == 404

    await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_product_span_margin_and_identity_contract_kind(async_client):
    broker_id = await create_broker(async_client, "SPAN")
    try:
        product = await create_product(
            async_client,
            ticker="SPAN",
            broker_id=broker_id,
            asset_type="stock",
            margin_mode="span",
            margin_per_contract=750,
        )
        assert product["margin_per_contract"] == 750.0
        assert product["margin_mode"] == "span"

        # An omitted value is an explicit null in the payload.
        plain = await create_product(
            async_client, ticker="PLAIN", broker_id=broker_id, asset_type="stock"
        )
        assert plain["margin_per_contract"] is None

        negative = await async_client.post(
            "/api/v1/assets/products",
            json={
                "ticker": "NEG",
                "broker_id": broker_id,
                "margin_per_contract": -1,
            },
        )
        assert negative.status_code == 400
        assert negative.json()["detail"] == (
            "margin_per_contract must be zero or greater"
        )

        updated = await async_client.put(
            f"/api/v1/assets/products/{product['product_id']}",
            json={"margin_per_contract": 900},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["margin_per_contract"] == 900.0
        # A span-only update touches nothing else.
        assert updated.json()["margin_mode"] == "span"
        assert updated.json()["multiplier"] == 1.0
        assert updated.json()["margin_rate"] == 0.0
        assert updated.json()["asset_type"] == "stock"

        negative_update = await async_client.put(
            f"/api/v1/assets/products/{product['product_id']}",
            json={"margin_per_contract": -5},
        )
        assert negative_update.status_code == 400
        assert negative_update.json()["detail"] == (
            "margin_per_contract must be zero or greater"
        )

        # An explicit null clears the span and only the span.
        cleared = await async_client.put(
            f"/api/v1/assets/products/{product['product_id']}",
            json={"margin_per_contract": None, "multiplier": 2},
        )
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()["margin_per_contract"] is None
        assert cleared.json()["multiplier"] == 2.0
        assert cleared.json()["margin_mode"] == "span"
        assert cleared.json()["margin_rate"] == 0.0

        # The contract type is the owning identity's asset_type.
        mismatched = await create_symbol(
            async_client,
            product["product_id"],
            price_symbol="SPAN-F",
            sync_symbol="SPAN-F",
            contract_kind="future",
        )
        assert mismatched.status_code == 400
        assert mismatched.json()["detail"] == (
            "contract type is set by the underlying + broker + type"
        )

        matching = await create_symbol(
            async_client,
            product["product_id"],
            price_symbol="SPAN.ME",
            sync_symbol="SPAN",
            contract_kind="stock",
        )
        assert matching.status_code == 201, matching.text
        assert matching.json()["contract_kind"] == "stock"
        omitted = await create_symbol(
            async_client,
            product["product_id"],
            price_symbol="SPAN2",
            sync_symbol="SPAN2",
        )
        assert omitted.status_code == 201, omitted.text
        assert omitted.json()["contract_kind"] == "stock"

        # The symbol payload mirrors the identity's span value.
        assert matching.json()["margin_per_contract"] is None
        await async_client.put(
            f"/api/v1/assets/products/{product['product_id']}",
            json={"margin_per_contract": 4},
        )
        mirrored = await async_client.get(
            f"/api/v1/assets/symbols?product_id={product['product_id']}"
        )
        assert mirrored.status_code == 200, mirrored.text
        assert {row["margin_per_contract"] for row in mirrored.json()} == {4.0}

        # Updates obey the same identity rule.
        bad_kind = await async_client.put(
            f"/api/v1/assets/symbols/{matching.json()['symbol_id']}",
            json={"contract_kind": "future"},
        )
        assert bad_kind.status_code == 400
        assert bad_kind.json()["detail"] == (
            "contract type is set by the underlying + broker + type"
        )
        same_kind = await async_client.put(
            f"/api/v1/assets/symbols/{matching.json()['symbol_id']}",
            json={"contract_kind": "stock"},
        )
        assert same_kind.status_code == 200, same_kind.text
        assert same_kind.json()["contract_kind"] == "stock"

        # An untyped identity keeps the legacy ``future`` fallback, which is
        # also the only value a client may supply for it.
        untyped = await create_product(
            async_client, ticker="UNTYPED", broker_id=broker_id
        )
        fallback = await create_symbol(
            async_client,
            untyped["product_id"],
            price_symbol="UNTYPED",
            sync_symbol="UNTYPED",
            contract_kind="future",
        )
        assert fallback.status_code == 201, fallback.text
        assert fallback.json()["contract_kind"] == "future"
        rejected_fallback = await create_symbol(
            async_client,
            untyped["product_id"],
            price_symbol="UNTYPED2",
            sync_symbol="UNTYPED2",
            contract_kind="stock",
        )
        assert rejected_fallback.status_code == 400
        assert rejected_fallback.json()["detail"] == (
            "contract type is set by the underlying + broker + type"
        )
    finally:
        await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_option_identity_checks(async_client):
    broker_id = await create_broker(async_client, "REG2")
    product = await create_product(
        async_client, ticker="OPT", broker_id=broker_id, asset_type="option"
    )
    dated = await create_symbol(
        async_client,
        product["product_id"],
        contract_kind="option",
        option_type="call",
        expiry_date="2026-03-31",
        strike_price=10,
        sync_symbol="OPT3",
    )
    assert dated.status_code == 201, dated.text

    # An all-NULL option is allowed once even though a different option exists
    # on the same product with price_symbol NULL.
    first = await create_symbol(
        async_client,
        product["product_id"],
        contract_kind="option",
        sync_symbol="OPT1",
    )
    assert first.status_code == 201, first.text
    repeated = await create_symbol(
        async_client,
        product["product_id"],
        contract_kind="option",
        sync_symbol="OPT2",
    )
    assert repeated.status_code == 400
    assert repeated.json()["detail"] == "Option identity already exists"

    duplicate_dated = await create_symbol(
        async_client,
        product["product_id"],
        contract_kind="option",
        option_type="call",
        expiry_date="2026-03-31",
        strike_price=10,
        sync_symbol="OPT4",
    )
    assert duplicate_dated.status_code == 400
    assert duplicate_dated.json()["detail"] == (
        f"Option contract already exists on product OPT "
        f"(product_id={product['product_id']})"
    )

    await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_manual_quote_create_and_delete_cleanup(async_client, monkeypatch):
    broker_a = await create_broker(async_client, "REG3")
    broker_b = await create_broker(async_client, "REG4")
    product_a = await create_product(
        async_client,
        ticker="MANA",
        broker_id=broker_a,
        source="manual",
    )
    product_b = await create_product(
        async_client,
        ticker="MANB",
        broker_id=broker_b,
        source="manual",
    )
    symbol_a = (
        await create_symbol(
            async_client,
            product_a["product_id"],
            price_symbol="MANA",
            sync_symbol="MANUAL.KEY",
        )
    ).json()
    symbol_b = (
        await create_symbol(
            async_client,
            product_b["product_id"],
            price_symbol="MANB",
            sync_symbol="MANUAL.KEY",
        )
    ).json()

    quote_resp = await async_client.put(
        f"/api/v1/assets/symbols/{symbol_a['symbol_id']}/quote",
        json={"price": 12.5, "change_24h": 0.5},
    )
    assert quote_resp.status_code == 200, quote_resp.text
    assert quote_resp.json()["price"] == 12.5
    assert quote_resp.json()["change_24h"] == 0.5

    def must_not_fetch(*args, **kwargs):  # pragma: no cover - must never run
        raise AssertionError("manual refresh must not call a provider")

    monkeypatch.setattr(registry, "_fetch_quote", must_not_fetch)
    refresh = await async_client.post(
        f"/api/v1/assets/symbols/{symbol_a['symbol_id']}/update-price"
    )
    assert refresh.status_code == 200, refresh.text
    assert refresh.json()["price"] == 12.5

    # Deleting the first reference keeps the quote; the last one removes it.
    assert (
        await async_client.delete(f"/api/v1/assets/symbols/{symbol_a['symbol_id']}")
    ).status_code == 204
    _, Session = get_test_engine()
    async with Session() as session:
        quote = (
            await session.execute(
                select(AssetQuote).where(
                    AssetQuote.source == "manual",
                    AssetQuote.sync_symbol == "MANUAL.KEY",
                )
            )
        ).scalars().first()
    assert quote is not None

    assert (
        await async_client.delete(f"/api/v1/assets/symbols/{symbol_b['symbol_id']}")
    ).status_code == 204
    async with Session() as session:
        quote = (
            await session.execute(
                select(AssetQuote).where(
                    AssetQuote.source == "manual",
                    AssetQuote.sync_symbol == "MANUAL.KEY",
                )
            )
        ).scalars().first()
    assert quote is None

    await cleanup_brokers(broker_a, broker_b)


@pytest.mark.asyncio
async def test_batch_refresh_fetches_each_key_once(async_client, monkeypatch):
    broker_a = await create_broker(async_client, "REG5")
    broker_b = await create_broker(async_client, "REG6")
    broker_c = await create_broker(async_client, "REG7")

    async def seed(broker_id, ticker, price_symbol, sync_symbol):
        product = await create_product(
            async_client,
            ticker=ticker,
            broker_id=broker_id,
            source="yfinance",
        )
        resp = await create_symbol(
            async_client,
            product["product_id"],
            price_symbol=price_symbol,
            sync_symbol=sync_symbol,
        )
        assert resp.status_code == 201, resp.text

    await seed(broker_a, "BA", "AAA", "SAME")
    await seed(broker_b, "BB", "BBB", "SAME")
    await seed(broker_c, "BC", "CCC", "OTHER")
    await seed(broker_c, "BD", "DDD", "FAIL")

    calls = []

    def fake_fetch(source, sync_symbol):
        calls.append((source, sync_symbol))
        if sync_symbol == "FAIL":
            raise RuntimeError("provider down")
        return 1.25, 0.5

    monkeypatch.setattr(registry, "_fetch_quote", fake_fetch)
    resp = await async_client.post("/api/v1/assets/symbols/batch-update-prices")
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["updated"] == 2
    assert payload["tickers"] == ["AAA", "BBB", "CCC"]
    assert sorted(calls) == [
        ("yfinance", "FAIL"),
        ("yfinance", "OTHER"),
        ("yfinance", "SAME"),
    ]

    await cleanup_brokers(broker_a, broker_b, broker_c)


async def _seed_order(
    symbol: str,
    broker_id: int | None,
    contract_type: str = "stock",
    port_type: str = "Active Trading",
) -> tuple[int, int, int]:
    _, Session = get_test_engine()
    async with Session() as session:
        portfolio = Portfolio(
            portfolio_name=f"Proposal {symbol}",
            port_type=port_type,
            broker_id=broker_id,
            product_tickers=None,
            x_amount=Decimal("0"),
            available_cash=Decimal("1000"),
            margin_locked=Decimal("0"),
        )
        session.add(portfolio)
        await session.flush()
        plan = TradePlan(portfolio_id=portfolio.portfolio_id)
        session.add(plan)
        await session.flush()
        order = ActiveOrder(
            plan_id=plan.plan_id,
            portfolio_id=portfolio.portfolio_id,
            asset_type=symbol,
            side="Buy",
            qty=Decimal("1"),
            entry_price=Decimal("10"),
            contract_type=contract_type,
        )
        session.add(order)
        await session.commit()
        return portfolio.portfolio_id, plan.plan_id, order.order_id


async def _delete_orders(*order_ids: str) -> None:
    _, Session = get_test_engine()
    async with Session() as session:
        orders = (
            await session.execute(
                select(ActiveOrder).where(ActiveOrder.order_id.in_(order_ids))
            )
        ).scalars().all()
        portfolio_ids = []
        for order in orders:
            portfolio_ids.append(order.portfolio_id)
            await session.delete(order)
        plans = (
            await session.execute(
                select(TradePlan).where(TradePlan.portfolio_id.in_(portfolio_ids))
            )
        ).scalars().all()
        for plan in plans:
            await session.delete(plan)
        portfolios = (
            await session.execute(
                select(Portfolio).where(Portfolio.portfolio_id.in_(portfolio_ids))
            )
        ).scalars().all()
        for portfolio in portfolios:
            await session.delete(portfolio)
        await session.commit()


@pytest.mark.asyncio
async def test_proposal_and_apply_contract(async_client, monkeypatch):
    broker_id = await create_broker(async_client, "SYN1")
    other_broker = await create_broker(async_client, "SYN2")
    brokerless_portfolio, _, brokerless_order = await _seed_order("NOBROKER", None)
    portfolio_id, _, order_id = await _seed_order(
        "NEWSYM", broker_id, contract_type="future"
    )

    try:
        proposal = await async_client.get("/api/v1/assets/proposal")
        assert proposal.status_code == 200, proposal.text
        items = {
            (item["broker_id"], item["symbol"]): item
            for item in proposal.json()["items"]
        }
        item = items[(broker_id, "NEWSYM")]
        assert item["create"] == {"symbol": "NEWSYM"}
        assert item["order_asset_types"] == ["future"]
        assert item["broker_required"] is False
        assert items[(None, "NOBROKER")]["broker_required"] is True

        # Exactly one of product_id / create_product.
        neither = await async_client.post(
            "/api/v1/assets/apply",
            json={"choices": [{"symbol": "NEWSYM", "broker_id": broker_id}]},
        )
        assert neither.status_code == 400
        assert neither.json()["detail"] == (
            "Provide exactly one of product_id or create_product=true"
        )
        both = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "NEWSYM",
                        "broker_id": broker_id,
                        "product_id": 1,
                        "create_product": True,
                    }
                ]
            },
        )
        assert both.status_code == 400

        absent = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {"symbol": "NOPE", "broker_id": broker_id, "create_product": True}
                ]
            },
        )
        assert absent.status_code == 400
        assert absent.json()["detail"] == "Symbol NOPE was not in the proposal"

        # Cross-broker product.
        foreign = await create_product(
            async_client, ticker="FOREIGN", broker_id=other_broker
        )
        cross = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "NEWSYM",
                        "broker_id": broker_id,
                        "product_id": foreign["product_id"],
                    }
                ]
            },
        )
        assert cross.status_code == 400
        assert cross.json()["detail"] == (
            f"Product FOREIGN (product_id={foreign['product_id']}) "
            "is not in broker SYN1"
        )

        # Duplicate underlying identity: same underlying + broker + asset type.
        await create_product(
            async_client,
            ticker="NEWSYM",
            broker_id=broker_id,
            asset_type="stock",
        )
        duplicate = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "NEWSYM",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_underlying": " newsym ",
                        "create_source": "yfinance",
                        "create_sync_symbol": "NEWSYM",
                        "create_asset_type": "stock",
                    }
                ]
            },
        )
        assert duplicate.status_code == 400
        assert duplicate.json()["detail"] == (
            "An asset with this ticker already exists"
        )

        # A brokerless Active Trading pair may now receive an explicit broker
        # at sync time: the identity is created under the chosen broker.
        brokerless = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "NOBROKER",
                        "broker_id": other_broker,
                        "create_product": True,
                        "create_underlying": "NOBROKERU",
                        "create_source": "manual",
                        "create_sync_symbol": "",
                        "create_asset_type": "stock",
                    }
                ]
            },
        )
        assert brokerless.status_code == 200, brokerless.text
        assert brokerless.json()["created"] == 1
        _, Session = get_test_engine()
        async with Session() as session:
            brokerless_product = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker == "NOBROKERU",
                        AssetProduct.broker_id == other_broker,
                    )
                )
            ).scalars().first()
            brokerless_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.price_symbol == "NOBROKER",
                        AssetSymbol.broker_id == other_broker,
                    )
                )
            ).scalars().first()
        assert brokerless_product is not None
        assert brokerless_symbol.product_id == brokerless_product.product_id

        # Leaving the broker unassigned stays allowed: the symbol lands on the
        # brokerless default identity while the proposal flag stays informational.
        assert items[(None, "NOBROKER")]["broker_required"] is True
        unassigned = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "NOBROKER",
                        "broker_id": None,
                        "create_product": True,
                        "create_source": "manual",
                    }
                ]
            },
        )
        assert unassigned.status_code == 200, unassigned.text
        assert unassigned.json()["created"] == 1
        async with Session() as session:
            unassigned_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.price_symbol == "NOBROKER",
                        AssetSymbol.broker_id.is_(None),
                    )
                )
            ).scalars().first()
            default_product = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker.is_(None),
                        AssetProduct.broker_id.is_(None),
                        AssetProduct.asset_type.is_(None),
                    )
                )
            ).scalars().first()
        assert unassigned_symbol.product_id == default_product.product_id

        # Successful create: the product ticker is the explicit underlying and
        # the contract row keeps the order symbol as its price symbol.
        monkeypatch.setattr(
            registry,
            "_fetch_quote",
            lambda source, sync_symbol: (_ for _ in ()).throw(RuntimeError("down")),
        )
        third_portfolio, _, third_order = await _seed_order("FRESHSYM", broker_id)
        created = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "FRESHSYM",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_underlying": " fresh ",
                        "create_source": "yfinance",
                        "create_sync_symbol": "FRESHSYM.BK",
                        "create_asset_type": "stock",
                    }
                ]
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["created"] == 1

        _, Session = get_test_engine()
        async with Session() as session:
            product = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker == "FRESH",
                        AssetProduct.broker_id == broker_id,
                    )
                )
            ).scalars().first()
            symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.product_id == product.product_id
                    )
                )
            ).scalars().first()
            failed_quote = (
                await session.execute(
                    select(AssetQuote).where(
                        AssetQuote.source == "yfinance",
                        AssetQuote.sync_symbol == "FRESHSYM.BK",
                    )
                )
            ).scalars().first()
        assert product.ticker == "FRESH"
        assert product.asset_type == "stock"
        assert product.source == "yfinance"
        assert product.multiplier == 1
        assert product.margin_rate == 0
        assert product.margin_mode == "notional"
        assert symbol.price_symbol == "FRESHSYM"
        assert symbol.sync_symbol == "FRESHSYM.BK"
        assert symbol.contract_kind == "stock"
        assert failed_quote is None

        # Same-owner selection is idempotent.
        again = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "FRESHSYM",
                        "broker_id": broker_id,
                        "product_id": product.product_id,
                    }
                ]
            },
        )
        assert again.status_code == 200
        assert again.json()["created"] == 0

        # A blank underlying is valid when the broker scopes the product: the
        # product keeps a NULL ticker and the contract carries the order symbol.
        fourth_portfolio, _, fourth_order = await _seed_order("BLANKSYM", broker_id)
        blank_create = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "BLANKSYM",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_underlying": "   ",
                        "create_source": "manual",
                        "create_asset_type": "future",
                    }
                ]
            },
        )
        assert blank_create.status_code == 200, blank_create.text
        assert blank_create.json()["created"] == 1

        _, Session = get_test_engine()
        async with Session() as session:
            blank_product = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.broker_id == broker_id,
                        AssetProduct.ticker.is_(None),
                        AssetProduct.asset_type == "future",
                    )
                )
            ).scalars().first()
            blank_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.product_id == blank_product.product_id
                    )
                )
            ).scalars().first()
        assert blank_product.ticker is None
        assert blank_symbol.price_symbol == "BLANKSYM"
        assert blank_symbol.sync_symbol == "BLANKSYM"
        assert blank_symbol.contract_kind == "future"

        # A THB broker changes nothing: the create default still carries only
        # the dashboard symbol, with no guessed provider symbol.
        thb_broker = await create_broker(async_client, "SYN3", currency="THB")
        thb_portfolio, _, thb_order = await _seed_order("PTT", thb_broker)
        thb_proposal = await async_client.get("/api/v1/assets/proposal")
        thb_items = {
            (item["broker_id"], item["symbol"]): item
            for item in thb_proposal.json()["items"]
        }
        assert thb_items[(thb_broker, "PTT")]["create"] == {"symbol": "PTT"}
        assert "sync_symbol" not in thb_items[(thb_broker, "PTT")]["create"]

        await cleanup_brokers(broker_id, other_broker, thb_broker)
    finally:
        _, Session = get_test_engine()
        async with Session() as session:
            await session.execute(
                delete(AssetSymbol).where(
                    AssetSymbol.price_symbol == "NOBROKER",
                    AssetSymbol.broker_id.is_(None),
                )
            )
            await session.commit()
        await _delete_orders(
            order_id, brokerless_order, third_order, fourth_order, thb_order
        )


@pytest.mark.asyncio
async def test_apply_choice_broker_is_independent_of_pair(async_client):
    """A sync choice may attach a price symbol to any existing broker.

    The proposal pair only proves the order symbol exists somewhere; the
    per-choice broker decides the identity, collision scope and product
    validation, so two rows of one symbol with different brokers are allowed
    in a single request.
    """
    pair_broker = await create_broker(async_client, "APX1")
    chosen_broker = await create_broker(async_client, "APX2")
    third_broker = await create_broker(async_client, "APX3")
    orders = []
    for symbol in ("CHOOSESYM", "TWOBROKERSYM"):
        _, _, order_id = await _seed_order(symbol, pair_broker)
        orders.append(order_id)

    try:
        # Unknown broker is rejected before anything is written.
        unknown = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "CHOOSESYM",
                        "broker_id": 999999,
                        "create_product": True,
                        "create_source": "manual",
                        "create_asset_type": "stock",
                    }
                ]
            },
        )
        assert unknown.status_code == 400
        assert unknown.json()["detail"] == "Broker 999999 not found"

        # A broker different from the pair creates the identity and the symbol
        # under the chosen broker, never under the pair's broker.
        created = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "CHOOSESYM",
                        "broker_id": chosen_broker,
                        "create_product": True,
                        "create_underlying": "CHOOSEU",
                        "create_source": "manual",
                        "create_asset_type": "stock",
                    }
                ]
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["created"] == 1
        _, Session = get_test_engine()
        async with Session() as session:
            chosen_product = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker == "CHOOSEU",
                        AssetProduct.broker_id == chosen_broker,
                    )
                )
            ).scalars().one()
            chosen_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.price_symbol == "CHOOSESYM",
                        AssetSymbol.broker_id == chosen_broker,
                    )
                )
            ).scalars().one()
            pair_products = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker == "CHOOSEU",
                        AssetProduct.broker_id == pair_broker,
                    )
                )
            ).scalars().all()
        assert chosen_symbol.product_id == chosen_product.product_id
        assert pair_products == []

        # Two rows of one symbol under different brokers, one request.
        first_product = await create_product(
            async_client, ticker="TWOPA", broker_id=chosen_broker, asset_type="stock"
        )
        second_product = await create_product(
            async_client, ticker="TWOPB", broker_id=third_broker, asset_type="stock"
        )
        both_choices = [
            {
                "symbol": "TWOBROKERSYM",
                "broker_id": chosen_broker,
                "product_id": first_product["product_id"],
            },
            {
                "symbol": "TWOBROKERSYM",
                "broker_id": third_broker,
                "product_id": second_product["product_id"],
            },
        ]
        both = await async_client.post(
            "/api/v1/assets/apply", json={"choices": both_choices}
        )
        assert both.status_code == 200, both.text
        assert both.json() == {"created": 2, "choices": 2}
        async with Session() as session:
            rows = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.price_symbol == "TWOBROKERSYM"
                    )
                )
            ).scalars().all()
        assert {row.broker_id for row in rows} == {chosen_broker, third_broker}
        assert {row.product_id for row in rows} == {
            first_product["product_id"],
            second_product["product_id"],
        }

        again = await async_client.post(
            "/api/v1/assets/apply", json={"choices": both_choices}
        )
        assert again.status_code == 200, again.text
        assert again.json() == {"created": 0, "choices": 2}

        # An existing product must belong to the chosen broker; the message
        # names the chosen broker, not the proposal pair's broker.
        wrong = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "CHOOSESYM",
                        "broker_id": chosen_broker,
                        "product_id": second_product["product_id"],
                    }
                ]
            },
        )
        assert wrong.status_code == 400
        assert wrong.json()["detail"] == (
            f"Product TWOPB (product_id={second_product['product_id']}) "
            "is not in broker APX2"
        )

        await cleanup_brokers(pair_broker, chosen_broker, third_broker)
    finally:
        await _delete_orders(*orders)


@pytest.mark.asyncio
async def test_apply_existing_product_uses_its_asset_type(async_client):
    """Assigning an existing product derives the symbol's contract kind from it.

    A sync row carries no option terms and no asset type of its own, so an
    option product or a product without an asset type is refused unguessed.
    """
    broker_id = await create_broker(async_client, "SYN7")
    orders = []
    for symbol in ("STOCKSYM", "FUTSYM", "OPTSYM", "NOTYPE"):
        _, _, order_id = await _seed_order(symbol, broker_id)
        orders.append(order_id)

    try:
        stock = await create_product(
            async_client, ticker="STOCKSYM", broker_id=broker_id, asset_type="stock"
        )
        future = await create_product(
            async_client, ticker="FUTSYM", broker_id=broker_id, asset_type="future"
        )
        option = await create_product(
            async_client, ticker="OPTSYM", broker_id=broker_id, asset_type="option"
        )
        untyped = await create_product(
            async_client, ticker="NOTYPE", broker_id=broker_id
        )
        assert untyped["asset_type"] is None

        async def assign(symbol: str, product: dict):
            return await async_client.post(
                "/api/v1/assets/apply",
                json={
                    "choices": [
                        {
                            "symbol": symbol,
                            "broker_id": broker_id,
                            "product_id": product["product_id"],
                        }
                    ]
                },
            )

        for symbol, product in (("STOCKSYM", stock), ("FUTSYM", future)):
            resp = await assign(symbol, product)
            assert resp.status_code == 200, resp.text
            assert resp.json()["created"] == 1

        option_resp = await assign("OPTSYM", option)
        assert option_resp.status_code == 400
        assert option_resp.json()["detail"] == (
            "Add the option contract in All-assets — a sync row has no expiry, "
            "strike or type"
        )

        untyped_resp = await assign("NOTYPE", untyped)
        assert untyped_resp.status_code == 400
        assert untyped_resp.json()["detail"] == (
            "Set the asset type of product NOTYPE in All-assets before syncing"
        )

        _, Session = get_test_engine()
        async with Session() as session:
            products = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.broker_id == broker_id
                    )
                )
            ).scalars().all()
            symbols = (
                await session.execute(
                    select(AssetSymbol).where(AssetSymbol.broker_id == broker_id)
                )
            ).scalars().all()
            quotes = (
                await session.execute(
                    select(AssetQuote).where(
                        AssetQuote.sync_symbol.in_(
                            ["STOCKSYM", "FUTSYM", "OPTSYM", "NOTYPE"]
                        )
                    )
                )
            ).scalars().all()

        assert {product.ticker for product in products} == {
            "STOCKSYM", "FUTSYM", "OPTSYM", "NOTYPE"
        }
        assert {symbol.price_symbol: symbol.contract_kind for symbol in symbols} == {
            "STOCKSYM": "stock",
            "FUTSYM": "future",
        }
        assert quotes == []
    finally:
        await _delete_orders(*orders)
        await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_proposal_resolved_flags_existing_symbol_spec(async_client):
    """`resolved` is true only for a spec owning the key in the pair's broker."""
    broker_id = await create_broker(async_client, "SYN5")
    other_broker = await create_broker(async_client, "SYN6")
    _, _, resolved_order = await _seed_order("HASSPEC", broker_id)
    _, _, missing_order = await _seed_order("NOSPEC", broker_id)
    _, _, brokerless_order = await _seed_order("NOSPEC", None)

    try:
        product = await create_product(
            async_client, ticker="HASSPEC", broker_id=broker_id, asset_type="stock"
        )
        symbol = await create_symbol(
            async_client,
            product["product_id"],
            price_symbol=" hasspec ",
            sync_symbol="HASSPEC.BK",
            contract_kind="stock",
        )
        assert symbol.status_code == 201, symbol.text

        # Same normalized key, but owned by a different broker: out of scope.
        foreign = await create_product(
            async_client, ticker="NOSPEC", broker_id=other_broker, asset_type="stock"
        )
        foreign_symbol = await create_symbol(
            async_client,
            foreign["product_id"],
            price_symbol="NOSPEC",
            sync_symbol="NOSPEC.BK",
            contract_kind="stock",
        )
        assert foreign_symbol.status_code == 201, foreign_symbol.text

        proposal = await async_client.get("/api/v1/assets/proposal")
        assert proposal.status_code == 200, proposal.text
        items = {
            (item["broker_id"], item["symbol"]): item
            for item in proposal.json()["items"]
        }
        assert items[(broker_id, "HASSPEC")]["resolved"] is True
        assert items[(broker_id, "NOSPEC")]["resolved"] is False
        # A brokerless pair never matches a broker-owned spec.
        assert items[(None, "NOSPEC")]["resolved"] is False
        # The flag is informational only: the spec is still counted and the
        # row stays assignable.
        assert items[(broker_id, "HASSPEC")]["products"][0]["symbol_count"] == 1
    finally:
        await cleanup_brokers(broker_id, other_broker)
        await _delete_orders(resolved_order, missing_order, brokerless_order)


@pytest.mark.asyncio
async def test_apply_default_identity_and_identity_variants(async_client):
    """A pair with no underlying/broker/type lands on the default identity."""
    broker_id = await create_broker(async_client, "IDN1")
    orders: list[str] = []
    type_identity_id: int | None = None
    _, Session = get_test_engine()
    async with Session() as session:
        default_product = (
            await session.execute(
                select(AssetProduct).where(
                    AssetProduct.ticker.is_(None),
                    AssetProduct.broker_id.is_(None),
                    AssetProduct.asset_type.is_(None),
                )
            )
        ).scalars().first()
    assert default_product is not None
    default_id = default_product.product_id

    try:
        # No underlying, no broker, no type: the reserved default identity.
        _, _, default_order = await _seed_order(
            "IDNDEF", None, port_type="Managed Fund"
        )
        orders.append(default_order)
        default_choice = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "IDNDEF",
                        "broker_id": None,
                        "create_product": True,
                        "create_source": "manual",
                    }
                ]
            },
        )
        assert default_choice.status_code == 200, default_choice.text
        assert default_choice.json()["created"] == 1

        async with Session() as session:
            default_rows = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker.is_(None),
                        AssetProduct.broker_id.is_(None),
                        AssetProduct.asset_type.is_(None),
                    )
                )
            ).scalars().all()
            default_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.product_id == default_id,
                        AssetSymbol.price_symbol == "IDNDEF",
                    )
                )
            ).scalars().one()
        # Reused, never duplicated: still exactly one default identity row.
        assert len(default_rows) == 1
        assert default_rows[0].product_id == default_id
        assert default_rows[0].multiplier == 1
        assert default_rows[0].margin_rate == 0
        assert default_rows[0].margin_mode == "notional"
        assert default_rows[0].source == "-"
        assert default_symbol.price_symbol == "IDNDEF"
        assert default_symbol.sync_symbol == "IDNDEF"
        assert default_symbol.broker_id is None
        assert default_symbol.contract_kind == "future"

        # The brokerless pair now reads as resolved and re-applying is a no-op.
        proposal = await async_client.get("/api/v1/assets/proposal")
        by_pair = {
            (item["broker_id"], item["symbol"]): item
            for item in proposal.json()["items"]
        }
        assert by_pair[(None, "IDNDEF")]["resolved"] is True
        again = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "IDNDEF",
                        "broker_id": None,
                        "create_product": True,
                        "create_source": "manual",
                    }
                ]
            },
        )
        assert again.status_code == 200, again.text
        assert again.json()["created"] == 0

        # Only a broker: identity (NULL, broker, NULL).
        _, _, broker_order = await _seed_order("IDNBRK", broker_id)
        orders.append(broker_order)
        broker_choice = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "IDNBRK",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_source": "manual",
                    }
                ]
            },
        )
        assert broker_choice.status_code == 200, broker_choice.text
        assert broker_choice.json()["created"] == 1

        # Only a type: identity (NULL, NULL, type) from a managed-fund pair.
        _, _, type_order = await _seed_order("IDNTYP", None, port_type="Managed Fund")
        orders.append(type_order)
        type_choice = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "IDNTYP",
                        "broker_id": None,
                        "create_product": True,
                        "create_source": "manual",
                        "create_asset_type": "stock",
                    }
                ]
            },
        )
        assert type_choice.status_code == 200, type_choice.text
        assert type_choice.json()["created"] == 1

        # All three parts: the typed identity wins.
        _, _, full_order = await _seed_order("IDNFULL", broker_id)
        orders.append(full_order)
        full_choice = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "IDNFULL",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_underlying": " idnfullu ",
                        "create_source": "manual",
                        "create_asset_type": "future",
                    }
                ]
            },
        )
        assert full_choice.status_code == 200, full_choice.text
        assert full_choice.json()["created"] == 1

        async with Session() as session:
            broker_identity = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker.is_(None),
                        AssetProduct.broker_id == broker_id,
                        AssetProduct.asset_type.is_(None),
                    )
                )
            ).scalars().one()
            broker_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.product_id == broker_identity.product_id
                    )
                )
            ).scalars().one()
            type_identity = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker.is_(None),
                        AssetProduct.broker_id.is_(None),
                        AssetProduct.asset_type == "stock",
                    )
                )
            ).scalars().one()
            type_identity_id = type_identity.product_id
            type_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.product_id == type_identity_id
                    )
                )
            ).scalars().one()
            full_identity = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker == "IDNFULLU",
                        AssetProduct.broker_id == broker_id,
                    )
                )
            ).scalars().one()
            full_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.product_id == full_identity.product_id
                    )
                )
            ).scalars().one()
        assert broker_symbol.price_symbol == "IDNBRK"
        assert broker_symbol.contract_kind == "future"
        assert type_symbol.price_symbol == "IDNTYP"
        assert type_symbol.contract_kind == "stock"
        assert full_identity.asset_type == "future"
        assert full_identity.multiplier == 1
        assert full_identity.margin_rate == 0
        assert full_identity.margin_mode == "notional"
        assert full_symbol.price_symbol == "IDNFULL"
        assert full_symbol.contract_kind == "future"

        # A symbol may be attached to the default identity directly, while the
        # default row itself stays uneditable/undeletable.
        attach = await async_client.post(
            f"/api/v1/assets/products/{default_id}/symbols",
            json={"price_symbol": "IDNDIRECT", "sync_symbol": "IDNDIRECT"},
        )
        assert attach.status_code == 201, attach.text
        attached = attach.json()
        assert attached["multiplier_effective"] == 1.0
        assert attached["margin_rate_effective"] == 0.0
        assert attached["multiplier_inherited"] is True
        assert attached["margin_rate_inherited"] is True

        blocked_edit = await async_client.put(
            f"/api/v1/assets/products/{default_id}", json={"multiplier": 2}
        )
        assert blocked_edit.status_code == 400
        assert blocked_edit.json()["detail"] == (
            "The default product is not editable"
        )
        blocked_delete = await async_client.delete(
            f"/api/v1/assets/products/{default_id}"
        )
        assert blocked_delete.status_code == 400
        assert blocked_delete.json()["detail"] == (
            "The default product is not editable"
        )
    finally:
        _, Session = get_test_engine()
        async with Session() as session:
            symbols = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.price_symbol.in_(
                            ["IDNDEF", "IDNTYP", "IDNDIRECT"]
                        )
                    )
                )
            ).scalars().all()
            for symbol in symbols:
                await session.delete(symbol)
            if type_identity_id is not None:
                type_product = await session.get(AssetProduct, type_identity_id)
                if type_product is not None:
                    await session.delete(type_product)
            await session.commit()
        await _delete_orders(*orders)
        await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_apply_create_needs_explicit_source_and_provider(
    async_client, monkeypatch
):
    broker_id = await create_broker(async_client, "SYN4")
    _, _, tfex_order = await _seed_order(
        "S50Z26", broker_id, contract_type="future"
    )
    _, _, manual_order = await _seed_order(
        "MANOPT", broker_id, contract_type="option"
    )
    calls = []

    def fake_fetch(source, sync_symbol):
        calls.append((source, sync_symbol))
        return 10.0, 1.0

    monkeypatch.setattr(registry, "_fetch_quote", fake_fetch)
    base = {"broker_id": broker_id, "create_product": True}

    try:
        missing_source = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "S50Z26",
                        **base,
                        "create_asset_type": "future",
                        "create_sync_symbol": "S50Z26",
                    }
                ]
            },
        )
        assert missing_source.status_code == 400
        assert missing_source.json()["detail"] == (
            "Create needs a price source: yfinance, tfex or manual"
        )

        bad_source = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "S50Z26",
                        **base,
                        "create_source": "polygon",
                        "create_asset_type": "future",
                        "create_sync_symbol": "S50Z26",
                    }
                ]
            },
        )
        assert bad_source.status_code == 400
        assert bad_source.json()["detail"] == (
            "Create needs a price source: yfinance, tfex or manual"
        )

        bad_type = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "S50Z26",
                        **base,
                        "create_source": "tfex",
                        "create_sync_symbol": "S50Z26",
                        "create_asset_type": "bond",
                    }
                ]
            },
        )
        assert bad_type.status_code == 400
        assert bad_type.json()["detail"] == (
            "Create needs an asset type: stock, future, option, crypto or mutual_fund"
        )

        blank_provider = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "S50Z26",
                        **base,
                        "create_source": "yfinance",
                        "create_sync_symbol": "   ",
                        "create_asset_type": "stock",
                    }
                ]
            },
        )
        assert blank_provider.status_code == 400
        assert blank_provider.json()["detail"] == (
            "Create needs the provider symbol (sync_symbol)"
        )

        # Nothing was written by the rejected choices.
        _, Session = get_test_engine()
        async with Session() as session:
            assert (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.broker_id == broker_id
                    )
                )
            ).scalars().first() is None
            assert calls == []

        tfex_created = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "S50Z26",
                        **base,
                        "create_underlying": "TFEXUND",
                        "create_source": "tfex",
                        "create_sync_symbol": "S50Z26",
                        "create_asset_type": "future",
                    }
                ]
            },
        )
        assert tfex_created.status_code == 200, tfex_created.text
        assert tfex_created.json()["created"] == 1
        assert calls == [("tfex", "S50Z26")]

        manual_created = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "MANOPT",
                        **base,
                        "create_underlying": "MANUND",
                        "create_source": "manual",
                        "create_sync_symbol": "",
                        "create_asset_type": "option",
                    }
                ]
            },
        )
        assert manual_created.status_code == 200, manual_created.text
        assert manual_created.json()["created"] == 1
        # A manual product never reaches the provider.
        assert calls == [("tfex", "S50Z26")]

        async with Session() as session:
            tfex_product = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker == "TFEXUND",
                        AssetProduct.broker_id == broker_id,
                    )
                )
            ).scalars().one()
            tfex_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.product_id == tfex_product.product_id
                    )
                )
            ).scalars().one()
            manual_product = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker == "MANUND",
                        AssetProduct.broker_id == broker_id,
                    )
                )
            ).scalars().one()
            manual_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.product_id == manual_product.product_id
                    )
                )
            ).scalars().one()

        assert tfex_product.ticker == "TFEXUND"
        assert tfex_product.source == "tfex"
        assert tfex_product.asset_type == "future"
        assert tfex_symbol.price_symbol == "S50Z26"
        assert tfex_symbol.sync_symbol == "S50Z26"
        assert tfex_symbol.contract_kind == "future"

        assert manual_product.ticker == "MANUND"
        assert manual_product.source == "manual"
        assert manual_product.asset_type == "option"
        assert manual_symbol.price_symbol == "MANOPT"
        assert manual_symbol.sync_symbol == "MANOPT"
        assert manual_symbol.contract_kind == "option"
    finally:
        await _delete_orders(tfex_order, manual_order)
        await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_proposal_includes_managed_fund_sources(async_client):
    broker_id = await create_broker(async_client, "MFP")
    order_ids: list[str] = []
    _, Session = get_test_engine()
    async with Session() as session:
        fund = Portfolio(
            portfolio_name="Fund Proposal",
            port_type="Managed Fund",
            risk_status="Safe",
            broker_id=broker_id,
            x_amount=Decimal("0"),
            available_cash=Decimal("1000"),
            margin_locked=Decimal("0"),
        )
        brokerless_fund = Portfolio(
            portfolio_name="Fund Proposal Unassigned",
            port_type="Managed Fund",
            risk_status="Safe",
            broker_id=None,
            x_amount=Decimal("0"),
            available_cash=Decimal("0"),
            margin_locked=Decimal("0"),
        )
        session.add_all([fund, brokerless_fund])
        await session.flush()
        session.add_all(
            [
                ManagedFundHolding(
                    portfolio_id=fund.portfolio_id,
                    asset="fund.a ",
                    qty=Decimal("10"),
                ),
                ManagedFundHolding(
                    portfolio_id=brokerless_fund.portfolio_id,
                    asset="FUNDNULL",
                    qty=Decimal("5"),
                ),
                ManagedFundOrder(
                    portfolio_id=fund.portfolio_id,
                    asset="FUNDP",
                    side="Buy",
                    qty=Decimal("1"),
                    price=Decimal("10"),
                    status="pending",
                ),
                # Final statuses are history, never proposal sources.
                ManagedFundOrder(
                    portfolio_id=fund.portfolio_id,
                    asset="FUNDDONE",
                    side="Buy",
                    qty=Decimal("1"),
                    status="done",
                ),
                ManagedFundOrder(
                    portfolio_id=fund.portfolio_id,
                    asset="FUNDCANC",
                    side="Buy",
                    qty=Decimal("1"),
                    status="cancelled",
                ),
            ]
        )
        await session.commit()
        fund_ids = [fund.portfolio_id, brokerless_fund.portfolio_id]

    try:
        # One active order shares the holding symbol: the pair must merge.
        _, _, shared_order = await _seed_order(
            "FUND.A", broker_id, contract_type="future"
        )
        order_ids.append(shared_order)

        proposal = await async_client.get("/api/v1/assets/proposal")
        assert proposal.status_code == 200, proposal.text
        items = proposal.json()["items"]
        by_key = {(item["broker_id"], item["symbol"]): item for item in items}

        # Normalized dedupe: the holding ("fund.a ") and the order ("FUND.A")
        # are one row, with the active order's contract-type hint.
        assert len(
            [
                item
                for item in items
                if item["broker_id"] == broker_id and item["symbol"] == "FUND.A"
            ]
        ) == 1
        shared = by_key[(broker_id, "FUND.A")]
        assert shared["order_asset_types"] == ["future"]
        assert shared["broker_required"] is False
        assert shared["resolved"] is False

        # A fund-only pair carries no contract-type guess.
        fund_order_item = by_key[(broker_id, "FUNDP")]
        assert fund_order_item["order_asset_types"] == []
        assert fund_order_item["broker_required"] is False

        # A brokerless fund portfolio records its symbol under NULL.
        brokerless_item = by_key[(None, "FUNDNULL")]
        assert brokerless_item["broker_code"] is None
        assert brokerless_item["broker_required"] is False
        assert brokerless_item["order_asset_types"] == []

        # Final-status fund orders are not proposal sources.
        symbols = {item["symbol"] for item in items}
        assert "FUNDDONE" not in symbols
        assert "FUNDCANC" not in symbols

        # Apply creates the identity for a fund symbol exactly like any other
        # source: product ticker = underlying, symbol key = order symbol.
        created = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "FUNDP",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_underlying": "FUNDUND",
                        "create_source": "manual",
                        "create_sync_symbol": "",
                        "create_asset_type": "mutual_fund",
                    }
                ]
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["created"] == 1

        async with Session() as session:
            fund_product = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker == "FUNDUND",
                        AssetProduct.broker_id == broker_id,
                    )
                )
            ).scalars().one()
            fund_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.product_id == fund_product.product_id
                    )
                )
            ).scalars().one()
        assert fund_product.asset_type == "mutual_fund"
        assert fund_symbol.price_symbol == "FUNDP"
        assert fund_symbol.sync_symbol == "FUNDP"
        assert fund_symbol.contract_kind == "mutual_fund"

        # The same fund symbol is now resolved and can attach to that product.
        refreshed = {
            (item["broker_id"], item["symbol"]): item
            for item in (
                await async_client.get("/api/v1/assets/proposal")
            ).json()["items"]
        }
        assert refreshed[(broker_id, "FUNDP")]["resolved"] is True

        _, _, second_order = await _seed_order(
            "FUNDP2", broker_id, contract_type="spot"
        )
        order_ids.append(second_order)
        attached = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "FUNDP2",
                        "broker_id": broker_id,
                        "product_id": fund_product.product_id,
                    }
                ]
            },
        )
        assert attached.status_code == 200, attached.text
        assert attached.json()["created"] == 1
    finally:
        await _delete_orders(*order_ids)
        await cleanup_brokers(broker_id)
        async with Session() as session:
            for model in (ManagedFundOrder, ManagedFundHolding):
                await session.execute(
                    delete(model).where(model.portfolio_id.in_(fund_ids))
                )
            await session.execute(
                delete(Portfolio).where(Portfolio.portfolio_id.in_(fund_ids))
            )
            await session.commit()


@pytest.mark.asyncio
async def test_mutual_fund_identity_and_apply_create(async_client):
    broker_id = await create_broker(async_client, "FUND")
    plain = await create_product(
        async_client,
        ticker="PLAINF",
        broker_id=broker_id,
        asset_type="stock",
        source="manual",
    )
    order_ids = []
    try:
        fund = await create_product(
            async_client,
            ticker="FUNDX",
            broker_id=broker_id,
            asset_type="mutual_fund",
            multiplier=1,
            margin_rate=0.05,
            margin_mode="notional",
            source="manual",
        )
        assert fund["asset_type"] == "mutual_fund"
        assert fund["margin_rate"] == 0.05

        # The type is a free string on products: update onto and away from it.
        moved = await async_client.put(
            f"/api/v1/assets/products/{plain['product_id']}",
            json={"asset_type": "mutual_fund"},
        )
        assert moved.status_code == 200, moved.text
        assert moved.json()["asset_type"] == "mutual_fund"

        # A contract's type derives from the fund identity; the supplied value
        # must match it.
        matching = await create_symbol(
            async_client,
            fund["product_id"],
            price_symbol="FUNDS",
            sync_symbol="FUNDS",
            contract_kind="mutual_fund",
        )
        assert matching.status_code == 201, matching.text
        assert matching.json()["contract_kind"] == "mutual_fund"
        omitted = await create_symbol(
            async_client,
            fund["product_id"],
            price_symbol="FUNDS2",
            sync_symbol="FUNDS2",
        )
        assert omitted.status_code == 201, omitted.text
        assert omitted.json()["contract_kind"] == "mutual_fund"
        mismatched = await create_symbol(
            async_client,
            fund["product_id"],
            price_symbol="FUNDS3",
            sync_symbol="FUNDS3",
            contract_kind="stock",
        )
        assert mismatched.status_code == 400
        assert mismatched.json()["detail"] == (
            "contract type is set by the underlying + broker + type"
        )

        # Apply-create: the fund identity is created as its own product and the
        # order symbol stays the contract key.
        _, _, create_order = await _seed_order(
            "FUNDORD", broker_id, contract_type="spot"
        )
        order_ids.append(create_order)
        created = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "FUNDORD",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_underlying": "FUNDUND",
                        "create_source": "manual",
                        "create_sync_symbol": "",
                        "create_asset_type": "mutual_fund",
                    }
                ]
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["created"] == 1

        _, Session = get_test_engine()
        async with Session() as session:
            fund_product = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker == "FUNDUND",
                        AssetProduct.broker_id == broker_id,
                    )
                )
            ).scalars().one()
            created_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.product_id == fund_product.product_id
                    )
                )
            ).scalars().one()
        assert fund_product.asset_type == "mutual_fund"
        assert fund_product.source == "manual"
        assert created_symbol.price_symbol == "FUNDORD"
        assert created_symbol.sync_symbol == "FUNDORD"
        assert created_symbol.contract_kind == "mutual_fund"

        # The existing-product branch accepts the fund identity too (contract
        # kind derives without the option-terms requirement).
        _, _, second_order = await _seed_order(
            "FUNDORD2", broker_id, contract_type="spot"
        )
        order_ids.append(second_order)
        attached = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "FUNDORD2",
                        "broker_id": broker_id,
                        "product_id": fund_product.product_id,
                    }
                ]
            },
        )
        assert attached.status_code == 200, attached.text
        assert attached.json()["created"] == 1
        async with Session() as session:
            second_symbol = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.price_symbol == "FUNDORD2"
                    )
                )
            ).scalars().one()
        assert second_symbol.product_id == fund_product.product_id
        assert second_symbol.contract_kind == "mutual_fund"

        # Unknown types still use the widened exact message.
        rejected = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "FUNDORD",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_underlying": "BADFUND",
                        "create_source": "manual",
                        "create_sync_symbol": "",
                        "create_asset_type": "fund",
                    }
                ]
            },
        )
        assert rejected.status_code == 400
        assert rejected.json()["detail"] == (
            "Create needs an asset type: stock, future, option, crypto or "
            "mutual_fund"
        )
    finally:
        await _delete_orders(*order_ids)
        await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_mutual_fund_margin_notional_and_span(async_client):
    _, Session = get_test_engine()
    async with Session() as session:
        broker = Broker(code="MFMG", name="Fund Margin Broker")
        session.add(broker)
        await session.flush()
        notional = AssetProduct(
            ticker="FNDN",
            broker_id=broker.id,
            asset_type="mutual_fund",
            multiplier=Decimal("1"),
            margin_rate=Decimal("0.05"),
            margin_mode="notional",
            source="-",
        )
        span = AssetProduct(
            ticker="FNDS",
            broker_id=broker.id,
            asset_type="mutual_fund",
            multiplier=Decimal("2"),
            margin_rate=Decimal("0"),
            margin_mode="span",
            margin_per_contract=Decimal("7"),
            source="-",
        )
        session.add_all([notional, span])
        await session.flush()
        session.add_all(
            [
                AssetSymbol(
                    product_id=notional.product_id,
                    broker_id=broker.id,
                    price_symbol="FNDN",
                    sync_symbol="FNDN",
                ),
                AssetSymbol(
                    product_id=span.product_id,
                    broker_id=broker.id,
                    price_symbol="FNDS",
                    sync_symbol="FNDS",
                ),
            ]
        )
        portfolio = Portfolio(
            portfolio_name="Fund Margin",
            port_type="Active Trading",
            risk_status="Safe",
            broker_id=broker.id,
            product_ticker="FNDN",
            product_tickers=["FNDN"],
            product_type="mutual_fund",
            x_amount=Decimal("50"),
            available_cash=Decimal("1000"),
            margin_locked=Decimal("0"),
        )
        session.add(portfolio)
        await session.flush()
        plan = TradePlan(portfolio_id=portfolio.portfolio_id)
        session.add(plan)
        await session.flush()
        for asset, qty in (("FNDN", 2), ("FNDS", 3)):
            session.add(
                ActiveOrder(
                    plan_id=plan.plan_id,
                    portfolio_id=portfolio.portfolio_id,
                    asset_type=asset,
                    side="Buy",
                    qty=Decimal(str(qty)),
                    entry_price=Decimal("100"),
                    current_price=Decimal("100"),
                    contract_type="spot",
                )
            )
        await session.commit()
        portfolio_id = portfolio.portfolio_id
        broker_id = broker.id

    try:
        async with Session() as session:
            loaded = await session.get(Portfolio, portfolio_id)
            orders = (
                await session.execute(
                    select(ActiveOrder).where(
                        ActiveOrder.portfolio_id == portfolio_id
                    )
                )
            ).scalars().all()
            margin = await compute_margin_locked(session, loaded)
            risk = await compute_risk(session, loaded, orders)

        # A fund behaves like any non-option: notional 100×1×2×0.05 = 10 and
        # span 3×7 = 21, counted in the equity bucket.
        assert margin == pytest.approx(31.0)
        assert risk["margin_locked"] == pytest.approx(31.0)
        assert risk["eq"]["orders"] == 2
        assert risk["options"]["buckets"] == {
            "short_call": {"orders": 0, "lots": 0.0, "avg_premium": 0.0, "pl": 0.0},
            "short_put": {"orders": 0, "lots": 0.0, "avg_premium": 0.0, "pl": 0.0},
            "long_call": {"orders": 0, "lots": 0.0, "avg_premium": 0.0, "pl": 0.0},
            "long_put": {"orders": 0, "lots": 0.0, "avg_premium": 0.0, "pl": 0.0},
        }
        # Display values resolve the typed fund identity.
        assert risk["multiplier"] == 1.0
        assert risk["margin_rate"] == 0.05
    finally:
        async with Session() as session:
            await session.execute(
                delete(ActiveOrder).where(ActiveOrder.portfolio_id == portfolio_id)
            )
            await session.execute(
                delete(TradePlan).where(TradePlan.portfolio_id == portfolio_id)
            )
            await session.execute(
                delete(AssetSymbol).where(AssetSymbol.broker_id == broker_id)
            )
            await session.execute(
                delete(AssetProduct).where(AssetProduct.broker_id == broker_id)
            )
            await session.execute(
                delete(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
            )
            await session.execute(delete(Broker).where(Broker.id == broker_id))
            await session.commit()


@pytest.mark.asyncio
async def test_product_rename_cascade_and_prechecks(async_client):
    broker_id = await create_broker(async_client, "REN1")
    product = await create_product(
        async_client,
        ticker="RENOLD",
        broker_id=broker_id,
        asset_type="stock",
        source="manual",
    )
    symbol = (
        await create_symbol(
            async_client,
            product["product_id"],
            price_symbol="RENOLD",
            sync_symbol="RENOLD.BK",
        )
    ).json()
    await async_client.put(
        f"/api/v1/assets/symbols/{symbol['symbol_id']}/quote",
        json={"price": 5.0, "change_24h": 0.0},
    )

    portfolio_id, _, order_id = await _seed_order("RENOLD", broker_id)
    _, Session = get_test_engine()
    async with Session() as session:
        db_portfolio = await session.get(Portfolio, portfolio_id)
        db_portfolio.product_tickers = ["RENOLD", "OTHER"]
        db_portfolio.product_ticker = "RENOLD"
        await session.commit()

    try:
        # Product identity precheck.
        await create_product(
            async_client, ticker="TAKEN", broker_id=broker_id, asset_type="stock"
        )
        conflict = await async_client.put(
            f"/api/v1/assets/products/{product['product_id']}",
            json={"ticker": "TAKEN"},
        )
        assert conflict.status_code == 400
        assert conflict.json()["detail"] == "An asset with this ticker already exists"

        # Broker-scoped normalized symbol precheck.
        other_product = await create_product(
            async_client, ticker="P2", broker_id=broker_id, asset_type="stock"
        )
        p3_product = await create_product(
            async_client, ticker="P3", broker_id=broker_id, asset_type="stock"
        )
        await create_symbol(
            async_client, p3_product["product_id"], price_symbol="RENSYM", sync_symbol="R3"
        )
        symbol_conflict = await async_client.put(
            f"/api/v1/assets/products/{other_product['product_id']}",
            json={"ticker": "RENSYM"},
        )
        assert symbol_conflict.status_code == 400
        assert symbol_conflict.json()["detail"] == "An asset with this ticker already exists"

        renamed = await async_client.put(
            f"/api/v1/assets/products/{product['product_id']}",
            json={"ticker": "RENNEW"},
        )
        assert renamed.status_code == 200, renamed.text
        assert renamed.json()["ticker"] == "RENNEW"

        async with Session() as session:
            db_symbol = await session.get(AssetSymbol, symbol["symbol_id"])
            db_order = await session.get(ActiveOrder, order_id)
            db_portfolio = await session.get(Portfolio, portfolio_id)
            quote = (
                await session.execute(
                    select(AssetQuote).where(
                        AssetQuote.source == "manual",
                        AssetQuote.sync_symbol == "RENOLD.BK",
                    )
                )
            ).scalars().first()
        assert db_symbol.price_symbol == "RENNEW"
        assert db_symbol.sync_symbol == "RENOLD.BK"
        assert db_order.asset_type == "RENNEW"
        assert db_portfolio.product_ticker == "RENNEW"
        assert db_portfolio.product_tickers == ["RENNEW", "OTHER"]
        assert quote is not None and float(quote.price) == 5.0
        assert quote.change_24h == 0
    finally:
        await _delete_orders(order_id)
        await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_margin_modes_overrides_and_display_risk(async_client):
    _, Session = get_test_engine()
    async with Session() as session:
        broker = Broker(code="MRG1", name="Margin Broker")
        session.add(broker)
        await session.flush()
        portfolio = Portfolio(
            portfolio_name="Margin Portfolio",
            port_type="Active Trading",
            broker_id=broker.id,
            product_ticker="N",
            product_tickers=["N"],
            x_amount=Decimal("50"),
            available_cash=Decimal("10000"),
            margin_locked=Decimal("999"),
        )
        stored_portfolio = Portfolio(
            portfolio_name="Stored Margin",
            port_type="Managed Fund",
            broker_id=broker.id,
            margin_locked=Decimal("123"),
            available_cash=Decimal("0"),
        )
        session.add_all([portfolio, stored_portfolio])
        await session.flush()

        def product(ticker, multiplier, rate, mode, span=None):
            return AssetProduct(
                ticker=ticker,
                broker_id=broker.id,
                asset_type="stock",
                multiplier=Decimal(str(multiplier)),
                margin_rate=Decimal(str(rate)),
                margin_mode=mode,
                margin_per_contract=None if span is None else Decimal(str(span)),
                source="-",
            )

        products = {
            "N": product("N", 2, 0.1, "notional"),
            "P": product("P", 2, 0.5, "premium"),
            # The span margin is identity-owned: qty × 7 = 21 for S.
            "S": product("S", 3, 0.2, "span", span=7),
            # O carries its 5 / 0.2 on the identity; contracts cannot override.
            "O": product("O", 5, 0.2, "notional"),
            "S2": product("S2", 1, 0.5, "span"),
            "Z": product("Z", 1, 0, "notional"),
        }
        session.add_all(products.values())
        await session.flush()
        session.add_all(
            [
                AssetSymbol(
                    product_id=products["N"].product_id,
                    broker_id=broker.id,
                    price_symbol="N",
                    sync_symbol="N",
                ),
                AssetSymbol(
                    product_id=products["P"].product_id,
                    broker_id=broker.id,
                    price_symbol="P",
                    sync_symbol="P",
                ),
                AssetSymbol(
                    product_id=products["S"].product_id,
                    broker_id=broker.id,
                    price_symbol="S",
                    sync_symbol="S",
                ),
                AssetSymbol(
                    product_id=products["O"].product_id,
                    broker_id=broker.id,
                    price_symbol="O",
                    sync_symbol="O",
                ),
                AssetSymbol(
                    product_id=products["S2"].product_id,
                    broker_id=broker.id,
                    price_symbol="S2",
                    sync_symbol="S2",
                ),
                AssetSymbol(
                    product_id=products["Z"].product_id,
                    broker_id=broker.id,
                    price_symbol="Z",
                    sync_symbol="Z",
                ),
            ]
        )
        plan = TradePlan(portfolio_id=portfolio.portfolio_id)
        session.add(plan)
        await session.flush()
        orders = [
            ("N", "spot", Decimal("3"), Decimal("100")),
            ("P", "spot", Decimal("3"), Decimal("100")),
            ("S", "spot", Decimal("3"), Decimal("100")),
            ("O", "spot", Decimal("2"), Decimal("100")),
            ("S2", "spot", Decimal("2"), Decimal("100")),
            ("N", "option", Decimal("1"), Decimal("100")),
            ("Z", "option", Decimal("1"), Decimal("100")),
            ("MISS", "spot", Decimal("9"), Decimal("100")),
        ]
        for asset_type, contract_type, qty, mark in orders:
            session.add(
                ActiveOrder(
                    plan_id=plan.plan_id,
                    portfolio_id=portfolio.portfolio_id,
                    asset_type=asset_type,
                    side="Buy",
                    qty=qty,
                    entry_price=mark,
                    current_price=mark,
                    contract_type=contract_type,
                    margin_rate=Decimal("0.9"),  # ignored by the registry formula
                )
            )
        # Missing mark and missing quantity contribute zero.
        session.add(
            ActiveOrder(
                plan_id=plan.plan_id,
                portfolio_id=portfolio.portfolio_id,
                asset_type="N",
                side="Buy",
                qty=Decimal("1"),
                contract_type="spot",
            )
        )
        session.add(
            ActiveOrder(
                plan_id=plan.plan_id,
                portfolio_id=portfolio.portfolio_id,
                asset_type="N",
                side="Buy",
                entry_price=Decimal("100"),
                current_price=Decimal("100"),
                contract_type="spot",
            )
        )
        await session.commit()
        portfolio_id = portfolio.portfolio_id
        stored_portfolio_id = stored_portfolio.portfolio_id
        broker_id = broker.id

    try:
        async with Session() as session:
            loaded = await session.get(Portfolio, portfolio_id)
            stored = await session.get(Portfolio, stored_portfolio_id)
            margin = await compute_margin_locked(session, loaded)
            stored_margin = await compute_margin_locked(session, stored)
            no_db = await compute_margin_locked(None, loaded)
            orders = (
                await session.execute(
                    select(ActiveOrder).where(
                        ActiveOrder.portfolio_id == portfolio_id
                    )
                )
            ).scalars().all()
            risk = await compute_risk(session, loaded, orders)

        # notional 60 + premium 600 + span 21 + override 200 + span-fallback 200
        # (+ zero-rate option 0, missing spec/mark/qty 0).
        assert margin == pytest.approx(1101.0)
        assert stored_margin == pytest.approx(123.0)
        assert no_db == pytest.approx(999.0)

        # Display fields only from the first product_tickers entry.
        assert risk["multiplier"] == 2.0
        assert risk["margin_rate"] == 0.1
        # Per-order sizing uses the identity values (O: multiplier 5).
        assert risk["eq"]["orders"] == 6
        assert risk["eq"]["size0"] == pytest.approx(
            600.0 + 600.0 + 900.0 + 1000.0 + 200.0 + 900.0
        )

        # Non-Active portfolio keeps its stored margin in the overview sum.
        overview = await async_client.get("/api/v1/analytics/overview")
        assert overview.status_code == 200
        rows = {
            row["portfolio_id"]: row
            for row in overview.json()["portfolios"]
        }
        assert rows[stored_portfolio_id]["margin_locked"] == pytest.approx(123.0)
        assert rows[portfolio_id]["margin_locked"] == pytest.approx(1101.0)

        # Unresolved/empty product lists default to 1.0 / 0.0 without a DB call.
        from types import SimpleNamespace

        empty = SimpleNamespace(
            portfolio_id=0,
            port_type="Active Trading",
            broker_id=None,
            product_tickers=[],
            product_ticker=None,
            x_amount=0,
            available_cash=0,
            margin_locked=0,
        )
        empty_risk = await compute_risk(None, empty, [])
        assert empty_risk["multiplier"] == 1.0
        assert empty_risk["margin_rate"] == 0.0
    finally:
        async with Session() as session:
            await session.execute(
                delete(ActiveOrder).where(ActiveOrder.portfolio_id == portfolio_id)
            )
            await session.execute(
                delete(TradePlan).where(TradePlan.portfolio_id == portfolio_id)
            )
            await session.execute(
                delete(AssetSymbol).where(AssetSymbol.broker_id == broker_id)
            )
            await session.execute(
                delete(AssetProduct).where(AssetProduct.broker_id == broker_id)
            )
            await session.execute(
                delete(Portfolio).where(
                    Portfolio.portfolio_id.in_([portfolio_id, stored_portfolio_id])
                )
            )
            await session.execute(delete(Broker).where(Broker.id == broker_id))
            await session.commit()


@pytest.mark.asyncio
async def test_portfolio_product_type_display_identity(async_client):
    _, Session = get_test_engine()
    async with Session() as session:
        broker = Broker(code="PTYP", name="Portfolio Type Broker")
        session.add(broker)
        await session.flush()
        stock = AssetProduct(
            ticker="SHARED",
            broker_id=broker.id,
            asset_type="stock",
            multiplier=Decimal("1"),
            margin_rate=Decimal("0"),
            margin_mode="notional",
            source="-",
        )
        future = AssetProduct(
            ticker="SHARED",
            broker_id=broker.id,
            asset_type="future",
            multiplier=Decimal("200"),
            margin_rate=Decimal("0.1"),
            margin_mode="notional",
            source="-",
        )
        session.add_all([stock, future])
        await session.flush()
        symbol = AssetSymbol(
            product_id=future.product_id,
            broker_id=broker.id,
            price_symbol="SHFUT",
            sync_symbol="SHFUT",
        )
        portfolio = Portfolio(
            portfolio_name="Typed Identity",
            port_type="Active Trading",
            risk_status="Safe",
            broker_id=broker.id,
            product_ticker="SHARED",
            product_tickers=["SHARED"],
            product_type="stock",
            x_amount=Decimal("50"),
            available_cash=Decimal("1000"),
            margin_locked=Decimal("0"),
        )
        session.add_all([symbol, portfolio])
        await session.flush()
        plan = TradePlan(portfolio_id=portfolio.portfolio_id)
        session.add(plan)
        await session.flush()
        # One contract on the future identity: per-order margin must keep using
        # this order's own spec whatever the portfolio display type says.
        session.add(
            ActiveOrder(
                plan_id=plan.plan_id,
                portfolio_id=portfolio.portfolio_id,
                asset_type="SHFUT",
                side="Buy",
                qty=Decimal("1"),
                entry_price=Decimal("10"),
                current_price=Decimal("10"),
                contract_type="spot",
            )
        )
        await session.commit()
        portfolio_id = portfolio.portfolio_id
        broker_id = broker.id

    try:
        async with Session() as session:
            loaded = await session.get(Portfolio, portfolio_id)
            orders = (
                await session.execute(
                    select(ActiveOrder).where(
                        ActiveOrder.portfolio_id == portfolio_id
                    )
                )
            ).scalars().all()
            risk_stock = await compute_risk(session, loaded, orders)
            # Two products share the ticker: the type picks the identity.
            loaded.product_type = "future"
            risk_future = await compute_risk(session, loaded, orders)
            # Without a type the ticker is ambiguous -> display fallback 1 / 0.
            loaded.product_type = None
            risk_untyped = await compute_risk(session, loaded, orders)

        assert risk_stock["multiplier"] == 1.0
        assert risk_stock["margin_rate"] == 0.0
        assert risk_future["multiplier"] == 200.0
        assert risk_future["margin_rate"] == 0.1
        assert risk_untyped["multiplier"] == 1.0
        assert risk_untyped["margin_rate"] == 0.0
        # Per-order margin is unchanged: 10 × 200 × 1 × 0.1 from SHFUT's own
        # future identity in every display mode.
        assert risk_stock["margin_locked"] == pytest.approx(200.0)
        assert risk_future["margin_locked"] == pytest.approx(200.0)
        assert risk_untyped["margin_locked"] == pytest.approx(200.0)

        # Payloads expose the stored type on detail, list and analytics grids.
        detail = await async_client.get(f"/api/v1/portfolios/{portfolio_id}")
        assert detail.status_code == 200
        assert detail.json()["product_type"] == "stock"
        listed = {
            row["portfolio_id"]: row
            for row in (await async_client.get("/api/v1/portfolios")).json()
        }
        assert listed[portfolio_id]["product_type"] == "stock"

        future_update = await async_client.put(
            f"/api/v1/portfolios/{portfolio_id}",
            json={"product_type": "future"},
        )
        assert future_update.status_code == 200, future_update.text
        assert future_update.json()["product_type"] == "future"
        assert future_update.json()["product_ticker"] == "SHARED"
        grid = {
            row["portfolio_id"]: row
            for row in (
                await async_client.get("/api/v1/analytics/portfolio-grid")
            ).json()
        }
        assert grid[portfolio_id]["product_type"] == "future"

        invalid = await async_client.put(
            f"/api/v1/portfolios/{portfolio_id}",
            json={"product_type": "bond"},
        )
        assert invalid.status_code == 400
        assert invalid.json()["detail"] == (
            "product_type must be one of stock, future, option, crypto or mutual_fund"
        )
        cleared = await async_client.put(
            f"/api/v1/portfolios/{portfolio_id}", json={"product_type": None}
        )
        assert cleared.status_code == 200
        assert cleared.json()["product_type"] is None
        assert cleared.json()["product_ticker"] == "SHARED"
    finally:
        async with Session() as session:
            await session.execute(
                delete(ActiveOrder).where(ActiveOrder.portfolio_id == portfolio_id)
            )
            await session.execute(
                delete(TradePlan).where(TradePlan.portfolio_id == portfolio_id)
            )
            await session.execute(
                delete(AssetSymbol).where(AssetSymbol.broker_id == broker_id)
            )
            await session.execute(
                delete(AssetProduct).where(AssetProduct.broker_id == broker_id)
            )
            await session.execute(
                delete(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
            )
            await session.execute(delete(Broker).where(Broker.id == broker_id))
            await session.commit()


@pytest.mark.asyncio
async def test_symbol_payload_effective_and_inherited_contract_values(async_client):
    broker_id = await create_broker(async_client, "EFF1")
    try:
        product = await create_product(
            async_client,
            ticker="EFF1",
            broker_id=broker_id,
            asset_type="future",
            multiplier=2.5,
            margin_rate=0.25,
        )
        assert product["multiplier"] == 2.5
        assert product["margin_rate"] == 0.25

        inherited_resp = await create_symbol(
            async_client,
            product["product_id"],
            price_symbol="EFF1",
            sync_symbol="EFF1.BK",
        )
        assert inherited_resp.status_code == 201, inherited_resp.text
        inherited = inherited_resp.json()
        assert inherited["multiplier_override"] is None
        assert inherited["margin_rate_override"] is None
        assert inherited["multiplier_effective"] == 2.5
        assert inherited["margin_rate_effective"] == 0.25
        assert inherited["multiplier_inherited"] is True
        assert inherited["margin_rate_inherited"] is True

        rejected_multiplier = await create_symbol(
            async_client,
            product["product_id"],
            price_symbol="EFF1-M",
            sync_symbol="EFF1-M.BK",
            multiplier_override=4,
        )
        assert rejected_multiplier.status_code == 400
        assert rejected_multiplier.json()["detail"] == (
            "multiplier is set on the underlying + broker + type, not on the "
            "contract"
        )

        rejected_rate = await create_symbol(
            async_client,
            product["product_id"],
            price_symbol="EFF1-R",
            sync_symbol="EFF1-R.BK",
            margin_rate_override=0.5,
        )
        assert rejected_rate.status_code == 400
        assert rejected_rate.json()["detail"] == (
            "margin_rate is set on the underlying + broker + type, not on the "
            "contract"
        )

        # The span margin is identity-owned too: a supplied contract value is
        # refused, and the symbol payload mirrors the product's value.
        rejected_span = await create_symbol(
            async_client,
            product["product_id"],
            price_symbol="EFF1-S",
            sync_symbol="EFF1-S.BK",
            margin_per_contract=7,
        )
        assert rejected_span.status_code == 400
        assert rejected_span.json()["detail"] == (
            "margin per contract is set on the underlying + broker + type, "
            "not on the contract"
        )

        product_span = await async_client.put(
            f"/api/v1/assets/products/{product['product_id']}",
            json={"margin_per_contract": 7},
        )
        assert product_span.status_code == 200, product_span.text
        assert product_span.json()["margin_per_contract"] == 7.0

        span_resp = await create_symbol(
            async_client,
            product["product_id"],
            price_symbol="EFF1-S",
            sync_symbol="EFF1-S.BK",
        )
        assert span_resp.status_code == 201, span_resp.text
        span = span_resp.json()
        assert span["margin_per_contract"] == 7.0
        assert span["contract_kind"] == "future"
        assert span["multiplier_effective"] == 2.5
        assert span["margin_rate_effective"] == 0.25
        assert span["multiplier_inherited"] is True
        assert span["margin_rate_inherited"] is True
        assert span["multiplier_override"] is None
        assert span["margin_rate_override"] is None

        rejected_update = await async_client.put(
            f"/api/v1/assets/symbols/{span['symbol_id']}",
            json={"multiplier_override": 3},
        )
        assert rejected_update.status_code == 400
        assert rejected_update.json()["detail"] == (
            "multiplier is set on the underlying + broker + type, not on the "
            "contract"
        )
        rejected_span_update = await async_client.put(
            f"/api/v1/assets/symbols/{span['symbol_id']}",
            json={"margin_per_contract": 9},
        )
        assert rejected_span_update.status_code == 400
        assert rejected_span_update.json()["detail"] == (
            "margin per contract is set on the underlying + broker + type, "
            "not on the contract"
        )

        # Editing the identity moves both effective values; the contract never
        # carries its own.
        updated_product = await async_client.put(
            f"/api/v1/assets/products/{product['product_id']}",
            json={"multiplier": 6, "margin_rate": 0.4},
        )
        assert updated_product.status_code == 200, updated_product.text
        listed = await async_client.get(
            f"/api/v1/assets/symbols?product_id={product['product_id']}"
        )
        assert listed.status_code == 200, listed.text
        by_symbol = {row["price_symbol"]: row for row in listed.json()}
        assert by_symbol["EFF1"]["multiplier_effective"] == 6.0
        assert by_symbol["EFF1"]["margin_rate_effective"] == 0.4
        assert by_symbol["EFF1"]["multiplier_inherited"] is True
        assert by_symbol["EFF1"]["margin_rate_inherited"] is True
        # The span value is untouched by an unrelated identity edit.
        assert by_symbol["EFF1-S"]["margin_per_contract"] == 7.0

        # A product with neither value falls back to multiplier 1 / rate 0 and
        # both stay inherited — the same rule risk_calc applies without a spec.
        _, Session = get_test_engine()
        async with Session() as session:
            fallback = await registry.symbol_payload(
                session,
                AssetSymbol(sync_symbol="NOQUOTE"),
                AssetProduct(),
            )
        assert fallback["multiplier_effective"] == 1.0
        assert fallback["margin_rate_effective"] == 0.0
        assert fallback["multiplier_inherited"] is True
        assert fallback["margin_rate_inherited"] is True
        assert fallback["margin_per_contract"] is None
        assert fallback["contract_kind"] == "future"

        # The batched order-underlying resolver leaves brokerless and unknown
        # pairs unassigned instead of borrowing another broker's product.
        async with Session() as session:
            assert (
                await registry.resolve_underlyings(
                    session,
                    [(None, "EFF1"), (broker_id, "UNKNOWN"), (broker_id, None)],
                )
                == {}
            )
            assert await registry.resolve_underlyings(
                session, [(broker_id, "eff1")]
            ) == {(broker_id, "EFF1"): "EFF1"}
    finally:
        await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_blank_underlying_is_valid_only_when_scoped(async_client):
    broker_id = await create_broker(async_client, "UNS1")
    unscoped_id = None
    try:
        # Blank + broker: unassigned but scoped, so the product is valid.
        scoped_resp = await async_client.post(
            "/api/v1/assets/products",
            json={"ticker": "   ", "broker_id": broker_id},
        )
        assert scoped_resp.status_code == 201, scoped_resp.text
        scoped = scoped_resp.json()
        assert scoped["ticker"] is None
        assert scoped["broker_id"] == broker_id
        assert scoped["asset_type"] is None

        # Blank + broker + type is a second valid scoped identity.
        typed_resp = await async_client.post(
            "/api/v1/assets/products",
            json={"ticker": "", "broker_id": broker_id, "asset_type": "future"},
        )
        assert typed_resp.status_code == 201, typed_resp.text
        typed = typed_resp.json()
        assert typed["ticker"] is None
        assert typed["asset_type"] == "future"

        # Blank with neither broker nor type is the reserved default identity.
        reserved = await async_client.post(
            "/api/v1/assets/products", json={"ticker": " "}
        )
        assert reserved.status_code == 400
        assert reserved.json()["detail"] == "Ticker is required"

        # A blank-ticker scoped product is not the default and stays editable.
        _, Session = get_test_engine()
        async with Session() as session:
            stored = await session.get(AssetProduct, scoped["product_id"])
            assert stored is not None
            assert registry.is_default_product(stored) is False
        edited = await async_client.put(
            f"/api/v1/assets/products/{scoped['product_id']}",
            json={"name": "Unassigned underlying"},
        )
        assert edited.status_code == 200, edited.text
        assert edited.json()["ticker"] is None
        assert edited.json()["name"] == "Unassigned underlying"

        # Blanking an existing ticker keeps the scoped product valid.
        named = await create_product(
            async_client,
            ticker="UNS1-OLD",
            broker_id=broker_id,
            asset_type="stock",
        )
        blanked_resp = await async_client.put(
            f"/api/v1/assets/products/{named['product_id']}",
            json={"ticker": "   "},
        )
        assert blanked_resp.status_code == 200, blanked_resp.text
        blanked = blanked_resp.json()
        assert blanked["ticker"] is None
        assert blanked["broker_id"] == broker_id
        assert blanked["asset_type"] == "stock"

        # Blanking the ticker while clearing the only scope is refused.
        unscoped = await create_product(async_client, ticker="UNS1-NOSCOPE")
        unscoped_id = unscoped["product_id"]
        refused = await async_client.put(
            f"/api/v1/assets/products/{unscoped_id}", json={"ticker": ""}
        )
        assert refused.status_code == 400
        assert refused.json()["detail"] == "Ticker is required"

        # Unassigned products are listed, scoped by broker or by type.
        listed = await async_client.get("/api/v1/assets/products")
        assert listed.status_code == 200, listed.text
        listed_ids = {row["product_id"] for row in listed.json()}
        assert scoped["product_id"] in listed_ids
        assert typed["product_id"] in listed_ids
    finally:
        if unscoped_id is not None:
            await async_client.delete(f"/api/v1/assets/products/{unscoped_id}")
        await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_custom_flat_assets_rename_cascade_validations_and_order_bypass(
    async_client, monkeypatch
):
    from app.routers import active_orders as active_orders_router

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(custom_metadata.create_all)
    CustomSession = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with CustomSession() as seed:
        asset = CustomAsset(
            ticker="OLD", asset_type="stock", name="OLD", source="manual"
        )
        seed.add(asset)
        await seed.flush()
        seed.add_all(
            [
                CustomActiveOrder(
                    order_id="custom-old",
                    plan_id=1,
                    portfolio_id=777,
                    asset_type="OLD",
                    side="Buy",
                    contract_type="spot",
                ),
                CustomTransaction(
                    transaction_type="Trade",
                    asset="OLD",
                    amount=Decimal("1"),
                    executed_by="Manual",
                ),
            ]
        )
        await seed.commit()
        asset_id = asset.asset_id

    async def resolve_portfolio_db(_db, _portfolio_id):
        return CustomSession(), True

    monkeypatch.setattr(assets_router, "resolve_portfolio_db", resolve_portfolio_db)
    monkeypatch.setattr(active_orders_router, "resolve_portfolio_db", resolve_portfolio_db)

    try:
        bad_multiplier = await async_client.post(
            "/api/v1/assets?portfolio_id=777",
            json={"ticker": "BAD1", "multiplier": 0},
        )
        assert bad_multiplier.status_code == 400
        assert bad_multiplier.json()["detail"] == "multiplier must be greater than 0"
        bad_rate = await async_client.post(
            "/api/v1/assets?portfolio_id=777",
            json={"ticker": "BAD2", "margin_rate": 2},
        )
        assert bad_rate.status_code == 400
        assert bad_rate.json()["detail"] == "margin_rate must be between 0 and 1"
        bad_update = await async_client.put(
            f"/api/v1/assets/{asset_id}?portfolio_id=777",
            json={"margin_rate": 2},
        )
        assert bad_update.status_code == 400
        assert bad_update.json()["detail"] == "margin_rate must be between 0 and 1"

        renamed = await async_client.put(
            f"/api/v1/assets/{asset_id}?portfolio_id=777", json={"ticker": "NEW"}
        )
        assert renamed.status_code == 200, renamed.text
        assert renamed.json()["ticker"] == "NEW"

        async with CustomSession() as check:
            db_asset = await check.get(CustomAsset, asset_id)
            db_order = await check.get(CustomActiveOrder, "custom-old")
            db_transaction = (
                await check.execute(select(CustomTransaction))
            ).scalars().first()
        assert db_asset.ticker == "NEW"
        assert db_order.asset_type == "NEW"
        assert db_transaction.asset == "NEW"

        created = await async_client.post(
            "/api/v1/assets?portfolio_id=777",
            json={"ticker": "NEWC", "price_symbol": "NEWC.BK", "asset_type": "stock"},
        )
        assert created.status_code == 201, created.text
        created_body = created.json()
        assert set(created_body) == {
            "asset_id", "ticker", "price_symbol", "asset_type", "name", "source",
            "group_id", "price", "change_24h", "updated_at", "broker_id",
            "broker_code", "multiplier", "margin_rate",
        }
        assert created_body["ticker"] == "NEWC"

        listed = await async_client.get("/api/v1/assets?portfolio_id=777")
        assert listed.status_code == 200
        rows = listed.json()
        assert all(
            set(row) == set(created_body) for row in rows
        )
        assert {row["ticker"] for row in rows} >= {"NEW", "NEWC"}

        deleted = await async_client.delete(
            f"/api/v1/assets/{created_body['asset_id']}?portfolio_id=777"
        )
        assert deleted.status_code == 204
        listed = await async_client.get("/api/v1/assets?portfolio_id=777")
        assert "NEWC" not in {row["ticker"] for row in listed.json()}

        # Custom order creation bypasses the main-broker contract-spec guard.
        order = await async_client.post(
            "/api/v1/orders",
            json={
                "order_id": "custom-new",
                "portfolio_id": 777,
                "asset_type": "NO-SPEC",
                "side": "Buy",
                "qty": 1,
                "entry_price": 10,
            },
        )
        assert order.status_code == 201, order.text
        assert order.json()["asset_type"] == "NO-SPEC"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_create_portfolio_translates_contract_symbols_verbatim_unmatched(
    async_client,
):
    broker_id = await create_broker(async_client, "PTR1")
    product = await create_product(
        async_client, ticker="PROD", broker_id=broker_id, asset_type="stock"
    )
    created_symbol = await create_symbol(
        async_client, product["product_id"], price_symbol="SYM", sync_symbol="SYM"
    )
    assert created_symbol.status_code == 201, created_symbol.text
    try:
        resp = await async_client.post(
            "/api/v1/portfolios",
            json={
                "portfolio_name": "Translated Create",
                "port_type": "Active Trading",
                "broker_id": broker_id,
                "product_tickers": ["SYM", " lower "],
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["product_tickers"] == ["PROD", " lower "]
        assert body["product_ticker"] == "PROD"

        portfolio_id = body["portfolio_id"]
        stored = await async_client.get(f"/api/v1/portfolios/{portfolio_id}")
        assert stored.json()["product_tickers"] == ["PROD", " lower "]
    finally:
        _, Session = get_test_engine()
        async with Session() as session:
            await session.execute(
                delete(Portfolio).where(Portfolio.portfolio_name == "Translated Create")
            )
            await session.commit()
        await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_order_guard_create_update_and_port_type_bypasses(async_client):
    broker_id = await create_broker(async_client, "GRD1")
    product = await create_product(
        async_client, ticker="AAA", broker_id=broker_id, asset_type="stock"
    )
    await create_symbol(
        async_client, product["product_id"], price_symbol="AAA", sync_symbol="AAA"
    )

    _, Session = get_test_engine()
    async with Session() as session:
        portfolio = Portfolio(
            portfolio_name="Guard Active",
            port_type="Active Trading",
            broker_id=broker_id,
            margin_locked=Decimal("0"),
        )
        null_broker = Portfolio(
            portfolio_name="Guard Null Broker",
            port_type="Active Trading",
            margin_locked=Decimal("0"),
        )
        spread = Portfolio(
            portfolio_name="Guard Spread",
            port_type="Spread Strategy",
            margin_locked=Decimal("0"),
        )
        managed = Portfolio(
            portfolio_name="Guard Managed",
            port_type="Managed Fund",
            margin_locked=Decimal("0"),
        )
        misleading = Portfolio(
            portfolio_name="Guard Misleading",
            port_type="Active Trading",
            broker_id=broker_id,
            margin_locked=Decimal("0"),
        )
        session.add_all([portfolio, null_broker, spread, managed, misleading])
        await session.commit()
        portfolio_id = portfolio.portfolio_id
        null_broker_id = null_broker.portfolio_id
        spread_id = spread.portfolio_id
        managed_id = managed.portfolio_id
        misleading_id = misleading.portfolio_id

    order_id = None
    try:
        created = await async_client.post(
            "/api/v1/orders",
            json={
                "portfolio_id": portfolio_id,
                "asset_type": "AAA",
                "side": "Buy",
                "qty": 1,
                "entry_price": 10,
            },
        )
        assert created.status_code == 201, created.text
        order_id = created.json()["order_id"]

        expected = "No contract spec for CCC on broker GRD1 — add it in All-assets first"
        no_param = await async_client.put(
            f"/api/v1/orders/{order_id}", json={"asset_type": "CCC"}
        )
        assert no_param.status_code == 400
        assert no_param.json()["detail"] == expected
        misleading_param = await async_client.put(
            f"/api/v1/orders/{order_id}?portfolio_id={misleading_id}",
            json={"asset_type": "CCC"},
        )
        assert misleading_param.status_code == 400
        assert misleading_param.json()["detail"] == expected

        # A non-asset-type update is not guarded.
        side_update = await async_client.put(
            f"/api/v1/orders/{order_id}", json={"side": "Sell"}
        )
        assert side_update.status_code == 200, side_update.text

        null_broker_resp = await async_client.post(
            "/api/v1/orders",
            json={
                "portfolio_id": null_broker_id,
                "asset_type": "AAA",
                "side": "Buy",
                "qty": 1,
                "entry_price": 10,
            },
        )
        assert null_broker_resp.status_code == 400
        assert null_broker_resp.json()["detail"] == (
            "Assign a broker in Edit portfolio before adding orders"
        )

        for bypass_id in (spread_id, managed_id):
            bypass = await async_client.post(
                "/api/v1/orders",
                json={
                    "portfolio_id": bypass_id,
                    "asset_type": "UNREGISTERED",
                    "side": "Buy",
                    "qty": 1,
                    "entry_price": 10,
                },
            )
            assert bypass.status_code == 201, bypass.text
    finally:
        async with Session() as session:
            await session.execute(
                delete(ActiveOrder).where(
                    ActiveOrder.portfolio_id.in_(
                        [portfolio_id, null_broker_id, spread_id, managed_id]
                    )
                )
            )
            await session.execute(
                delete(TradePlan).where(
                    TradePlan.portfolio_id.in_(
                        [portfolio_id, null_broker_id, spread_id, managed_id]
                    )
                )
            )
            await session.execute(
                delete(Portfolio).where(
                    Portfolio.portfolio_id.in_(
                        [portfolio_id, null_broker_id, spread_id, managed_id, misleading_id]
                    )
                )
            )
            await session.commit()
        await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_apply_default_product_owner_collision_and_multi_choice(
    async_client, monkeypatch
):
    broker_id = await create_broker(async_client, "APL1")
    orders = []
    for symbol in ("DEFSYM", "COLSYM", "MULT1", "MULT2"):
        _, _, order_id = await _seed_order(symbol, broker_id)
        orders.append(order_id)

    def provider_down(source, sync_symbol):
        raise RuntimeError("provider down")

    monkeypatch.setattr(registry, "_fetch_quote", provider_down)
    _, Session = get_test_engine()
    async with Session() as session:
        default_product = (
            await session.execute(
                select(AssetProduct).where(
                    AssetProduct.ticker.is_(None),
                    AssetProduct.broker_id.is_(None),
                    AssetProduct.asset_type.is_(None),
                )
            )
        ).scalars().first()

    try:
        default_choice = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "DEFSYM",
                        "broker_id": broker_id,
                        "product_id": default_product.product_id,
                    }
                ]
            },
        )
        assert default_choice.status_code == 400
        assert default_choice.json()["detail"] == "The default product is not editable"

        owner = await create_product(
            async_client, ticker="OWNER", broker_id=broker_id, asset_type="stock"
        )
        await create_symbol(
            async_client, owner["product_id"], price_symbol="COLSYM", sync_symbol="C1"
        )
        collision = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "COLSYM",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_underlying": "COLSYMU",
                        "create_source": "manual",
                        "create_sync_symbol": "",
                        "create_asset_type": "stock",
                    }
                ]
            },
        )
        assert collision.status_code == 400
        assert collision.json()["detail"] == (
            f"Symbol COLSYM on broker APL1 already belongs to product OWNER "
            f"(product_id={owner['product_id']})"
        )

        multi = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "MULT1",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_underlying": "MULTU1",
                        "create_source": "tfex",
                        "create_sync_symbol": "MULT1Z26",
                        "create_asset_type": "future",
                    },
                    {
                        "symbol": "MULT2",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_underlying": "MULTU2",
                        "create_source": "manual",
                        "create_sync_symbol": "",
                        "create_asset_type": "crypto",
                    },
                ]
            },
        )
        assert multi.status_code == 200, multi.text
        assert multi.json()["created"] == 2
        async with Session() as session:
            created_products = (
                await session.execute(
                    select(AssetProduct).where(
                        AssetProduct.ticker.in_(["MULTU1", "MULTU2"]),
                        AssetProduct.broker_id == broker_id,
                    )
                )
            ).scalars().all()
            created_symbols = (
                await session.execute(
                    select(AssetSymbol).where(
                        AssetSymbol.broker_id == broker_id,
                        AssetSymbol.price_symbol.in_(["MULT1", "MULT2"]),
                    )
                )
            ).scalars().all()
        assert len(created_products) == 2
        assert len(created_symbols) == 2
        by_ticker = {product.ticker: product for product in created_products}
        assert by_ticker["MULTU1"].asset_type == "future"
        assert by_ticker["MULTU1"].source == "tfex"
        assert by_ticker["MULTU2"].asset_type == "crypto"
        assert by_ticker["MULTU2"].source == "manual"
        symbols_by_key = {symbol.price_symbol: symbol for symbol in created_symbols}
        assert symbols_by_key["MULT1"].sync_symbol == "MULT1Z26"
        assert symbols_by_key["MULT1"].contract_kind == "future"
        assert symbols_by_key["MULT2"].sync_symbol == "MULT2"
        assert symbols_by_key["MULT2"].contract_kind == "crypto"
    finally:
        await _delete_orders(*orders)
        await cleanup_brokers(broker_id)


@pytest.mark.asyncio
async def test_rename_uses_effective_broker_for_symbol_collision(async_client):
    broker_one = await create_broker(async_client, "EFF1")
    broker_two = await create_broker(async_client, "EFF2")
    moving = await create_product(
        async_client, ticker="MOVER", broker_id=broker_one, asset_type="stock"
    )
    occupied = await create_product(
        async_client, ticker="OCC", broker_id=broker_two, asset_type="stock"
    )
    await create_symbol(
        async_client, occupied["product_id"], price_symbol="MOVED", sync_symbol="MV"
    )
    try:
        resp = await async_client.put(
            f"/api/v1/assets/products/{moving['product_id']}",
            json={"ticker": "MOVED", "broker_id": broker_two},
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "An asset with this ticker already exists"
    finally:
        await cleanup_brokers(broker_one, broker_two)


@pytest.mark.asyncio
async def test_symbol_move_to_another_product_identity(async_client):
    broker_id = await create_broker(async_client, "MOV1")
    other_broker = await create_broker(async_client, "MOV2")
    alpha = await create_product(
        async_client,
        ticker="ALPHA",
        broker_id=broker_id,
        asset_type="stock",
        multiplier=2,
        margin_rate=0.1,
        margin_mode="notional",
        margin_per_contract=7,
        source="manual",
    )
    beta = await create_product(
        async_client,
        ticker="BETA",
        broker_id=broker_id,
        asset_type="stock",
        multiplier=5,
        margin_rate=0.25,
        margin_mode="premium",
        margin_per_contract=11,
        source="manual",
    )
    gamma = await create_product(
        async_client,
        ticker="GAMMA",
        broker_id=other_broker,
        asset_type="stock",
        multiplier=3,
        margin_rate=0.4,
        margin_mode="notional",
        source="manual",
    )
    _, Session = get_test_engine()

    async def stored(symbol_id: int) -> AssetSymbol:
        async with Session() as session:
            return await session.get(AssetSymbol, symbol_id)

    async def default_product_id() -> int:
        async with Session() as session:
            row = (
                await session.execute(
                    select(AssetProduct)
                    .where(
                        AssetProduct.ticker.is_(None),
                        AssetProduct.broker_id.is_(None),
                        AssetProduct.asset_type.is_(None),
                    )
                    .order_by(AssetProduct.product_id)
                )
            ).scalars().first()
            return row.product_id

    try:
        created = await create_symbol(
            async_client,
            alpha["product_id"],
            price_symbol="MOVE.ME",
            sync_symbol="MOVE",
            contract_kind="stock",
        )
        assert created.status_code == 201, created.text
        symbol = created.json()
        symbol_id = symbol["symbol_id"]
        assert symbol["multiplier_effective"] == 2.0
        assert symbol["margin_rate_effective"] == 0.1
        assert symbol["contract_kind"] == "stock"
        assert symbol["margin_per_contract"] == 7.0

        # Move inside the same broker: identity-owned values re-base from the
        # new owner, including its span margin.
        moved = await async_client.put(
            f"/api/v1/assets/symbols/{symbol_id}",
            json={"product_id": beta["product_id"]},
        )
        assert moved.status_code == 200, moved.text
        body = moved.json()
        assert set(body) == SYMBOL_KEYS
        assert body["product_id"] == beta["product_id"]
        assert body["price_symbol"] == "MOVE.ME"
        assert body["sync_symbol"] == "MOVE"
        assert body["contract_kind"] == "stock"
        assert body["margin_per_contract"] == 11.0
        assert body["multiplier_effective"] == 5.0
        assert body["margin_rate_effective"] == 0.25
        assert (await stored(symbol_id)).broker_id == broker_id

        # Move to a product owned by a different broker: the broker mirror
        # follows the new owner.
        across = await async_client.put(
            f"/api/v1/assets/symbols/{symbol_id}",
            json={"product_id": gamma["product_id"]},
        )
        assert across.status_code == 200, across.text
        assert across.json()["product_id"] == gamma["product_id"]
        assert across.json()["multiplier_effective"] == 3.0
        assert across.json()["margin_rate_effective"] == 0.4
        # GAMMA has no span value, so the contract reports none: the symbol
        # column is never read.
        assert across.json()["margin_per_contract"] is None
        row = await stored(symbol_id)
        assert row.product_id == gamma["product_id"]
        assert row.broker_id == other_broker

        # Unknown target product is a pure validation failure.
        unknown = await async_client.put(
            f"/api/v1/assets/symbols/{symbol_id}", json={"product_id": 999999}
        )
        assert unknown.status_code == 404
        assert unknown.json()["detail"] == "Product not found"
        row = await stored(symbol_id)
        assert row.product_id == gamma["product_id"]
        assert row.broker_id == other_broker

        # A rejected identity-owned override leaves the symbol where it was.
        for field, detail in (
            (
                "multiplier_override",
                "multiplier is set on the underlying + broker + type, "
                "not on the contract",
            ),
            (
                "margin_rate_override",
                "margin_rate is set on the underlying + broker + type, "
                "not on the contract",
            ),
            (
                "margin_per_contract",
                "margin per contract is set on the underlying + broker + "
                "type, not on the contract",
            ),
        ):
            rejected = await async_client.put(
                f"/api/v1/assets/symbols/{symbol_id}",
                json={"product_id": beta["product_id"], field: 4},
            )
            assert rejected.status_code == 400
            assert rejected.json()["detail"] == detail
            row = await stored(symbol_id)
            assert row.product_id == gamma["product_id"]
            assert row.broker_id == other_broker

        # Omitted product_id keeps ownership; remaining fields still update.
        renamed = await async_client.put(
            f"/api/v1/assets/symbols/{symbol_id}", json={"sync_symbol": "MOVE2"}
        )
        assert renamed.status_code == 200, renamed.text
        assert renamed.json()["product_id"] == gamma["product_id"]
        assert renamed.json()["sync_symbol"] == "MOVE2"
        # An explicit null is the same no-op move (it is not a target).
        null_move = await async_client.put(
            f"/api/v1/assets/symbols/{symbol_id}",
            json={"product_id": None, "price_symbol": "move.me"},
        )
        assert null_move.status_code == 200, null_move.text
        assert null_move.json()["product_id"] == gamma["product_id"]
        assert null_move.json()["price_symbol"] == "move.me"
        # The current owner is an explicit no-op move as well.
        same = await async_client.put(
            f"/api/v1/assets/symbols/{symbol_id}",
            json={"product_id": gamma["product_id"]},
        )
        assert same.status_code == 200, same.text
        assert same.json()["product_id"] == gamma["product_id"]
        assert same.json()["margin_per_contract"] is None
        row = await stored(symbol_id)
        assert row.product_id == gamma["product_id"]
        assert row.broker_id == other_broker

        # A normalized key already owned in the target broker scope blocks the
        # move with the existing collision detail and changes no rows.
        assert (
            await create_symbol(
                async_client,
                alpha["product_id"],
                price_symbol="DUP",
                sync_symbol="DUPA",
            )
        ).status_code == 201
        gamma_dup = await create_symbol(
            async_client,
            gamma["product_id"],
            price_symbol="DUP",
            sync_symbol="DUPG",
        )
        assert gamma_dup.status_code == 201, gamma_dup.text
        gamma_dup_id = gamma_dup.json()["symbol_id"]
        collision = await async_client.put(
            f"/api/v1/assets/symbols/{gamma_dup_id}",
            json={"product_id": beta["product_id"]},
        )
        assert collision.status_code == 400
        assert collision.json()["detail"] == (
            f"Symbol DUP on broker MOV1 already belongs to product ALPHA "
            f"(product_id={alpha['product_id']})"
        )
        row = await stored(gamma_dup_id)
        assert row.product_id == gamma["product_id"]
        assert row.price_symbol == "DUP"
        assert row.broker_id == other_broker

        # Option identity must stay available inside the target product.
        opt_home = await create_product(
            async_client, ticker="OPTA", broker_id=broker_id, asset_type="option"
        )
        opt_target = await create_product(
            async_client, ticker="OPTB", broker_id=broker_id, asset_type="option"
        )
        for product, sync in ((opt_home, "OA1"), (opt_target, "OB1")):
            seeded = await create_symbol(
                async_client,
                product["product_id"],
                contract_kind="option",
                option_type="call",
                expiry_date="2026-03-31",
                strike_price=10,
                sync_symbol=sync,
            )
            assert seeded.status_code == 201, seeded.text
        dated = (
            await async_client.get(
                f"/api/v1/assets/symbols?product_id={opt_home['product_id']}"
            )
        ).json()[0]
        option_conflict = await async_client.put(
            f"/api/v1/assets/symbols/{dated['symbol_id']}",
            json={"product_id": opt_target["product_id"]},
        )
        assert option_conflict.status_code == 400
        assert option_conflict.json()["detail"] == (
            f"Option contract already exists on product OPTB "
            f"(product_id={opt_target['product_id']})"
        )
        row = await stored(dated["symbol_id"])
        assert row.product_id == opt_home["product_id"]
        assert row.broker_id == broker_id

        # The default identity accepts moved symbols too.
        default_id = await default_product_id()
        movable = await create_symbol(
            async_client,
            alpha["product_id"],
            price_symbol="DEFMOVE",
            sync_symbol="DEFSYNC",
            contract_kind="stock",
        )
        assert movable.status_code == 201, movable.text
        assert movable.json()["contract_kind"] == "stock"
        assert movable.json()["margin_per_contract"] == 7.0
        to_default = await async_client.put(
            f"/api/v1/assets/symbols/{movable.json()['symbol_id']}",
            json={"product_id": default_id},
        )
        assert to_default.status_code == 200, to_default.text
        assert to_default.json()["product_id"] == default_id
        assert to_default.json()["multiplier_effective"] == 1.0
        assert to_default.json()["margin_rate_effective"] == 0.0
        # The type and span re-derive from the new (untyped) owner: legacy
        # ``future`` fallback and no span value.
        assert to_default.json()["contract_kind"] == "future"
        assert to_default.json()["margin_per_contract"] is None
        default_row = await stored(movable.json()["symbol_id"])
        assert default_row.product_id == default_id
        assert default_row.broker_id is None
        assert default_row.contract_kind == "future"
        removed = await async_client.delete(
            f"/api/v1/assets/symbols/{movable.json()['symbol_id']}"
        )
        assert removed.status_code == 204
    finally:
        async with Session() as session:
            stray = (
                await session.execute(
                    select(AssetSymbol).where(AssetSymbol.sync_symbol == "DEFSYNC")
                )
            ).scalars().all()
            for item in stray:
                await session.delete(item)
            await session.commit()
        await cleanup_brokers(broker_id, other_broker)
