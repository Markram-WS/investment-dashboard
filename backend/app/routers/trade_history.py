from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, resolve_portfolio_db
from app.models import TradeHistory, Portfolio
from app.custom_models import CustomTransaction
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
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        # Trade history is always written to main DB (TradeHistory), even for custom portfolios.
        # CustomTransaction in external DBs is for deposit/withdraw records, not closed orders.
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
                    flow=None,
                    comments=th.comments,
                )
            )

        return response
    finally:
        if is_custom:
            await session.close()


@router.post("/", tags=["trade-history"], status_code=status.HTTP_201_CREATED)
async def create_trade_history(
    history: TradeHistoryCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a trade history record (for manual entry or bot sync)."""
    session, is_custom = await resolve_portfolio_db(db, history.portfolio_id)
    try:
        # Validate portfolio exists
        portfolio_result = await db.execute(
            select(Portfolio).where(Portfolio.portfolio_id == history.portfolio_id)
        )
        if portfolio_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        if is_custom:
            db_history = CustomTransaction(
                source_portfolio_id=history.portfolio_id,
                transaction_type=history.type,
                asset=history.asset,
                amount=history.amount or 0,
                executed_by=history.executed_by,
                reference_id=history.order_id,
            )
        else:
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

        session.add(db_history)
        await session.commit()
        await session.refresh(db_history)

        if is_custom:
            return {
                "history_id": db_history.transaction_id,
                "portfolio_id": history.portfolio_id,
                "type": db_history.transaction_type,
                "asset": db_history.asset,
                "amount": float(str(db_history.amount)) if db_history.amount is not None else None,
                "entry_price": None,
                "exit_price": None,
                "realized_pl": None,
                "executed_by": db_history.executed_by,
                "decision_note": None,
                "order_id": db_history.reference_id,
                "close_order_id": None,
            }

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
    finally:
        if is_custom:
            await session.close()