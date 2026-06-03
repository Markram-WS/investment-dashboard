from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Portfolio, TradeHistory
from pydantic import BaseModel
from typing import List, Dict
from datetime import datetime

router = APIRouter()


class EquityPoint(BaseModel):
    date: str
    cumulative_pl: float


class PayoffBar(BaseModel):
    date: str
    realized_pl: float


class PerformanceResponse(BaseModel):
    equity_curve: List[EquityPoint]
    payoff_data: List[PayoffBar]
    total_pl: float


@router.get("/{portfolio_id}", response_model=PerformanceResponse)
async def get_performance(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    trades_result = await db.execute(
        select(TradeHistory)
        .where(
            TradeHistory.portfolio_id == portfolio_id,
            TradeHistory.realized_pl.isnot(None),
        )
        .order_by(TradeHistory.exit_date.asc(), TradeHistory.entry_date.asc())
    )
    trades = trades_result.scalars().all()

    equity_curve: List[EquityPoint] = []
    payoff_data: List[PayoffBar] = []
    cumulative = 0.0

    if trades:
        first_date = (
            trades[0].exit_date or trades[0].entry_date or datetime.utcnow()
        ).isoformat()
        equity_curve.append(EquityPoint(date=first_date, cumulative_pl=0.0))

    month_buckets: Dict[str, float] = {}

    for trade in trades:
        pl = float(trade.realized_pl or 0)
        cumulative += pl
        trade_date = (
            trade.exit_date
            if trade.exit_date
            else (trade.entry_date if trade.entry_date else datetime.utcnow())
        )
        equity_curve.append(
            EquityPoint(
                date=trade_date.isoformat(),
                cumulative_pl=round(cumulative, 2),
            )
        )
        month_key = trade_date.strftime("%Y-%m")
        month_buckets[month_key] = month_buckets.get(month_key, 0) + pl

    payoff_data = [
        PayoffBar(date=f"{month}-01", realized_pl=round(total, 2))
        for month, total in sorted(month_buckets.items())
    ]

    return PerformanceResponse(
        equity_curve=equity_curve,
        payoff_data=payoff_data,
        total_pl=round(cumulative, 2),
    )
