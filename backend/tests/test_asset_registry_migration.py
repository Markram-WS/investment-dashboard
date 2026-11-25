"""SQLite startup-migration tests for the asset registry.

These prove portable behaviour only. PostgreSQL-only constraints
(``UNIQUE NULLS NOT DISTINCT`` and the three partial/expression indexes) are
asserted in the PG-only test, skipped unless ``POSTGRES_TEST_URL`` is set.
"""

import os

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.asset_registry_migration import (
    AssetRegistryPreflightError,
    create_application_tables,
    run_asset_registry_migration,
)


def _engine():
    return create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
    )


async def _scalar(engine, sql: str, **params):
    async with engine.connect() as conn:
        return (await conn.execute(text(sql), params)).scalar()


async def _table_exists(engine, table: str) -> bool:
    return bool(
        await _scalar(
            engine,
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=:table",
            table=table,
        )
    )


async def _prepare(engine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(create_application_tables)


async def _seed_legacy(engine) -> dict:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                CREATE TABLE whitelist_assets (
                    asset_id INTEGER PRIMARY KEY,
                    ticker VARCHAR NOT NULL,
                    asset_type VARCHAR NOT NULL,
                    broker_id INTEGER,
                    price_symbol VARCHAR,
                    price NUMERIC(20,8),
                    change_24h NUMERIC(10,4),
                    source VARCHAR,
                    name VARCHAR,
                    group_id INTEGER,
                    multiplier NUMERIC(20,8) DEFAULT 1,
                    margin_rate NUMERIC(10,6) DEFAULT 0,
                    updated_at DATETIME
                )
                """
            )
        )
        await conn.execute(
            text("INSERT INTO brokers (code, name) VALUES ('T1', 'Test Broker')")
        )
        broker_id = (
            await conn.execute(text("SELECT id FROM brokers WHERE code='T1'"))
        ).scalar()
        await conn.execute(
            text(
                """
                INSERT INTO whitelist_assets
                    (asset_id, ticker, asset_type, broker_id, price_symbol,
                     price, change_24h, source, name, multiplier, margin_rate)
                VALUES
                    (1, 'AAA', 'futures', :b, 'AAA.BK', 10, 1.5, 'yfinance',
                     'Alpha', 2, 0.1),
                    (2, 'BBB', 'stock', :b, NULL, NULL, NULL, NULL,
                     'Beta', 1, 0),
                    (3, 'CCC', 'crypto', NULL, '', 5, NULL, NULL,
                     'Gamma', 1, 0),
                    (4, 'AAA2', 'option', :b, 'AAA.BK', 99, 2.5, 'yfinance',
                     'Option', 1, 0)
                """
            ),
            {"b": broker_id},
        )
        await conn.execute(
            text(
                """
                INSERT INTO portfolios
                    (portfolio_name, port_type, broker_id, product_ticker,
                     product_tickers, x_amount, initial_capital,
                     available_cash, margin_locked)
                VALUES ('Migrated', 'Active Trading', :b, 'AAA',
                        '["AAA", "BBB", "XYZ"]', 0, 0, 0, 0)
                """
            ),
            {"b": broker_id},
        )
    return {"broker_id": broker_id}


@pytest.mark.asyncio
async def test_migration_converts_rows_and_drops_legacy():
    engine = _engine()
    try:
        await _prepare(engine)
        context = await _seed_legacy(engine)

        async with engine.begin() as conn:
            await conn.run_sync(run_asset_registry_migration)

        assert not await _table_exists(engine, "whitelist_assets")
        assert await _table_exists(engine, "asset_products")
        assert await _table_exists(engine, "asset_symbols")
        assert await _table_exists(engine, "asset_quotes")

        workers = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
        async with workers() as session:
            default_count = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM asset_products WHERE ticker IS NULL "
                        "AND broker_id IS NULL AND asset_type IS NULL"
                    )
                )
            ).scalar()
            product_count = (
                await session.execute(text("SELECT COUNT(*) FROM asset_products"))
            ).scalar()
            symbol_count = (
                await session.execute(text("SELECT COUNT(*) FROM asset_symbols"))
            ).scalar()
            quote_count = (
                await session.execute(text("SELECT COUNT(*) FROM asset_quotes"))
            ).scalar()
            portfolio = (
                await session.execute(
                    text(
                        "SELECT product_tickers, product_ticker FROM portfolios "
                        "WHERE portfolio_name='Migrated'"
                    )
                )
            ).first()

            aaa = (
                await session.execute(
                    text(
                        "SELECT p.asset_type, p.multiplier, p.margin_rate, "
                        "s.contract_kind, s.price_symbol, s.sync_symbol, s.broker_id "
                        "FROM asset_products p JOIN asset_symbols s "
                        "ON s.product_id=p.product_id WHERE p.ticker='AAA'"
                    )
                )
            ).first()
            bbb = (
                await session.execute(
                    text(
                        "SELECT s.price_symbol, s.sync_symbol FROM asset_symbols s "
                        "JOIN asset_products p ON p.product_id=s.product_id "
                        "WHERE p.ticker='BBB'"
                    )
                )
            ).first()
            ccc = (
                await session.execute(
                    text(
                        "SELECT p.asset_type, s.contract_kind, s.broker_id, "
                        "s.sync_symbol FROM asset_symbols s "
                        "JOIN asset_products p ON p.product_id=s.product_id "
                        "WHERE p.ticker='CCC'"
                    )
                )
            ).first()
            option = (
                await session.execute(
                    text(
                        "SELECT p.asset_type, s.contract_kind, s.price_symbol "
                        "FROM asset_symbols s JOIN asset_products p "
                        "ON p.product_id=s.product_id WHERE p.ticker='AAA2'"
                    )
                )
            ).first()
            quote = (
                await session.execute(
                    text(
                        "SELECT price, change_24h FROM asset_quotes "
                        "WHERE source='yfinance' AND sync_symbol='AAA.BK'"
                    )
                )
            ).first()

        assert default_count == 1
        # Four distinct broker/ticker/type identities plus the default product.
        assert product_count == 5
        assert symbol_count == 4
        # AAA/AAA2 collapse onto one normalized quote key.
        assert quote_count == 3

        assert aaa[0] == "future"
        assert float(aaa[1]) == 2.0
        assert float(aaa[2]) == 0.1
        assert aaa[3] == "future"
        assert aaa[4] == "AAA"
        assert aaa[5] == "AAA.BK"
        assert aaa[6] == context["broker_id"]

        assert bbb[0] == "BBB"
        assert bbb[1] == "BBB"

        assert ccc[0] == "crypto"
        assert ccc[1] == "spot"
        assert ccc[2] is not None
        assert ccc[3] == "CCC"

        assert option[0] == "option"
        assert option[1] == "option"

        # Last writer in ascending asset_id order wins the collapsed quote.
        assert float(quote[0]) == 99.0
        assert float(quote[1]) == 2.5

        assert portfolio[0] == '["AAA", "BBB", "XYZ"]'
        assert portfolio[1] == "AAA"

        # Second run is a no-op for conversion and default creation.
        async with engine.begin() as conn:
            await conn.run_sync(run_asset_registry_migration)
        assert (
            await _scalar(engine, "SELECT COUNT(*) FROM asset_products")
        ) == product_count
        assert (
            await _scalar(engine, "SELECT COUNT(*) FROM asset_symbols")
        ) == symbol_count
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_migration_without_legacy_creates_registry_and_default():
    engine = _engine()
    try:
        await _prepare(engine)
        async with engine.begin() as conn:
            await conn.run_sync(run_asset_registry_migration)

        assert not await _table_exists(engine, "whitelist_assets")
        assert (
            await _scalar(engine, "SELECT COUNT(*) FROM asset_products")
        ) == 1
        assert (
            await _scalar(engine, "SELECT COUNT(*) FROM asset_symbols")
        ) == 0
        assert (
            await _scalar(engine, "SELECT COUNT(*) FROM asset_quotes")
        ) == 0

        async with engine.begin() as conn:
            await conn.run_sync(run_asset_registry_migration)
        assert (
            await _scalar(engine, "SELECT COUNT(*) FROM asset_products")
        ) == 1
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_retained_startup_never_assigns_a_broker_to_active_trading():
    engine = _engine()
    try:
        await _prepare(engine)
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "INSERT INTO portfolios (portfolio_name, port_type, "
                    "broker_id, x_amount, initial_capital, available_cash) "
                    "VALUES ('Still Brokerless', 'Active Trading', NULL, 0, 0, 0)"
                )
            )

        async with engine.begin() as conn:
            await conn.run_sync(run_asset_registry_migration)
        async with engine.begin() as conn:
            await conn.run_sync(run_asset_registry_migration)

        assert (
            await _scalar(
                engine,
                "SELECT broker_id FROM portfolios "
                "WHERE portfolio_name='Still Brokerless'",
            )
        ) is None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_retained_migration_adds_product_span_margin_idempotently():
    engine = _engine()

    async def columns(table: str) -> dict[str, tuple]:
        async with engine.connect() as conn:
            rows = (
                await conn.execute(text(f"PRAGMA table_info({table})"))
            ).all()
        return {row[1]: tuple(row) for row in rows}

    try:
        await _prepare(engine)
        # A registry created by the previous release: no span margin column.
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    CREATE TABLE asset_products (
                        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker VARCHAR,
                        broker_id INTEGER,
                        asset_type VARCHAR,
                        multiplier NUMERIC(20,8) NOT NULL DEFAULT 1,
                        margin_rate NUMERIC(10,6) NOT NULL DEFAULT 0,
                        source VARCHAR DEFAULT '-',
                        margin_mode VARCHAR NOT NULL DEFAULT 'notional',
                        group_id INTEGER,
                        name VARCHAR,
                        created_at DATETIME,
                        updated_at DATETIME,
                        CONSTRAINT uq_asset_product_identity
                            UNIQUE (ticker, broker_id, asset_type)
                    )
                    """
                )
            )
            await conn.execute(
                text(
                    "INSERT INTO asset_products "
                    "(ticker, broker_id, asset_type, multiplier, margin_rate, "
                    "source, margin_mode, name) "
                    "VALUES ('OLD', NULL, 'stock', 2, 0.1, '-', 'notional', "
                    "'Old Product')"
                )
            )
        assert "margin_per_contract" not in await columns("asset_products")

        # Both boots converge to the same schema and keep every product row.
        for _ in range(2):
            async with engine.begin() as conn:
                await conn.run_sync(run_asset_registry_migration)

        schema = await columns("asset_products")
        assert "margin_per_contract" in schema
        # PRAGMA table_info: (cid, name, type, notnull, dflt_value, pk).
        assert schema["margin_per_contract"][3] == 0
        assert (
            await _scalar(engine, "SELECT COUNT(*) FROM asset_products")
        ) == 2  # the retained row plus the created default identity
        assert (
            await _scalar(
                engine,
                "SELECT margin_per_contract FROM asset_products "
                "WHERE ticker='OLD'",
            )
        ) is None
        assert (
            await _scalar(
                engine,
                "SELECT multiplier FROM asset_products WHERE ticker='OLD'",
            )
        ) == 2
        assert (
            await _scalar(
                engine, "SELECT name FROM asset_products WHERE ticker='OLD'"
            )
        ) == "Old Product"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_duplicate_dashboard_key_rolls_back_the_whole_migration():
    engine = _engine()
    try:
        await _prepare(engine)
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    CREATE TABLE whitelist_assets (
                        asset_id INTEGER PRIMARY KEY,
                        ticker VARCHAR NOT NULL,
                        asset_type VARCHAR NOT NULL,
                        broker_id INTEGER,
                        price_symbol VARCHAR
                    )
                    """
                )
            )
            await conn.execute(
                text("INSERT INTO brokers (code, name) VALUES ('DF', 'Unassigned')")
            )
            await conn.execute(
                text(
                    """
                    INSERT INTO whitelist_assets
                        (asset_id, ticker, asset_type, broker_id, price_symbol)
                    VALUES (1, ' dup ', 'stock', NULL, NULL),
                           (2, 'DUP', 'stock', NULL, NULL)
                    """
                )
            )

        with pytest.raises(AssetRegistryPreflightError) as exc_info:
            async with engine.begin() as conn:
                await conn.run_sync(run_asset_registry_migration)
        assert str(exc_info.value).startswith(
            "Asset registry migration preflight failed:"
        )
        assert "DUP" in str(exc_info.value)

        # The whole transaction rolled back: legacy survives, no registry rows.
        assert await _table_exists(engine, "whitelist_assets")
        assert not await _table_exists(engine, "asset_products")
        assert (
            await _scalar(engine, "SELECT COUNT(*) FROM whitelist_assets")
        ) == 2
    finally:
        await engine.dispose()


@pytest.mark.skipif(
    not os.getenv("POSTGRES_TEST_URL"),
    reason="PostgreSQL-only schema assertions need POSTGRES_TEST_URL",
)
@pytest.mark.asyncio
async def test_postgres_only_constraints_and_indexes():
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(os.environ["POSTGRES_TEST_URL"], echo=False)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(create_application_tables)
            await conn.run_sync(run_asset_registry_migration)
            index_names = {
                row[0]
                for row in (
                    await conn.execute(
                        text(
                            "SELECT indexname FROM pg_indexes "
                            "WHERE tablename='asset_symbols'"
                        )
                    )
                ).all()
            }
            constraint = (
                await conn.execute(
                    text(
                        "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                        "WHERE conname='uq_asset_product_identity'"
                    )
                )
            ).scalar()
        assert "NULLS NOT DISTINCT" in (constraint or "")
        assert {
            "uq_asset_symbol_product_dashboard",
            "uq_asset_symbol_broker_dashboard",
            "uq_asset_symbol_option_identity",
        }.issubset(index_names)
    finally:
        await engine.dispose()
