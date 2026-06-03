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
    linked_order_id: Optional[str] = None
    contract_type: Optional[str] = 'spot'
    direction: Optional[str] = None
    expiry_date: Optional[datetime] = None
    strike_price: Optional[float] = None
    cost: Optional[float] = 0.0


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
    linked_order_id: Optional[str] = None
    contract_type: Optional[str] = None
    direction: Optional[str] = None
    expiry_date: Optional[datetime] = None
    strike_price: Optional[float] = None
    cost: Optional[float] = None


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
    linked_order_id: Optional[str]
    group_id: Optional[int] = None
    contract_type: Optional[str] = 'spot'
    direction: Optional[str] = None
    expiry_date: Optional[datetime] = None
    strike_price: Optional[float] = None
    cost: Optional[float] = 0.0
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
    cost: Optional[float] = 0.0


@router.post("/{order_id}/close", tags=["orders"])
async def close_order(order_id: str, req: CloseOrderRequest, db: AsyncSession = Depends(get_db)):
    """Close an active order: delete from active_orders and create a trade history record.
    If the order has a linked_order_id referencing a pending-close linked order (one-way),
    also close that linked order automatically."""
    result = await db.execute(select(ActiveOrder).where(ActiveOrder.order_id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    now = datetime.utcnow()

    def make_history(o: ActiveOrder, exit_price: Optional[float], realized_pl: Optional[float],
                     close_order_id: Optional[str], decision_note: Optional[str]) -> TradeHistory:
        return TradeHistory(
            portfolio_id=o.portfolio_id,
            order_id=o.order_id,
            close_order_id=close_order_id,
            group_id=o.group_id,
            type=o.side,
            asset=o.asset_type,
            amount=float(o.qty) if o.qty else None,
            entry_price=float(o.entry_price) if o.entry_price else None,
            exit_price=exit_price or (float(o.current_price) if o.current_price else None),
            realized_pl=realized_pl,
            executed_by=o.executed_by or "Manual",
            decision_note=decision_note,
            entry_date=o.created_at or now,
            exit_date=now,
            comments={"cost": float(req.cost or 0)},
        )

    also_closed = None

    # Check if this is a pending-close link (one-way)
    if order.linked_order_id:
        linked_result = await db.execute(
            select(ActiveOrder).where(ActiveOrder.order_id == order.linked_order_id)
        )
        linked = linked_result.scalar_one_or_none()
        # One-way: linked order has no reciprocal linked_order_id
        if linked and linked.linked_order_id != order.order_id:
            linked_history = make_history(linked, req.exit_price, req.realized_pl, None, req.decision_note)
            db.add(linked_history)
            await db.delete(linked)
            await db.flush()
            also_closed = {
                "order_id": linked.order_id,
                "history_id": linked_history.history_id,
            }
        # Spread (mutual): close only this order; frontend will open second modal

    history = make_history(order, req.exit_price, req.realized_pl, req.close_order_id, req.decision_note)
    db.add(history)
    await db.delete(order)
    await db.commit()
    await db.refresh(history)

    resp = {
        "order_id": order.order_id,
        "order_status": "CLOSE",
        "history_id": history.history_id,
    }
    if also_closed:
        resp["also_closed"] = also_closed
    # Signal frontend to open second modal for spread pair
    if order.linked_order_id:
        linked_check = await db.execute(
            select(ActiveOrder).where(ActiveOrder.order_id == order.linked_order_id)
        )
        linked_alive = linked_check.scalar_one_or_none()
        if linked_alive and linked_alive.linked_order_id == order.order_id:
            resp["paired_order_id"] = linked_alive.order_id
    return resp


class LinkOrderRequest(BaseModel):
    target_order_id: str


@router.post("/{order_id}/link", tags=["orders"])
async def link_order(order_id: str, req: LinkOrderRequest, db: AsyncSession = Depends(get_db)):
    """Link order to a target order by setting linked_order_id (one-way = pending close).
    For two-way (spread), the target order must also link back."""
    result = await db.execute(select(ActiveOrder).where(ActiveOrder.order_id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    result = await db.execute(select(ActiveOrder).where(ActiveOrder.order_id == req.target_order_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target order not found")

    order.linked_order_id = req.target_order_id
    await db.commit()
    await db.refresh(order)
    return {"order_id": order.order_id, "linked_order_id": order.linked_order_id}