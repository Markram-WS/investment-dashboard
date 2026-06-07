from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from pydantic import BaseModel
from app.database import get_db, resolve_portfolio_db
from app.models import OrdersGroup, Portfolio
from app.custom_models import CustomOrdersGroup

router = APIRouter()


class OrdersGroupCreate(BaseModel):
    name: str
    max_orders: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    range: Optional[float] = None


class OrdersGroupUpdate(BaseModel):
    name: Optional[str] = None
    max_orders: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    range: Optional[float] = None


class OrdersGroupResponse(BaseModel):
    id: int
    portfolio_id: int
    name: str
    max_orders: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    range: Optional[float] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=List[OrdersGroupResponse], tags=["orders-groups"])
async def list_orders_groups(
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomOrdersGroup if is_custom else OrdersGroup
        result = await session.execute(
            select(ModelClass).where(ModelClass.portfolio_id == portfolio_id)
        )
        return result.scalars().all()
    finally:
        if is_custom:
            await session.close()


@router.post("/", response_model=OrdersGroupResponse, status_code=status.HTTP_201_CREATED, tags=["orders-groups"])
async def create_orders_group(portfolio_id: int, data: OrdersGroupCreate, db: AsyncSession = Depends(get_db)):
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomOrdersGroup if is_custom else OrdersGroup
        result = await db.execute(
            select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        group = ModelClass(portfolio_id=portfolio_id, **data.dict())
        session.add(group)
        await session.commit()
        await session.refresh(group)
        return group
    finally:
        if is_custom:
            await session.close()


@router.put("/{group_id}", response_model=OrdersGroupResponse, tags=["orders-groups"])
async def update_orders_group(
    group_id: int,
    data: OrdersGroupUpdate,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomOrdersGroup if is_custom else OrdersGroup
        result = await session.execute(select(ModelClass).where(ModelClass.id == group_id))
        group = result.scalar_one_or_none()
        if not group:
            raise HTTPException(status_code=404, detail="Orders group not found")
        for key, val in data.dict(exclude_unset=True).items():
            setattr(group, key, val)
        await session.commit()
        await session.refresh(group)
        return group
    finally:
        if is_custom:
            await session.close()


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["orders-groups"])
async def delete_orders_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomOrdersGroup if is_custom else OrdersGroup
        result = await session.execute(select(ModelClass).where(ModelClass.id == group_id))
        group = result.scalar_one_or_none()
        if not group:
            raise HTTPException(status_code=404, detail="Orders group not found")
        await session.delete(group)
        await session.commit()
    finally:
        if is_custom:
            await session.close()
