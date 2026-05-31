from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import TradeHistory, Portfolio
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()

# Request model for creating trade history
class TradeHistoryCreate(BaseModel):
    portfolio_id: int
    type: str  # Buy, Sell, Deposit, Withdraw, Transfer
    asset: str
    amount: Optional[float] = None
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    realized_pl: Optional[float] = None
    executed_by: str = "Manual"
    decision_note: Optional[str] = None
    entry_date: Optional[datetime] = None
    exit_date: Optional[datetime] = None
    order_id: Optional[str] = None
    close_order_id: Optional[str] = None


class TransactionResponse(BaseModel):
    """Response model matching frontend Transaction interface for TransactionsPage."""
    history_id: int
    portfolio_id: int
    portfolio_name: str
    type: str  # Buy, Sell, Deposit, Withdraw, Transfer
    asset: str
    amount: Optional[float] = None  # total amount (qty * price) for trades, or amount for deposit/withdraw
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    realized_pl: Optional[float] = None
    executed_by: str  # Manual, Bot, AI
    decision_note: Optional[str] = None
    entry_date: Optional[str] = None  # ISO string
    exit_date: Optional[str] = None  # ISO string
    order_id: Optional[str] = None
    close_order_id: Optional[str] = None
    flow: Optional[str] = None  # For transfers: "Source -> Destination", else null
    comments: Optional[dict] = None

    class Config:
        orm_mode = True


@router.get("/", tags=["trade-history"], response_model=List[TransactionResponse])
async def get_trade_history(
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
    offset: int = 0,
    limit: int = 100
):
    """
    Get all trade history records for TransactionsPage display.
    Returns TradeHistory data formatted to match frontend Transaction interface.
    """
    # Query trade history with portfolio join
    query = (
        select(TradeHistory, Portfolio)
        .join(Portfolio, TradeHistory.portfolio_id == Portfolio.portfolio_id)
    )
    if portfolio_id:
        query = query.where(TradeHistory.portfolio_id == portfolio_id)
    query = query.order_by(TradeHistory.exit_date.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    
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
                entry_price=float(th.entry_price) if th.entry_price is not None else None,
                exit_price=float(th.exit_price) if th.exit_price is not None else None,
                realized_pl=float(th.realized_pl) if th.realized_pl is not None else None,
                executed_by=th.executed_by or "Manual",
                decision_note=th.decision_note,
                entry_date=th.entry_date.isoformat() if th.entry_date else None,
                exit_date=th.exit_date.isoformat() if th.exit_date else None,
                order_id=th.order_id,
                close_order_id=th.close_order_id,
                flow=None,  # TradeHistory doesn't have flow - reserved for Transfer type
                comments=th.comments,
            )
        )
    
    return response


@router.post("/", tags=["trade-history"], status_code=status.HTTP_201_CREATED)
async def create_trade_history(
    history: TradeHistoryCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a trade history record (for manual entry or bot sync)."""
    # Validate portfolio exists
    portfolio_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == history.portfolio_id)
    )
    if portfolio_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    db_history = TradeHistory(
        portfolio_id=history.portfolio_id,
        order_id=history.order_id,
        close_order_id=history.close_order_id,
        type=history.type,
        asset=history.asset,
        amount=history.amount,
        entry_price=history.entry_price,
        exit_price=history.exit_price,
        realized_pl=history.realized_pl,
        executed_by=history.executed_by,
        decision_note=history.decision_note,
        entry_date=history.entry_date,
        exit_date=history.exit_date,
        comments={}
    )
    
    db.add(db_history)
    await db.commit()
    await db.refresh(db_history)
    
    return {
        "history_id": db_history.history_id,
        "portfolio_id": db_history.portfolio_id,
        "type": db_history.type,
        "asset": db_history.asset,
        "amount": float(str(db_history.amount)) if db_history.amount is not None else None,
        "entry_price": float(str(db_history.entry_price)) if db_history.entry_price is not None else None,
        "exit_price": float(str(db_history.exit_price)) if db_history.exit_price is not None else None,
        "realized_pl": float(str(db_history.realized_pl)) if db_history.realized_pl is not None else None,
        "executed_by": db_history.executed_by,
        "decision_note": db_history.decision_note,
        "order_id": db_history.order_id,
        "close_order_id": db_history.close_order_id,
    }