from decimal import Decimal

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Portfolio, ActiveOrder, WhitelistAssets


def dec(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


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
