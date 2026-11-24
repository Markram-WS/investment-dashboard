from decimal import Decimal

from sqlalchemy import func, select, or_
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


def _norm_symbol(value) -> str | None:
    """Normalize a symbol for contract-spec lookup (case/whitespace only)."""
    text = (value or "").strip().upper()
    return text or None


async def _load_contract_specs(
    db: AsyncSession, portfolio: Portfolio, tickers
) -> tuple[dict[str, WhitelistAssets], WhitelistAssets | None]:
    """Load contract specs for ``portfolio.broker_id`` in one query.

    Returns ``(specs_by_symbol, product_spec)``. ``specs_by_symbol`` is keyed by
    the normalized ticker; the portfolio product spec doubles as the fallback
    for orders whose own symbol has no live row.
    """
    wanted = {s for s in (_norm_symbol(t) for t in tickers) if s}
    product_symbol = _norm_symbol(portfolio.product_ticker)
    if product_symbol:
        wanted.add(product_symbol)
    specs: dict[str, WhitelistAssets] = {}
    if wanted:
        spec_result = await db.execute(
            select(WhitelistAssets).where(
                WhitelistAssets.broker_id == portfolio.broker_id,
                func.upper(func.trim(WhitelistAssets.ticker)).in_(wanted),
            )
        )
        for spec in spec_result.scalars().all():
            symbol = _norm_symbol(spec.ticker)
            if symbol:
                specs[symbol] = spec
    return specs, specs.get(product_symbol) if product_symbol else None


def _order_spec(order, specs: dict[str, WhitelistAssets], product_spec):
    """The order's own symbol spec, falling back to the portfolio product."""
    symbol = _norm_symbol(getattr(order, "asset_type", None))
    if symbol:
        spec = specs.get(symbol)
        if spec is not None:
            return spec
    return product_spec


async def compute_margin_locked(db: AsyncSession, portfolio: Portfolio) -> float:
    """Σ notional × margin_rate over non-option active orders.

    notional = COALESCE(current_price, entry_price) × multiplier × qty. Each
    order uses the live asset row for its own symbol on the portfolio broker,
    falling back to the portfolio product's spec. When the portfolio has no
    product and no order resolves a spec, the stored margin_locked column is
    returned unchanged (legacy behaviour). Without a session (pure risk
    helpers) no spec can be resolved, so the stored value is used as well.
    """
    if db is None:
        return float(portfolio.margin_locked or 0)
    orders_result = await db.execute(
        select(ActiveOrder).where(
            ActiveOrder.portfolio_id == portfolio.portfolio_id,
            or_(ActiveOrder.contract_type.is_(None), ActiveOrder.contract_type != "option"),
        )
    )
    orders = orders_result.scalars().all()
    specs, product_spec = await _load_contract_specs(
        db, portfolio, [order.asset_type for order in orders]
    )
    if not portfolio.product_ticker and not specs:
        return float(portfolio.margin_locked or 0)

    total = Decimal("0")
    for order in orders:
        spec = _order_spec(order, specs, product_spec)
        if spec is None:
            continue
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
    """Every number the pool rail and the detail payload need for one portfolio.

    ``orders`` is the caller's already-loaded ORM list. Per order the mark is
    ``current_price`` falling back to ``entry_price``; contract multiplier comes
    from the live asset row for that order's own symbol on the portfolio broker,
    falling back to the portfolio product's spec and then to 1. The top-level
    ``multiplier``/``margin_rate`` still describe the portfolio product for
    backward compatibility.

    Non-option orders drive the equity block; option orders are bucketed by
    long/short × call/put. Orders that cannot be priced (no qty, no mark) are
    skipped so they contribute nothing instead of an invented zero price.
    """
    specs, product_spec = await _load_contract_specs(
        db, portfolio, [getattr(order, "asset_type", None) for order in orders]
    )
    multiplier = Decimal("1")
    margin_rate = Decimal("0")
    if product_spec:
        multiplier = _spec_fallback(product_spec.multiplier, "1")
        margin_rate = _spec_fallback(product_spec.margin_rate, "0")

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
        order_spec = _order_spec(order, specs, product_spec)
        order_multiplier = (
            _spec_fallback(order_spec.multiplier, "1") if order_spec else Decimal("1")
        )

        is_option = (order.contract_type or "").strip().lower() == "option"
        if not is_option:
            eq_orders += 1
            eq_lots += qty
            eq_mark_value += mark_dec * qty
            eq_size0 += mark_dec * order_multiplier * qty
            eq_size_at_x_mark += max(ZERO, mark_dec - x_amount) * order_multiplier * qty
            eq_size_at_x_entry += max(ZERO, entry_dec - x_amount) * order_multiplier * qty
            eq_pl += (mark_dec - entry_dec) * order_multiplier * qty
            continue

        side = (order.side or "").strip().lower()
        if side == "short":
            short_premium += entry_dec * order_multiplier * qty
        elif side == "long":
            long_premium += entry_dec * order_multiplier * qty

        bucket_key = _option_bucket_key(order)
        if bucket_key is None:
            unclassified += 1
            continue
        bucket = buckets[bucket_key]
        bucket["orders"] += 1
        bucket["lots"] += qty
        bucket["premium_value"] += entry_dec * qty
        direction = Decimal("1") if side == "long" else Decimal("-1")
        bucket["pl"] += (mark_dec - entry_dec) * order_multiplier * qty * direction

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
