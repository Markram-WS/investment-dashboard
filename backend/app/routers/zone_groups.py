from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from pydantic import BaseModel
from app.database import get_db
from app.models import ZoneGroup, Portfolio

router = APIRouter()


class ZoneGroupCreate(BaseModel):
    name: str
    max_orders: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    range: Optional[float] = None


class ZoneGroupUpdate(BaseModel):
    name: Optional[str] = None
    max_orders: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    range: Optional[float] = None


class ZoneGroupResponse(BaseModel):
    id: int
    portfolio_id: int
    name: str
    max_orders: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    range: Optional[float] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=List[ZoneGroupResponse], tags=["zone-groups"])
async def list_zone_groups(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ZoneGroup).where(ZoneGroup.portfolio_id == portfolio_id)
    )
    return result.scalars().all()


@router.post("/", response_model=ZoneGroupResponse, status_code=status.HTTP_201_CREATED, tags=["zone-groups"])
async def create_zone_group(portfolio_id: int, data: ZoneGroupCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    group = ZoneGroup(portfolio_id=portfolio_id, **data.dict())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.put("/{group_id}", response_model=ZoneGroupResponse, tags=["zone-groups"])
async def update_zone_group(group_id: int, data: ZoneGroupUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZoneGroup).where(ZoneGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Zone group not found")
    for key, val in data.dict(exclude_unset=True).items():
        setattr(group, key, val)
    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["zone-groups"])
async def delete_zone_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZoneGroup).where(ZoneGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Zone group not found")
    await db.delete(group)
    await db.commit()
