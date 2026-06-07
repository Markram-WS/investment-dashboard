from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.database import get_db, resolve_portfolio_db
from app.models import ActiveOrder, TradePlan, TradeHistory
from app.custom_models import CustomActiveOrder, CustomTradePlan
from pydantic import BaseModel, field_validator
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
    option_type: Optional[str] = None
    expiry_date: Optional[datetime] = None
    strike_price: Optional[float] = None
    cost: Optional[float] = 0.0

    @field_validator('expiry_date', mode='after')
    @classmethod
    def strip_tz(cls, v):
        if isinstance(v, datetime):
            return v.replace(tzinfo=None)
        return v


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
    option_type: Optional[str] = None
    expiry_date: Optional[datetime] = None
    strike_price: Optional[float] = None
    cost: Optional[float] = None

    @field_validator('expiry_date', mode='after')
    @classmethod
    def strip_tz(cls, v):
        if isinstance(v, datetime):
            return v.replace(tzinfo=None)
        return v


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
    option_type: Optional[str] = None
    expiry_date: Optional[datetime] = None
    strike_price: Optional[float] = None
    cost: Optional[float] = 0.0
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True


@router.get("/", tags=["orders"], response_model=List[ActiveOrderResponse])
async def list_orders(
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """List all active orders."""
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass))
        orders = result.scalars().all()
        return orders
    finally:
        if is_custom:
            await session.close()


@router.post("/", tags=["orders"], status_code=status.HTTP_201_CREATED, response_model=ActiveOrderResponse)
async def create_order(order: ActiveOrderCreate, db: AsyncSession = Depends(get_db)):
    """Create a new active order. If plan_id is omitted, auto-resolve or create a default trade plan."""
    session, is_custom = await resolve_portfolio_db(db, order.portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        data = order.dict(exclude_none=True)
        if data.get("plan_id") is None:
            if is_custom:
                result = await session.execute(
                    select(CustomTradePlan).where(CustomTradePlan.portfolio_id == data["portfolio_id"]).limit(1)
                )
                existing = result.scalar_one_or_none()
                if existing:
                    data["plan_id"] = existing.plan_id
                else:
                    default_plan = CustomTradePlan(portfolio_id=data["portfolio_id"])
                    session.add(default_plan)
                    await session.flush()
                    data["plan_id"] = default_plan.plan_id
            else:
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
        db_order = ModelClass(**data)
        session.add(db_order)
        await session.commit()
        await session.refresh(db_order)
        return db_order
    finally:
        if is_custom:
            await session.close()


@router.get("/{order_id}", tags=["orders"], response_model=ActiveOrderResponse)
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """Get a single active order by ID."""
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return order
    finally:
        if is_custom:
            await session.close()


@router.patch("/{order_id}/status", tags=["orders"])
async def update_order_status(
    order_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """Update order status. If CANCELED, delete from active_orders and create trade history."""
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
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
            await session.delete(order)
            if is_custom:
                await db.commit()
                await session.commit()
            else:
                await db.commit()
            await db.refresh(history)
            return {"order_id": order.order_id, "order_status": "CANCELED", "history_id": history.history_id}

        order.order_status = new_status
        await session.commit()
        return {"order_id": order.order_id, "order_status": order.order_status}
    finally:
        if is_custom:
            await session.close()


@router.put("/{order_id}", tags=["orders"], response_model=ActiveOrderResponse)
async def update_order(
    order_id: str,
    order_update: ActiveOrderUpdate,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """Update an active order with new values."""
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        update_data = order_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(order, field, value)

        await session.commit()
        await session.refresh(order)
        return order
    finally:
        if is_custom:
            await session.close()


class CloseOrderRequest(BaseModel):
    exit_price: Optional[float] = None
    realized_pl: Optional[float] = None
    decision_note: Optional[str] = None
    close_order_id: Optional[str] = None
    cost: Optional[float] = 0.0


@router.post("/{order_id}/unlink", tags=["orders"])
async def unlink_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """Unlink an order from its linked partner. Clears linked_order_id on both sides."""
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        partner_id = order.linked_order_id
        order.linked_order_id = None

        if partner_id:
            result2 = await session.execute(select(ModelClass).where(ModelClass.order_id == partner_id))
            partner = result2.scalar_one_or_none()
            if partner and partner.linked_order_id == order_id:
                partner.linked_order_id = None

        await session.commit()
        return {"order_id": order.order_id, "linked_order_id": None, "unlinked_partner": partner_id}
    finally:
        if is_custom:
            await session.close()


@router.post("/{order_id}/close", tags=["orders"])
async def close_order(
    order_id: str,
    req: CloseOrderRequest,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """Close an active order: delete from active_orders and create trade history record(s).
    Auto-closes all sub-orders that one-way link to this order (linked_order_id == this order_id).
    If this order is cross-linked (spread pair), signals frontend for the paired order."""
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        now = datetime.utcnow()

        def make_history(o, exit_price, realized_pl, close_order_id, decision_note):
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

        sub_result = await session.execute(
            select(ModelClass).where(
                and_(ModelClass.linked_order_id == order_id, ModelClass.order_id != order_id)
            )
        )
        sub_orders = sub_result.scalars().all()

        auto_closed = []
        for sub in sub_orders:
            if order.linked_order_id == sub.order_id:
                continue
            sub_history = make_history(sub, req.exit_price, req.realized_pl, None, req.decision_note)
            db.add(sub_history)
            await session.delete(sub)
            await db.flush()
            auto_closed.append({"order_id": sub.order_id, "history_id": sub_history.history_id})

        history = make_history(order, req.exit_price, req.realized_pl, req.close_order_id, req.decision_note)
        db.add(history)
        await session.delete(order)

        if is_custom:
            await db.commit()
            await session.commit()
        else:
            await db.commit()
        await db.refresh(history)

        resp = {
            "order_id": order.order_id,
            "order_status": "CLOSE",
            "history_id": history.history_id,
        }
        if auto_closed:
            resp["auto_closed"] = auto_closed

        if order.linked_order_id:
            partner_result = await session.execute(
                select(ModelClass).where(ModelClass.order_id == order.linked_order_id)
            )
            partner = partner_result.scalar_one_or_none()
            if partner and partner.linked_order_id == order.order_id:
                resp["paired_order_id"] = partner.order_id

        return resp
    finally:
        if is_custom:
            await session.close()


class LinkOrderRequest(BaseModel):
    target_order_id: str


@router.post("/{order_id}/link", tags=["orders"])
async def link_order(
    order_id: str,
    req: LinkOrderRequest,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """Link order to a target order by setting linked_order_id (one-way = pending close).
    For two-way (spread), the target order must also link back."""
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == req.target_order_id))
        target = result.scalar_one_or_none()
        if not target:
            raise HTTPException(status_code=404, detail="Target order not found")

        if req.target_order_id == order_id:
            raise HTTPException(status_code=400, detail="Cannot link order to itself")
        order.linked_order_id = req.target_order_id
        await session.commit()
        return {"order_id": order.order_id, "linked_order_id": order.linked_order_id}
    finally:
        if is_custom:
            await session.close()