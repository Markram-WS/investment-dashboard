from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import evict_custom_engine, get_db
from app.models import (
    Portfolio, CustomPortfolioConnection,
    ActiveOrder, TradeHistory, TradePlan, OptionDetails,
    PortfolioNavHistory, SimulationModels, DecisionJournal,
    Transaction, OrdersGroup
)
from app.managed_fund_models import (
    ManagedFundHolding, ManagedFundOrder,
    ManagedFundOrderHistory, ManagedFundSetting
)
from app.risk_calc import compute_margin_locked
from app.services import asset_registry as registry
from app.utils.crypto import encrypt_password, decrypt_password
from app.custom_mapping import mapped_diagnostics, select_test_mapping, validate_mapping
from app.mapping_templates import list_templates
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import date

from sqlalchemy.engine import URL
from sqlalchemy.ext.asyncio import create_async_engine
import asyncpg


class PortfolioCreate(BaseModel):
    portfolio_name: str
    port_type: str
    broker_id: Optional[int] = None
    product_ticker: Optional[str] = None
    product_tickers: Optional[List[str]] = None
    x_amount: Optional[float] = 0.0
    initial_capital: Optional[float] = 0.0
    target_ratio: Optional[Dict[str, Any]] = None
    current_nav: Optional[float] = None
    margin_locked: Optional[float] = 0.0
    cash_buffer_limit: Optional[float] = 0.0
    available_cash: Optional[float] = 0.0
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
    mapping_config: Optional[Dict[str, Any]] = None


class PortfolioResponse(BaseModel):
    portfolio_id: int
    portfolio_name: str
    port_type: str
    is_custom: bool = False
    broker_id: Optional[int] = None
    product_ticker: Optional[str] = None
    product_tickers: Optional[List[str]] = None
    x_amount: Optional[float] = 0.0
    initial_capital: Optional[float] = 0.0
    target_ratio: Optional[Dict[str, Any]]
    current_allocations: Optional[Dict[str, Any]]
    current_nav: Optional[float]
    margin_locked: Optional[float]
    cash_buffer_limit: Optional[float]
    available_cash: Optional[float]
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
    broker_id: Optional[int] = None
    product_ticker: Optional[str] = None
    product_tickers: Optional[List[str]] = None
    x_amount: Optional[float] = None
    initial_capital: Optional[float] = None
    target_ratio: Optional[Dict[str, Any]] = None
    current_nav: Optional[float] = None
    margin_locked: Optional[float] = None
    cash_buffer_limit: Optional[float] = None
    available_cash: Optional[float] = None
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
    mapping_config: Optional[Dict[str, Any]] = None


class StoredConnectionTestRequest(BaseModel):
    """Body for testing a saved connection; credentials are never accepted."""

    mapping_config: Optional[Dict[str, Any]] = None


def _normalize_product_tickers(values: Optional[List[str]]) -> Optional[List[str]]:
    """Drop blanks and dedupe by normalized key, preserving the first raw value.

    Values are not uppercased/trimmed: translation uses the normalized form only
    for matching, so unmatched entries keep their original casing/whitespace.
    """
    if not values:
        return None
    normalized: List[str] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        key = value.strip().upper()
        if not key or key in seen:
            continue
        seen.add(key)
        normalized.append(value)
    return normalized or None


def _serialize_product_tickers(portfolio: Portfolio) -> Optional[List[str]]:
    """Stored list, else the legacy single ticker, else None."""
    stored = portfolio.product_tickers
    if stored:
        return list(stored)
    return [portfolio.product_ticker] if portfolio.product_ticker else None


async def _probe_mapped_connection(
    *,
    db_host: str,
    db_port: Optional[int],
    db_name: str,
    db_user: str,
    db_password: str,
    mapping_config: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Connect once with the given credentials and optionally collect diagnostics.

    Shared by both connection-test routes. The password is handed to the
    drivers only: it is never returned, echoed, or logged. With a mapping the
    response carries ``diagnostics``; without one it is a connect-only check.
    """
    if mapping_config is not None:
        errors = validate_mapping(mapping_config)
        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))

    try:
        conn = await asyncpg.connect(
            host=db_host,
            port=db_port,
            database=db_name,
            user=db_user,
            password=db_password,
            timeout=10,
        )
        await conn.close()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Connection failed: {str(e)}"
        )

    if mapping_config is None:
        return {"status": "ok", "message": "Connection successful"}

    mapped_engine = create_async_engine(
        URL.create(
            "postgresql+asyncpg",
            username=db_user,
            password=db_password,
            host=db_host,
            port=db_port,
            database=db_name,
        ),
        echo=False,
        future=True,
        pool_pre_ping=True,
    )
    try:
        diagnostics = await mapped_diagnostics(mapped_engine, mapping_config)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Connection failed: {str(e)}"
        )
    finally:
        await mapped_engine.dispose()

    return {
        "status": "ok",
        "message": "Connection successful",
        "diagnostics": diagnostics,
    }


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


@router.post("", tags=["portfolios"], status_code=status.HTTP_201_CREATED, response_model=PortfolioResponse)
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
        if portfolio.mapping_config is not None:
            errors = validate_mapping(portfolio.mapping_config)
            if errors:
                raise HTTPException(status_code=400, detail="; ".join(errors))

    if portfolio.product_tickers is not None:
        product_tickers = _normalize_product_tickers(portfolio.product_tickers)
        product_tickers = await registry.translate_product_tickers(
            db, portfolio.broker_id, product_tickers
        )
        product_ticker = product_tickers[0] if product_tickers else None
    else:
        product_tickers = None
        product_ticker = portfolio.product_ticker

    db_portfolio = Portfolio(
        portfolio_name=portfolio.portfolio_name,
        port_type=portfolio.port_type,
        is_custom=is_custom,
        broker_id=portfolio.broker_id,
        product_ticker=product_ticker,
        product_tickers=product_tickers,
        x_amount=portfolio.x_amount or 0,
        initial_capital=portfolio.initial_capital or 0,
        target_ratio=portfolio.target_ratio,
        current_nav=portfolio.current_nav,
        # margin_locked is computed from the market for Active Trading portfolios;
        # any submitted value is accepted but not persisted.
        margin_locked=0 if portfolio.port_type == "Active Trading" else portfolio.margin_locked,
        cash_buffer_limit=portfolio.cash_buffer_limit,
        available_cash=portfolio.available_cash,
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
            mapping_config=portfolio.mapping_config,
        )
        db.add(connection)

    await db.commit()
    await db.refresh(db_portfolio)

    response = {
        "portfolio_id": db_portfolio.portfolio_id,
        "portfolio_name": db_portfolio.portfolio_name,
        "port_type": db_portfolio.port_type,
        "is_custom": db_portfolio.is_custom,
        "broker_id": db_portfolio.broker_id,
        "product_ticker": db_portfolio.product_ticker,
        "product_tickers": _serialize_product_tickers(db_portfolio),
        "x_amount": db_portfolio.x_amount,
        "initial_capital": db_portfolio.initial_capital,
        "target_ratio": db_portfolio.target_ratio,
        "current_allocations": db_portfolio.target_ratio or {},
        "current_nav": db_portfolio.current_nav,
        "margin_locked": await compute_margin_locked(db, db_portfolio),
        "cash_buffer_limit": db_portfolio.cash_buffer_limit,
        "available_cash": db_portfolio.available_cash,
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


@router.get("/mapping-templates", tags=["portfolios"])
async def get_mapping_templates():
    """Built-in foreign-schema mapping templates."""
    return list_templates()


@router.get("/{portfolio_id}/connection", tags=["portfolios"])
async def get_portfolio_connection(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    """Connection details for a custom portfolio (never the password)."""
    result = await db.execute(
        select(CustomPortfolioConnection).where(
            CustomPortfolioConnection.portfolio_id == portfolio_id
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {
        "db_host": connection.db_host,
        "db_port": connection.db_port,
        "db_name": connection.db_name,
        "db_user": connection.db_user,
        "mapping_config": connection.mapping_config,
    }


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
        "broker_id": portfolio.broker_id,
        "product_ticker": portfolio.product_ticker,
        "product_tickers": _serialize_product_tickers(portfolio),
        "x_amount": portfolio.x_amount,
        "initial_capital": portfolio.initial_capital,
        "target_ratio": portfolio.target_ratio,
        "current_allocations": portfolio.target_ratio or {},
        "current_nav": portfolio.current_nav,
        "margin_locked": await compute_margin_locked(db, portfolio),
        "cash_buffer_limit": portfolio.cash_buffer_limit,
        "available_cash": portfolio.available_cash,
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
    if "product_tickers" in update_data:
        # The list is authoritative when supplied: normalize it, translate any
        # contract symbols to their owning product tickers and mirror the first
        # entry into the legacy single-ticker column.
        tickers = _normalize_product_tickers(update_data.pop("product_tickers"))
        tickers = await registry.translate_product_tickers(
            db,
            update_data.get("broker_id", portfolio.broker_id),
            tickers,
        )
        update_data["product_tickers"] = tickers
        update_data["product_ticker"] = tickers[0] if tickers else None
    # margin_locked is a policy input only for Managed Fund; Active Trading
    # computes it from live orders, so a submitted value is accepted and dropped.
    if update_data.get("port_type", portfolio.port_type) == "Active Trading":
        update_data.pop("margin_locked", None)
    for field, value in update_data.items():
        setattr(portfolio, field, value)
    await db.commit()
    await db.refresh(portfolio)
    return {
        "portfolio_id": portfolio.portfolio_id,
        "portfolio_name": portfolio.portfolio_name,
        "port_type": portfolio.port_type,
        "is_custom": portfolio.is_custom,
        "broker_id": portfolio.broker_id,
        "product_ticker": portfolio.product_ticker,
        "product_tickers": _serialize_product_tickers(portfolio),
        "x_amount": portfolio.x_amount,
        "initial_capital": portfolio.initial_capital,
        "target_ratio": portfolio.target_ratio,
        "current_allocations": portfolio.target_ratio or {},
        "current_nav": portfolio.current_nav,
        "margin_locked": await compute_margin_locked(db, portfolio),
        "cash_buffer_limit": portfolio.cash_buffer_limit,
        "available_cash": portfolio.available_cash,
        "risk_status": portfolio.risk_status,
        "tags": portfolio.tags,
        "last_rebalance_date": portfolio.last_rebalance_date,
    }


class ConnectionUpdate(BaseModel):
    db_host: Optional[str] = None
    db_port: Optional[int] = None
    db_name: Optional[str] = None
    db_user: Optional[str] = None
    db_password: Optional[str] = None
    mapping_config: Optional[Dict[str, Any]] = None


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
    mapping_provided = "mapping_config" in update.model_fields_set
    mapping_config = update_data.pop("mapping_config", None)
    if mapping_provided and mapping_config is not None:
        errors = validate_mapping(mapping_config)
        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))

    requested_port = update_data.get("db_port")
    if requested_port is not None and not 1 <= requested_port <= 65535:
        raise HTTPException(status_code=400, detail="Port must be between 1 and 65535.")

    credentials_changed = any(
        update_data[field] != getattr(connection, field)
        for field in ("db_host", "db_port", "db_name", "db_user")
        if field in update_data
    )
    if "db_password" in update_data:
        # Compare with the stored plaintext so re-saving the same password does
        # not needlessly replace the ciphertext; an undecryptable stored value
        # (e.g. rotated FERNET_KEY) counts as a change and re-encrypts.
        new_password = update_data.pop("db_password")
        try:
            stored_password = decrypt_password(connection.encrypted_password)
        except Exception:
            stored_password = None
        if new_password != stored_password:
            credentials_changed = True
            update_data["encrypted_password"] = encrypt_password(new_password)

    for field, value in update_data.items():
        setattr(connection, field, value)
    if mapping_provided:
        # Explicit null clears the mapping and returns to legacy behaviour.
        connection.mapping_config = mapping_config
    await db.commit()
    if credentials_changed:
        # The cached engine is keyed by portfolio id, not by credentials.
        await evict_custom_engine(portfolio_id)
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
    """Test a database connection with the given parameters.

    With a mapping config, also report how many order/history/account rows the
    foreign schema exposes and one normalised sample order.
    """
    return await _probe_mapped_connection(
        db_host=req.db_host,
        db_port=req.db_port,
        db_name=req.db_name,
        db_user=req.db_user,
        db_password=req.db_password,
        mapping_config=req.mapping_config,
    )


@router.post("/{portfolio_id}/test-connection", tags=["portfolios"])
async def test_stored_connection(
    portfolio_id: int,
    req: Optional[StoredConnectionTestRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """Test a saved custom portfolio connection, optionally with a new mapping.

    Credentials are never accepted here: the stored host/port/database/user
    are used and the saved password is decrypted server-side. Declared after
    the literal ``/test-connection`` route, which stays the creation-flow
    credential check.
    """
    portfolio_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    if portfolio_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    result = await db.execute(
        select(CustomPortfolioConnection).where(
            CustomPortfolioConnection.portfolio_id == portfolio_id
        )
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    mapping_config = select_test_mapping(
        req.mapping_config if req is not None else None,
        req is not None and "mapping_config" in req.model_fields_set,
        connection.mapping_config,
    )

    return await _probe_mapped_connection(
        db_host=connection.db_host,
        db_port=connection.db_port,
        db_name=connection.db_name,
        db_user=connection.db_user,
        db_password=decrypt_password(connection.encrypted_password),
        mapping_config=mapping_config,
    )
