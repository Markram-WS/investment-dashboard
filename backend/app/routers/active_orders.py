from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import ActiveOrder
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

router = APIRouter()


class ActiveOrderCreate(BaseModel):
    plan_id: int
    portfolio_id: int
    asset_type: str
    side: str
    qty: Optional[float] = None
    entry_price: Optional[float] = None
    current_price: Optional[float] = None
    tp_price: Optional[float] = None
    sl_price: Optional[float] = None
    leverage: Optional[float] = None
    margin_rate: Optional[float] = None
    spread_pair_id: Optional[str] = None


class ActiveOrderUpdate(BaseModel):
    asset_type: Optional[str] = None
    side: Optional[str] = None
    qty: Optional[float] = None
    entry_price: Optional[float] = None
    current_price: Optional[float] = None
    tp_price: Optional[float] = None
    sl_price: Optional[float] = None
    leverage: Optional[float] = None
    margin_rate: Optional[float] = None
    order_status: Optional[str] = None
    zone: Optional[str] = None
    spread_pair_id: Optional[str] = None


class ActiveOrderResponse(BaseModel):
    order_id: int
    plan_id: int
    portfolio_id: int
    asset_type: str
    side: str
    qty: Optional[float]
    entry_price: Optional[float]
    current_price: Optional[float]
    tp_price: Optional[float]
    sl_price: Optional[float]
    leverage: Optional[float]
    margin_rate: Optional[float]
    order_status: str
    spread_pair_id: Optional[str]

    class Config:
        orm_mode = True


@router.get("/", tags=["orders"], response_model=List[ActiveOrderResponse])
async def list_orders(db: AsyncSession = Depends(get_db)):
    """List all active orders."""
    result = await db.execute(select(ActiveOrder))
    orders = result.scalars().all()
    return orders


@router.post("/", tags=["orders"], status_code=status.HTTP_201_CREATED, response_model=ActiveOrderResponse)
async def create_order(order: ActiveOrderCreate, db: AsyncSession = Depends(get_db)):
    """Create a new active order."""
    db_order = ActiveOrder(**order.dict())
    db.add(db_order)
    await db.commit()
    await db.refresh(db_order)
    return db_order


@router.get("/{order_id}", tags=["orders"], response_model=ActiveOrderResponse)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single active order by ID."""
    result = await db.execute(select(ActiveOrder).where(ActiveOrder.order_id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}/status", tags=["orders"])
async def update_order_status(order_id: int, payload: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Update order status."""
    result = await db.execute(select(ActiveOrder).where(ActiveOrder.order_id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    new_status = payload.get("new_status")
    if new_status:
        order.order_status = new_status
        await db.commit()
        await db.refresh(order)
    
    return {"order_id": order.order_id, "order_status": order.order_status}


@router.put("/{order_id}", tags=["orders"], response_model=ActiveOrderResponse)
async def update_order(order_id: int, order_update: ActiveOrderUpdate, db: AsyncSession = Depends(get_db)):
    """Update an active order with new values."""
    result = await db.execute(select(ActiveOrder).where(ActiveOrder.order_id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update only provided fields
    update_data = order_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)
    
    await db.commit()
    await db.refresh(order)
    return order