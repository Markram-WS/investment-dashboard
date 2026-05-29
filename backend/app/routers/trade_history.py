from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import TradeHistory, Portfolio
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()


class TransactionResponse(BaseModel):
    """Response model matching frontend Transaction interface for TransactionsPage."""
    history_id: int
    portfolio_id: int
    portfolio_name: str
    type: str  # Buy, Sell, Deposit, Withdraw, Transfer
    asset: str
    amount: Optional[float] = None  # total amount (qty * price) for trades, or amount for deposit/withdraw
    exit_price: Optional[float] = None
    realized_pl: Optional[float] = None
    executed_by: str  # Manual, Bot, AI
    decision_note: Optional[str] = None
    entry_date: Optional[str] = None  # ISO string
    exit_date: Optional[str] = None  # ISO string
    flow: Optional[str] = None  # For transfers: "Source -> Destination", else null
    comments: Optional[dict] = None

    class Config:
        orm_mode = True


@router.get("/", tags=["trade-history"], response_model=List[TransactionResponse])
async def get_trade_history(
    db: AsyncSession = Depends(get_db),
    offset: int = 0,
    limit: int = 100
):
    """
    Get all trade history records for TransactionsPage display.
    Returns TradeHistory data formatted to match frontend Transaction interface.
    """
    # Query trade history with portfolio join
    result = await db.execute(
        select(TradeHistory, Portfolio)
        .join(Portfolio, TradeHistory.portfolio_id == Portfolio.portfolio_id)
        .order_by(TradeHistory.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    
    records = result.all()
    response = []
    
    for th, portfolio in records:
        response.append(
            TransactionResponse(
                history_id=th.history_id,
                portfolio_id=th.portfolio_id,
                portfolio_name=portfolio.portfolio_name,
                type=th.type,
                asset=th.asset,
                amount=float(th.amount) if th.amount is not None else None,
                exit_price=float(th.exit_price) if th.exit_price is not None else None,
                realized_pl=float(th.realized_pl) if th.realized_pl is not None else None,
                executed_by=th.executed_by or "Manual",
                decision_note=th.decision_note,
                entry_date=th.entry_date.isoformat() if th.entry_date else None,
                exit_date=th.exit_date.isoformat() if th.exit_date else None,
                flow=None,  # TradeHistory doesn't have flow - reserved for Transfer type
                comments=th.comments,
            )
        )
    
    return response