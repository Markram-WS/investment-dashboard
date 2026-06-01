from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.database import get_db
from app.models import ActiveOrder, TradePlan, TradeHistory
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

router = APIRouter()


class ActiveOrderCreate(BaseModel):
    order_id: Optional[str] = None
    plan_id: Optional[int] = None
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
    group_id: Optional[int] = None
    order_status: Optional[str] = None
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
    group_id: Optional[int] = None
    spread_pair_id: Optional[str] = None


class ActiveOrderResponse(BaseModel):
    order_id: str
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
    group_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True


@router.get("/", tags=["orders"], response_model=List[ActiveOrderResponse])
async def list_orders(db: AsyncSession = Depends(get_db)):
    """List all active orders."""
    result = await db.execute(select(ActiveOrder))
    orders = result.scalars().all()
    return orders


@router.post("/", tags=["orders"], status_code=status.HTTP_201_CREATED, response_model=ActiveOrderResponse)
async def create_order(order: ActiveOrderCreate, db: AsyncSession = Depends(get_db)):
    """Create a new active order. If plan_id is omitted, auto-resolve or create a default trade plan."""
    data = order.dict(exclude_none=True)
    if data.get("plan_id") is None:
        result = await db.execute(
            select(TradePlan).where(TradePlan.portfolio_id == data["portfolio_id"]).limit(1)
        )
        existing = result.scalar_one_or_none()
        if existing:
            data["plan_id"] = existing.plan_id
        else:
            default_plan = TradePlan(portfolio_id=data["portfolio_id"])
            db.add(default_plan)
            await db.flush()
            data["plan_id"] = default_plan.plan_id
    db_order = ActiveOrder(**data)
    db.add(db_order)
    await db.commit()
    await db.refresh(db_order)
    return db_order


@router.get("/{order_id}", tags=["orders"], response_model=ActiveOrderResponse)
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single active order by ID."""
    result = await db.execute(select(ActiveOrder).where(ActiveOrder.order_id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}/status", tags=["orders"])
async def update_order_status(order_id: str, payload: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Update order status. If CANCELED, delete from active_orders and create trade history."""
    result = await db.execute(select(ActiveOrder).where(ActiveOrder.order_id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    new_status = payload.get("new_status")
    if not new_status:
        return {"order_id": order.order_id, "order_status": order.order_status}

    if new_status.upper() == "CANCELED":
        now = datetime.utcnow()
        history = TradeHistory(
            portfolio_id=order.portfolio_id,
            order_id=order.order_id,
            group_id=order.group_id,
            type=order.side,
            asset=order.asset_type,
            amount=float(order.qty) if order.qty else None,
            entry_price=float(order.entry_price) if order.entry_price else None,
            executed_by=order.executed_by or "Manual",
            entry_date=order.created_at or now,
            exit_date=now,
            comments={"note": "Canceled"},
        )
        db.add(history)
        await db.delete(order)
        await db.commit()
        await db.refresh(history)
        return {"order_id": order.order_id, "order_status": "CANCELED", "history_id": history.history_id}

    order.order_status = new_status
    await db.commit()
    await db.refresh(order)

    return {"order_id": order.order_id, "order_status": order.order_status}


@router.put("/{order_id}", tags=["orders"], response_model=ActiveOrderResponse)
async def update_order(order_id: str, order_update: ActiveOrderUpdate, db: AsyncSession = Depends(get_db)):
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


class CloseOrderRequest(BaseModel):
    exit_price: Optional[float] = None
    realized_pl: Optional[float] = None
    decision_note: Optional[str] = None
    close_order_id: Optional[str] = None


@router.post("/{order_id}/close", tags=["orders"])
async def close_order(order_id: str, req: CloseOrderRequest, db: AsyncSession = Depends(get_db)):
    """Close an active order: delete from active_orders and create a trade history record."""
    result = await db.execute(select(ActiveOrder).where(ActiveOrder.order_id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    now = datetime.utcnow()

    history = TradeHistory(
        portfolio_id=order.portfolio_id,
        order_id=order.order_id,
        close_order_id=req.close_order_id,
        group_id=order.group_id,
        type=order.side,
        asset=order.asset_type,
        amount=float(order.qty) if order.qty else None,
        entry_price=float(order.entry_price) if order.entry_price else None,
        exit_price=req.exit_price or (float(order.current_price) if order.current_price else None),
        realized_pl=req.realized_pl,
        executed_by=order.executed_by or "Manual",
        decision_note=req.decision_note,
        entry_date=order.created_at or now,
        exit_date=now,
        comments={},
    )

    db.add(history)
    await db.delete(order)
    await db.commit()
    await db.refresh(history)

    return {
        "order_id": order.order_id,
        "order_status": "CLOSE",
        "history_id": history.history_id,
    }