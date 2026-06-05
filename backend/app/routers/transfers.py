from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Transaction, Portfolio
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

router = APIRouter()


class TransferCreate(BaseModel):
    """Request body for initiating a cash pool transfer."""
    source_portfolio_id: int = Field(..., gt=0, description="Source portfolio ID")
    destination_portfolio_id: int = Field(..., gt=0, description="Destination portfolio ID")
    amount: float = Field(..., gt=0, description="Transfer amount (must be positive)")
    asset: str = Field(default="USD", description="Asset symbol (default USD)")
    executed_by: str = Field(default="Manual", description="Who initiated the transfer")
    reference_id: Optional[str] = Field(None, description="External reference ID")
    audit_labels: Optional[dict] = Field(None, description="Additional metadata")

    class Config:
        schema_extra = {
            "example": {
                "source_portfolio_id": 1,
                "destination_portfolio_id": 2,
                "amount": 500.0,
                "asset": "USD",
                "executed_by": "Manual",
                "reference_id": "TRANSFER_001"
            }
        }


class TransferResponse(BaseModel):
    """Response model for transfer operations."""
    transaction_id: int
    source_portfolio_id: int
    destination_portfolio_id: int
    amount: float
    asset: str
    status: str
    executed_by: str
    reference_id: Optional[str] = None
    source_balance_before: Optional[float] = None
    source_balance_after: Optional[float] = None
    destination_balance_before: Optional[float] = None
    destination_balance_after: Optional[float] = None
    created_at: datetime
    confirmed_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class TransferConfirm(BaseModel):
    """Request body for confirming a pending transfer."""
    confirmation_token: str = Field(..., description="Confirmation token received from init")
    confirmed_by: str = Field(..., description="Name/ID of person confirming")


@router.post("", tags=["transfers"], status_code=status.HTTP_201_CREATED, response_model=TransferResponse)
async def initiate_transfer(transfer_data: TransferCreate, db: AsyncSession = Depends(get_db)):
    """
    Initiate a cash pool transfer between portfolios.
    
    Creates a pending transfer that requires manual confirmation before execution.
    Validates:
    - Source portfolio has sufficient balance (available_cash + money_market)
    - Source and destination portfolios exist and are different
    - Amount is positive
    
    Per Detailed-Functional-Requirements Section 2.2:
    - Cash Pool Transfer requires Manual Confirmation
    """
    # Verify source and destination are different
    if transfer_data.source_portfolio_id == transfer_data.destination_portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination portfolios must be different"
        )

    # Fetch portfolios
    source_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == transfer_data.source_portfolio_id)
    )
    source_portfolio = source_result.scalar_one_or_none()
    
    dest_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == transfer_data.destination_portfolio_id)
    )
    dest_portfolio = dest_result.scalar_one_or_none()

    if not source_portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source portfolio {transfer_data.source_portfolio_id} not found"
        )

    if not dest_portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination portfolio {transfer_data.destination_portfolio_id} not found"
        )

    # Calculate available balance (available_cash + money_market)
    source_available = (source_portfolio.available_cash or 0) + (source_portfolio.money_market or 0)
    
    # Balance verification
    if source_available < transfer_data.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance. Available: {source_available}, Requested: {transfer_data.amount}"
        )

    # Create pending transfer transaction
    transaction = Transaction(
        transaction_type="Transfer",
        asset=transfer_data.asset,
        amount=transfer_data.amount,
        source_portfolio_id=transfer_data.source_portfolio_id,
        destination_portfolio_id=transfer_data.destination_portfolio_id,
        executed_by=transfer_data.executed_by,
        status="pending_confirmation",  # Requires manual confirmation
        reference_id=transfer_data.reference_id,
        audit_labels={
            **(transfer_data.audit_labels or {}),
            "source_balance_before": float(source_available),
            "destination_balance_before": float((dest_portfolio.available_cash or 0) + (dest_portfolio.money_market or 0))
        }
    )
    
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    return TransferResponse(
        transaction_id=transaction.transaction_id,
        source_portfolio_id=transaction.source_portfolio_id,
        destination_portfolio_id=transaction.destination_portfolio_id,
        amount=float(transaction.amount),
        asset=transaction.asset,
        status=transaction.status,
        executed_by=transaction.executed_by,
        reference_id=transaction.reference_id,
        source_balance_before=float(source_available),
        source_balance_after=None,  # Will be set after confirmation
        destination_balance_before=float((dest_portfolio.available_cash or 0) + (dest_portfolio.money_market or 0)),
        destination_balance_after=None,
        created_at=transaction.created_at,
        confirmed_at=None
    )


@router.post("/{transaction_id}/confirm", tags=["transfers"], response_model=TransferResponse)
async def confirm_transfer(
    transaction_id: int,
    confirm_data: TransferConfirm,
    db: AsyncSession = Depends(get_db)
):
    """
    Confirm and execute a pending transfer.
    
    Per Detailed-Functional-Requirements Section 2.2:
    - Cash Pool Transfer requires Manual Confirmation
    - Updates portfolio balances after confirmation
    """
    # Fetch the transaction
    result = await db.execute(
        select(Transaction).where(
            Transaction.transaction_id == transaction_id,
            Transaction.transaction_type == "Transfer"
        )
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transfer transaction not found"
        )

    if transaction.status != "pending_confirmation":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transfer is not in pending state (current: {transaction.status})"
        )

    # Fetch portfolios for balance updates
    source_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == transaction.source_portfolio_id)
    )
    source_portfolio = source_result.scalar_one_or_none()

    dest_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == transaction.destination_portfolio_id)
    )
    dest_portfolio = dest_result.scalar_one_or_none()

    # Store balances before update
    source_balance_before = float((source_portfolio.available_cash or 0) + (source_portfolio.money_market or 0))
    dest_balance_before = float((dest_portfolio.available_cash or 0) + (dest_portfolio.money_market or 0))

    # Double-check balance at confirmation time
    if source_balance_before < float(transaction.amount):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance at confirmation time. Available: {source_balance_before}, Required: {transaction.amount}"
        )

    # Execute the transfer - deduct from source, add to destination
    # Deduct from available_cash first, then money_market if needed
    amount_to_transfer = float(transaction.amount)
    
    source_available = float(source_portfolio.available_cash or 0)
    source_money_market = float(source_portfolio.money_market or 0)
    
    # First, try to deduct from available_cash
    if source_available >= amount_to_transfer:
        source_available -= amount_to_transfer
    else:
        # Use all available_cash, pull rest from money_market
        amount_from_mm = amount_to_transfer - source_available
        source_available = 0
        source_money_market -= amount_from_mm
    
    source_portfolio.available_cash = source_available
    source_portfolio.money_market = source_money_market

    # Add to destination available_cash
    dest_available = float(dest_portfolio.available_cash or 0)
    dest_available += amount_to_transfer
    dest_portfolio.available_cash = dest_available

    # Update transaction status
    transaction.status = "completed"
    transaction.audit_labels = {
        **(transaction.audit_labels or {}),
        "confirmed_by": confirm_data.confirmed_by,
        "confirmation_token": confirm_data.confirmation_token,
        "source_balance_after": float((source_portfolio.available_cash or 0) + (source_portfolio.money_market or 0)),
        "destination_balance_after": float((dest_portfolio.available_cash or 0) + (dest_portfolio.money_market or 0))
    }

    db.add(source_portfolio)
    db.add(dest_portfolio)
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    return TransferResponse(
        transaction_id=transaction.transaction_id,
        source_portfolio_id=transaction.source_portfolio_id,
        destination_portfolio_id=transaction.destination_portfolio_id,
        amount=float(transaction.amount),
        asset=transaction.asset,
        status=transaction.status,
        executed_by=transaction.executed_by,
        reference_id=transaction.reference_id,
        source_balance_before=source_balance_before,
        source_balance_after=source_balance_before - amount_to_transfer,
        destination_balance_before=dest_balance_before,
        destination_balance_after=dest_balance_before + amount_to_transfer,
        created_at=transaction.created_at,
        confirmed_at=transaction.updated_at
    )


@router.get("/pending", tags=["transfers"], response_model=List[TransferResponse])
async def list_pending_transfers(db: AsyncSession = Depends(get_db)):
    """List all transfers pending confirmation."""
    result = await db.execute(
        select(Transaction).where(
            Transaction.transaction_type == "Transfer",
            Transaction.status == "pending_confirmation"
        ).order_by(Transaction.created_at.desc())
    )
    transactions = result.scalars().all()

    responses = []
    for tx in transactions:
        responses.append(TransferResponse(
            transaction_id=tx.transaction_id,
            source_portfolio_id=tx.source_portfolio_id,
            destination_portfolio_id=tx.destination_portfolio_id,
            amount=float(tx.amount),
            asset=tx.asset,
            status=tx.status,
            executed_by=tx.executed_by,
            reference_id=tx.reference_id,
            source_balance_before=(tx.audit_labels or {}).get("source_balance_before"),
            source_balance_after=None,
            destination_balance_before=(tx.audit_labels or {}).get("destination_balance_before"),
            destination_balance_after=None,
            created_at=tx.created_at,
            confirmed_at=None
        ))
    
    return responses


@router.get("/{transaction_id}", tags=["transfers"], response_model=TransferResponse)
async def get_transfer(transaction_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific transfer by ID."""
    result = await db.execute(
        select(Transaction).where(
            Transaction.transaction_id == transaction_id,
            Transaction.transaction_type == "Transfer"
        )
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transfer transaction not found"
        )

    return TransferResponse(
        transaction_id=transaction.transaction_id,
        source_portfolio_id=transaction.source_portfolio_id,
        destination_portfolio_id=transaction.destination_portfolio_id,
        amount=float(transaction.amount),
        asset=transaction.asset,
        status=transaction.status,
        executed_by=transaction.executed_by,
        reference_id=transaction.reference_id,
        source_balance_before=(transaction.audit_labels or {}).get("source_balance_before"),
        source_balance_after=(transaction.audit_labels or {}).get("source_balance_after"),
        destination_balance_before=(transaction.audit_labels or {}).get("destination_balance_before"),
        destination_balance_after=(transaction.audit_labels or {}).get("destination_balance_after"),
        created_at=transaction.created_at,
        confirmed_at=transaction.updated_at if transaction.status == "completed" else None
    )