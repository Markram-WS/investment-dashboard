"""Read-only adapter for custom portfolios mapped onto a foreign broker schema.

The credentials and the JSON mapping live in ``investment_main``; rows are read
from the foreign PostgreSQL database on every request. Nothing here creates
tables or writes outside the main database.

Safety rules:
- every identifier taken from the config is checked against
  ``^[A-Za-z_][A-Za-z0-9_]*$`` and then double-quoted;
- filter values are always bound parameters;
- filter operators are limited to ``=``, ``like`` and ``in``.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import bindparam, select, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.database import get_or_create_custom_engine
from app.models import CustomPortfolioConnection, Portfolio

IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
FILTER_OPS = ("=", "like", "in")

REQUIRED_ENTITIES = ("orders", "account")
REQUIRED_COLUMNS = {
    "orders": ("order_id", "asset_type", "side", "qty", "entry_price"),
    "history": ("asset", "exit_date"),
    "account": ("equity", "available_cash", "margin_locked"),
}

READ_ONLY_DETAIL = "Portfolio is read-only (mapped external database)"


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _valid_identifier(value: Any) -> bool:
    return isinstance(value, str) and bool(IDENTIFIER_RE.match(value))


def _is_scalar(value: Any) -> bool:
    return isinstance(value, (str, int, float, bool))


def _validate_write_block(
    prefix: str,
    write: Any,
    read_columns: dict,
    errors: list[str],
) -> None:
    """Validate ``entities.orders.write`` (and its optional ``history`` block)."""
    if not isinstance(write, dict):
        errors.append(f"{prefix} field 'write' must be an object")
        return

    key = write.get("key")
    key_column: str | None = None
    key_generated = False
    if not isinstance(key, dict):
        errors.append(f"{prefix} field 'write.key' must be an object")
    else:
        if not _valid_identifier(key.get("column")):
            errors.append(
                f"{prefix} field 'write.key.column' must be a valid SQL identifier"
            )
        else:
            key_column = key["column"]
        if not isinstance(key.get("generated", False), bool):
            errors.append(f"{prefix} field 'write.key.generated' must be a boolean")
        key_generated = key.get("generated") is True

    for flag in ("insert", "update", "delete"):
        if flag in write and not isinstance(write[flag], bool):
            errors.append(f"{prefix} field 'write.{flag}' must be a boolean")

    write_columns: dict[str, str] = {}
    spec = write.get("columns")
    if not isinstance(spec, dict) or not spec:
        errors.append(f"{prefix} must define a non-empty 'write.columns' object")
    else:
        targets: list[str] = []
        for canonical, target in spec.items():
            if not isinstance(canonical, str) or not canonical.strip():
                errors.append(
                    f"{prefix} 'write.columns' keys must be non-empty strings"
                )
                continue
            if not _valid_identifier(target):
                errors.append(
                    f"{prefix} 'write.columns.{canonical}' must be a valid SQL identifier"
                )
                continue
            if target in targets:
                errors.append(
                    f"{prefix} 'write.columns' maps two fields to the same column "
                    f"'{target}'"
                )
            targets.append(target)
            write_columns[canonical] = target
        if key_generated and key_column and key_column in targets:
            errors.append(
                f"{prefix} 'write.columns' must not include the generated key "
                f"column '{key_column}'"
            )

    defaults = write.get("defaults")
    if defaults is not None:
        if not isinstance(defaults, dict):
            errors.append(f"{prefix} field 'write.defaults' must be an object")
        else:
            for target, value in defaults.items():
                if not _valid_identifier(target):
                    errors.append(
                        f"{prefix} 'write.defaults.{target}' must be a valid SQL identifier"
                    )
                if not _is_scalar(value):
                    errors.append(
                        f"{prefix} 'write.defaults.{target}' must be a JSON scalar"
                    )
                if key_generated and key_column and target == key_column:
                    errors.append(
                        f"{prefix} 'write.defaults' must not set the generated key "
                        f"column '{key_column}'"
                    )

    value_maps = write.get("values")
    if value_maps is not None:
        if not isinstance(value_maps, dict):
            errors.append(f"{prefix} field 'write.values' must be an object")
        else:
            for canonical, mapping in value_maps.items():
                if not isinstance(mapping, dict):
                    errors.append(
                        f"{prefix} 'write.values.{canonical}' must be an object"
                    )
                    continue
                if write_columns and canonical not in write_columns:
                    errors.append(
                        f"{prefix} 'write.values.{canonical}' must reference a "
                        "writable column"
                    )
                for source, target_value in mapping.items():
                    if not isinstance(source, str):
                        errors.append(
                            f"{prefix} 'write.values.{canonical}' keys must be strings"
                        )
                    if not _is_scalar(target_value):
                        errors.append(
                            f"{prefix} 'write.values.{canonical}.{source}' must be "
                            "a JSON scalar"
                        )

    history = write.get("history")
    if history is not None:
        _validate_history_block(prefix, history, write_columns, read_columns, errors)


def _validate_history_block(
    prefix: str,
    history: Any,
    write_columns: dict[str, str],
    read_columns: dict,
    errors: list[str],
) -> None:
    if not isinstance(history, dict):
        errors.append(f"{prefix} field 'write.history' must be an object")
        return

    if history.get("schema") is not None and not _valid_identifier(history["schema"]):
        errors.append(
            f"{prefix} field 'write.history.schema' must be a valid SQL identifier"
        )
    if not _valid_identifier(history.get("table")):
        errors.append(f"{prefix} field 'write.history.table' must be a valid SQL identifier")

    columns = history.get("columns")
    if not isinstance(columns, dict) or not columns:
        errors.append(
            f"{prefix} must define a non-empty 'write.history.columns' object"
        )
    else:
        for canonical, target in columns.items():
            if not _valid_identifier(target):
                errors.append(
                    f"{prefix} 'write.history.columns.{canonical}' must be a valid "
                    "SQL identifier"
                )
            elif canonical not in write_columns and canonical not in read_columns:
                errors.append(
                    f"{prefix} 'write.history.columns.{canonical}' has no writable "
                    "or readable source column"
                )

    defaults = history.get("defaults")
    if defaults is not None:
        if not isinstance(defaults, dict):
            errors.append(f"{prefix} field 'write.history.defaults' must be an object")
        else:
            for target, value in defaults.items():
                if not _valid_identifier(target):
                    errors.append(
                        f"{prefix} 'write.history.defaults.{target}' must be a valid "
                        "SQL identifier"
                    )
                if not _is_scalar(value):
                    errors.append(
                        f"{prefix} 'write.history.defaults.{target}' must be a JSON scalar"
                    )

    status = history.get("status")
    if status is not None:
        if not isinstance(status, dict):
            errors.append(f"{prefix} field 'write.history.status' must be an object")
        else:
            if not _valid_identifier(status.get("column")):
                errors.append(
                    f"{prefix} 'write.history.status.column' must be a valid "
                    "SQL identifier"
                )
            for name in ("close", "cancel"):
                if not _is_scalar(status.get(name)):
                    errors.append(
                        f"{prefix} 'write.history.status.{name}' must be a JSON scalar"
                    )

    close_columns = history.get("close_columns")
    if close_columns is not None:
        if not isinstance(close_columns, dict):
            errors.append(
                f"{prefix} field 'write.history.close_columns' must be an object"
            )
        else:
            for canonical, target in close_columns.items():
                if not isinstance(canonical, str) or not canonical.strip():
                    errors.append(
                        f"{prefix} 'write.history.close_columns' keys must be "
                        "non-empty strings"
                    )
                if not _valid_identifier(target):
                    errors.append(
                        f"{prefix} 'write.history.close_columns.{canonical}' must be "
                        "a valid SQL identifier"
                    )


def validate_mapping(config: dict) -> list[str]:
    """Return user-facing English errors; an empty list means valid."""
    if not isinstance(config, dict):
        return ["mapping config must be a JSON object"]

    errors: list[str] = []

    if config.get("version") != 1:
        errors.append("mapping config 'version' must be 1")
    if config.get("template") is not None and not isinstance(config["template"], str):
        errors.append("mapping config 'template' must be a string")
    if config.get("timezone") is not None and not isinstance(config["timezone"], str):
        errors.append("mapping config 'timezone' must be a string")

    entities = config.get("entities")
    if not isinstance(entities, dict):
        errors.append("mapping config 'entities' must be an object")
        return errors

    for name in REQUIRED_ENTITIES:
        if name not in entities:
            errors.append(f"entity '{name}' is required")

    for name, entity in entities.items():
        prefix = f"entity '{name}'"
        if not isinstance(entity, dict):
            errors.append(f"{prefix} must be an object")
            continue

        if entity.get("schema") is not None and not _valid_identifier(entity["schema"]):
            errors.append(f"{prefix} field 'schema' must be a valid SQL identifier")
        if not _valid_identifier(entity.get("table")):
            errors.append(f"{prefix} field 'table' must be a valid SQL identifier")
        if entity.get("order_by") is not None and not _valid_identifier(entity["order_by"]):
            errors.append(f"{prefix} field 'order_by' must be a valid SQL identifier")

        columns = entity.get("columns")
        if not isinstance(columns, dict) or not columns:
            errors.append(f"{prefix} must define a non-empty 'columns' object")
            columns = {}
        else:
            for canonical, spec in columns.items():
                if isinstance(spec, str):
                    if not _valid_identifier(spec):
                        errors.append(
                            f"{prefix} column '{canonical}' must be a valid SQL identifier"
                        )
                elif isinstance(spec, dict):
                    if not _valid_identifier(spec.get("column")):
                        errors.append(
                            f"{prefix} column '{canonical}' must be a valid SQL identifier"
                        )
                    if "map" in spec and not isinstance(spec["map"], dict):
                        errors.append(
                            f"{prefix} column '{canonical}' field 'map' must be an object"
                        )
                else:
                    errors.append(
                        f"{prefix} column '{canonical}' must be a column name "
                        "or a map object"
                    )

        for required in REQUIRED_COLUMNS.get(name, ()):
            if required not in columns:
                errors.append(f"{prefix} is missing required column '{required}'")

        flt = entity.get("filter")
        if flt is not None:
            if not isinstance(flt, dict):
                errors.append(f"{prefix} field 'filter' must be an object")
            else:
                if not _valid_identifier(flt.get("column")):
                    errors.append(f"{prefix} filter column must be a valid SQL identifier")
                op = flt.get("op", "=")
                if op not in FILTER_OPS:
                    errors.append(f"{prefix} filter op must be one of =, like, in")
                if "value" not in flt:
                    errors.append(f"{prefix} filter is missing 'value'")
                elif op == "in" and not isinstance(flt.get("value"), (list, tuple)):
                    errors.append(f"{prefix} filter value for 'in' must be a list")

        if entity.get("defaults") is not None and not isinstance(entity["defaults"], dict):
            errors.append(f"{prefix} field 'defaults' must be an object")

        if entity.get("write") is not None:
            _validate_write_block(prefix, entity["write"], columns, errors)

    return errors


def select_test_mapping(
    request_mapping: Any,
    request_mapping_provided: bool,
    stored_mapping: Any,
) -> Any:
    """Mapping a stored-connection test should diagnose.

    An explicit ``mapping_config`` in the request body wins, including an
    explicit ``null`` (which means "connect only"). When the body omits the
    field, the mapping saved on the connection is used. ``None`` therefore
    always means connect-only, never invalid input.
    """
    if request_mapping_provided:
        return request_mapping
    return stored_mapping


def _ensure_valid(config: dict) -> None:
    errors = validate_mapping(config)
    if errors:
        raise ValueError("; ".join(errors))


# ---------------------------------------------------------------------------
# SQL construction (validated identifiers, bound values)
# ---------------------------------------------------------------------------

def _quote_identifier(identifier: str) -> str:
    if not _valid_identifier(identifier):
        raise ValueError(f"invalid SQL identifier: {identifier!r}")
    return f'"{identifier}"'


def _table_ref(entity: dict) -> str:
    table = _quote_identifier(entity["table"])
    schema = entity.get("schema")
    if schema:
        return f"{_quote_identifier(schema)}.{table}"
    return table


def _column_name(spec: Any) -> str | None:
    if isinstance(spec, str):
        return spec
    if isinstance(spec, dict) and isinstance(spec.get("column"), str):
        return spec["column"]
    return None


def _source_columns(entity: dict) -> list[str]:
    columns: list[str] = []
    for spec in (entity.get("columns") or {}).values():
        column = _column_name(spec)
        if column:
            columns.append(column)
    flt = entity.get("filter") or {}
    if isinstance(flt.get("column"), str):
        columns.append(flt["column"])
    if isinstance(entity.get("order_by"), str):
        columns.append(entity["order_by"])

    seen: set[str] = set()
    ordered: list[str] = []
    for column in columns:
        if column not in seen:
            seen.add(column)
            ordered.append(column)
    return ordered


def _filter_clause(entity: dict) -> tuple[str, list]:
    flt = entity.get("filter")
    if not flt:
        return "", []
    column = _quote_identifier(flt.get("column"))
    op = flt.get("op", "=")
    if op == "in":
        value = list(flt.get("value") or [])
        return (
            f" WHERE {column} IN :filter_value",
            [bindparam("filter_value", value=value, expanding=True)],
        )
    if op == "like":
        return (
            f" WHERE {column} LIKE :filter_value",
            [bindparam("filter_value", value=flt.get("value"))],
        )
    if op == "=":
        return (
            f" WHERE {column} = :filter_value",
            [bindparam("filter_value", value=flt.get("value"))],
        )
    raise ValueError(f"unsupported filter op: {op!r}")


def _select_sql(
    entity: dict,
    limit: int | None = None,
    default_order: str | None = None,
) -> tuple[str, list]:
    columns = ", ".join(_quote_identifier(c) for c in _source_columns(entity))
    sql = f"SELECT {columns} FROM {_table_ref(entity)}"
    where, binds = _filter_clause(entity)
    sql += where
    order_by = entity.get("order_by") or default_order
    if order_by:
        sql += f" ORDER BY {_quote_identifier(order_by)} DESC"
    if limit is not None:
        sql += f" LIMIT {int(limit)}"
    return sql, binds


# ---------------------------------------------------------------------------
# Row coercion / normalisation
# ---------------------------------------------------------------------------

def _row_get(row: Any, key: str, default=None):
    if row is None:
        return default
    try:
        if key in row:
            return row[key]
    except (TypeError, KeyError):
        pass
    return getattr(row, key, default)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _to_text(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _mapped_value(entity: dict, row: Any, canonical: str) -> tuple[Any, bool]:
    """Read one canonical field from a mapped row; (value, was_mapped)."""
    columns = entity.get("columns") or {}
    spec = columns.get(canonical)
    if spec is None and canonical == "amount":
        spec = columns.get("qty")
    if spec is None and canonical == "order_status":
        spec = columns.get("status")
    if spec is None:
        return None, False
    if isinstance(spec, str):
        return _row_get(row, spec), True
    if isinstance(spec, dict):
        column = spec.get("column")
        if not isinstance(column, str):
            return None, False
        value = _row_get(row, column)
        value_map = spec.get("map")
        if value is not None and isinstance(value_map, dict):
            if value in value_map:
                return value_map[value], True
            key = str(value).strip().upper()
            for map_key, map_value in value_map.items():
                if str(map_key).strip().upper() == key:
                    return map_value, True
        return value, True
    return None, False


def normalise_status(raw: Any) -> str:
    """Settrade status code -> canonical lowercase status."""
    if raw is None:
        return "unknown"
    value = str(raw).strip()
    if not value:
        return "unknown"
    upper = value.upper()
    if upper in ("M", "MP"):
        return "open"
    if upper.startswith("C"):
        return "cancelled"
    if upper.startswith("E"):
        return "expired"
    if upper.startswith("R"):
        return "rejected"
    return value.lower()


def normalise_order_row(row: Any, entity: dict) -> dict:
    """Foreign order row -> canonical order dict."""
    defaults = entity.get("defaults") or {}

    side, _ = _mapped_value(entity, row, "side")
    status_raw, status_mapped = _mapped_value(entity, row, "order_status")
    contract_type, contract_mapped = _mapped_value(entity, row, "contract_type")
    if not contract_mapped:
        contract_type = defaults.get("contract_type")
    direction, direction_mapped = _mapped_value(entity, row, "direction")
    if not direction_mapped:
        direction = side
    executed_by, executed_mapped = _mapped_value(entity, row, "executed_by")
    if not executed_mapped:
        executed_by = defaults.get("executed_by", "External")

    return {
        "order_id": _to_text(_mapped_value(entity, row, "order_id")[0]),
        "order_ref": _to_text(_mapped_value(entity, row, "order_ref")[0]),
        "asset_type": _to_text(_mapped_value(entity, row, "asset_type")[0]),
        "side": _to_text(side),
        "qty": _to_float(_mapped_value(entity, row, "qty")[0]),
        "entry_price": _to_float(_mapped_value(entity, row, "entry_price")[0]),
        "current_price": _to_float(_mapped_value(entity, row, "current_price")[0]),
        # The foreign mark is display-only: the dashboard's Net P&L reads the
        # local asset price (investment_main.whitelist_assets.price) instead.
        "mark_price": _to_float(_mapped_value(entity, row, "mark_price")[0]),
        "tp_price": _to_float(_mapped_value(entity, row, "tp_price")[0]),
        "exit_price": _to_float(_mapped_value(entity, row, "exit_price")[0]),
        "sl_price": _to_float(_mapped_value(entity, row, "sl_price")[0]),
        "leverage": _to_float(_mapped_value(entity, row, "leverage")[0]),
        "margin_rate": _to_float(_mapped_value(entity, row, "margin_rate")[0]),
        "order_status": normalise_status(status_raw) if status_mapped else "open",
        "executed_by": _to_text(executed_by),
        "group_id": _mapped_value(entity, row, "group_id")[0],
        "linked_order_id": _to_text(_mapped_value(entity, row, "linked_order_id")[0]),
        "contract_type": _to_text(contract_type),
        "direction": _to_text(direction),
        "option_type": _to_text(_mapped_value(entity, row, "option_type")[0]),
        "expiry_date": _to_iso(_mapped_value(entity, row, "expiry_date")[0]),
        "strike_price": _to_float(_mapped_value(entity, row, "strike_price")[0]),
        "exercise_price": _to_float(_mapped_value(entity, row, "exercise_price")[0]),
        "cost": _to_float(_mapped_value(entity, row, "cost")[0]),
        "remark": _to_text(_mapped_value(entity, row, "remark")[0]),
        "created_at": _to_iso(_mapped_value(entity, row, "created_at")[0]),
        "fee": _to_float(_mapped_value(entity, row, "fee")[0]),
        "realized_pl": _to_float(_mapped_value(entity, row, "realized_pl")[0]),
    }


def normalise_history_row(row: Any, entity: dict) -> dict:
    """Foreign order-history row -> canonical trade-history dict."""
    executed_by, executed_mapped = _mapped_value(entity, row, "executed_by")
    if not executed_mapped:
        executed_by = "External"

    amount = _mapped_value(entity, row, "amount")[0]
    if amount is None:
        amount = _mapped_value(entity, row, "qty")[0]
    closed_status, closed_status_mapped = _mapped_value(entity, row, "closed_status")

    return {
        "history_id": _mapped_value(entity, row, "history_id")[0],
        "type": _to_text(_mapped_value(entity, row, "type")[0]),
        "asset": _to_text(_mapped_value(entity, row, "asset")[0]),
        "amount": _to_float(amount),
        "entry_price": _to_float(_mapped_value(entity, row, "entry_price")[0]),
        "exit_price": _to_float(_mapped_value(entity, row, "exit_price")[0]),
        "realized_pl": _to_float(_mapped_value(entity, row, "realized_pl")[0]),
        "executed_by": _to_text(executed_by),
        "decision_note": _to_text(_mapped_value(entity, row, "decision_note")[0]),
        "order_id": _to_text(_mapped_value(entity, row, "order_id")[0]),
        "remark": _to_text(_mapped_value(entity, row, "remark")[0]),
        "entry_date": _to_iso(_mapped_value(entity, row, "entry_date")[0]),
        "exit_date": _to_iso(_mapped_value(entity, row, "exit_date")[0]),
        "closed_status": _to_text(closed_status) if closed_status_mapped else None,
    }


def _coerce_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def mapped_history_record(
    history: dict, portfolio_id: int, portfolio_name: str
) -> dict:
    """Normalised mapped history row -> GET /trade-history response dict."""
    closed_status = history.get("closed_status")
    cancelled = (
        isinstance(closed_status, str)
        and closed_status.strip().upper().startswith("C")
    )
    return {
        "history_id": _coerce_int(history.get("history_id")),
        "portfolio_id": portfolio_id,
        "portfolio_name": portfolio_name,
        "type": history.get("type") or "",
        "asset": history.get("asset") or "",
        "amount": history.get("amount"),
        "entry_price": history.get("entry_price"),
        "exit_price": history.get("exit_price"),
        "realized_pl": history.get("realized_pl"),
        "executed_by": history.get("executed_by") or "External",
        "decision_note": history.get("decision_note"),
        "entry_date": history.get("entry_date"),
        "exit_date": history.get("exit_date"),
        "order_id": history.get("order_id"),
        "close_order_id": None,
        "flow": None,
        "remark": {"note": "Canceled" if cancelled else "Close"},
        "order_remark": history.get("remark"),
    }


def mapped_history_records(
    history: list[dict],
    portfolio_id: int,
    portfolio_name: str,
    offset: int = 0,
    limit: int | None = None,
) -> list[dict]:
    """Sort by exit date, paginate, and build response rows."""
    ordered = sorted(
        history, key=lambda row: row.get("exit_date") or "", reverse=True
    )
    start = max(int(offset or 0), 0)
    end = None if limit is None else start + max(int(limit), 0)
    return [
        mapped_history_record(row, portfolio_id, portfolio_name)
        for row in ordered[start:end]
    ]


def normalise_account_row(row: Any, entity: dict) -> dict | None:
    """Foreign account row -> {equity, available_cash, margin_locked}."""
    if row is None:
        return None
    return {
        "equity": _to_float(_mapped_value(entity, row, "equity")[0]),
        "available_cash": _to_float(_mapped_value(entity, row, "available_cash")[0]),
        "margin_locked": _to_float(_mapped_value(entity, row, "margin_locked")[0]),
    }


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

async def _fetch_rows(engine: AsyncEngine, sql: str, binds: list) -> list[dict]:
    stmt = text(sql)
    if binds:
        stmt = stmt.bindparams(*binds)
    async with engine.connect() as conn:
        result = await conn.execute(stmt)
        return [dict(row) for row in result.mappings().all()]


async def _count_rows(engine: AsyncEngine, entity: dict) -> int:
    where, binds = _filter_clause(entity)
    sql = f"SELECT COUNT(*) FROM {_table_ref(entity)}{where}"
    stmt = text(sql)
    if binds:
        stmt = stmt.bindparams(*binds)
    async with engine.connect() as conn:
        result = await conn.execute(stmt)
        return int(result.scalar() or 0)


async def fetch_mapped_orders(engine: AsyncEngine, config: dict) -> list[dict]:
    _ensure_valid(config)
    entity = config["entities"]["orders"]
    columns = entity.get("columns") or {}
    default_order = _column_name(columns.get("created_at"))
    sql, binds = _select_sql(entity, default_order=default_order)
    rows = await _fetch_rows(engine, sql, binds)
    return [normalise_order_row(row, entity) for row in rows]


async def fetch_mapped_history(engine: AsyncEngine, config: dict) -> list[dict]:
    _ensure_valid(config)
    entity = config["entities"].get("history")
    if not entity:
        return []
    columns = entity.get("columns") or {}
    default_order = _column_name(columns.get("exit_date"))
    sql, binds = _select_sql(entity, default_order=default_order)
    rows = await _fetch_rows(engine, sql, binds)
    return [normalise_history_row(row, entity) for row in rows]


async def fetch_mapped_account(engine: AsyncEngine, config: dict) -> dict | None:
    _ensure_valid(config)
    entity = config["entities"].get("account")
    if not entity:
        return None
    sql, binds = _select_sql(entity, limit=1)
    rows = await _fetch_rows(engine, sql, binds)
    if not rows:
        return None
    return normalise_account_row(rows[0], entity)


async def mapped_diagnostics(engine: AsyncEngine, config: dict) -> dict:
    """Counts, one sample order, and per-entity read errors."""
    diagnostics: dict[str, Any] = {
        "orders_rows": 0,
        "history_rows": 0,
        "account_rows": 0,
        "sample_order": None,
        "errors": [],
    }
    errors = validate_mapping(config)
    if errors:
        diagnostics["errors"] = errors
        return diagnostics

    entities = config["entities"]
    for name in ("orders", "history", "account"):
        entity = entities.get(name)
        if not entity:
            continue
        try:
            diagnostics[f"{name}_rows"] = await _count_rows(engine, entity)
            if name == "orders":
                sql, binds = _select_sql(entity, limit=1)
                rows = await _fetch_rows(engine, sql, binds)
                if rows:
                    diagnostics["sample_order"] = normalise_order_row(rows[0], entity)
        except Exception as exc:  # surfaced to the caller, never swallowed
            diagnostics["errors"].append(f"{name}: {exc}")
    return diagnostics


# ---------------------------------------------------------------------------
# Mapped order writes (insert / update / close / cancel)
# ---------------------------------------------------------------------------

def _orders_entity(config: dict) -> dict:
    return config["entities"]["orders"]


def _write_block(entity: dict) -> dict:
    write = entity.get("write")
    if not isinstance(write, dict):
        raise ValueError("mapped orders do not allow writes")
    return write


def _key_column(entity: dict) -> str | None:
    """The unique row key: ``write.key.column`` or the read ``order_id`` column."""
    write = entity.get("write") if isinstance(entity.get("write"), dict) else {}
    key = write.get("key") if isinstance(write.get("key"), dict) else {}
    column = key.get("column")
    if _valid_identifier(column):
        return column
    return _column_name((entity.get("columns") or {}).get("order_id"))


def _translate_value(write: dict, canonical: str, value: Any) -> Any:
    """Apply ``write.values`` (canonical literal -> foreign literal)."""
    mapping = (write.get("values") or {}).get(canonical)
    if not isinstance(mapping, dict) or value is None:
        return value
    if isinstance(value, str) and value in mapping:
        return mapping[value]
    normalized = str(value).strip().upper()
    for source, target in mapping.items():
        if str(source).strip().upper() == normalized:
            return target
    return value


def mapped_orders_write_capabilities(config: dict) -> dict | None:
    """Public write capabilities of a mapped config; None when read-only."""
    if not isinstance(config, dict):
        return None
    entity = (config.get("entities") or {}).get("orders") or {}
    if not isinstance(entity, dict):
        return None
    write = entity.get("write")
    if not isinstance(write, dict):
        return None
    key = write.get("key") if isinstance(write.get("key"), dict) else {}
    return {
        "insert": bool(write.get("insert")),
        "update": bool(write.get("update")),
        "delete": bool(write.get("delete")),
        "fields": sorted((write.get("columns") or {}).keys()),
        "key_generated": bool(key.get("generated")),
    }


async def load_mapped_connection(
    db: AsyncSession, portfolio_id: int | None
) -> CustomPortfolioConnection | None:
    """The mapped connection row for a custom portfolio, or None."""
    if portfolio_id is None:
        return None
    result = await db.execute(
        select(CustomPortfolioConnection)
        .join(
            Portfolio,
            Portfolio.portfolio_id == CustomPortfolioConnection.portfolio_id,
        )
        .where(
            CustomPortfolioConnection.portfolio_id == portfolio_id,
            Portfolio.is_custom.is_(True),
            CustomPortfolioConnection.mapping_config.isnot(None),
        )
    )
    return result.scalar_one_or_none()


async def mapped_engine(connection: CustomPortfolioConnection) -> AsyncEngine:
    """Thin wrapper so tests can substitute the foreign engine."""
    return await get_or_create_custom_engine(connection)


async def fetch_mapped_order(
    engine: AsyncEngine, config: dict, key: Any
) -> dict | None:
    """One normalised mapped order by its unique key, or None."""
    _ensure_valid(config)
    entity = _orders_entity(config)
    key_column = _key_column(entity)
    if key_column is None:
        raise ValueError("mapped orders config has no order key column")
    columns = _source_columns(entity)
    if key_column not in columns:
        columns.append(key_column)
    sql = (
        f"SELECT {', '.join(_quote_identifier(c) for c in columns)} "
        f"FROM {_table_ref(entity)}"
    )
    where, binds = _filter_clause(entity)
    key_sql = f'{_quote_identifier(key_column)} = :key'
    sql += f"{where} AND {key_sql}" if where else f" WHERE {key_sql}"
    stmt = text(sql)
    if binds:
        stmt = stmt.bindparams(*binds)
    async with engine.connect() as conn:
        result = await conn.execute(stmt, {"key": key})
        row = result.mappings().first()
    if row is None:
        return None
    return normalise_order_row(dict(row), entity)


def _writable_values(
    entity: dict, write: dict, data: dict, *, allow_key: bool
) -> tuple[dict[str, Any], str | None, bool]:
    """Collect bound column values from canonical input; validate the rest."""
    columns = write.get("columns") or {}
    key = write.get("key") if isinstance(write.get("key"), dict) else {}
    key_column = _key_column(entity)
    generated = bool(key.get("generated"))

    values: dict[str, Any] = {}
    for canonical, target in columns.items():
        if canonical in data and data[canonical] is not None:
            values[target] = _translate_value(write, canonical, data[canonical])

    for field, value in data.items():
        if value is None or field in columns:
            continue
        if field == "order_id" and allow_key:
            if generated:
                raise ValueError(
                    "order_id is generated by the mapped table and cannot be supplied"
                )
            continue
        if field == "order_id" and not allow_key:
            raise ValueError("order_id cannot be changed")
        raise ValueError(
            f"field '{field}' cannot be written to the mapped orders table"
        )
    return values, key_column, generated


async def insert_mapped_order(
    engine: AsyncEngine, config: dict, data: dict
) -> dict:
    """Insert one mapped order; returns ``{order_id, order_ref, ...}``."""
    _ensure_valid(config)
    entity = _orders_entity(config)
    write = _write_block(entity)
    if not write.get("insert"):
        raise ValueError("mapped orders do not allow insert")
    values, key_column, generated = _writable_values(
        entity, write, data, allow_key=True
    )
    if key_column is None:
        raise ValueError("mapped orders write config is missing a key column")
    if not generated and key_column not in values:
        if data.get("order_id") is None:
            raise ValueError("order_id is required")
        values[key_column] = data["order_id"]
    for target, literal in (write.get("defaults") or {}).items():
        values.setdefault(target, literal)

    table = _table_ref(entity)
    returning = _quote_identifier(key_column)
    if values:
        targets = ", ".join(_quote_identifier(t) for t in values)
        params = {f"v{i}": value for i, value in enumerate(values.values())}
        placeholders = ", ".join(f":v{i}" for i in range(len(values)))
        sql = (
            f"INSERT INTO {table} ({targets}) VALUES ({placeholders}) "
            f"RETURNING {returning}"
        )
        stmt = text(sql)
    else:
        sql = f"INSERT INTO {table} DEFAULT VALUES RETURNING {returning}"
        stmt = text(sql)
        params = {}

    async with engine.begin() as conn:
        result = await conn.execute(stmt, params)
        row = result.first()
    if row is None:
        raise ValueError("mapped orders insert did not return a key")

    submitted = {
        canonical: data[canonical]
        for canonical in (write.get("columns") or {})
        if data.get(canonical) is not None
    }
    submitted["order_id"] = str(row[0])
    submitted["order_ref"] = _to_text(data.get("order_ref"))
    return submitted


async def update_mapped_order(
    engine: AsyncEngine, config: dict, key: Any, changes: dict
) -> dict | None:
    """Update one mapped order by key; None when the row does not exist."""
    _ensure_valid(config)
    entity = _orders_entity(config)
    write = _write_block(entity)
    if not write.get("update"):
        raise ValueError("mapped orders do not allow update")
    values, key_column, _generated = _writable_values(
        entity, write, changes, allow_key=False
    )
    if key_column is None:
        raise ValueError("mapped orders write config is missing a key column")
    if key_column in values:
        raise ValueError("order_id cannot be updated")

    if values:
        assignments = ", ".join(
            f"{_quote_identifier(target)} = :v{i}"
            for i, target in enumerate(values)
        )
        params = {f"v{i}": value for i, value in enumerate(values.values())}
        params["key"] = key
        sql = (
            f"UPDATE {_table_ref(entity)} SET {assignments} "
            f"WHERE {_quote_identifier(key_column)} = :key "
            f"RETURNING {_quote_identifier(key_column)}"
        )
        async with engine.begin() as conn:
            result = await conn.execute(text(sql), params)
            if result.first() is None:
                return None
    elif await fetch_mapped_order(engine, config, key) is None:
        return None
    return await fetch_mapped_order(engine, config, key)


async def move_mapped_order_to_history(
    engine: AsyncEngine,
    config: dict,
    key: Any,
    *,
    mode: str = "close",
    exit_price: float | None = None,
    realized_pl: float | None = None,
) -> dict | None:
    """Close/cancel: insert the history row, then delete the open row.

    Both statements share one transaction. Without a ``write.history`` block
    this is a plain delete. Returns None when the open row does not exist.
    """
    _ensure_valid(config)
    if mode not in ("close", "cancel"):
        raise ValueError(f"unsupported close mode: {mode!r}")
    entity = _orders_entity(config)
    write = _write_block(entity)
    if not write.get("delete"):
        raise ValueError("mapped orders do not allow delete")
    key_column = _key_column(entity)
    if key_column is None:
        raise ValueError("mapped orders write config is missing a key column")

    read_columns = entity.get("columns") or {}
    write_columns = write.get("columns") or {}
    history = write.get("history")
    select_columns = _source_columns(entity)
    if key_column not in select_columns:
        select_columns.append(key_column)
    select_sql = (
        f"SELECT {', '.join(_quote_identifier(c) for c in select_columns)} "
        f"FROM {_table_ref(entity)} "
        f"WHERE {_quote_identifier(key_column)} = :key"
    )

    async with engine.begin() as conn:
        result = await conn.execute(text(select_sql), {"key": key})
        row = result.mappings().first()
        if row is None:
            return None
        raw = dict(row)

        if isinstance(history, dict):
            values: dict[str, Any] = {}
            for canonical, target in (history.get("columns") or {}).items():
                source = write_columns.get(canonical)
                if source is None:
                    source = _column_name(read_columns.get(canonical))
                if source is None or source not in raw:
                    continue
                if raw[source] is not None:
                    values[target] = raw[source]
            for target, literal in (history.get("defaults") or {}).items():
                values.setdefault(target, literal)
            status = history.get("status") or {}
            status_column = status.get("column")
            status_value = (
                status.get("close") if mode == "close" else status.get("cancel")
            )
            if _valid_identifier(status_column) and status_value is not None:
                values[status_column] = status_value
            close_columns = history.get("close_columns") or {}
            if exit_price is not None and "exit_price" in close_columns:
                values[close_columns["exit_price"]] = exit_price
            if realized_pl is not None and "realized_pl" in close_columns:
                values[close_columns["realized_pl"]] = realized_pl

            schema = history.get("schema") or entity.get("schema")
            table = _quote_identifier(history.get("table"))
            if schema:
                table = f"{_quote_identifier(schema)}.{table}"
            if values:
                targets = ", ".join(_quote_identifier(t) for t in values)
                placeholders = ", ".join(
                    f":h{i}" for i in range(len(values))
                )
                params = {
                    f"h{i}": value for i, value in enumerate(values.values())
                }
                await conn.execute(
                    text(
                        f"INSERT INTO {table} ({targets}) VALUES ({placeholders})"
                    ),
                    params,
                )
            else:
                await conn.execute(text(f"INSERT INTO {table} DEFAULT VALUES"))

        await conn.execute(
            text(
                f"DELETE FROM {_table_ref(entity)} "
                f"WHERE {_quote_identifier(key_column)} = :key"
            ),
            {"key": key},
        )

    return {
        "order_id": str(key),
        "order_status": "CLOSE" if mode == "close" else "CANCELED",
        "history_id": None,
    }


# ---------------------------------------------------------------------------
# Mapped detection / write guard
# ---------------------------------------------------------------------------

def is_mapping_config_present(mapping_config: Any) -> bool:
    """True when a stored config makes a custom portfolio a mapped read view.

    Any stored JSON object counts, including an empty one; only ``NULL`` keeps
    the legacy custom-portfolio behaviour (our own tables in the external DB).
    """
    return mapping_config is not None


async def is_mapped_portfolio(db: AsyncSession, portfolio_id: int | None) -> bool:
    """True when the portfolio is custom and mapped onto a foreign schema."""
    if portfolio_id is None:
        return False
    result = await db.execute(
        select(CustomPortfolioConnection.mapping_config)
        .join(
            Portfolio,
            Portfolio.portfolio_id == CustomPortfolioConnection.portfolio_id,
        )
        .where(
            CustomPortfolioConnection.portfolio_id == portfolio_id,
            Portfolio.is_custom.is_(True),
            CustomPortfolioConnection.mapping_config.isnot(None),
        )
    )
    return is_mapping_config_present(result.scalar_one_or_none())


async def raise_if_mapped_readonly(
    db: AsyncSession, portfolio_id: int | None
) -> None:
    """409 when the portfolio is custom and mapped onto a foreign schema."""
    if await is_mapped_portfolio(db, portfolio_id):
        raise HTTPException(status_code=409, detail=READ_ONLY_DETAIL)
