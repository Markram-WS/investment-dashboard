"""Risk and margin math for the portfolio rail.

Margin is recomputed only for local ``Active Trading`` portfolios, from the
broker-scoped product/symbol specifications. Every other portfolio type keeps
its stored ``margin_locked``. The top-level ``multiplier``/``margin_rate`` in
``compute_risk`` are display-only and never feed the margin formula.
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActiveOrder, Portfolio
from app.services import asset_registry as registry


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
    return registry.normalise_symbol(value)


def _stored_margin(portfolio) -> float:
    return float(portfolio.margin_locked or 0)


async def _load_order_specs(db: AsyncSession, portfolio: Portfolio, orders):
    symbols = [getattr(order, "asset_type", None) for order in orders]
    return await registry.resolve_symbol_specs(db, portfolio.broker_id, symbols)


async def _display_product_spec(db: AsyncSession, portfolio: Portfolio):
    """First ``product_tickers`` entry in the portfolio's display identity.

    The identity is ``(ticker, broker, product_type)`` when the portfolio names
    a type, and the legacy unique ``(ticker, broker)`` match otherwise; an
    ambiguous ticker without a type resolves to None (display 1 / 0). This is
    display-only: per-order margin keeps using each order's own symbol spec,
    and a missing spec contributes zero.
    """
    if db is None:
        return None
    tickers = getattr(portfolio, "product_tickers", None)
    if not isinstance(tickers, list) or not tickers:
        return None
    matches = await registry.resolve_product(
        db,
        tickers[0],
        portfolio.broker_id,
        asset_type=getattr(portfolio, "product_type", None),
    )
    if len(matches) != 1:
        return None
    return matches[0]


def _order_multiplier(spec) -> Decimal:
    if spec is None:
        return Decimal("1")
    symbol, product = spec
    return registry.effective_multiplier(symbol, product)


def _margin_for_orders(orders, specs) -> Decimal:
    """Apply the broker-scoped formula to an explicit order list."""
    total = Decimal("0")
    for order in orders:
        spec = specs.get(_norm_symbol(order.asset_type))
        if spec is None:
            continue
        symbol, product = spec
        mark = order.current_price if order.current_price is not None else order.entry_price
        if mark is None or order.qty is None:
            continue
        multiplier = registry.effective_multiplier(symbol, product)
        mode = (product.margin_mode or "notional").strip().lower()
        premium = dec(mark) * multiplier * dec(order.qty)
        if mode == "premium":
            total += premium
        elif mode == "span":
            if product.margin_per_contract is not None:
                total += dec(order.qty) * dec(product.margin_per_contract)
            else:
                total += premium
        else:
            rate = registry.effective_margin_rate(symbol, product)
            total += dec(mark) * multiplier * dec(order.qty) * rate
    return total


async def compute_orders_margin_locked(
    db: AsyncSession, portfolio: Portfolio, orders: list
) -> float:
    """Margin from broker-scoped specs over a caller-supplied order list.

    Used by the hybrid mapped path to price only dashboard-local option rows.
    A missing broker/spec/mark/quantity contributes zero; the caller decides
    which orders belong to the calculation.
    """
    if db is None or portfolio is None or portfolio.broker_id is None:
        return 0.0
    specs = await _load_order_specs(db, portfolio, orders)
    return float(_margin_for_orders(orders, specs))


async def compute_margin_locked(db: AsyncSession, portfolio: Portfolio) -> float:
    """Margin locked from product/symbol specs for Active Trading only.

    Missing broker, spec, mark or quantity contributes zero. Options are
    included. The product's ``margin_mode`` selects exactly one formula:
    notional / premium / span.
    """
    if db is None:
        return _stored_margin(portfolio)
    if getattr(portfolio, "port_type", None) != "Active Trading":
        return _stored_margin(portfolio)
    if portfolio.broker_id is None:
        return 0.0

    orders = (
        await db.execute(
            select(ActiveOrder).where(
                ActiveOrder.portfolio_id == portfolio.portfolio_id
            )
        )
    ).scalars().all()
    return await compute_orders_margin_locked(db, portfolio, orders)


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

    Per-order sizing uses that order's own symbol spec (no portfolio-product
    fallback) and multiplier 1 when it has none. With ``db is None`` no registry
    lookup happens. Top-level ``multiplier``/``margin_rate`` are display-only:
    they come only from the first ``product_tickers`` entry resolved as its
    full identity ``(ticker, broker, product_type)``, or as a unique ticker +
    broker match when no type is set. Per-order margin is unchanged — each
    order still resolves its own symbol spec and a missing spec contributes
    zero.
    """
    display = await _display_product_spec(db, portfolio)
    multiplier = _spec_fallback(display.multiplier, "1") if display else Decimal("1")
    margin_rate = _spec_fallback(display.margin_rate, "0") if display else Decimal("0")

    specs = (
        await _load_order_specs(db, portfolio, orders) if db is not None else {}
    )

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
        order_spec = specs.get(_norm_symbol(getattr(order, "asset_type", None)))
        order_multiplier = _order_multiplier(order_spec)

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
