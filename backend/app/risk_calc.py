from decimal import Decimal

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Portfolio, ActiveOrder, WhitelistAssets


ZERO = Decimal("0")

OPTION_BUCKET_KEYS = ("short_call", "short_put", "long_call", "long_put")


def dec(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _rounded(value: Decimal) -> float:
    return round(float(value), 2)


async def compute_margin_locked(db: AsyncSession, portfolio: Portfolio) -> float:
    """Σ notional × margin_rate over non-option active orders.

    notional = COALESCE(current_price, entry_price) × multiplier × qty, where
    multiplier/margin_rate come from the live asset row matching
    (portfolio.broker_id, portfolio.product_ticker). Falls back to the stored
    margin_locked column when the portfolio has no product configured or the
    contract spec is missing.
    """
    if not portfolio.product_ticker:
        return float(portfolio.margin_locked or 0)
    spec_result = await db.execute(
        select(WhitelistAssets).where(
            WhitelistAssets.broker_id == portfolio.broker_id,
            WhitelistAssets.ticker == portfolio.product_ticker,
        )
    )
    spec = spec_result.scalars().first()
    if not spec:
        return float(portfolio.margin_locked or 0)

    orders_result = await db.execute(
        select(ActiveOrder).where(
            ActiveOrder.portfolio_id == portfolio.portfolio_id,
            or_(ActiveOrder.contract_type.is_(None), ActiveOrder.contract_type != "option"),
        )
    )
    total = Decimal("0")
    for order in orders_result.scalars().all():
        mark = order.current_price if order.current_price is not None else order.entry_price
        if mark is None or order.qty is None:
            continue
        total += (
            dec(mark)
            * dec(spec.multiplier)
            * dec(order.qty)
            * dec(spec.margin_rate)
        )
    return float(total)


def _spec_fallback(value, default: str) -> Decimal:
    return dec(value) if value is not None else Decimal(default)


def _option_bucket_key(order) -> str | None:
    side = (order.side or "").strip().lower()
    option_type = (order.option_type or "").strip().lower()
    if side not in ("long", "short") or option_type not in ("call", "put"):
        return None
    return f"{side}_{option_type}"


async def compute_risk(
    db: AsyncSession, portfolio: Portfolio, orders: list
) -> dict:
    """Every number the risk card and the pool rail need for one portfolio.

    ``orders`` is the caller's already-loaded ORM list. Per order the mark is
    ``current_price`` falling back to ``entry_price``; contract multiplier and
    margin rate come from the live asset row matching
    ``(portfolio.broker_id, portfolio.product_ticker)`` and fall back to 1/0
    when the portfolio has no product or the row is missing.

    Non-option orders drive the equity block; option orders are bucketed by
    long/short × call/put. Orders that cannot be priced (no qty, no mark) are
    skipped so they contribute nothing instead of an invented zero price.
    """
    multiplier = Decimal("1")
    margin_rate = Decimal("0")
    if portfolio.product_ticker:
        spec_result = await db.execute(
            select(WhitelistAssets).where(
                WhitelistAssets.broker_id == portfolio.broker_id,
                WhitelistAssets.ticker == portfolio.product_ticker,
            )
        )
        spec = spec_result.scalars().first()
        if spec:
            multiplier = _spec_fallback(spec.multiplier, "1")
            margin_rate = _spec_fallback(spec.margin_rate, "0")

    x_amount = dec(portfolio.x_amount)
    available_cash = dec(portfolio.available_cash)

    eq_orders = 0
    eq_lots = ZERO
    eq_mark_value = ZERO
    eq_size0 = ZERO
    eq_size_at_x_mark = ZERO
    eq_size_at_x_entry = ZERO
    eq_pl = ZERO

    buckets = {
        key: {
            "orders": 0,
            "lots": ZERO,
            "premium_value": ZERO,
            "pl": ZERO,
        }
        for key in OPTION_BUCKET_KEYS
    }
    unclassified = 0
    short_premium = ZERO
    long_premium = ZERO

    for order in orders:
        if order.qty is None:
            continue
        mark = order.current_price if order.current_price is not None else order.entry_price
        if mark is None:
            continue
        qty = dec(order.qty)
        mark_dec = dec(mark)
        entry_dec = dec(order.entry_price)

        is_option = (order.contract_type or "").strip().lower() == "option"
        if not is_option:
            eq_orders += 1
            eq_lots += qty
            eq_mark_value += mark_dec * qty
            eq_size0 += mark_dec * multiplier * qty
            eq_size_at_x_mark += max(ZERO, mark_dec - x_amount) * multiplier * qty
            eq_size_at_x_entry += max(ZERO, entry_dec - x_amount) * multiplier * qty
            eq_pl += (mark_dec - entry_dec) * multiplier * qty
            continue

        side = (order.side or "").strip().lower()
        if side == "short":
            short_premium += entry_dec * multiplier * qty
        elif side == "long":
            long_premium += entry_dec * multiplier * qty

        bucket_key = _option_bucket_key(order)
        if bucket_key is None:
            unclassified += 1
            continue
        bucket = buckets[bucket_key]
        bucket["orders"] += 1
        bucket["lots"] += qty
        bucket["premium_value"] += entry_dec * qty
        direction = Decimal("1") if side == "long" else Decimal("-1")
        bucket["pl"] += (mark_dec - entry_dec) * multiplier * qty * direction

    avg_price = eq_mark_value / eq_lots if eq_lots else ZERO
    available_at_x = max(ZERO, available_cash - eq_size_at_x_mark)

    options_pl = ZERO
    options_payload = {"buckets": {}, "unclassified": unclassified, "net_premium": ZERO, "pl": ZERO}
    for key in OPTION_BUCKET_KEYS:
        bucket = buckets[key]
        lots = bucket["lots"]
        bucket_pl = bucket["pl"]
        options_pl += bucket_pl
        options_payload["buckets"][key] = {
            "orders": bucket["orders"],
            "lots": _rounded(lots),
            "avg_premium": _rounded(bucket["premium_value"] / lots) if lots else 0.0,
            "pl": _rounded(bucket_pl),
        }

    net_premium = short_premium - long_premium
    options_payload["net_premium"] = _rounded(net_premium)
    options_payload["pl"] = _rounded(options_pl)

    pl_total = eq_pl + options_pl

    return {
        "x_amount": _rounded(x_amount),
        "multiplier": _rounded(multiplier),
        "margin_rate": _rounded(margin_rate),
        "margin_locked": round(await compute_margin_locked(db, portfolio), 2),
        "available_cash": _rounded(available_cash),
        "available_at_x": _rounded(available_at_x),
        "risk": _rounded(available_at_x + pl_total),
        "eq": {
            "orders": eq_orders,
            "lots": _rounded(eq_lots),
            "avg_price": _rounded(avg_price),
            "size0": _rounded(eq_size0),
            "size_at_x_mark": _rounded(eq_size_at_x_mark),
            "size_at_x_entry": _rounded(eq_size_at_x_entry),
            "pl": _rounded(eq_pl),
        },
        "options": options_payload,
        "pl_total": _rounded(pl_total),
        "net_premium": _rounded(net_premium),
    }
