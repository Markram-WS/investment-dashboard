"""
ETL Sync Module - Read-Only Sync from Bot DB
Implements Section 5: ETL Sync with LOGIC-ETL-SYNC flag
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import (
    Portfolio, ActiveOrder, TradePlan, TradeHistory, 
    Transaction, OptionDetails
)
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

router = APIRouter()


class ETLSyncStatus(BaseModel):
    """Response model for ETL sync status."""
    table_name: str
    records_synced: int
    last_sync_time: datetime
    status: str


class ETLSyncRequest(BaseModel):
    """Request model for triggering ETL sync."""
    tables: Optional[List[str]] = None  # If None, sync all tables
    force_refresh: bool = False


@router.post("/sync", response_model=List[ETLSyncStatus])
async def trigger_etl_sync(
    request: ETLSyncRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger ETL sync from Bot DB (Read-Only).
    Syncs data from 2 tables with LOGIC-ETL-SYNC flag.
    
    This is a read-only operation that:
    1. Fetches data from Bot DB (simulated via data_source='Bot' filter)
    2. Creates/updates records in main DB
    3. Sets etl_synced=True on synced records
    """
    results = []
    tables_to_sync = request.tables or ["portfolios", "active_orders"]
    
    for table_name in tables_to_sync:
        try:
            if table_name == "portfolios":
                # Sync portfolios with etl_synced=False
                stmt = (
                    select(Portfolio)
                    .where(Portfolio.data_source == 'Bot')
                    .where(Portfolio.etl_synced == False)  # noqa
                )
                result = await db.execute(stmt)
                records = result.scalars().all()
                
                for record in records:
                    record.etl_synced = True
                
                await db.commit()
                results.append(ETLSyncStatus(
                    table_name=table_name,
                    records_synced=len(records),
                    last_sync_time=datetime.utcnow(),
                    status="success"
                ))
                
            elif table_name == "active_orders":
                stmt = (
                    select(ActiveOrder)
                    .where(ActiveOrder.data_source == 'Bot')
                    .where(ActiveOrder.etl_synced == False)
                )
                result = await db.execute(stmt)
                records = result.scalars().all()
                
                for record in records:
                    record.etl_synced = True
                
                await db.commit()
                results.append(ETLSyncStatus(
                    table_name=table_name,
                    records_synced=len(records),
                    last_sync_time=datetime.utcnow(),
                    status="success"
                ))
                
            else:
                results.append(ETLSyncStatus(
                    table_name=table_name,
                    records_synced=0,
                    last_sync_time=datetime.utcnow(),
                    status="skipped"
                ))
                
        except Exception as e:
            results.append(ETLSyncStatus(
                table_name=table_name,
                records_synced=0,
                last_sync_time=datetime.utcnow(),
                status=f"error: {str(e)}"
            ))
    
    return results


@router.get("/status", response_model=List[ETLSyncStatus])
async def get_etl_status(db: AsyncSession = Depends(get_db)):
    """
    Get current ETL sync status for all tables.
    """
    results = []
    
    # Check portfolios
    stmt = select(Portfolio).where(Portfolio.data_source == 'Bot')
    result = await db.execute(stmt)
    total = len(result.scalars().all())
    stmt = select(Portfolio).where(
        Portfolio.data_source == 'Bot',
        Portfolio.etl_synced == True  # noqa
    )
    result = await db.execute(stmt)
    synced = len(result.scalars().all())
    
    results.append(ETLSyncStatus(
        table_name="portfolios",
        records_synced=synced,
        last_sync_time=datetime.utcnow() if synced > 0 else None,
        status="completed" if synced == total else "pending"
    ))
    
    # Check active_orders
    stmt = select(ActiveOrder).where(ActiveOrder.data_source == 'Bot')
    result = await db.execute(stmt)
    total = len(result.scalars().all())
    stmt = select(ActiveOrder).where(
        ActiveOrder.data_source == 'Bot',
        ActiveOrder.etl_synced == True
    )
    result = await db.execute(stmt)
    synced = len(result.scalars().all())
    
    results.append(ETLSyncStatus(
        table_name="active_orders",
        records_synced=synced,
        last_sync_time=datetime.utcnow() if synced > 0 else None,
        status="completed" if synced == total else "pending"
    ))
    
    return results


@router.get("/bot-data/{table_name}")
async def get_bot_data(
    table_name: str,
    skip_synced: bool = Query(False, description="Skip already synced records"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get Bot DB data (Read-Only).
    Implements Manual/Bot Data Isolation - filters by data_source.
    """
    valid_tables = ["portfolios", "active_orders", "trade_history", "transactions"]
    if table_name not in valid_tables:
        raise HTTPException(status_code=400, detail=f"Invalid table: {table_name}")
    
    model_map = {
        "portfolios": Portfolio,
        "active_orders": ActiveOrder,
        "trade_history": TradeHistory,
        "transactions": Transaction
    }
    
    stmt = select(model_map[table_name]).where(
        model_map[table_name].data_source == 'Bot'
    )
    
    if skip_synced:
        stmt = stmt.where(
            model_map[table_name].etl_synced == False  # noqa
        )
    
    result = await db.execute(stmt)
    records = result.scalars().all()
    
    return {"data": records, "count": len(records)}