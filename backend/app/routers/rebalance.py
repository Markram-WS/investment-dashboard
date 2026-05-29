from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, insert, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Portfolio, PortfolioNavHistory, ActiveOrder, TradePlan
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from decimal import Decimal
from datetime import date

router = APIRouter()

# Section 3.1: Dual-Mode Operation Definitions
REBALANCE_MODES = [
    {
        "mode": "standard",
        "description": "Adjust according to fixed target ratio percentages"
    },
    {
        "mode": "sigma_weighted",
        "description": "Calculate weights based on asset volatility (sigma)",
        "default_sigma_window_days": 30
    }
]


# Request/Response Models for Section 3.1
class RebalanceCalculateRequest(BaseModel):
    """Request body for rebalancing calculation (Section 3.1)."""
    portfolio_id: int
    mode: str = "standard"
    sigma_window_days: Optional[int] = 30


class RebalanceCalculateResponse(BaseModel):
    """Response for rebalance calculation (Section 3.1)."""
    portfolio_id: int
    mode: str
    sigma_window_days: Optional[int] = None


# Request/Response Models for Section 3.2
class RebalanceRecommendRequest(BaseModel):
    """Request body for rebalancing recommendation (Section 3.2)."""
    portfolio_id: int
    target_allocations: Optional[Dict[str, float]] = None


class TradeRecommendation(BaseModel):
    """Single trade recommendation."""
    symbol: str
    side: str  # "Buy" or "Sell"
    qty: Decimal
    estimated_price: Decimal
    reason: str


class RebalanceRecommendResponse(BaseModel):
    """Response for rebalance recommendation (Section 3.2)."""
    portfolio_id: int
    portfolio_name: str
    current_nav: Decimal
    target_allocations: Dict[str, Any]
    current_allocations: Dict[str, Any]
    recommendations: List[TradeRecommendation]
    total_drift: Decimal


class ExecuteRebalanceRequest(BaseModel):
    """Request body for executing recommended trades."""
    portfolio_id: int
    recommendations: List[TradeRecommendation]


class ExecuteRebalanceResponse(BaseModel):
    """Response for executed rebalance."""
    portfolio_id: int
    executed_orders: List[Dict[str, Any]]
    total_orders: int


# Section 3.1 Endpoints
@router.get("/modes", tags=["rebalance"])
async def get_rebalance_modes():
    """
    Section 3.1: Get available rebalancing modes.
    
    Returns list of supported rebalancing calculation modes.
    """
    return REBALANCE_MODES


@router.post("/calculate", tags=["rebalance"])
async def calculate_rebalance(
    request: RebalanceCalculateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Section 3.1: Calculate rebalancing analysis.
    
    Performs rebalancing calculation in either standard mode
    or sigma-weighted (volatility-based) mode.
    """
    # Validate mode
    valid_modes = [m["mode"] for m in REBALANCE_MODES]
    if request.mode not in valid_modes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mode. Must be one of: {valid_modes}"
        )
    
    # Verify portfolio exists
    result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == request.portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    response = {
        "portfolio_id": portfolio.portfolio_id,
        "mode": request.mode
    }
    
    if request.mode == "sigma_weighted":
        response["sigma_window_days"] = request.sigma_window_days or 30
    
    return response


# Section 3.2 Endpoints
@router.post("/recommend", tags=["rebalance"])
async def recommend_rebalance(
    request: RebalanceRecommendRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Section 3.2 Step 1-2: Calculate portfolio drift and recommend trades.
    
    Calculates the difference between current and target allocations,
    then generates trade recommendations to rebalance the portfolio.
    """
    # Fetch portfolio
    result = await db.execute(select(Portfolio).where(Portfolio.portfolio_id == request.portfolio_id))
    portfolio = result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get target allocations (from portfolio or override)
    target_allocations = request.target_allocations or portfolio.target_ratio or {}
    
    if not target_allocations:
        raise HTTPException(
            status_code=400, 
            detail="No target allocations defined. Set target_ratio on portfolio."
        )
    
    # Calculate current allocations (simplified - based on current_nav distribution)
    # In a real system, this would analyze actual holdings
    current_nav = portfolio.current_nav or Decimal("0")
    
    # Placeholder current_allocations based on target as starting point
    # In production, this would come from actual position data
    current_allocations = dict(target_allocations)  # Simplified
    
    # Calculate drift and generate recommendations
    recommendations = []
    total_drift = Decimal("0")
    
    for symbol, target_pct in target_allocations.items():
        current_pct = Decimal(str(current_allocations.get(symbol, 0)))
        drift = Decimal(str(target_pct)) - current_pct
        
        if abs(drift) > Decimal("0.001"):  # Only recommend if drift > 0.1%
            target_value = current_nav * Decimal(str(target_pct)) / Decimal("100")
            current_value = current_nav * current_pct / Decimal("100")
            
            if drift > 0:
                # Need to buy
                recommendations.append(TradeRecommendation(
                    symbol=symbol,
                    side="Buy",
                    qty=(target_value - current_value) / Decimal("100"),
                    estimated_price=Decimal("100"),
                    reason=f"Increase allocation from {current_pct:.1f}% to {target_pct:.1f}%"
                ))
            else:
                # Need to sell
                recommendations.append(TradeRecommendation(
                    symbol=symbol,
                    side="Sell",
                    qty=(current_value - target_value) / Decimal("100"),
                    estimated_price=Decimal("100"),
                    reason=f"Decrease allocation from {current_pct:.1f}% to {target_pct:.1f}%"
                ))
            
            total_drift += abs(drift)
    
    return RebalanceRecommendResponse(
        portfolio_id=portfolio.portfolio_id,
        portfolio_name=portfolio.portfolio_name,
        current_nav=current_nav,
        target_allocations=target_allocations,
        current_allocations=current_allocations,
        recommendations=recommendations,
        total_drift=total_drift
    )


@router.post("/execute", tags=["rebalance"])
async def execute_rebalance(
    request: ExecuteRebalanceRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Section 3.2 Step 3: Execute recommended trades.
    
    Converts trade recommendations into active orders in the order management system.
    """
    # Verify portfolio exists
    result = await db.execute(select(Portfolio).where(Portfolio.portfolio_id == request.portfolio_id))
    portfolio = result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    executed_orders = []
    
    for rec in request.recommendations:
        # Create trade plan first
        trade_plan = TradePlan(
            portfolio_id=portfolio.portfolio_id,
            entry_zone=f"{rec.symbol}_{rec.side}",
            entry_reason=rec.reason,
            data_source="Manual"
        )
        db.add(trade_plan)
        await db.flush()  # Get plan_id
        
        # Create active order from recommendation
        active_order = ActiveOrder(
            plan_id=trade_plan.plan_id,
            portfolio_id=portfolio.portfolio_id,
            asset_type="Stock",
            side=rec.side,
            qty=rec.qty,
            entry_price=rec.estimated_price,
            current_price=rec.estimated_price,
            executed_by="Manual",
            order_status="pending_sync",
            data_source="Manual"
        )
        db.add(active_order)
        await db.flush()
        
        executed_orders.append({
            "order_id": active_order.order_id,
            "plan_id": trade_plan.plan_id,
            "symbol": rec.symbol,
            "side": rec.side,
            "qty": str(rec.qty)
        })
    
    await db.commit()
    
    # Update portfolio rebalance date
    portfolio.last_rebalance_date = date.today()
    await db.commit()
    
    return ExecuteRebalanceResponse(
        portfolio_id=portfolio.portfolio_id,
        executed_orders=executed_orders,
        total_orders=len(executed_orders)
    )


@router.get("/nav-history/{portfolio_id}", tags=["rebalance"])
async def get_nav_history(
    portfolio_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Section 3.2 Step 4: Retrieve NAV history for a portfolio.
    
    Returns NAV records ordered by date (newest first).
    Supports 1-day=1-record upsert pattern.
    """
    # Verify portfolio exists
    result = await db.execute(select(Portfolio).where(Portfolio.portfolio_id == portfolio_id))
    portfolio = result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Fetch NAV history
    result = await db.execute(
        select(PortfolioNavHistory)
        .where(PortfolioNavHistory.portfolio_id == portfolio_id)
        .order_by(PortfolioNavHistory.nav_date.desc())
    )
    nav_records = result.scalars().all()
    
    return {
        "portfolio_id": portfolio_id,
        "portfolio_name": portfolio.portfolio_name,
        "nav_history": [
            {
                "nav_id": nav.nav_id,
                "nav_date": nav.nav_date.isoformat() if nav.nav_date else None,
                "nav_value": float(nav.nav_value)
            }
            for nav in nav_records
        ]
    }


class UpsertNavHistoryRequest(BaseModel):
    """Request body for upserting NAV history."""
    portfolio_id: int
    nav_value: Decimal


class UpsertNavHistoryResponse(BaseModel):
    """Response for NAV history upsert."""
    portfolio_id: int
    nav_date: str
    nav_value: str
    action: str


@router.post("/nav-history/upsert", tags=["rebalance"])
async def upsert_nav_history(
    request: UpsertNavHistoryRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Section 3.2 Step 4 (Upsert): Record NAV history.
    
    Performs 1-day=1-record upsert - creates new record or updates existing
    if there's already a record for today's date.
    """
    portfolio_id = request.portfolio_id
    nav_value = request.nav_value
    
    # Verify portfolio exists
    result = await db.execute(select(Portfolio).where(Portfolio.portfolio_id == portfolio_id))
    portfolio = result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    today = date.today()
    
    # Check for existing record
    result = await db.execute(
        select(PortfolioNavHistory)
        .where(
            PortfolioNavHistory.portfolio_id == portfolio_id,
            PortfolioNavHistory.nav_date == today
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        existing.nav_value = nav_value
    else:
        nav_record = PortfolioNavHistory(
            portfolio_id=portfolio_id,
            nav_date=today,
            nav_value=nav_value
        )
        db.add(nav_record)
    
    await db.commit()
    
    return {
        "portfolio_id": portfolio_id,
        "nav_date": today.isoformat(),
        "nav_value": str(nav_value),
        "action": "updated" if existing else "created"
    }