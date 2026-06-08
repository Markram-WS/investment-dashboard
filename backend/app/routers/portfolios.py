from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import (
    Portfolio, CustomPortfolioConnection,
    ActiveOrder, TradeHistory, TradePlan, OptionDetails,
    PortfolioNavHistory, SimulationModels, DecisionJournal,
    Transaction, OrdersGroup, WhitelistAssets
)
from app.managed_fund_models import (
    ManagedFundHolding, ManagedFundOrder,
    ManagedFundOrderHistory, ManagedFundSetting
)
from app.utils.crypto import encrypt_password
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import date

import asyncpg


class PortfolioCreate(BaseModel):
    portfolio_name: str
    port_type: str
    target_ratio: Optional[Dict[str, Any]] = None
    current_nav: Optional[float] = None
    margin_locked: Optional[float] = 0.0
    cash_buffer_limit: Optional[float] = 0.0
    available_cash: Optional[float] = 0.0
    money_market: Optional[float] = 0.0
    trade_plan_md: Optional[str] = None
    risk_status: Optional[str] = "Safe"
    tags: Optional[Dict[str, Any]] = None
    last_rebalance_date: Optional[date] = None
    # Custom portfolio connection fields
    db_host: Optional[str] = None
    db_port: Optional[int] = 5432
    db_name: Optional[str] = None
    db_user: Optional[str] = None
    db_password: Optional[str] = None


class PortfolioResponse(BaseModel):
    portfolio_id: int
    portfolio_name: str
    port_type: str
    is_custom: bool = False
    target_ratio: Optional[Dict[str, Any]]
    current_allocations: Optional[Dict[str, Any]]
    current_nav: Optional[float]
    margin_locked: Optional[float]
    cash_buffer_limit: Optional[float]
    available_cash: Optional[float]
    money_market: Optional[float]
    risk_status: Optional[str]
    tags: Optional[Dict[str, Any]]
    last_rebalance_date: Optional[date]
    # Custom portfolio connection info (partial - no password)
    db_host: Optional[str] = None
    db_port: Optional[int] = None
    db_name: Optional[str] = None
    db_user: Optional[str] = None

    class Config:
        orm_mode = True


class PortfolioTypeResponse(BaseModel):
    type_name: str
    description: str
    logic: str


PORTFOLIO_TYPES = [
    PortfolioTypeResponse(
        type_name="Managed Fund",
        description="Portfolio focused on rebalancing according to target ratios",
        logic="Rebalance based on target allocation weights"
    ),
    PortfolioTypeResponse(
        type_name="Active Trading",
        description="Portfolio for managing individual orders (Stock, Future, Option)",
        logic="Manage Stock, Future, and Option orders individually"
    ),
    PortfolioTypeResponse(
        type_name="Custom Portfolio",
        description="Portfolio with isolated external database for orders, transactions, and assets",
        logic="Transactional data stored on user-configured external PostgreSQL database; metadata kept locally"
    ),
]


class PortfolioUpdate(BaseModel):
    portfolio_name: Optional[str] = None
    port_type: Optional[str] = None
    target_ratio: Optional[Dict[str, Any]] = None
    current_nav: Optional[float] = None
    margin_locked: Optional[float] = None
    cash_buffer_limit: Optional[float] = None
    available_cash: Optional[float] = None
    money_market: Optional[float] = None
    trade_plan_md: Optional[str] = None
    internal_notes: Optional[str] = None
    risk_status: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    last_rebalance_date: Optional[date] = None


class TestConnectionRequest(BaseModel):
    db_host: str
    db_port: int = 5432
    db_name: str
    db_user: str
    db_password: str


router = APIRouter()


@router.get("", tags=["portfolios"])
async def list_portfolios(db: AsyncSession = Depends(get_db)):
    """List all portfolios with their risk status."""
    result = await db.execute(select(Portfolio))
    portfolios = result.scalars().all()
    return [{
        "portfolio_id": p.portfolio_id,
        "portfolio_name": p.portfolio_name,
        "risk_status": p.risk_status,
        "available_cash": p.available_cash,
        "port_type": p.port_type,
        "is_custom": p.is_custom,
    } for p in portfolios]


@router.post("/", tags=["portfolios"], status_code=status.HTTP_201_CREATED, response_model=PortfolioResponse)
async def create_portfolio(portfolio: PortfolioCreate, db: AsyncSession = Depends(get_db)):
    """Create a new portfolio. If port_type is 'Custom Portfolio', requires connection details."""
    is_custom = portfolio.port_type == "Custom Portfolio"

    if is_custom:
        missing = []
        if not portfolio.db_host:
            missing.append("db_host")
        if not portfolio.db_name:
            missing.append("db_name")
        if not portfolio.db_user:
            missing.append("db_user")
        if not portfolio.db_password:
            missing.append("db_password")
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Custom Portfolio requires: {', '.join(missing)}"
            )

    db_portfolio = Portfolio(
        portfolio_name=portfolio.portfolio_name,
        port_type=portfolio.port_type,
        is_custom=is_custom,
        target_ratio=portfolio.target_ratio,
        current_nav=portfolio.current_nav,
        margin_locked=portfolio.margin_locked,
        cash_buffer_limit=portfolio.cash_buffer_limit,
        available_cash=portfolio.available_cash,
        money_market=portfolio.money_market,
        trade_plan_md=portfolio.trade_plan_md,
        risk_status=portfolio.risk_status,
        tags=portfolio.tags,
        last_rebalance_date=portfolio.last_rebalance_date,
    )
    db.add(db_portfolio)
    await db.flush()

    if is_custom:
        encrypted_pw = encrypt_password(portfolio.db_password)
        connection = CustomPortfolioConnection(
            portfolio_id=db_portfolio.portfolio_id,
            db_host=portfolio.db_host,
            db_port=portfolio.db_port or 5432,
            db_name=portfolio.db_name,
            db_user=portfolio.db_user,
            encrypted_password=encrypted_pw,
        )
        db.add(connection)

    await db.commit()
    await db.refresh(db_portfolio)

    response = {
        "portfolio_id": db_portfolio.portfolio_id,
        "portfolio_name": db_portfolio.portfolio_name,
        "port_type": db_portfolio.port_type,
        "is_custom": db_portfolio.is_custom,
        "target_ratio": db_portfolio.target_ratio,
        "current_allocations": db_portfolio.target_ratio or {},
        "current_nav": db_portfolio.current_nav,
        "margin_locked": db_portfolio.margin_locked,
        "cash_buffer_limit": db_portfolio.cash_buffer_limit,
        "available_cash": db_portfolio.available_cash,
        "money_market": db_portfolio.money_market,
        "risk_status": db_portfolio.risk_status,
        "tags": db_portfolio.tags,
        "last_rebalance_date": db_portfolio.last_rebalance_date,
        "db_host": portfolio.db_host,
        "db_port": portfolio.db_port,
        "db_name": portfolio.db_name,
        "db_user": portfolio.db_user,
    }
    return response


@router.get("/types", tags=["portfolios"], response_model=List[PortfolioTypeResponse])
async def get_portfolio_types():
    """Get list of available portfolio types with their definitions."""
    return PORTFOLIO_TYPES


@router.get("/{portfolio_id}", tags=["portfolios"], response_model=PortfolioResponse)
async def get_portfolio(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single portfolio by ID."""
    result = await db.execute(select(Portfolio).where(Portfolio.portfolio_id == portfolio_id))
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    response_data = {
        "portfolio_id": portfolio.portfolio_id,
        "portfolio_name": portfolio.portfolio_name,
        "port_type": portfolio.port_type,
        "is_custom": portfolio.is_custom,
        "target_ratio": portfolio.target_ratio,
        "current_allocations": portfolio.target_ratio or {},
        "current_nav": portfolio.current_nav,
        "margin_locked": portfolio.margin_locked,
        "cash_buffer_limit": portfolio.cash_buffer_limit,
        "available_cash": portfolio.available_cash,
        "money_market": portfolio.money_market,
        "risk_status": portfolio.risk_status,
        "tags": portfolio.tags,
        "last_rebalance_date": portfolio.last_rebalance_date,
        "db_host": None,
        "db_port": None,
        "db_name": None,
        "db_user": None,
    }

    if portfolio.is_custom:
        conn_result = await db.execute(
            select(CustomPortfolioConnection).where(
                CustomPortfolioConnection.portfolio_id == portfolio_id
            )
        )
        conn = conn_result.scalar_one_or_none()
        if conn:
            response_data.update({
                "db_host": conn.db_host,
                "db_port": conn.db_port,
                "db_name": conn.db_name,
                "db_user": conn.db_user,
            })

    return response_data


@router.put("/{portfolio_id}", tags=["portfolios"])
async def update_portfolio(portfolio_id: int, update: PortfolioUpdate, db: AsyncSession = Depends(get_db)):
    """Update a portfolio by ID."""
    result = await db.execute(select(Portfolio).where(Portfolio.portfolio_id == portfolio_id))
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    update_data = update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(portfolio, field, value)
    await db.commit()
    await db.refresh(portfolio)
    return portfolio


class ConnectionUpdate(BaseModel):
    db_host: Optional[str] = None
    db_port: Optional[int] = None
    db_name: Optional[str] = None
    db_user: Optional[str] = None
    db_password: Optional[str] = None


@router.patch("/{portfolio_id}/connection", tags=["portfolios"])
async def update_portfolio_connection(
    portfolio_id: int,
    update: ConnectionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update custom portfolio database connection details."""
    result = await db.execute(select(Portfolio).where(Portfolio.portfolio_id == portfolio_id))
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    if not portfolio.is_custom:
        raise HTTPException(status_code=400, detail="Portfolio is not a custom portfolio")

    conn_result = await db.execute(
        select(CustomPortfolioConnection).where(
            CustomPortfolioConnection.portfolio_id == portfolio_id
        )
    )
    connection = conn_result.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    update_data = update.dict(exclude_unset=True, exclude_none=True)
    if "db_password" in update_data:
        update_data["encrypted_password"] = encrypt_password(update_data.pop("db_password"))
    for field, value in update_data.items():
        setattr(connection, field, value)
    await db.commit()
    return {"detail": "Connection updated"}


@router.delete("/{portfolio_id}", tags=["portfolios"])
async def delete_portfolio(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a portfolio by ID. Fails if active (non-closed) orders exist."""
    result = await db.execute(select(Portfolio).where(Portfolio.portfolio_id == portfolio_id))
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Delete custom connection if present
    await db.execute(
        CustomPortfolioConnection.__table__.delete().where(
            CustomPortfolioConnection.portfolio_id == portfolio_id
        )
    )

    await db.execute(
        DecisionJournal.__table__.delete().where(DecisionJournal.portfolio_id == portfolio_id)
    )
    await db.execute(
        TradeHistory.__table__.delete().where(TradeHistory.portfolio_id == portfolio_id)
    )
    await db.execute(
        ActiveOrder.__table__.update()
        .where(ActiveOrder.portfolio_id == portfolio_id)
        .values(option_id=None)
    )
    await db.execute(
        ActiveOrder.__table__.delete().where(ActiveOrder.portfolio_id == portfolio_id)
    )
    await db.execute(
        TradePlan.__table__.delete().where(TradePlan.portfolio_id == portfolio_id)
    )
    await db.execute(
        PortfolioNavHistory.__table__.delete().where(PortfolioNavHistory.portfolio_id == portfolio_id)
    )
    await db.execute(
        SimulationModels.__table__.delete().where(SimulationModels.portfolio_id == portfolio_id)
    )
    await db.execute(
        OrdersGroup.__table__.delete().where(OrdersGroup.portfolio_id == portfolio_id)
    )
    await db.execute(
        Transaction.__table__.delete().where(
            (Transaction.source_portfolio_id == portfolio_id) |
            (Transaction.destination_portfolio_id == portfolio_id)
        )
    )

    # Managed Fund tables cascade
    await db.execute(
        ManagedFundHolding.__table__.delete().where(ManagedFundHolding.portfolio_id == portfolio_id)
    )
    await db.execute(
        ManagedFundOrder.__table__.delete().where(ManagedFundOrder.portfolio_id == portfolio_id)
    )
    await db.execute(
        ManagedFundOrderHistory.__table__.delete().where(ManagedFundOrderHistory.portfolio_id == portfolio_id)
    )
    await db.execute(
        ManagedFundSetting.__table__.delete().where(ManagedFundSetting.portfolio_id == portfolio_id)
    )

    await db.delete(portfolio)
    await db.commit()
    return {"detail": "Portfolio deleted"}


@router.post("/test-connection", tags=["portfolios"])
async def test_connection(req: TestConnectionRequest):
    """Test a database connection with the given parameters."""
    try:
        conn = await asyncpg.connect(
            host=req.db_host,
            port=req.db_port,
            database=req.db_name,
            user=req.db_user,
            password=req.db_password,
            timeout=10,
        )
        await conn.close()
        return {"status": "ok", "message": "Connection successful"}
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Connection failed: {str(e)}"
        )
