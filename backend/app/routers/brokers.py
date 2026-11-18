from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models import Broker


class BrokerCreate(BaseModel):
    code: str
    name: str
    default_margin_rate: Optional[float] = 0
    currency: Optional[str] = "USD"


class BrokerResponse(BaseModel):
    id: int
    code: str
    name: str
    default_margin_rate: Optional[float] = 0
    currency: Optional[str] = "USD"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


router = APIRouter()


@router.get("", response_model=List[BrokerResponse], tags=["brokers"])
async def list_brokers(db: AsyncSession = Depends(get_db)):
    """List all brokers ordered by code."""
    result = await db.execute(select(Broker).order_by(Broker.code))
    return result.scalars().all()


@router.post("", response_model=BrokerResponse, status_code=status.HTTP_201_CREATED, tags=["brokers"])
async def create_broker(data: BrokerCreate, db: AsyncSession = Depends(get_db)):
    """Create a broker. `code` is uppercased and must be unique."""
    code = data.code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Broker code is required")
    existing = await db.execute(select(Broker).where(Broker.code == code))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail=f"Broker code '{code}' already exists")

    broker = Broker(
        code=code,
        name=data.name,
        default_margin_rate=data.default_margin_rate or 0,
        currency=data.currency or "USD",
    )
    db.add(broker)
    await db.commit()
    await db.refresh(broker)
    return broker
