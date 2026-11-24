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
