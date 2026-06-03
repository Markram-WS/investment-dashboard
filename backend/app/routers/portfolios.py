from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Portfolio, ActiveOrder, TradeHistory, TradePlan, OptionDetails, PortfolioNavHistory, SimulationModels, DecisionJournal, Transaction, OrdersGroup
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import date

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

class PortfolioResponse(BaseModel):
    portfolio_id: int
    portfolio_name: str
    port_type: str
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

    class Config:
        orm_mode = True


# Spread pair response model
class SpreadPairResponse(BaseModel):
    """Response model for spread pair data."""
    pair_id: str
    leg_a: Dict[str, Any]
    leg_b: Dict[str, Any]
    net_pl: Optional[float] = None
    spread_diff: Optional[float] = None
    zone: Optional[str] = None


class PortfolioSpreadsResponse(BaseModel):
    """Response model for portfolio spreads data."""
    portfolio_id: int
    portfolio_name: str
    port_type: str
    risk_status: str
    spread_pairs: List[SpreadPairResponse]
    unpaired_orders: List[Dict[str, Any]]


class PortfolioTypeResponse(BaseModel):
    """Response model for portfolio types endpoint."""
    type_name: str
    description: str
    logic: str


# Portfolio type definitions based on Detailed-Functional-Requirements.md Section 2.1
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
        type_name="Spread Strategy",
        description="Portfolio for 1:1 spread trading pairs",
        logic="Pair trades in 1:1 ratio and track spread values; excluded from rebalancing"
    ),
]


router = APIRouter()

@router.get("", tags=["portfolios"])
async def list_portfolios(db: AsyncSession = Depends(get_db)):
    """List all portfolios with their risk status."""
    result = await db.execute(select(Portfolio))
    portfolios = result.scalars().all()
    return [{"portfolio_id": p.portfolio_id, "portfolio_name": p.portfolio_name, "risk_status": p.risk_status, "available_cash": p.available_cash} for p in portfolios]

@router.post("/", tags=["portfolios"], status_code=status.HTTP_201_CREATED, response_model=PortfolioResponse)
async def create_portfolio(portfolio: PortfolioCreate, db: AsyncSession = Depends(get_db)):
    """Create a new portfolio."""
    db_portfolio = Portfolio(**portfolio.dict())
    db.add(db_portfolio)
    await db.commit()
    await db.refresh(db_portfolio)
    # Return response with current_allocations populated
    return {
        "portfolio_id": db_portfolio.portfolio_id,
        "portfolio_name": db_portfolio.portfolio_name,
        "port_type": db_portfolio.port_type,
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
    }

# Define /types BEFORE /{portfolio_id} to avoid route matching conflict
# FastAPI processes routes in definition order, so /types must come before /{portfolio_id}
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
    # current_allocations not stored in DB - use target_ratio as starting point
    response_data = {
        "portfolio_id": portfolio.portfolio_id,
        "portfolio_name": portfolio.portfolio_name,
        "port_type": portfolio.port_type,
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
    }
    return response_data


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


@router.delete("/{portfolio_id}", tags=["portfolios"])
async def delete_portfolio(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a portfolio by ID. Fails if active (non-closed) orders exist."""
    # Verify portfolio exists
    result = await db.execute(select(Portfolio).where(Portfolio.portfolio_id == portfolio_id))
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Cascade-delete all related records in FK-safe order
    await db.execute(
        DecisionJournal.__table__.delete().where(DecisionJournal.portfolio_id == portfolio_id)
    )

    await db.execute(
        TradeHistory.__table__.delete().where(TradeHistory.portfolio_id == portfolio_id)
    )

    # Break FK chain: active_orders → option_details before deleting orders
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

    await db.delete(portfolio)
    await db.commit()
    return {"detail": "Portfolio deleted"}


@router.get("/{portfolio_id}/spreads", tags=["portfolios"], response_model=PortfolioSpreadsResponse)
async def get_portfolio_spreads(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    """Get spread pairs and unpaired orders for a portfolio."""
    # Validate portfolio exists
    portfolio_result = await db.execute(select(Portfolio).where(Portfolio.portfolio_id == portfolio_id))
    portfolio = portfolio_result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Helper function to calculate zone based on spread price range
    def calculate_zone(spread_diff: Optional[float]) -> str:
        if spread_diff is None:
            return "Zone 1"
        # Zone thresholds based on spread difference
        if spread_diff < 5:
            return "Zone 1"
        elif spread_diff < 10:
            return "Zone 2"
        elif spread_diff < 20:
            return "Zone 3"
        else:
            return "Zone 4"

    # Get active orders for this portfolio
    active_orders_result = await db.execute(
        select(ActiveOrder)
        .where(ActiveOrder.portfolio_id == portfolio_id)
        .order_by(ActiveOrder.created_at.desc())
    )
    active_orders = active_orders_result.scalars().all()

    # Build order_id lookup for cross-link detection
    order_map = {o.order_id: o for o in active_orders}

    # Detect cross-linked spread pairs: A.linked_order_id == B.order_id AND B.linked_order_id == A.order_id
    spread_pair_legs = set()
    spread_pairs = []

    for a in active_orders:
        if a.linked_order_id and a.linked_order_id in order_map:
            b = order_map[a.linked_order_id]
            if b.linked_order_id == a.order_id:  # cross-linked
                pair_key = tuple(sorted([a.order_id, b.order_id]))
                if pair_key not in spread_pair_legs:
                    spread_pair_legs.add(pair_key)

                    leg_a_pl = 0.0
                    leg_b_pl = 0.0
                    for order in [a, b]:
                        tr = await db.execute(
                            select(TradeHistory).where(TradeHistory.order_id == order.order_id)
                        )
                        th = tr.scalar_one_or_none()
                        if th and th.realized_pl is not None:
                            if order == a:
                                leg_a_pl = th.realized_pl
                            else:
                                leg_b_pl = th.realized_pl

                    net_pl = float(leg_a_pl or 0) + float(leg_b_pl or 0)
                    spread_diff = None
                    if a.entry_price and b.entry_price:
                        spread_diff = b.entry_price - a.entry_price

                    zone = calculate_zone(spread_diff)

                    spread_pairs.append(SpreadPairResponse(
                        pair_id=a.linked_order_id,
                        leg_a={
                            "order_id": a.order_id,
                            "asset_type": a.asset_type,
                            "side": a.side,
                            "qty": a.qty,
                            "entry_price": a.entry_price,
                            "current_price": a.current_price,
                            "tp_price": a.tp_price,
                            "leverage": a.leverage,
                            "margin_rate": a.margin_rate,
                            "order_status": a.order_status,
                            "executed_by": a.executed_by,
                            "created_at": a.created_at.isoformat() if a.created_at else None,
                            "linked_order_id": a.linked_order_id,
                        },
                        leg_b={
                            "order_id": b.order_id,
                            "asset_type": b.asset_type,
                            "side": b.side,
                            "qty": b.qty,
                            "entry_price": b.entry_price,
                            "current_price": b.current_price,
                            "tp_price": b.tp_price,
                            "leverage": b.leverage,
                            "margin_rate": b.margin_rate,
                            "order_status": b.order_status,
                            "executed_by": b.executed_by,
                            "created_at": b.created_at.isoformat() if b.created_at else None,
                            "linked_order_id": b.linked_order_id,
                        },
                        net_pl=net_pl,
                        spread_diff=spread_diff,
                        zone=zone,
                    ))

    # Get unpaired orders (orders with one-way linked_order_id that aren't cross-linked)
    # Unpaired = orders with one-way linked_order_id (not cross-linked, not paired)
    paired_order_ids = set()
    for pair_key in spread_pair_legs:
        paired_order_ids.update(pair_key)
    for pair in spread_pairs:
        paired_order_ids.add(pair.leg_a["order_id"])
        paired_order_ids.add(pair.leg_b["order_id"])
    unpaired_orders = [
        {
            "order_id": order.order_id,
            "asset_type": order.asset_type,
            "side": order.side,
            "qty": order.qty,
            "entry_price": order.entry_price,
            "current_price": order.current_price,
            "tp_price": order.tp_price,
            "leverage": order.leverage,
            "margin_rate": order.margin_rate,
            "order_status": order.order_status,
            "executed_by": order.executed_by,
            "linked_order_id": order.linked_order_id,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }
        for order in active_orders
        if order.linked_order_id and order.order_id not in paired_order_ids
    ]

    return PortfolioSpreadsResponse(
        portfolio_id=portfolio.portfolio_id,
        portfolio_name=portfolio.portfolio_name,
        port_type=portfolio.port_type,
        risk_status=portfolio.risk_status,
        spread_pairs=spread_pairs,
        unpaired_orders=unpaired_orders,
    )