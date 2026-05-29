from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import TradePlan, Portfolio
from app.schemas.trade_plan import TradePlanCreate, TradePlanResponse, TradePlanUpdate

router = APIRouter()

@router.post("/", response_model=TradePlanResponse, status_code=status.HTTP_201_CREATED, tags=["trade-plans"])
async def create_trade_plan(plan: TradePlanCreate, db: AsyncSession = Depends(get_db)):
    # Check if portfolio exists
    result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == plan.portfolio_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    db_plan = TradePlan(**plan.dict())
    db.add(db_plan)
    await db.commit()
    await db.refresh(db_plan)
    return db_plan

@router.get("/", response_model=List[TradePlanResponse], tags=["trade-plans"])
async def list_trade_plans(portfolio_id: int = None, db: AsyncSession = Depends(get_db)):
    query = select(TradePlan)
    if portfolio_id:
        query = query.where(TradePlan.portfolio_id == portfolio_id)
    result = await db.execute(query)
    plans = result.scalars().all()
    return plans

@router.get("/{plan_id}", response_model=TradePlanResponse, tags=["trade-plans"])
async def get_trade_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TradePlan).where(TradePlan.plan_id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Trade plan not found")
    return plan

@router.put("/{plan_id}", response_model=TradePlanResponse, tags=["trade-plans"])
async def update_trade_plan(plan_id: int, plan_update: TradePlanUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TradePlan).where(TradePlan.plan_id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Trade plan not found")
    
    plan.trade_plan_md = plan_update.trade_plan_md
    await db.commit()
    await db.refresh(plan)
    return plan

@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["trade-plans"])
async def delete_trade_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TradePlan).where(TradePlan.plan_id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Trade plan not found")
    await db.delete(plan)
    await db.commit()
    return None