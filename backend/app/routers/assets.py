from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models import WhitelistAssets

class AssetResponse(BaseModel):
    asset_id: int
    ticker: str
    asset_type: str

    class Config:
        orm_mode = True

router = APIRouter()

@router.get("/", response_model=list[AssetResponse], tags=["assets"])
async def list_assets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WhitelistAssets))
    return result.scalars().all()
