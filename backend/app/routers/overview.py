from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, resolve_portfolio_db
from app.models import Portfolio, TradeHistory
from app.custom_models import CustomTransaction
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class PortfolioOverviewItem(BaseModel):
    portfolio_id: int
    portfolio_name: str
    margin: float
    buffer: float
    available_cash: float
    money_market: float
    total_pl: float = 0
    risk_status: Optional[str]

    class Config:
        orm_mode = True

class OverviewResponse(BaseModel):
    margin: float
    buffer: float
    available_cash: float
    money_market: float
    total_pl: float = 0
    pool_health_index: float
    money_reserve_status: str
    portfolios: List[PortfolioOverviewItem]

    class Config:
        orm_mode = True

router = APIRouter()

@router.get("/", tags=["overview"])
async def get_overview(
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """
    Get global overview data including cash breakdown, pool health, money reserve status,
    and list of portfolios with risk indicators.
    """
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        if is_custom and portfolio_id:
            p_result = await db.execute(
                select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
            )
            portfolio = p_result.scalar_one_or_none()
            if not portfolio:
                return OverviewResponse(
                    margin=0.0, buffer=0.0, available_cash=0.0, money_market=0.0,
                    pool_health_index=0.0, money_reserve_status="Optimal", portfolios=[]
                )

            total_margin = float(portfolio.margin_locked) if portfolio.margin_locked else 0
            total_buffer = float(portfolio.cash_buffer_limit) if portfolio.cash_buffer_limit else 0
            total_available_cash = float(portfolio.available_cash) if portfolio.available_cash else 0
            total_money_market = float(portfolio.money_market) if portfolio.money_market else 0

            pl_result = await session.execute(
                select(func.coalesce(func.sum(CustomTransaction.amount), 0))
                .where(CustomTransaction.source_portfolio_id == portfolio_id)
            )
            total_pl = float(pl_result.scalar() or 0)

            total_cash = total_margin + total_buffer + total_available_cash + total_money_market
            global_cash = total_available_cash + total_money_market
            pool_health_index = min(100, max(0, (global_cash / total_cash) * 100)) if total_cash > 0 else 0.0

            lower_bound = (total_margin + total_buffer) * 1.2
            upper_bound = (total_margin + total_buffer) * 2.0
            if global_cash < lower_bound:
                money_reserve_status = "Danger"
            elif global_cash > upper_bound:
                money_reserve_status = "Inefficient"
            else:
                money_reserve_status = "Optimal"

            return OverviewResponse(
                margin=total_margin, buffer=total_buffer,
                available_cash=total_available_cash, money_market=total_money_market,
                total_pl=total_pl, pool_health_index=pool_health_index,
                money_reserve_status=money_reserve_status,
                portfolios=[PortfolioOverviewItem(
                    portfolio_id=portfolio.portfolio_id,
                    portfolio_name=portfolio.portfolio_name,
                    margin=total_margin, buffer=total_buffer,
                    available_cash=total_available_cash, money_market=total_money_market,
                    total_pl=total_pl, risk_status=portfolio.risk_status,
                )]
            )

        result = await session.execute(select(Portfolio))
        portfolios = result.scalars().all()

        if not portfolios:
            return OverviewResponse(
                margin=0.0, buffer=0.0, available_cash=0.0, money_market=0.0,
                pool_health_index=0.0, money_reserve_status="Optimal", portfolios=[]
            )

        total_margin = sum(float(p.margin_locked) if p.margin_locked else 0 for p in portfolios)
        total_buffer = sum(float(p.cash_buffer_limit) if p.cash_buffer_limit else 0 for p in portfolios)
        total_available_cash = sum(float(p.available_cash) if p.available_cash else 0 for p in portfolios)
        total_money_market = sum(float(p.money_market) if p.money_market else 0 for p in portfolios)

        pl_rows = await session.execute(
            select(TradeHistory.portfolio_id, func.coalesce(func.sum(TradeHistory.realized_pl), 0).label('total_pl'))
            .where(TradeHistory.realized_pl.isnot(None))
            .group_by(TradeHistory.portfolio_id)
        )
        pl_map = {row.portfolio_id: float(row.total_pl) for row in pl_rows}
        total_pl = sum(pl_map.values())

        total_cash = total_margin + total_buffer + total_available_cash + total_money_market
        global_cash = total_available_cash + total_money_market

        if total_cash > 0:
            pool_health_index = min(100, max(0, (global_cash / total_cash) * 100))
        else:
            pool_health_index = 0.0

        lower_bound = (total_margin + total_buffer) * 1.2
        upper_bound = (total_margin + total_buffer) * 2.0
        if global_cash < lower_bound:
            money_reserve_status = "Danger"
        elif global_cash > upper_bound:
            money_reserve_status = "Inefficient"
        else:
            money_reserve_status = "Optimal"

        portfolio_overview_items = []
        for p in portfolios:
            portfolio_overview_items.append(
                PortfolioOverviewItem(
                    portfolio_id=p.portfolio_id,
                    portfolio_name=p.portfolio_name,
                    margin=float(p.margin_locked) if p.margin_locked else 0,
                    buffer=float(p.cash_buffer_limit) if p.cash_buffer_limit else 0,
                    available_cash=float(p.available_cash) if p.available_cash else 0,
                    money_market=float(p.money_market) if p.money_market else 0,
                    total_pl=pl_map.get(p.portfolio_id, 0.0),
                    risk_status=p.risk_status
                )
            )

        return OverviewResponse(
            margin=total_margin, buffer=total_buffer,
            available_cash=total_available_cash, money_market=total_money_market,
            total_pl=total_pl, pool_health_index=pool_health_index,
            money_reserve_status=money_reserve_status,
            portfolios=portfolio_overview_items
        )
    finally:
        if is_custom:
            await session.close()