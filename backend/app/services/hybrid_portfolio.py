"""Hybrid storage helpers for mapped Custom Portfolios that trade options.

A mapped portfolio (``is_custom=true`` with a non-null ``mapping_config``)
keeps bot-managed non-option orders in the connected database, while manual
option orders live in the dashboard's main PostgreSQL tables. The helpers here
own the parts both stores must agree on:

* the local option selector/predicate (normalized ``contract_type == "option"``),
* canonical, source-stamped row projections,
* deterministic merge/sort order for active orders and trade history,
* the composite history identity ``(history_source, history_key)``.

Nothing here opens a foreign engine, copies rows, or writes: callers pass
already-fetched mapped rows in and receive merged dictionaries out.
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from decimal import Decimal
from typing import Any, Iterable, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActiveOrder, TradeHistory

ORDER_SOURCE_DASHBOARD = "dashboard"
ORDER_SOURCE_MAPPED = "mapped"
ORDER_SOURCES = (ORDER_SOURCE_DASHBOARD, ORDER_SOURCE_MAPPED)
MAPPED_ORDER_SOURCE_DETAIL = (
    "Order source is required for a mapped portfolio: dashboard or mapped"
)

HISTORY_SOURCE_DASHBOARD = ORDER_SOURCE_DASHBOARD
HISTORY_SOURCE_MAPPED = ORDER_SOURCE_MAPPED

OPTION_CONTRACT_TYPE = "option"


# ---------------------------------------------------------------------------
# Contract classification
# ---------------------------------------------------------------------------

def normalise_contract_type(value: Any) -> str:
    """Lowercase/trim an order contract type (``None``/blank -> ``""``)."""
    if value is None:
        return ""
    return str(value).strip().lower()


def is_option_contract(value: Any) -> bool:
    """True when an order's normalized ``contract_type`` is ``option``."""
    return normalise_contract_type(value) == OPTION_CONTRACT_TYPE


def validate_order_source(value: Optional[str]) -> Optional[str]:
    """Normalize a requested ``order_source``; None when absent/unknown.

    Only the exact lowercase contract values are accepted; an unknown value is
    treated the same as a missing one (the router answers 400).
    """
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized if normalized in ORDER_SOURCES else None


# ---------------------------------------------------------------------------
# Number/date coercion
# ---------------------------------------------------------------------------

def _number(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _int_or_none(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Local (dashboard) queries
# ---------------------------------------------------------------------------

def _option_predicate():
    return func.lower(func.trim(ActiveOrder.contract_type)) == OPTION_CONTRACT_TYPE


async def fetch_local_option_orders(
    db: AsyncSession, portfolio_id: int
) -> list[ActiveOrder]:
    """Dashboard option rows for one mapped portfolio."""
    result = await db.execute(
        select(ActiveOrder)
        .where(
            ActiveOrder.portfolio_id == portfolio_id,
            _option_predicate(),
        )
        .order_by(ActiveOrder.created_at.desc())
    )
    return list(result.scalars().all())


async def fetch_local_option_order(
    db: AsyncSession, portfolio_id: int, order_id: str
) -> Optional[ActiveOrder]:
    """One dashboard option row, scoped to its portfolio and option predicate."""
    result = await db.execute(
        select(ActiveOrder).where(
            ActiveOrder.portfolio_id == portfolio_id,
            ActiveOrder.order_id == order_id,
            _option_predicate(),
        )
    )
    return result.scalar_one_or_none()


async def fetch_local_history(
    db: AsyncSession, portfolio_id: int
) -> list[TradeHistory]:
    """Every dashboard ``TradeHistory`` row for one mapped portfolio."""
    result = await db.execute(
        select(TradeHistory)
        .where(TradeHistory.portfolio_id == portfolio_id)
        .order_by(TradeHistory.exit_date.desc(), TradeHistory.history_id.desc())
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Canonical projections
# ---------------------------------------------------------------------------

def local_order_row(order: ActiveOrder) -> dict:
    """Dashboard ``ActiveOrder`` -> source-stamped canonical order dict.

    The dict is a superset of ``ActiveOrderResponse`` except for ``underlying``:
    that field needs the asset registry, so the orders router resolves it per
    request and writes it onto the returned dict. Each consumer's response
    model filters the keys it does not declare.
    """
    return {
        "order_id": order.order_id,
        "plan_id": order.plan_id,
        "portfolio_id": order.portfolio_id,
        "asset_type": order.asset_type,
        "side": order.side,
        "qty": _number(order.qty),
        "entry_price": _number(order.entry_price),
        "current_price": _number(order.current_price),
        "tp_price": _number(order.tp_price),
        "sl_price": _number(order.sl_price),
        "leverage": _number(order.leverage),
        "margin_rate": _number(order.margin_rate),
        "order_status": order.order_status,
        "executed_by": order.executed_by,
        "group_id": order.group_id,
        "group_name": None,
        "linked_order_id": order.linked_order_id,
        "contract_type": order.contract_type,
        "direction": order.direction,
        "option_type": order.option_type,
        "expiry_date": _iso(order.expiry_date),
        "strike_price": _number(order.strike_price),
        "exercise_price": None,
        "cost": _number(order.cost) or 0,
        "remark": order.remark,
        "order_ref": None,
        "mark_price": None,
        "fee": None,
        "link_type": "none",
        "created_at": _iso(order.created_at),
        "order_source": ORDER_SOURCE_DASHBOARD,
    }


def local_history_row(
    trade: TradeHistory,
    portfolio_name: Optional[str] = None,
) -> dict:
    """Dashboard ``TradeHistory`` -> canonical, source-stamped history dict.

    ``history_key`` is assigned by :func:`merge_history_rows`; the raw history
    id is kept for the composite key and removed afterwards.
    """
    return {
        "history_id": trade.history_id,
        "portfolio_id": trade.portfolio_id,
        "portfolio_name": portfolio_name,
        "type": trade.type,
        "asset": trade.asset,
        "amount": _number(trade.amount),
        "entry_price": _number(trade.entry_price),
        "exit_price": _number(trade.exit_price),
        "realized_pl": _number(trade.realized_pl),
        "executed_by": trade.executed_by or "Manual",
        "decision_note": trade.decision_note,
        "entry_date": _iso(trade.entry_date),
        "exit_date": _iso(trade.exit_date),
        "order_id": trade.order_id,
        "close_order_id": trade.close_order_id,
        "flow": None,
        "remark": trade.remark,
        "order_remark": trade.order_remark,
        "closed_status": None,
        "history_source": HISTORY_SOURCE_DASHBOARD,
        "_raw_history_id": trade.history_id,
    }


def mapped_history_row(
    history: dict,
    portfolio_id: int,
    portfolio_name: str,
) -> dict:
    """Normalised mapped history -> canonical, source-stamped history dict."""
    closed_status = history.get("closed_status")
    cancelled = (
        isinstance(closed_status, str)
        and closed_status.strip().upper().startswith("C")
    )
    raw_id = history.get("history_id")
    return {
        "history_id": _int_or_none(raw_id) or 0,
        "portfolio_id": portfolio_id,
        "portfolio_name": portfolio_name,
        "type": history.get("type") or "",
        "asset": history.get("asset") or "",
        "amount": _number(history.get("amount")),
        "entry_price": _number(history.get("entry_price")),
        "exit_price": _number(history.get("exit_price")),
        "realized_pl": _number(history.get("realized_pl")),
        "executed_by": history.get("executed_by") or "External",
        "decision_note": history.get("decision_note"),
        "entry_date": _iso(history.get("entry_date")),
        "exit_date": _iso(history.get("exit_date")),
        "order_id": history.get("order_id"),
        "close_order_id": None,
        "flow": None,
        "remark": {"note": "Canceled" if cancelled else "Close"},
        "order_remark": history.get("remark"),
        "closed_status": closed_status,
        "history_source": HISTORY_SOURCE_MAPPED,
        "_raw_history_id": raw_id,
    }


# ---------------------------------------------------------------------------
# Deterministic identity and merge order
# ---------------------------------------------------------------------------

def _created_sort_key(row: dict) -> tuple[bool, str]:
    value = row.get("created_at")
    return (value is not None, value or "")


def _source_sort_key(row: dict, field: str) -> int:
    return 0 if row.get(field) == ORDER_SOURCE_DASHBOARD else 1


def merge_order_rows(
    dashboard_rows: Iterable[dict], mapped_rows: Iterable[dict]
) -> list[dict]:
    """Union source-stamped order rows in the frozen display order.

    ``created_at`` descending (nulls last), dashboard before mapped, then
    ``order_id`` ascending. Three stable sorts express the priority without
    mixing the directions in one key.
    """
    rows = list(dashboard_rows) + list(mapped_rows)
    rows.sort(key=lambda row: str(row.get("order_id") or ""))
    rows.sort(key=lambda row: _source_sort_key(row, "order_source"))
    rows.sort(key=_created_sort_key, reverse=True)
    return rows


def _history_exit_sort_key(row: dict) -> tuple[bool, str]:
    value = row.get("exit_date")
    return (value is not None, value or "")


def _fingerprint_value(value: Any) -> str:
    number = _number(value)
    if number is not None:
        return f"{number:.10g}"
    if value is None:
        return ""
    return str(value).strip()


def _history_fingerprint(row: dict) -> str:
    """Stable fingerprint of the fields that identify a mapped history row."""
    parts = [
        _fingerprint_value(row.get(field))
        for field in (
            "order_id",
            "entry_date",
            "exit_date",
            "asset",
            "type",
            "amount",
            "exit_price",
        )
    ]
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()
    return f"mapped:{digest[:16]}"


def _history_key_base(row: dict) -> str:
    """Source id when the mapping supplies one, else the content fingerprint."""
    if row.get("history_source") == HISTORY_SOURCE_DASHBOARD:
        return str(row.get("_raw_history_id", row.get("history_id")))
    raw_id = row.get("_raw_history_id")
    if raw_id is not None and str(raw_id).strip():
        return str(raw_id).strip()
    return _history_fingerprint(row)


def merge_history_rows(
    dashboard_rows: Iterable[dict], mapped_rows: Iterable[dict]
) -> list[dict]:
    """Union source-stamped history rows, then assign composite keys.

    Sort order is ``exit_date`` descending (nulls last), dashboard before
    mapped, then ``history_key`` ascending. A mapped row without a configured
    history id gets a deterministic content fingerprint; repeated fingerprints
    take an occurrence ordinal in the sorted order so the keys stay unique.
    """
    rows = list(dashboard_rows) + list(mapped_rows)
    rows.sort(key=_history_key_base)
    rows.sort(key=lambda row: _source_sort_key(row, "history_source"))
    rows.sort(key=_history_exit_sort_key, reverse=True)

    occurrences: dict[str, int] = {}
    for row in rows:
        base = _history_key_base(row)
        raw_id = row.get("_raw_history_id")
        needs_ordinal = (
            row.get("history_source") == HISTORY_SOURCE_MAPPED
            and (raw_id is None or not str(raw_id).strip())
        )
        if needs_ordinal:
            ordinal = occurrences.get(base, 0)
            occurrences[base] = ordinal + 1
            row["history_key"] = f"{base}#{ordinal}"
        else:
            row["history_key"] = base
        row.pop("_raw_history_id", None)
    return rows


def recent_trade_row(row: dict) -> dict:
    """Merged history row -> analytics ``recent_trades[]`` entry."""
    return {
        "history_id": row.get("history_id"),
        "type": row.get("type"),
        "asset": row.get("asset"),
        "amount": _number(row.get("amount")),
        "exit_price": _number(row.get("exit_price")),
        "realized_pl": _number(row.get("realized_pl")),
        "executed_by": row.get("executed_by"),
        "decision_note": row.get("decision_note"),
        "remark": row.get("remark"),
        "entry_date": row.get("entry_date"),
        "exit_date": row.get("exit_date"),
        "history_source": row.get("history_source"),
        "history_key": row.get("history_key"),
    }
