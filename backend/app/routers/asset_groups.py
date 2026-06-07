from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database import get_db, resolve_portfolio_db
from app.models import AssetGroup, WhitelistAssets
from app.custom_models import CustomAssetGroup, CustomWhitelistAssets

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
async def list_groups(
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomAssetGroup if is_custom else AssetGroup
        if not is_custom:
            await seed_default_groups(session)
        result = await session.execute(select(ModelClass).order_by(ModelClass.id))
        return result.scalars().all()
    finally:
        if is_custom:
            await session.close()

@router.post("", response_model=AssetGroupResponse, status_code=201, tags=["asset-groups"])
async def create_group(
    data: AssetGroupCreate,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomAssetGroup if is_custom else AssetGroup
        existing = await session.execute(select(ModelClass).where(ModelClass.name == data.name))
        if existing.scalars().first():
            raise HTTPException(400, "Group name already exists")
        group = ModelClass(name=data.name)
        session.add(group)
        await session.commit()
        await session.refresh(group)
        return group
    finally:
        if is_custom:
            await session.close()

@router.put("/{group_id}", response_model=AssetGroupResponse, tags=["asset-groups"])
async def update_group(
    group_id: int,
    data: AssetGroupUpdate,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomAssetGroup if is_custom else AssetGroup
        result = await session.execute(select(ModelClass).where(ModelClass.id == group_id))
        group = result.scalars().first()
        if not group:
            raise HTTPException(404, "Group not found")
        if getattr(group, 'is_default', False):
            raise HTTPException(400, "Cannot edit default groups")
        if data.name is not None:
            existing = await session.execute(
                select(ModelClass).where(ModelClass.name == data.name, ModelClass.id != group_id)
            )
            if existing.scalars().first():
                raise HTTPException(400, "Group name already exists")
            group.name = data.name
        await session.commit()
        await session.refresh(group)
        return group
    finally:
        if is_custom:
            await session.close()

@router.delete("/{group_id}", status_code=204, tags=["asset-groups"])
async def delete_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomAssetGroup if is_custom else AssetGroup
        result = await session.execute(select(ModelClass).where(ModelClass.id == group_id))
        group = result.scalars().first()
        if not group:
            raise HTTPException(404, "Group not found")
        if getattr(group, 'is_default', False):
            raise HTTPException(400, "Cannot delete default groups")
        AssetModel = CustomWhitelistAssets if is_custom else WhitelistAssets
        await session.execute(
            AssetModel.__table__.update().where(AssetModel.group_id == group_id).values(group_id=None)
        )
        await session.delete(group)
        await session.commit()
    finally:
        if is_custom:
            await session.close()
