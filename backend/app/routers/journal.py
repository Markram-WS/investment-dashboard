from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import DecisionJournal, Portfolio
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Pydantic schemas for request/response
class JournalEntryCreate(BaseModel):
    """Schema for creating a journal entry"""
    portfolio_id: int
    history_id: Optional[int] = None  # Optional link to trade history
    entry_text: str

class JournalEntryResponse(BaseModel):
    """Schema for journal entry response"""
    journal_id: int
    portfolio_id: int
    portfolio_name: Optional[str] = None
    history_id: Optional[int] = None
    entry_text: str
    created_at: datetime

    class Config:
        orm_mode = True

router = APIRouter()

@router.post("/", tags=["journal"], status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    entry_data: JournalEntryCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new journal entry (Post-it Note).
    Used for recording decision notes when closing orders.
    """
    # Verify portfolio exists
    portfolio_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == entry_data.portfolio_id)
    )
    portfolio = portfolio_result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Create the journal entry
    journal_entry = DecisionJournal(
        portfolio_id=entry_data.portfolio_id,
        history_id=entry_data.history_id,
        entry_text=entry_data.entry_text
    )
    
    db.add(journal_entry)
    await db.commit()
    await db.refresh(journal_entry)
    
    return {
        "journal_id": journal_entry.journal_id,
        "portfolio_id": journal_entry.portfolio_id,
        "portfolio_name": portfolio.portfolio_name,
        "history_id": journal_entry.history_id,
        "entry_text": journal_entry.entry_text,
        "created_at": journal_entry.created_at
    }


@router.get("/{portfolio_id}", tags=["journal"], response_model=List[JournalEntryResponse])
async def get_journal_entries(
    portfolio_id: int,
    db: AsyncSession = Depends(get_db),
    limit: int = 100
):
    """
    Get all journal entries for a specific portfolio.
    Returns entries sorted by created_at descending (newest first).
    """
    # Verify portfolio exists
    portfolio_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    portfolio = portfolio_result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get journal entries for this portfolio
    entries_result = await db.execute(
        select(DecisionJournal)
        .where(DecisionJournal.portfolio_id == portfolio_id)
        .order_by(DecisionJournal.created_at.desc())
        .limit(limit)
    )
    entries = entries_result.scalars().all()
    
    response = []
    for entry in entries:
        response.append(JournalEntryResponse(
            journal_id=entry.journal_id,
            portfolio_id=entry.portfolio_id,
            portfolio_name=portfolio.portfolio_name,
            history_id=entry.history_id,
            entry_text=entry.entry_text,
            created_at=entry.created_at
        ))
    
    return response