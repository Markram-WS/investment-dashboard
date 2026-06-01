from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from pydantic import BaseModel
from app.database import get_db
from app.models import OrdersGroup, Portfolio

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
async def list_orders_groups(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(OrdersGroup).where(OrdersGroup.portfolio_id == portfolio_id)
    )
    return result.scalars().all()


@router.post("/", response_model=OrdersGroupResponse, status_code=status.HTTP_201_CREATED, tags=["orders-groups"])
async def create_orders_group(portfolio_id: int, data: OrdersGroupCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    group = OrdersGroup(portfolio_id=portfolio_id, **data.dict())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.put("/{group_id}", response_model=OrdersGroupResponse, tags=["orders-groups"])
async def update_orders_group(group_id: int, data: OrdersGroupUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OrdersGroup).where(OrdersGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Orders group not found")
    for key, val in data.dict(exclude_unset=True).items():
        setattr(group, key, val)
    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["orders-groups"])
async def delete_orders_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OrdersGroup).where(OrdersGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Orders group not found")
    await db.delete(group)
    await db.commit()
