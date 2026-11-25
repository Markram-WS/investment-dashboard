"""Product ticker list: update normalization and the product-rename cascade."""

import os
import sys
from decimal import Decimal

import pytest
from sqlalchemy import delete

sys.path.insert(0, os.path.dirname(__file__))
from conftest import get_test_engine  # noqa: E402

from app.models import (  # noqa: E402
    AssetProduct,
    AssetSymbol,
    Broker,
    Portfolio,
)


@pytest.mark.asyncio
async def test_portfolio_product_type_payload_update_and_validation(async_client):
    _, Session = get_test_engine()
    typed_id = None
    untyped_id = None
    try:
        # Create accepts the identity type and persists it; omitted = null.
        typed = await async_client.post(
            "/api/v1/portfolios",
            json={
                "portfolio_name": "Typed Identity",
                "port_type": "Managed Fund",
                "product_type": "future",
            },
        )
        assert typed.status_code == 201, typed.text
        typed_body = typed.json()
        typed_id = typed_body["portfolio_id"]
        assert typed_body["product_type"] == "future"

        untyped = await async_client.post(
            "/api/v1/portfolios",
            json={"portfolio_name": "Untyped Identity", "port_type": "Managed Fund"},
        )
        assert untyped.status_code == 201, untyped.text
        untyped_id = untyped.json()["portfolio_id"]
        assert untyped.json()["product_type"] is None

        invalid_create = await async_client.post(
            "/api/v1/portfolios",
            json={
                "portfolio_name": "Bad Type",
                "port_type": "Managed Fund",
                "product_type": "futures",
            },
        )
        assert invalid_create.status_code == 400
        assert invalid_create.json()["detail"] == (
            "product_type must be one of stock, future, option or crypto"
        )

        # Detail and list payloads expose it.
        detail = await async_client.get(f"/api/v1/portfolios/{typed_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["product_type"] == "future"
        listed = {
            row["portfolio_id"]: row
            for row in (await async_client.get("/api/v1/portfolios")).json()
        }
        assert listed[typed_id]["product_type"] == "future"
        assert listed[untyped_id]["product_type"] is None

        # Update normalizes case/whitespace and leaves the ticker handling as is.
        combined = await async_client.put(
            f"/api/v1/portfolios/{typed_id}",
            json={"product_tickers": ["ABC"], "product_type": " STOCK "},
        )
        assert combined.status_code == 200, combined.text
        assert combined.json()["product_tickers"] == ["ABC"]
        assert combined.json()["product_ticker"] == "ABC"
        assert combined.json()["product_type"] == "stock"

        for invalid in ("bond", "", "futures"):
            rejected = await async_client.put(
                f"/api/v1/portfolios/{typed_id}",
                json={"product_type": invalid},
            )
            assert rejected.status_code == 400
            assert rejected.json()["detail"] == (
                "product_type must be one of stock, future, option or crypto"
            )

        # Explicit null clears only the type; the ticker stays.
        cleared = await async_client.put(
            f"/api/v1/portfolios/{typed_id}", json={"product_type": None}
        )
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()["product_type"] is None
        assert cleared.json()["product_ticker"] == "ABC"
        assert cleared.json()["product_tickers"] == ["ABC"]

        stored = await async_client.get(f"/api/v1/portfolios/{typed_id}")
        assert stored.json()["product_type"] is None
    finally:
        async with Session() as session:
            await session.execute(
                delete(Portfolio).where(
                    Portfolio.portfolio_id.in_(
                        [pid for pid in (typed_id, untyped_id) if pid is not None]
                    )
                )
            )
            await session.commit()


@pytest.mark.asyncio
async def test_product_tickers_normalized_and_renamed(async_client):
    _, Session = get_test_engine()
    async with Session() as session:
        broker = Broker(code="PT", name="Product Ticker Broker")
        session.add(broker)
        await session.flush()
        product = AssetProduct(
            ticker="OLD",
            broker_id=broker.id,
            asset_type="futures",
            multiplier=Decimal("10"),
            margin_rate=Decimal("0.2"),
            source="-",
            margin_mode="notional",
        )
        session.add(product)
        await session.flush()
        symbol = AssetSymbol(
            product_id=product.product_id,
            broker_id=broker.id,
            price_symbol="OLD",
            sync_symbol="OLD",
            contract_kind="future",
        )
        portfolio = Portfolio(
            portfolio_name="Ticker List",
            port_type="Active Trading",
            risk_status="Safe",
            broker_id=broker.id,
            product_ticker="OLD",
            product_tickers=["OLD"],
            x_amount=Decimal("50"),
            available_cash=Decimal("1000"),
            margin_locked=Decimal("0"),
        )
        session.add_all([symbol, portfolio])
        await session.commit()
        portfolio_id = portfolio.portfolio_id
        product_id = product.product_id
        broker_id = broker.id

    try:
        # Normalization is only for matching/dedupe: unmatched values keep their
        # original casing and whitespace, and the legacy mirror is the first one.
        resp = await async_client.put(
            f"/api/v1/portfolios/{portfolio_id}",
            json={"product_tickers": [" abc ", "ABC", "", "def"]},
        )
        assert resp.status_code == 200
        assert resp.json()["product_tickers"] == [" abc ", "def"]
        assert resp.json()["product_ticker"] == " abc "

        # Clearing the list stores NULL and clears the legacy mirror.
        resp = await async_client.put(
            f"/api/v1/portfolios/{portfolio_id}", json={"product_tickers": []}
        )
        assert resp.json()["product_tickers"] is None
        assert resp.json()["product_ticker"] is None

        # A rename rewrites matching JSON list entries in the same transaction.
        resp = await async_client.put(
            f"/api/v1/portfolios/{portfolio_id}",
            json={"product_tickers": ["OLD", "XYZ"]},
        )
        assert resp.status_code == 200
        resp = await async_client.put(
            f"/api/v1/assets/products/{product_id}", json={"ticker": "NEW"}
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["ticker"] == "NEW"

        resp = await async_client.get(f"/api/v1/portfolios/{portfolio_id}")
        assert resp.json()["product_tickers"] == ["NEW", "XYZ"]
        assert resp.json()["product_ticker"] == "NEW"
    finally:
        async with Session() as session:
            await session.execute(
                delete(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
            )
            await session.execute(
                delete(AssetSymbol).where(AssetSymbol.product_id == product_id)
            )
            await session.execute(
                delete(AssetProduct).where(AssetProduct.product_id == product_id)
            )
            await session.execute(delete(Broker).where(Broker.id == broker_id))
            await session.commit()
