from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models import AssetGroup, WhitelistAssets

class AssetGroupResponse(BaseModel):
    id: int
    name: str
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True

class AssetGroupCreate(BaseModel):
    name: str

class AssetGroupUpdate(BaseModel):
    name: Optional[str] = None

router = APIRouter()

async def seed_default_groups(db: AsyncSession):
    result = await db.execute(select(AssetGroup).limit(1))
    if result.scalars().first() is None:
        db.add_all([
            AssetGroup(name="Ungrouped", is_default=True),
            AssetGroup(name="Watchlist", is_default=True),
        ])
        await db.commit()

@router.get("", response_model=list[AssetGroupResponse], tags=["asset-groups"])
async def list_groups(db: AsyncSession = Depends(get_db)):
    await seed_default_groups(db)
    result = await db.execute(select(AssetGroup).order_by(AssetGroup.id))
    return result.scalars().all()

@router.post("", response_model=AssetGroupResponse, status_code=201, tags=["asset-groups"])
async def create_group(data: AssetGroupCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(AssetGroup).where(AssetGroup.name == data.name))
    if existing.scalars().first():
        raise HTTPException(400, "Group name already exists")
    group = AssetGroup(name=data.name)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group

@router.put("/{group_id}", response_model=AssetGroupResponse, tags=["asset-groups"])
async def update_group(group_id: int, data: AssetGroupUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AssetGroup).where(AssetGroup.id == group_id))
    group = result.scalars().first()
    if not group:
        raise HTTPException(404, "Group not found")
    if group.is_default:
        raise HTTPException(400, "Cannot edit default groups")
    if data.name is not None:
        existing = await db.execute(select(AssetGroup).where(AssetGroup.name == data.name, AssetGroup.id != group_id))
        if existing.scalars().first():
            raise HTTPException(400, "Group name already exists")
        group.name = data.name
    await db.commit()
    await db.refresh(group)
    return group

@router.delete("/{group_id}", status_code=204, tags=["asset-groups"])
async def delete_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AssetGroup).where(AssetGroup.id == group_id))
    group = result.scalars().first()
    if not group:
        raise HTTPException(404, "Group not found")
    if group.is_default:
        raise HTTPException(400, "Cannot delete default groups")
    await db.execute(
        WhitelistAssets.__table__.update().where(WhitelistAssets.group_id == group_id).values(group_id=None)
    )
    await db.delete(group)
    await db.commit()
