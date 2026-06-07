import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, get_custom_session
from app.models import Transaction, Portfolio, CustomPortfolioConnection
from app.custom_models import CustomTransaction
from pydantic import BaseModel, field_validator
from typing import List, Optional, Literal
from datetime import datetime

TransactionType = Literal["Funding", "Deposit", "Trade", "Transfer", "Withdrawal", "Withdraw"]


class TransactionResponse(BaseModel):
    transaction_id: int
    portfolio_id: Optional[int] = None
    portfolio_name: Optional[str] = None
    transaction_type: str
    asset: Optional[str] = None
    amount: Optional[float] = None
    source_portfolio_id: Optional[int] = None
    destination_portfolio_id: Optional[int] = None
    executed_by: str
    status: str
    reference_id: Optional[str] = None
    audit_labels: Optional[dict] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    flow: Optional[str] = None
    balance_delta: Optional[float] = None

    class Config:
        orm_mode = True


class TransactionCreate(BaseModel):
    transaction_type: TransactionType
    asset: str
    amount: float
    source_portfolio_id: Optional[int] = None
    destination_portfolio_id: Optional[int] = None
    executed_by: str
    status: str = "completed"
    reference_id: Optional[str] = None
    audit_labels: Optional[dict] = None

    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('amount must be positive')
        return v


router = APIRouter()


def _build_response(t, portfolio_names: dict) -> TransactionResponse:
    flow = None
    source_name = portfolio_names.get(t.source_portfolio_id) if t.source_portfolio_id else None
    dest_name = portfolio_names.get(t.destination_portfolio_id) if t.destination_portfolio_id else None
    if source_name and dest_name:
        flow = f"{source_name} -> {dest_name}"
    elif dest_name:
        flow = f"-> {dest_name}"
    elif source_name:
        flow = f"{source_name} -> withdraw"

    balance_delta = None
    if t.amount is not None:
        amount = float(t.amount)
        if t.transaction_type in ["Withdrawal", "Withdraw"]:
            balance_delta = -amount
        elif t.transaction_type in ["Funding", "Deposit"]:
            balance_delta = amount
        else:
            balance_delta = amount

    return TransactionResponse(
        transaction_id=t.transaction_id,
        portfolio_id=None,
        portfolio_name=None,
        transaction_type=t.transaction_type,
        asset=t.asset,
        amount=t.amount,
        source_portfolio_id=t.source_portfolio_id,
        destination_portfolio_id=t.destination_portfolio_id,
        executed_by=t.executed_by,
        status=t.status,
        reference_id=t.reference_id,
        audit_labels=t.audit_labels,
        created_at=t.created_at,
        updated_at=None,
        flow=flow,
        balance_delta=balance_delta,
    )


@router.get("", tags=["transactions"], response_model=List[TransactionResponse])
async def get_transactions(
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
    offset: int = 0,
    limit: int = 100,
):
    """
    Get transactions.
    - If portfolio_id is provided: route to that portfolio's target database
    - If no portfolio_id: query investment_main + all custom databases (aggregated)
    """
    portfolio_names = {}
    all_results = []

    # Gather portfolio names for display
    portfolios_result = await db.execute(select(Portfolio.portfolio_id, Portfolio.portfolio_name))
    portfolio_names = {p.portfolio_id: p.portfolio_name for p in portfolios_result.all()}

    if portfolio_id is not None:
        # Single portfolio query — route to correct DB
        result = await db.execute(
            select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
        )
        portfolio = result.scalar_one_or_none()
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        if not portfolio.is_custom:
            tx_result = await db.execute(
                select(Transaction)
                .where(
                    (Transaction.source_portfolio_id == portfolio_id) |
                    (Transaction.destination_portfolio_id == portfolio_id)
                )
                .order_by(Transaction.created_at.asc())
                .offset(offset)
                .limit(limit)
            )
            return [_build_response(t, portfolio_names) for t in tx_result.scalars().all()]
        else:
            conn_result = await db.execute(
                select(CustomPortfolioConnection).where(
                    CustomPortfolioConnection.portfolio_id == portfolio_id
                )
            )
            conn = conn_result.scalar_one_or_none()
            if not conn:
                raise HTTPException(status_code=404, detail="Custom connection not found")

            custom_session = await get_custom_session(conn)
            try:
                tx_result = await custom_session.execute(
                    select(CustomTransaction)
                    .order_by(CustomTransaction.created_at.asc())
                    .offset(offset)
                    .limit(limit)
                )
                transactions = tx_result.scalars().all()
                return [_build_response(t, portfolio_names) for t in transactions]
            finally:
                await custom_session.close()

    # Global query: investment_main + all custom DBs
    main_result = await db.execute(
        select(Transaction).order_by(Transaction.created_at.asc()).offset(offset).limit(limit)
    )
    all_results.extend([_build_response(t, portfolio_names) for t in main_result.scalars().all()])

    conn_result = await db.execute(select(CustomPortfolioConnection))
    connections = conn_result.scalars().all()

    failed_portfolios = []

    async def fetch_custom(conn: CustomPortfolioConnection) -> list:
        try:
            session = await get_custom_session(conn)
            try:
                tx_result = await session.execute(
                    select(CustomTransaction).order_by(CustomTransaction.created_at.asc())
                )
                items = tx_result.scalars().all()
                return [_build_response(t, portfolio_names) for t in items]
            finally:
                await session.close()
        except Exception:
            failed_portfolios.append(conn.portfolio_id)
            return []

    if connections:
        custom_results = await asyncio.gather(*[fetch_custom(c) for c in connections], return_exceptions=True)
        for cr in custom_results:
            if isinstance(cr, list):
                all_results.extend(cr)

    all_results.sort(key=lambda x: x.created_at or datetime.min)
    all_results = all_results[offset:offset + limit]

    if failed_portfolios:
        return [
            TransactionResponse(
                transaction_id=-1,
                transaction_type="System",
                asset="N/A",
                amount=0,
                executed_by="System",
                status="warning",
                created_at=datetime.utcnow(),
                audit_labels={
                    "partial_data": True,
                    "failed_portfolios": failed_portfolios,
                },
            )
        ] + all_results

    return all_results


@router.post("", tags=["transactions"], status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_data: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """
    Create a new transaction record.
    - If portfolio_id is provided and portfolio is custom, write to custom DB
    - Otherwise, write to investment_main
    """
    if portfolio_id is not None:
        result = await db.execute(
            select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
        )
        portfolio = result.scalar_one_or_none()
        if portfolio and portfolio.is_custom:
            conn_result = await db.execute(
                select(CustomPortfolioConnection).where(
                    CustomPortfolioConnection.portfolio_id == portfolio_id
                )
            )
            conn = conn_result.scalar_one_or_none()
            if conn:
                custom_session = await get_custom_session(conn)
                try:
                    tx = CustomTransaction(**transaction_data.dict())
                    custom_session.add(tx)
                    await custom_session.commit()
                    await custom_session.refresh(tx)
                    return tx
                finally:
                    await custom_session.close()

    transaction = Transaction(**transaction_data.dict())
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction


@router.get("/{transaction_id}", tags=["transactions"], response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """Get a single transaction by ID."""
    if portfolio_id is not None:
        result = await db.execute(
            select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
        )
        portfolio = result.scalar_one_or_none()
        if portfolio and portfolio.is_custom:
            conn_result = await db.execute(
                select(CustomPortfolioConnection).where(
                    CustomPortfolioConnection.portfolio_id == portfolio_id
                )
            )
            conn = conn_result.scalar_one_or_none()
            if conn:
                custom_session = await get_custom_session(conn)
                try:
                    tx_result = await custom_session.execute(
                        select(CustomTransaction).where(
                            CustomTransaction.transaction_id == transaction_id
                        )
                    )
                    transaction = tx_result.scalar_one_or_none()
                    if not transaction:
                        raise HTTPException(status_code=404, detail="Transaction not found")
                    all_names = await db.execute(
                        select(Portfolio.portfolio_id, Portfolio.portfolio_name)
                    )
                    pnames = {p.portfolio_id: p.portfolio_name for p in all_names.all()}
                    return _build_response(transaction, pnames)
                finally:
                    await custom_session.close()

    result = await db.execute(
        select(Transaction).where(Transaction.transaction_id == transaction_id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    portfolio_ids = set()
    if transaction.source_portfolio_id:
        portfolio_ids.add(transaction.source_portfolio_id)
    if transaction.destination_portfolio_id:
        portfolio_ids.add(transaction.destination_portfolio_id)

    pnames = {}
    if portfolio_ids:
        pr = await db.execute(
            select(Portfolio.portfolio_id, Portfolio.portfolio_name)
            .where(Portfolio.portfolio_id.in_(portfolio_ids))
        )
        pnames = {p.portfolio_id: p.portfolio_name for p in pr.all()}

    return _build_response(transaction, pnames)
