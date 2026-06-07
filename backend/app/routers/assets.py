from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models import WhitelistAssets, AssetGroup, ActiveOrder
from app.services.yfinance_service import fetch_price

class AssetResponse(BaseModel):
    asset_id: int
    ticker: str
    asset_type: str
    name: Optional[str] = None
    source: str = 'manual'
    group_id: Optional[int] = None
    price: Optional[float] = None
    change_24h: Optional[float] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AssetCreate(BaseModel):
    ticker: str
    asset_type: str = 'stock'
    name: Optional[str] = None
    source: str = 'manual'
    group_id: Optional[int] = None

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    asset_type: Optional[str] = None
    source: Optional[str] = None
    group_id: Optional[int] = None
    price: Optional[float] = None
    change_24h: Optional[float] = None

router = APIRouter()

def _ensure_default_group(db: AsyncSession):
    result = db.execute(select(AssetGroup).where(AssetGroup.name == "Ungrouped"))
    group = result.scalars().first()
    if not group:
        group = AssetGroup(name="Ungrouped", is_default=True)
        db.add(group)
        db.commit()
        db.refresh(group)
    return group

@router.get("", response_model=List[AssetResponse], tags=["assets"])
async def list_assets(
    group_id: Optional[int] = Query(None),
    asset_type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(WhitelistAssets)
    if group_id is not None:
        query = query.where(WhitelistAssets.group_id == group_id)
    if asset_type:
        query = query.where(WhitelistAssets.asset_type == asset_type)
    if source:
        query = query.where(WhitelistAssets.source == source)
    query = query.order_by(WhitelistAssets.ticker)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("", response_model=AssetResponse, status_code=201, tags=["assets"])
async def create_asset(data: AssetCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(WhitelistAssets).where(WhitelistAssets.ticker == data.ticker.upper()))
    if existing.scalars().first():
        raise HTTPException(400, "Asset with this ticker already exists")
    if data.group_id:
        grp = await db.execute(select(AssetGroup).where(AssetGroup.id == data.group_id))
        if not grp.scalars().first():
            raise HTTPException(404, "Group not found")
    asset = WhitelistAssets(
        ticker=data.ticker.upper(),
        asset_type=data.asset_type,
        name=data.name or data.ticker.upper(),
        source=data.source,
        group_id=data.group_id,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset

@router.put("/{asset_id}", response_model=AssetResponse, tags=["assets"])
async def update_asset(asset_id: int, data: AssetUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WhitelistAssets).where(WhitelistAssets.asset_id == asset_id))
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    for field in ("name", "asset_type", "source", "group_id", "price", "change_24h"):
        val = getattr(data, field, None)
        if val is not None:
            setattr(asset, field, val)
    asset.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(asset)
    return asset

@router.delete("/{asset_id}", status_code=204, tags=["assets"])
async def delete_asset(asset_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WhitelistAssets).where(WhitelistAssets.asset_id == asset_id))
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    await db.delete(asset)
    await db.commit()

@router.post("/sync-from-orders", response_model=List[AssetResponse], tags=["assets"])
async def sync_from_orders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ActiveOrder.asset_type).distinct())
    tickers = {row[0].strip().upper() for row in result if row[0] and row[0].strip()}
    existing = await db.execute(select(WhitelistAssets.ticker))
    existing_tickers = {row[0].upper() for row in existing if row[0]}
    missing = tickers - existing_tickers
    if not missing:
        return []
    ung_group = _ensure_default_group(db)
    new_assets = []
    for ticker in missing:
        asset = WhitelistAssets(
            ticker=ticker,
            asset_type='stock',
            name=ticker,
            source='yfinance',
            group_id=ung_group.id,
        )
        db.add(asset)
        new_assets.append(asset)
    await db.commit()
    for a in new_assets:
        await db.refresh(a)
        try:
            price, change = fetch_price(a.ticker)
            a.price = price
            a.change_24h = change
        except Exception:
            pass
    await db.commit()
    for a in new_assets:
        await db.refresh(a)
    return new_assets

@router.post("/{asset_id}/update-price", response_model=AssetResponse, tags=["assets"])
async def update_asset_price(asset_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WhitelistAssets).where(WhitelistAssets.asset_id == asset_id))
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    if asset.source == 'yfinance':
        try:
            price, change = fetch_price(asset.ticker)
            asset.price = price
            asset.change_24h = change
        except Exception as e:
            raise HTTPException(502, f"Failed to fetch price: {e}")
    asset.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(asset)
    return asset

@router.post("/batch-update-prices", tags=["assets"])
async def batch_update_prices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WhitelistAssets).where(WhitelistAssets.source == 'yfinance')
    )
    assets = result.scalars().all()
    updated = []
    for asset in assets:
        try:
            price, change = fetch_price(asset.ticker)
            asset.price = price
            asset.change_24h = change
            asset.updated_at = datetime.utcnow()
            updated.append(asset.ticker)
        except Exception:
            pass
    await db.commit()
    return {"updated": len(updated), "tickers": updated}
