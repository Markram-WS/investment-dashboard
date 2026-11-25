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
from app.risk_calc import compute_margin_locked, compute_risk  # noqa: E402
from app.services import asset_registry as registry  # noqa: E402
from app.routers import assets as assets_router  # noqa: E402


PRODUCT_KEYS = {
    "product_id", "ticker", "broker_id", "broker_code", "asset_type",
    "multiplier", "margin_rate", "margin_mode", "source", "group_id",
    "name", "symbol_count",
}
SYMBOL_KEYS = {
    "symbol_id", "product_id", "price_symbol", "sync_symbol", "contract_kind",
    "option_type", "expiry_date", "strike_price", "multiplier_override",
    "margin_rate_override", "margin_per_contract", "price", "change_24h",
    "updated_at",
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
    default_symbol = await create_symbol(
        async_client, default_product.product_id, sync_symbol="BAD"
    )
    assert default_symbol.status_code == 400

    # Missing lookups.
    assert (await async_client.get("/api/v1/assets/products/999999")).status_code == 404
    assert (await async_client.put("/api/v1/assets/symbols/999999", json={})).status_code == 404
    assert (await async_client.delete("/api/v1/assets/symbols/999999")).status_code == 404

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
    symbol: str, broker_id: int | None, contract_type: str = "stock"
) -> tuple[int, int, int]:
    _, Session = get_test_engine()
    async with Session() as session:
        portfolio = Portfolio(
            portfolio_name=f"Proposal {symbol}",
            port_type="Active Trading",
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
        assert item["create"] == {"ticker": "NEWSYM"}
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

        # Duplicate create ticker (same broker, any asset type).
        existing = await create_product(
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
                        "create_source": "yfinance",
                        "create_sync_symbol": "NEWSYM",
                        "create_asset_type": "stock",
                    }
                ]
            },
        )
        assert duplicate.status_code == 400
        assert duplicate.json()["detail"] == "A product with this ticker already exists"

        # Brokerless Active Trading portfolio cannot receive a symbol.
        brokerless = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "NOBROKER",
                        "broker_id": None,
                        "create_product": True,
                        "create_source": "yfinance",
                        "create_sync_symbol": "NOBROKER",
                        "create_asset_type": "stock",
                    }
                ]
            },
        )
        assert brokerless.status_code == 400
        assert brokerless.json()["detail"] == (
            "Assign a broker in Edit portfolio before adding orders"
        )

        # Successful create, provider failure keeps a null quote.
        monkeypatch.setattr(
            registry,
            "_fetch_quote",
            lambda source, sync_symbol: (_ for _ in ()).throw(RuntimeError("down")),
        )
        created = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "NEWSYM",
                        "broker_id": broker_id,
                        "create_product": True,
                        "create_source": "yfinance",
                        "create_sync_symbol": "NEWSYM",
                        "create_asset_type": "stock",
                    }
                ]
            },
        )
        assert created.status_code == 400  # duplicate ticker still wins

        third_portfolio, _, third_order = await _seed_order("FRESHSYM", broker_id)
        created = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "FRESHSYM",
                        "broker_id": broker_id,
                        "create_product": True,
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
                        AssetProduct.ticker == "FRESHSYM",
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
        assert product.asset_type == "stock"
        assert product.source == "yfinance"
        assert product.multiplier == 1
        assert product.margin_rate == 0
        assert product.margin_mode == "notional"
        assert symbol.price_symbol == "FRESHSYM"
        assert symbol.sync_symbol == "FRESHSYM.BK"
        assert symbol.contract_kind == "stock"

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

        # A THB broker changes nothing: the create default still carries only
        # the dashboard ticker, with no guessed provider symbol.
        thb_broker = await create_broker(async_client, "SYN3", currency="THB")
        thb_portfolio, _, thb_order = await _seed_order("PTT", thb_broker)
        thb_proposal = await async_client.get("/api/v1/assets/proposal")
        thb_items = {
            (item["broker_id"], item["symbol"]): item
            for item in thb_proposal.json()["items"]
        }
        assert thb_items[(thb_broker, "PTT")]["create"] == {"ticker": "PTT"}
        assert "sync_symbol" not in thb_items[(thb_broker, "PTT")]["create"]

        await cleanup_brokers(broker_id, other_broker, thb_broker)
    finally:
        await _delete_orders(
            order_id, brokerless_order, third_order, thb_order
        )


@pytest.mark.asyncio
async def test_apply_create_needs_explicit_source_type_and_provider(
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

        missing_type = await async_client.post(
            "/api/v1/assets/apply",
            json={
                "choices": [
                    {
                        "symbol": "S50Z26",
                        **base,
                        "create_source": "tfex",
                        "create_sync_symbol": "S50Z26",
                    }
                ]
            },
        )
        assert missing_type.status_code == 400
        assert missing_type.json()["detail"] == (
            "Create needs an asset type: stock, future, option or crypto"
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
            "Create needs an asset type: stock, future, option or crypto"
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
                        AssetProduct.ticker == "S50Z26",
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
                        AssetProduct.ticker == "MANOPT",
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

        assert tfex_product.source == "tfex"
        assert tfex_product.asset_type == "future"
        assert tfex_symbol.price_symbol == "S50Z26"
        assert tfex_symbol.sync_symbol == "S50Z26"
        assert tfex_symbol.contract_kind == "future"

        assert manual_product.source == "manual"
        assert manual_product.asset_type == "option"
        assert manual_symbol.price_symbol == "MANOPT"
        assert manual_symbol.sync_symbol == "MANOPT"
        assert manual_symbol.contract_kind == "option"
    finally:
        await _delete_orders(tfex_order, manual_order)
        await cleanup_brokers(broker_id)


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

        def product(ticker, multiplier, rate, mode):
            return AssetProduct(
                ticker=ticker,
                broker_id=broker.id,
                asset_type="stock",
                multiplier=Decimal(str(multiplier)),
                margin_rate=Decimal(str(rate)),
                margin_mode=mode,
                source="-",
            )

        products = {
            "N": product("N", 2, 0.1, "notional"),
            "P": product("P", 2, 0.5, "premium"),
            "S": product("S", 3, 0.2, "span"),
            "O": product("O", 2, 0.1, "notional"),
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
                    margin_per_contract=Decimal("7"),
                ),
                AssetSymbol(
                    product_id=products["O"].product_id,
                    broker_id=broker.id,
                    price_symbol="O",
                    sync_symbol="O",
                    multiplier_override=Decimal("5"),
                    margin_rate_override=Decimal("0.2"),
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
        # Per-order sizing uses overrides (O: multiplier 5).
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
            "/api/v1/orders/",
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
            "/api/v1/portfolios/",
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
            "/api/v1/orders/",
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
            "/api/v1/orders/",
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
                "/api/v1/orders/",
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
                        "create_source": "tfex",
                        "create_sync_symbol": "MULT1Z26",
                        "create_asset_type": "future",
                    },
                    {
                        "symbol": "MULT2",
                        "broker_id": broker_id,
                        "create_product": True,
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
                        AssetProduct.ticker.in_(["MULT1", "MULT2"]),
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
        assert by_ticker["MULT1"].asset_type == "future"
        assert by_ticker["MULT1"].source == "tfex"
        assert by_ticker["MULT2"].asset_type == "crypto"
        assert by_ticker["MULT2"].source == "manual"
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
