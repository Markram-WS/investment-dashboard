from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Portfolio, TradeHistory
from app.custom_mapping import (
    fetch_mapped_history,
    load_mapped_connection,
    mapped_engine,
)
from app.services.hybrid_portfolio import (
    fetch_local_history,
    local_history_row,
    mapped_history_row,
    merge_history_rows,
)
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


def empty_performance_response() -> PerformanceResponse:
    """No realized rows (local or connected) -> empty series."""
    return PerformanceResponse(equity_curve=[], payoff_data=[], total_pl=0.0)


def _parse_date(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _performance_from_realized(realized: list[dict]) -> PerformanceResponse:
    """Chronological equity/payoff aggregation over merged realized rows."""
    if not realized:
        return empty_performance_response()

    equity_curve: List[EquityPoint] = []
    payoff_data: List[PayoffBar] = []
    cumulative = 0.0

    first_date = realized[0]["_date"]
    equity_curve.append(
        EquityPoint(date=first_date.isoformat(), cumulative_pl=0.0)
    )

    month_buckets: Dict[str, float] = {}

    for row in realized:
        pl = float(row.get("realized_pl") or 0)
        cumulative += pl
        trade_date = row["_date"]
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


async def _merged_realized_rows(
    db: AsyncSession, portfolio: Portfolio, connection
) -> list[dict]:
    """Dashboard TradeHistory + connected mapped history, realized rows only.

    A foreign read failure yields the dashboard-local rows only; the analytics
    banner is the visible degraded signal.
    """
    local_history = await fetch_local_history(db, portfolio.portfolio_id)
    dashboard_rows = [
        local_history_row(row, portfolio.portfolio_name) for row in local_history
    ]
    mapped_rows: list[dict] = []
    try:
        engine = await mapped_engine(connection)
        history = await fetch_mapped_history(engine, connection.mapping_config)
        mapped_rows = [
            mapped_history_row(
                row, portfolio.portfolio_id, portfolio.portfolio_name
            )
            for row in history
        ]
    except Exception:
        mapped_rows = []

    merged = merge_history_rows(dashboard_rows, mapped_rows)
    realized: list[dict] = []
    for row in merged:
        if row.get("realized_pl") is None:
            continue
        trade_date = _parse_date(
            row.get("exit_date") or row.get("entry_date")
        )
        if trade_date is None:
            continue
        realized.append({**row, "_date": trade_date})
    realized.sort(key=lambda row: row["_date"])
    return realized


@router.get("/{portfolio_id}", response_model=PerformanceResponse)
async def get_performance(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    connection = await load_mapped_connection(db, portfolio_id)
    if connection is not None:
        return _performance_from_realized(
            await _merged_realized_rows(db, portfolio, connection)
        )

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
