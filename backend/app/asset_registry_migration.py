"""Transactional startup migration for the asset registry.

The main database previously kept a mockup-only ``whitelist_assets`` table.
This module creates the broker-scoped product/symbol/quote registry, converts
any legacy rows (products, symbols, quotes, portfolio product lists), asserts
every conversion invariant and then drops the legacy table -- all inside the
single transaction owned by the caller.  Later boots find no legacy table and
only ensure the registry/default product exist.

Dialect policy: PostgreSQL 15 is canonical (``SERIAL``, ``TIMESTAMPTZ``,
``UNIQUE NULLS NOT DISTINCT``, partial/expression indexes, advisory lock);
SQLite uses portable DDL and never claims the PostgreSQL-only constraints.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.models import Base


LEGACY_TABLE = "whitelist_assets"
REGISTRY_TABLES = ("asset_products", "asset_symbols", "asset_quotes")
CREATE_ALL_EXCLUDED = frozenset((LEGACY_TABLE,) + REGISTRY_TABLES)

ASSET_TYPE_MAP = {
    "futures": "future",
    "future": "future",
    "stock": "stock",
    "option": "option",
    "crypto": "crypto",
}
CONTRACT_KIND_MAP = {
    "option": "option",
    "future": "future",
    "futures": "future",
    "stock": "stock",
    "crypto": "spot",
}

LEGACY_COLUMNS = (
    ("name", "VARCHAR"),
    ("source", "VARCHAR DEFAULT 'manual'"),
    ("group_id", "INTEGER REFERENCES asset_groups(id)"),
    ("price", "NUMERIC(20,8)"),
    ("change_24h", "NUMERIC(10,4)"),
    ("updated_at", "TIMESTAMP"),
    ("price_symbol", "VARCHAR"),
    ("broker_id", "INTEGER"),
    ("multiplier", "NUMERIC(20,8) NOT NULL DEFAULT 1"),
    ("margin_rate", "NUMERIC(10,6) NOT NULL DEFAULT 0"),
)

PORTFOLIO_COLUMNS = (
    ("is_custom", "BOOLEAN DEFAULT FALSE"),
    ("broker_id", "INTEGER"),
    ("product_ticker", "VARCHAR"),
    ("product_tickers", "JSON"),
    ("x_amount", "NUMERIC(20,8) NOT NULL DEFAULT 0"),
    ("initial_capital", "NUMERIC(20,8) NOT NULL DEFAULT 0"),
)


class AssetRegistryMigrationError(RuntimeError):
    """The startup migration refused to proceed (transaction must roll back)."""


class AssetRegistryPreflightError(AssetRegistryMigrationError):
    """Legacy data cannot be converted without ambiguity."""


def create_application_tables(conn: Connection) -> None:
    """``create_all`` for every mapped table except legacy and registry tables."""
    tables = [
        table
        for name, table in Base.metadata.tables.items()
        if name not in CREATE_ALL_EXCLUDED
    ]
    Base.metadata.create_all(conn, tables=tables, checkfirst=True)


# ---------------------------------------------------------------------------
# Probes / small DDL helpers
# ---------------------------------------------------------------------------

def _dialect(conn: Connection) -> str:
    return conn.dialect.name


def _table_exists(conn: Connection, table: str) -> bool:
    if _dialect(conn) == "postgresql":
        return bool(
            conn.execute(
                text("SELECT to_regclass(:table_name) IS NOT NULL"),
                {"table_name": table},
            ).scalar()
        )
    return (
        conn.execute(
            text(
                "SELECT 1 FROM sqlite_master "
                "WHERE type = 'table' AND name = :table_name"
            ),
            {"table_name": table},
        ).first()
        is not None
    )


def _column_exists(conn: Connection, table: str, column: str) -> bool:
    if _dialect(conn) == "postgresql":
        return bool(
            conn.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = :table_name AND column_name = :column"
                ),
                {"table_name": table, "column": column},
            ).first()
        )
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return any(row[1] == column for row in rows)


def _add_column(conn: Connection, table: str, column: str, sql_type: str) -> None:
    if _column_exists(conn, table, column):
        return
    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}"))


def _json_param(conn: Connection, value: Any) -> Any:
    """Raw SQL JSON binding: text on SQLite, JSON text cast on PostgreSQL."""
    return json.dumps(value)


def _update_portfolio_tickers(
    conn: Connection, portfolio_id: int, values: list[str]
) -> None:
    if _dialect(conn) == "postgresql":
        conn.execute(
            text(
                "UPDATE portfolios SET product_tickers = CAST(:values AS JSON), "
                "product_ticker = :mirror WHERE portfolio_id = :portfolio_id"
            ),
            {
                "values": _json_param(conn, values),
                "mirror": values[0] if values else None,
                "portfolio_id": portfolio_id,
            },
        )
    else:
        conn.execute(
            text(
                "UPDATE portfolios SET product_tickers = :values, "
                "product_ticker = :mirror WHERE portfolio_id = :portfolio_id"
            ),
            {
                "values": _json_param(conn, values),
                "mirror": values[0] if values else None,
                "portfolio_id": portfolio_id,
            },
        )


def _normalise(value: Any) -> str | None:
    if value is None:
        return None
    text_value = str(value).strip().upper()
    return text_value or None


def _quote_source(value: Any) -> str:
    text_value = (str(value) if value is not None else "").strip()
    return text_value or "-"


# ---------------------------------------------------------------------------
# Registry DDL
# ---------------------------------------------------------------------------

_POSTGRES_DDL = (
    """
    CREATE TABLE IF NOT EXISTS asset_products (
        product_id SERIAL PRIMARY KEY,
        ticker VARCHAR,
        broker_id INTEGER REFERENCES brokers(id),
        asset_type VARCHAR,
        multiplier NUMERIC(20,8) NOT NULL DEFAULT 1,
        margin_rate NUMERIC(10,6) NOT NULL DEFAULT 0,
        source VARCHAR DEFAULT '-',
        margin_mode VARCHAR NOT NULL DEFAULT 'notional',
        group_id INTEGER REFERENCES asset_groups(id),
        name VARCHAR,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_asset_product_identity
            UNIQUE NULLS NOT DISTINCT (ticker, broker_id, asset_type),
        CONSTRAINT ck_asset_product_margin_mode
            CHECK (margin_mode IN ('notional','premium','span'))
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS asset_symbols (
        symbol_id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL
            REFERENCES asset_products(product_id) ON DELETE CASCADE,
        broker_id INTEGER REFERENCES brokers(id),
        price_symbol VARCHAR,
        sync_symbol VARCHAR NOT NULL,
        contract_kind VARCHAR DEFAULT 'future',
        option_type VARCHAR,
        expiry_date DATE,
        strike_price NUMERIC(20,8),
        multiplier_override NUMERIC(20,8),
        margin_rate_override NUMERIC(10,6),
        margin_per_contract NUMERIC(20,8),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS asset_quotes (
        source VARCHAR NOT NULL,
        sync_symbol VARCHAR NOT NULL,
        price NUMERIC(20,8),
        change_24h NUMERIC(10,4),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source, sync_symbol)
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_symbol_product_dashboard
        ON asset_symbols (product_id, upper(trim(price_symbol)))
        WHERE price_symbol IS NOT NULL
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_symbol_broker_dashboard
        ON asset_symbols (broker_id, upper(trim(price_symbol)))
        WHERE price_symbol IS NOT NULL
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_symbol_option_identity
        ON asset_symbols (product_id, expiry_date, strike_price, option_type)
        WHERE contract_kind = 'option' AND price_symbol IS NULL
    """,
)

_SQLITE_DDL = (
    """
    CREATE TABLE IF NOT EXISTS asset_products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker VARCHAR,
        broker_id INTEGER REFERENCES brokers(id),
        asset_type VARCHAR,
        multiplier NUMERIC(20,8) NOT NULL DEFAULT 1,
        margin_rate NUMERIC(10,6) NOT NULL DEFAULT 0,
        source VARCHAR DEFAULT '-',
        margin_mode VARCHAR NOT NULL DEFAULT 'notional'
            CHECK (margin_mode IN ('notional','premium','span')),
        group_id INTEGER REFERENCES asset_groups(id),
        name VARCHAR,
        created_at DATETIME,
        updated_at DATETIME,
        CONSTRAINT uq_asset_product_identity UNIQUE (ticker, broker_id, asset_type)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS asset_symbols (
        symbol_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL
            REFERENCES asset_products(product_id) ON DELETE CASCADE,
        broker_id INTEGER REFERENCES brokers(id),
        price_symbol VARCHAR,
        sync_symbol VARCHAR NOT NULL,
        contract_kind VARCHAR DEFAULT 'future',
        option_type VARCHAR,
        expiry_date DATE,
        strike_price NUMERIC(20,8),
        multiplier_override NUMERIC(20,8),
        margin_rate_override NUMERIC(10,6),
        margin_per_contract NUMERIC(20,8),
        created_at DATETIME,
        updated_at DATETIME
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS asset_quotes (
        source VARCHAR NOT NULL,
        sync_symbol VARCHAR NOT NULL,
        price NUMERIC(20,8),
        change_24h NUMERIC(10,4),
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (source, sync_symbol)
    )
    """,
)


def _create_registry_tables(conn: Connection) -> None:
    statements = _POSTGRES_DDL if _dialect(conn) == "postgresql" else _SQLITE_DDL
    for statement in statements:
        conn.execute(text(statement))


# ---------------------------------------------------------------------------
# Retained startup ledger
# ---------------------------------------------------------------------------

def _ensure_brokers(conn: Connection) -> int:
    if _dialect(conn) == "postgresql":
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS brokers (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR NOT NULL UNIQUE,
                    name VARCHAR NOT NULL,
                    default_margin_rate NUMERIC(10,6) DEFAULT 0,
                    currency VARCHAR DEFAULT 'USD',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                "INSERT INTO brokers (code, name) VALUES ('DF', 'Unassigned') "
                "ON CONFLICT (code) DO NOTHING"
            )
        )
    else:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS brokers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code VARCHAR NOT NULL UNIQUE,
                    name VARCHAR NOT NULL,
                    default_margin_rate NUMERIC(10,6) DEFAULT 0,
                    currency VARCHAR DEFAULT 'USD',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                "INSERT OR IGNORE INTO brokers (code, name) "
                "VALUES ('DF', 'Unassigned')"
            )
        )
    conn.execute(
        text("UPDATE brokers SET default_margin_rate = 0 WHERE default_margin_rate IS NULL")
    )
    conn.execute(text("UPDATE brokers SET currency = 'USD' WHERE currency IS NULL"))
    conn.execute(
        text("UPDATE brokers SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
    )
    return int(
        conn.execute(text("SELECT id FROM brokers WHERE code = 'DF'")).scalar()
    )


def _retained_portfolio_migrations(conn: Connection) -> None:
    for column, sql_type in PORTFOLIO_COLUMNS:
        _add_column(conn, "portfolios", column, sql_type)
    conn.execute(
        text(
            "UPDATE portfolios SET initial_capital = available_cash "
            "WHERE initial_capital = 0"
        )
    )
    _add_column(conn, "active_orders", "remark", "VARCHAR")
    if _column_exists(conn, "trade_history", "comments") and not _column_exists(
        conn, "trade_history", "remark"
    ):
        conn.execute(text("ALTER TABLE trade_history RENAME COLUMN comments TO remark"))
    _add_column(conn, "custom_portfolio_connections", "mapping_config", "JSON")
    _add_column(conn, "trade_history", "order_remark", "VARCHAR")


def _ensure_default_product(conn: Connection) -> None:
    if _dialect(conn) == "postgresql":
        conn.execute(
            text(
                """
                INSERT INTO asset_products
                    (ticker, broker_id, asset_type, multiplier, margin_rate,
                     source, margin_mode)
                SELECT NULL, NULL, NULL, 1, 0, '-', 'notional'
                WHERE NOT EXISTS (
                    SELECT 1 FROM asset_products
                    WHERE ticker IS NULL AND broker_id IS NULL AND asset_type IS NULL
                )
                """
            )
        )
        return
    exists = conn.execute(
        text(
            "SELECT 1 FROM asset_products "
            "WHERE ticker IS NULL AND broker_id IS NULL AND asset_type IS NULL"
        )
    ).first()
    if exists is None:
        conn.execute(
            text(
                "INSERT INTO asset_products "
                "(ticker, broker_id, asset_type, multiplier, margin_rate, source, margin_mode) "
                "VALUES (NULL, NULL, NULL, 1, 0, '-', 'notional')"
            )
        )


# ---------------------------------------------------------------------------
# Legacy conversion
# ---------------------------------------------------------------------------

def _legacy_column_additions(conn: Connection) -> None:
    for column, sql_type in LEGACY_COLUMNS:
        _add_column(conn, LEGACY_TABLE, column, sql_type)


def _legacy_rows(conn: Connection) -> list[dict[str, Any]]:
    result = conn.execute(
        text(
            """
            SELECT asset_id, ticker, asset_type, broker_id, multiplier,
                   margin_rate, name, source, group_id, price_symbol,
                   price, change_24h
            FROM whitelist_assets
            ORDER BY asset_id
            """
        )
    ).mappings()
    return [dict(row) for row in result]


def _preflight_duplicate_keys(
    conn: Connection, rows: list[dict[str, Any]], df_broker_id: int
) -> None:
    seen: dict[tuple[int, str], list[tuple[int, str, str | None]]] = {}
    for row in rows:
        broker_id = row.get("broker_id")
        broker_id = df_broker_id if broker_id is None else int(broker_id)
        symbol = _normalise(row.get("ticker"))
        if symbol is None:
            continue
        offending = (
            broker_id,
            str(row.get("ticker")),
            row.get("price_symbol"),
        )
        seen.setdefault((broker_id, symbol), []).append(offending)

    duplicates = {
        key: tuples for key, tuples in seen.items() if len(tuples) > 1
    }
    if not duplicates:
        return
    details = []
    for key in sorted(duplicates):
        for offending in sorted(duplicates[key], key=repr):
            details.append(repr(offending))
    raise AssetRegistryPreflightError(
        "Asset registry migration preflight failed: duplicate broker-scoped "
        "dashboard symbols: " + ", ".join(details)
    )


def _product_id_for(
    conn: Connection,
    ticker: str,
    broker_id: int,
    asset_type: str,
    cache: dict[tuple[str, int, str], int],
    row: dict[str, Any],
) -> int:
    key = (ticker, broker_id, asset_type)
    if key in cache:
        return cache[key]
    if _dialect(conn) == "postgresql":
        result = conn.execute(
            text(
                """
                INSERT INTO asset_products
                    (ticker, broker_id, asset_type, multiplier, margin_rate,
                     source, margin_mode, group_id, name)
                VALUES
                    (:ticker, :broker_id, :asset_type, :multiplier,
                     :margin_rate, :source, 'notional', :group_id, :name)
                RETURNING product_id
                """
            ),
            {
                "ticker": ticker,
                "broker_id": broker_id,
                "asset_type": asset_type,
                "multiplier": row.get("multiplier") if row.get("multiplier") is not None else 1,
                "margin_rate": row.get("margin_rate") if row.get("margin_rate") is not None else 0,
                "source": _quote_source(row.get("source")),
                "group_id": row.get("group_id"),
                "name": row.get("name"),
            },
        )
        product_id = int(result.scalar())
    else:
        result = conn.execute(
            text(
                """
                INSERT INTO asset_products
                    (ticker, broker_id, asset_type, multiplier, margin_rate,
                     source, margin_mode, group_id, name)
                VALUES
                    (:ticker, :broker_id, :asset_type, :multiplier,
                     :margin_rate, :source, 'notional', :group_id, :name)
                """
            ),
            {
                "ticker": ticker,
                "broker_id": broker_id,
                "asset_type": asset_type,
                "multiplier": row.get("multiplier") if row.get("multiplier") is not None else 1,
                "margin_rate": row.get("margin_rate") if row.get("margin_rate") is not None else 0,
                "source": _quote_source(row.get("source")),
                "group_id": row.get("group_id"),
                "name": row.get("name"),
            },
        )
        product_id = int(result.lastrowid)
    cache[key] = product_id
    return product_id


def _upsert_quote(
    conn: Connection,
    source: str,
    sync_symbol: str,
    price: Any,
    change_24h: Any,
) -> None:
    existing = conn.execute(
        text(
            "SELECT 1 FROM asset_quotes "
            "WHERE source = :source AND sync_symbol = :sync_symbol"
        ),
        {"source": source, "sync_symbol": sync_symbol},
    ).first()
    if existing is None:
        conn.execute(
            text(
                """
                INSERT INTO asset_quotes
                    (source, sync_symbol, price, change_24h, updated_at)
                VALUES (:source, :sync_symbol, :price, :change_24h,
                        CURRENT_TIMESTAMP)
                """
            ),
            {
                "source": source,
                "sync_symbol": sync_symbol,
                "price": price,
                "change_24h": change_24h,
            },
        )
    else:
        conn.execute(
            text(
                """
                UPDATE asset_quotes
                SET price = :price, change_24h = :change_24h,
                    updated_at = CURRENT_TIMESTAMP
                WHERE source = :source AND sync_symbol = :sync_symbol
                """
            ),
            {
                "source": source,
                "sync_symbol": sync_symbol,
                "price": price,
                "change_24h": change_24h,
            },
        )


def _convert_legacy_rows(
    conn: Connection, rows: list[dict[str, Any]], df_broker_id: int
) -> tuple[list[dict[str, Any]], int, set[tuple[str, str]]]:
    cache: dict[tuple[str, int, str], int] = {}
    converted: list[dict[str, Any]] = []
    quote_keys: set[tuple[str, str]] = set()
    product_identities: set[tuple[str, int, str]] = set()

    for row in rows:
        ticker = row.get("ticker")
        if ticker is None or not str(ticker).strip():
            raise AssetRegistryMigrationError(
                "Asset registry migration failed: legacy asset "
                f"{row.get('asset_id')} has a blank ticker"
            )
        ticker = str(ticker)
        broker_id = row.get("broker_id")
        broker_id = df_broker_id if broker_id is None else int(broker_id)
        raw_asset_type = row.get("asset_type")
        asset_type = ASSET_TYPE_MAP.get(
            (str(raw_asset_type).strip().lower() if raw_asset_type else ""),
            raw_asset_type,
        )
        if asset_type is None:
            raise AssetRegistryMigrationError(
                "Asset registry migration failed: legacy asset "
                f"{row.get('asset_id')} has no asset type"
            )

        product_id = _product_id_for(
            conn, ticker, broker_id, str(asset_type), cache, row
        )
        product_identities.add((ticker, broker_id, str(asset_type)))

        provider_symbol = row.get("price_symbol")
        provider_symbol = (
            str(provider_symbol).strip() if provider_symbol is not None else ""
        )
        sync_symbol = provider_symbol or ticker
        kind = CONTRACT_KIND_MAP.get(
            (str(raw_asset_type).strip().lower() if raw_asset_type else ""),
            "future",
        )
        conn.execute(
            text(
                """
                INSERT INTO asset_symbols
                    (product_id, broker_id, price_symbol, sync_symbol,
                     contract_kind, created_at, updated_at)
                VALUES (:product_id, :broker_id, :price_symbol, :sync_symbol,
                        :contract_kind, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            ),
            {
                "product_id": product_id,
                "broker_id": broker_id,
                "price_symbol": ticker,
                "sync_symbol": sync_symbol,
                "contract_kind": kind,
            },
        )

        source = _quote_source(row.get("source"))
        quote_keys.add((source, sync_symbol))
        _upsert_quote(
            conn, source, sync_symbol, row.get("price"), row.get("change_24h")
        )
        converted.append(
            {
                "asset_id": row.get("asset_id"),
                "ticker": ticker,
                "broker_id": broker_id,
                "asset_type": str(asset_type),
                "contract_kind": kind,
                "sync_symbol": sync_symbol,
                "product_id": product_id,
            }
        )
    return converted, len(product_identities), quote_keys


def _translate_portfolio_lists(conn: Connection) -> None:
    portfolios = conn.execute(
        text(
            "SELECT portfolio_id, broker_id, product_ticker, product_tickers "
            "FROM portfolios ORDER BY portfolio_id"
        )
    ).mappings().all()
    for portfolio in portfolios:
        stored = portfolio.get("product_tickers")
        if stored is None:
            continue
        if isinstance(stored, str):
            try:
                values = json.loads(stored)
            except (TypeError, ValueError):
                continue
        else:
            values = stored
        if not isinstance(values, list):
            continue

        broker_id = portfolio.get("broker_id")
        params = {"broker_id": broker_id}
        symbol_filter = (
            "s.broker_id = :broker_id"
            if broker_id is not None
            else "s.broker_id IS NULL"
        )
        rows = conn.execute(
            text(
                f"""
                SELECT s.price_symbol, p.ticker
                FROM asset_symbols s
                JOIN asset_products p ON p.product_id = s.product_id
                WHERE {symbol_filter} AND s.price_symbol IS NOT NULL
                ORDER BY s.symbol_id
                """
            ),
            params,
        ).all()
        contract_to_product: dict[str, str] = {}
        for price_symbol, product_ticker in rows:
            key = _normalise(price_symbol)
            if key and key not in contract_to_product and product_ticker is not None:
                contract_to_product[key] = product_ticker

        translated = [
            contract_to_product.get(_normalise(value), value) for value in values
        ]
        _update_portfolio_tickers(
            conn, int(portfolio["portfolio_id"]), translated
        )


def _assert_conversion(
    conn: Connection,
    rows: list[dict[str, Any]],
    converted: list[dict[str, Any]],
    product_count: int,
    quote_keys: set[tuple[str, str]],
) -> None:
    if len(converted) != len(rows):
        raise AssetRegistryMigrationError(
            "Asset registry migration failed: not every legacy row converted"
        )
    expected_products = {
        (
            str(row.get("ticker")),
            int(row.get("broker_id")),
            str(ASSET_TYPE_MAP.get(
                (str(row.get("asset_type")).strip().lower() if row.get("asset_type") else ""),
                row.get("asset_type"),
            )),
        )
        for row in rows
    }
    if product_count != len(expected_products):
        raise AssetRegistryMigrationError(
            "Asset registry migration failed: product count does not match "
            f"legacy identities ({product_count} != {len(expected_products)})"
        )

    for record in converted:
        symbol_row = conn.execute(
            text(
                """
                SELECT s.price_symbol, s.sync_symbol, s.broker_id,
                       s.contract_kind, p.ticker, p.broker_id
                FROM asset_symbols s
                JOIN asset_products p ON p.product_id = s.product_id
                WHERE s.product_id = :product_id
                  AND s.price_symbol = :ticker
                ORDER BY s.symbol_id
                LIMIT 1
                """
            ),
            {"product_id": record["product_id"], "ticker": record["ticker"]},
        ).first()
        if symbol_row is None:
            raise AssetRegistryMigrationError(
                "Asset registry migration failed: legacy asset "
                f"{record['asset_id']} has no converted symbol"
            )
        price_symbol, sync_symbol, symbol_broker, kind, product_ticker, product_broker = (
            symbol_row
        )
        if price_symbol != record["ticker"]:
            raise AssetRegistryMigrationError(
                "Asset registry migration failed: dashboard symbol mismatch"
            )
        if sync_symbol != record["sync_symbol"]:
            raise AssetRegistryMigrationError(
                "Asset registry migration failed: provider symbol mismatch"
            )
        if product_ticker != record["ticker"]:
            raise AssetRegistryMigrationError(
                "Asset registry migration failed: product ticker mismatch"
            )
        if symbol_broker != product_broker or product_broker is None:
            raise AssetRegistryMigrationError(
                "Asset registry migration failed: broker mismatch or NULL broker"
            )
        if kind != record["contract_kind"]:
            raise AssetRegistryMigrationError(
                "Asset registry migration failed: contract kind mismatch"
            )

    null_brokers = conn.execute(
        text(
            "SELECT COUNT(*) FROM asset_products "
            "WHERE ticker IS NOT NULL AND broker_id IS NULL"
        )
    ).scalar()
    if int(null_brokers or 0):
        raise AssetRegistryMigrationError(
            "Asset registry migration failed: converted product has NULL broker"
        )

    quote_count = int(
        conn.execute(text("SELECT COUNT(*) FROM asset_quotes")).scalar() or 0
    )
    if quote_count != len(quote_keys):
        raise AssetRegistryMigrationError(
            "Asset registry migration failed: quote count does not match "
            f"legacy keys ({quote_count} != {len(quote_keys)})"
        )


def _run_legacy_branch(conn: Connection, df_broker_id: int) -> None:
    _legacy_column_additions(conn)
    rows = _legacy_rows(conn)
    _preflight_duplicate_keys(conn, rows, df_broker_id)

    conn.execute(
        text(
            f"UPDATE {LEGACY_TABLE} SET price_symbol = ticker "
            "WHERE price_symbol IS NULL"
        )
    )
    conn.execute(
        text(f"UPDATE {LEGACY_TABLE} SET broker_id = :df_broker_id WHERE broker_id IS NULL"),
        {"df_broker_id": df_broker_id},
    )
    # The legacy conversion owns the DF default; a retained database keeps its
    # brokerless Active Trading portfolios blocked until the user assigns one.
    conn.execute(
        text(
            "UPDATE portfolios SET broker_id = :df_broker_id "
            "WHERE broker_id IS NULL AND port_type = 'Active Trading'"
        ),
        {"df_broker_id": df_broker_id},
    )

    if _dialect(conn) == "postgresql":
        conn.execute(
            text(
                f"ALTER TABLE {LEGACY_TABLE} "
                "DROP CONSTRAINT IF EXISTS whitelist_assets_ticker_key"
            )
        )
    conn.execute(
        text(
            f"CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_broker_ticker "
            f"ON {LEGACY_TABLE} (broker_id, ticker)"
        )
    )

    rows = _legacy_rows(conn)
    converted, product_count, quote_keys = _convert_legacy_rows(
        conn, rows, df_broker_id
    )
    _translate_portfolio_lists(conn)
    _assert_conversion(conn, rows, converted, product_count, quote_keys)
    conn.execute(text(f"DROP TABLE {LEGACY_TABLE}"))


def run_asset_registry_migration(conn: Connection) -> None:
    """Create the registry and convert legacy rows in the caller's transaction."""
    df_broker_id = _ensure_brokers(conn)
    _retained_portfolio_migrations(conn)
    _create_registry_tables(conn)

    legacy_exists = _table_exists(conn, LEGACY_TABLE)
    if legacy_exists and _dialect(conn) == "postgresql":
        conn.execute(
            text("SELECT pg_advisory_xact_lock(hashtext('asset_registry_migration'))")
        )

    _ensure_default_product(conn)
    if legacy_exists:
        _run_legacy_branch(conn, df_broker_id)
