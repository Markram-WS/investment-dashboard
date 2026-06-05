from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Transaction, Portfolio
from pydantic import BaseModel, field_validator
from typing import List, Optional, Literal
from datetime import datetime

# Valid transaction types
TransactionType = Literal["Funding", "Deposit", "Trade", "Transfer", "Withdrawal", "Withdraw"]

class TransactionResponse(BaseModel):
    transaction_id: int
    portfolio_id: Optional[int] = None
    portfolio_name: Optional[str] = None
    transaction_type: str  # Funding, Transfer, Trade, etc.
    asset: Optional[str] = None
    amount: Optional[float] = None
    source_portfolio_id: Optional[int] = None
    destination_portfolio_id: Optional[int] = None
    executed_by: str  # Manual, Bot, AI
    status: str
    reference_id: Optional[str] = None
    audit_labels: Optional[dict] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Computed fields for UI
    flow: Optional[str] = None
    balance_delta: Optional[float] = None  # To be calculated in the query if needed

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

@router.get("", tags=["transactions"], response_model=List[TransactionResponse])
async def get_transactions(
    db: AsyncSession = Depends(get_db),
    offset: int = 0,
    limit: int = 100
):
    """
    Get all transactions with computed flow and balance_delta fields.
    Supports pagination via offset and limit parameters.
    """
    # Query transactions with pagination - order by created_at asc for oldest first
    transactions_result = await db.execute(
        select(Transaction)
        .order_by(Transaction.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    transactions = transactions_result.scalars().all()
    
    # Get portfolio names for source and destination
    portfolio_ids = set()
    for t in transactions:
        if t.source_portfolio_id:
            portfolio_ids.add(t.source_portfolio_id)
        if t.destination_portfolio_id:
            portfolio_ids.add(t.destination_portfolio_id)
    
    # Fetch portfolio names
    portfolio_names = {}
    if portfolio_ids:
        portfolios_result = await db.execute(
            select(Portfolio.portfolio_id, Portfolio.portfolio_name)
            .where(Portfolio.portfolio_id.in_(portfolio_ids))
        )
        portfolio_names = {p.portfolio_id: p.portfolio_name for p in portfolios_result.all()}
    
    response = []
    for transaction in transactions:
        # Calculate flow
        flow = None
        source_name = portfolio_names.get(transaction.source_portfolio_id) if transaction.source_portfolio_id else None
        dest_name = portfolio_names.get(transaction.destination_portfolio_id) if transaction.destination_portfolio_id else None
        if source_name and dest_name:
            flow = f"{source_name} -> {dest_name}"
        elif dest_name:
            flow = f"-> {dest_name}"
        elif source_name:
            flow = f"{source_name} -> withdraw"
        
        # Calculate balance_delta
        balance_delta = None
        if transaction.amount is not None:
            amount = float(transaction.amount)
            # For funding/deposit: positive (incoming)
            # For withdrawal: negative (outgoing)
            # For trade: depends on buy/sell perspective - we'll show amount as positive for simplicity
            # For transfer: from source perspective: negative, to destination: positive
            # Since we don't know which portfolio perspective, we'll show the absolute amount
            # and let the frontend handle interpretation based on transaction type
            
            if transaction.transaction_type in ["Withdrawal", "Withdraw"]:
                balance_delta = -amount
            elif transaction.transaction_type in ["Funding", "Deposit"]:
                balance_delta = amount
            else:
                # For Trade, Transfer, etc. - show amount as is (frontend can interpret)
                balance_delta = amount
        
        response.append(
            TransactionResponse(
                transaction_id=transaction.transaction_id,
                portfolio_id=None,  # Not applicable in current model
                portfolio_name=None,  # Not applicable
                transaction_type=transaction.transaction_type,
                asset=transaction.asset,
                amount=transaction.amount,
                source_portfolio_id=transaction.source_portfolio_id,
                destination_portfolio_id=transaction.destination_portfolio_id,
                executed_by=transaction.executed_by,
                status=transaction.status,
                reference_id=transaction.reference_id,
                audit_labels=transaction.audit_labels,
                created_at=transaction.created_at,
                updated_at=None,  # No updated_at field in Transaction model
                flow=flow,
                balance_delta=balance_delta
            )
        )
    return response

@router.post("", tags=["transactions"], status_code=status.HTTP_201_CREATED)
async def create_transaction(transaction_data: TransactionCreate, db: AsyncSession = Depends(get_db)):
    """
    Create a new transaction record.
    Expected keys in transaction_data:
        transaction_type, asset, amount, source_portfolio_id, destination_portfolio_id,
        executed_by, status, reference_id, audit_labels
    """
    # For simplicity, we assume the input data is valid and matches the Transaction model.
    # In a real application, you would use a Pydantic model for validation.
    transaction = Transaction(**transaction_data.dict())
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction


@router.get("/{transaction_id}", tags=["transactions"], response_model=TransactionResponse)
async def get_transaction(transaction_id: int, db: AsyncSession = Depends(get_db)):
    """
    Get a single transaction by ID with computed flow and balance_delta fields.
    """
    result = await db.execute(
        select(Transaction)
        .where(Transaction.transaction_id == transaction_id)
    )
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Get portfolio names for flow calculation
    portfolio_ids = set()
    if transaction.source_portfolio_id:
        portfolio_ids.add(transaction.source_portfolio_id)
    if transaction.destination_portfolio_id:
        portfolio_ids.add(transaction.destination_portfolio_id)
    
    portfolio_names = {}
    if portfolio_ids:
        portfolios_result = await db.execute(
            select(Portfolio.portfolio_id, Portfolio.portfolio_name)
            .where(Portfolio.portfolio_id.in_(portfolio_ids))
        )
        portfolio_names = {p.portfolio_id: p.portfolio_name for p in portfolios_result.all()}
    
    # Calculate flow
    flow = None
    source_name = portfolio_names.get(transaction.source_portfolio_id) if transaction.source_portfolio_id else None
    dest_name = portfolio_names.get(transaction.destination_portfolio_id) if transaction.destination_portfolio_id else None
    if source_name and dest_name:
        flow = f"{source_name} -> {dest_name}"
    elif dest_name:
        flow = f"-> {dest_name}"
    elif source_name:
        flow = f"{source_name} -> withdraw"
    
    # Calculate balance_delta
    balance_delta = None
    if transaction.amount is not None:
        amount = float(transaction.amount)
        if transaction.transaction_type in ["Withdrawal", "Withdraw"]:
            balance_delta = -amount
        elif transaction.transaction_type in ["Funding", "Deposit"]:
            balance_delta = amount
        else:
            balance_delta = amount
    
    return TransactionResponse(
        transaction_id=transaction.transaction_id,
        portfolio_id=None,
        portfolio_name=None,
        transaction_type=transaction.transaction_type,
        asset=transaction.asset,
        amount=transaction.amount,
        source_portfolio_id=transaction.source_portfolio_id,
        destination_portfolio_id=transaction.destination_portfolio_id,
        executed_by=transaction.executed_by,
        status=transaction.status,
        reference_id=transaction.reference_id,
        audit_labels=transaction.audit_labels,
        created_at=transaction.created_at,
        updated_at=None,
        flow=flow,
        balance_delta=balance_delta
    )
