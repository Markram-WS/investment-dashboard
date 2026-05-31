from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Portfolio, ActiveOrder, TradePlan, AiActionLog, TradeHistory, AiAgent
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
router = APIRouter()

# Alias endpoint for PortfolioAnalytics screen
@router.get("", tags=["analytics"])
async def get_analytics_portfolio_grid(db: AsyncSession = Depends(get_db)):
    """Alias for portfolio-grid endpoint - used by PortfolioAnalytics screen."""
    return await get_portfolio_grid_data(db)

# Existing overview endpoint (unchanged)
@router.get("/overview", tags=["analytics"])
async def get_overview_data(db: AsyncSession = Depends(get_db)):
    """Get overview data for the dashboard homepage."""
    # Get all portfolios
    result = await db.execute(select(Portfolio))
    portfolios = result.scalars().all()

    # Calculate global sums
    total_margin = sum(p.margin_locked or 0 for p in portfolios)
    total_buffer = sum(p.cash_buffer_limit or 0 for p in portfolios)
    total_available_cash = sum(p.available_cash or 0 for p in portfolios)
    total_money_market = sum(p.money_market or 0 for p in portfolios)

    total_cash = total_available_cash + total_money_market

    # Global risk alert: show when (Total Margin + Total Buffer) / Total Cash > 85%
    global_risk_alert_show = False
    global_risk_alert_message = ""
    if total_cash > 0:
        ratio = (total_margin + total_buffer) / total_cash
        if ratio > 0.85:
            global_risk_alert_show = True
            global_risk_alert_message = f"Global risk alert: (Margin+Buffer)/TotalCash = {ratio:.0%} > 85%"

    # Pool Health Index (placeholder - in reality would be calculated from strategy alignment and risk)
    # For now, we'll compute a simple heuristic based on portfolio risk distribution
    safe_count = sum(1 for p in portfolios if p.risk_status == "Safe")
    warning_count = sum(1 for p in portfolios if p.risk_status == "Warning")
    danger_count = sum(1 for p in portfolios if p.risk_status == "Danger")
    total_portfolios = len(portfolios)
    if total_portfolios > 0:
        # Simple index: 100 * (safe_count + 0.5*warning_count) / total_portfolios
        pool_health_index = (safe_count + 0.5 * warning_count) / total_portfolios * 100
    else:
        pool_health_index = 0

    # Money Reserve Status
    # Danger: Global Cash < (Total Margin + Total Buffer) * 120%
    # Optimal: Global Cash between 120% - 200% of (Total Margin + Total Buffer)
    # Inefficient: Global Cash > (Total Margin + Total Buffer) * 200%
    money_reserve_status = "Optimal"
    money_reserve_percentage = 0
    if (total_margin + total_buffer) > 0:
        money_reserve_percentage = (total_cash / (total_margin + total_buffer)) * 100
        if money_reserve_percentage < 120:
            money_reserve_status = "Danger"
        elif money_reserve_percentage > 200:
            money_reserve_status = "Inefficient"
        else:
            money_reserve_status = "Optimal"

    # Portfolio list for cards
    portfolio_list = []
    for p in portfolios:
        portfolio_list.append({
            "portfolio_id": p.portfolio_id,
            "portfolio_name": p.portfolio_name,
            "port_type": p.port_type,
            "margin_locked": p.margin_locked,
            "cash_buffer_limit": p.cash_buffer_limit,
            "available_cash": p.available_cash,
            "money_market": p.money_market,
            "risk_status": p.risk_status,
            "trade_plan_md": p.trade_plan_md
        })

    return {
        "global_cash_breakdown": {
            "margin": total_margin,
            "buffer": total_buffer,
            "available_cash": total_available_cash,
            "money_market": total_money_market
        },
        "global_risk_alert": {
            "show": global_risk_alert_show,
            "message": global_risk_alert_message
        },
        "pool_health_index": round(pool_health_index, 1),
        "money_reserve_status": {
            "status": money_reserve_status,
            "percentage": round(money_reserve_percentage, 1)
        },
        "portfolios": portfolio_list
    }


# New portfolio grid endpoint
class SpreadPair(BaseModel):
    """Model for a spread pair (two linked orders)"""
    pair_id: str
    leg_a: Dict[str, Any]
    leg_b: Dict[str, Any]
    net_pl: Optional[float] = None
    spread_diff: Optional[float] = None
    zone: Optional[str] = None

class PortfolioGridData(BaseModel):
    """Model for portfolio grid data"""
    portfolio_id: int
    portfolio_name: str
    port_type: str
    risk_status: str
    trade_plan_md: Optional[str] = None
    internal_notes: Optional[str] = None
    available_cash: Optional[float] = None
    money_market: Optional[float] = None
    tags: Optional[Dict[str, Any]] = None
    ai_reasoning: Optional[str] = None
    ai_risk_insight: Optional[str] = None
    spread_pairs: List[SpreadPair] = []
    active_orders: List[Dict[str, Any]] = []
    recent_trades: List[Dict[str, Any]] = []

def _to_float(val):
    """Convert Decimal/None to float for JSON serialization."""
    if val is None:
        return None
    return float(str(val))

def _calculate_zone(entry_price: float, entry_zone: Optional[str]) -> str:
    """Calculate zone (ZONE A / ZONE B) based on entry_price vs trade_plan entry_zone.
    
    Args:
        entry_price: The price at which the order was placed
        entry_zone: Trade plan entry zone (e.g., "BTC: 95000-98000, ETH: 3500-3700")
    
    Returns:
        Zone label (ZONE A, ZONE B, etc.)
    """
    if not entry_zone or entry_price is None:
        return "ZONE A"  # Default
    
    try:
        # Parse entry_zone format: "BTC: 95000-98000, ETH: 3500-3700"
        # For Grid type, determine zone based on which price range it falls into
        # Simplified: if we have one zone defined, everything is ZONE A
        # If we want multiple zones, we'd need to extend this logic
        return "ZONE A"
    except Exception:
        return "ZONE A"

@router.get("/portfolio-grid", tags=["analytics"], response_model=List[PortfolioGridData])
async def get_portfolio_grid_data(db: AsyncSession = Depends(get_db)):
    """Get portfolio grid data for the analytics screen."""
    # Get all portfolios with their related data
    portfolios_result = await db.execute(select(Portfolio))
    portfolios = portfolios_result.scalars().all()
    
    grid_data = []
    
    for portfolio in portfolios:
        # Get active orders for this portfolio
        active_orders_result = await db.execute(
            select(ActiveOrder)
            .where(ActiveOrder.portfolio_id == portfolio.portfolio_id)
            .order_by(ActiveOrder.created_at.desc())
        )
        active_orders = active_orders_result.scalars().all()
        
        # Get trade plan
        trade_plan_result = await db.execute(
            select(TradePlan)
            .where(TradePlan.portfolio_id == portfolio.portfolio_id)
            .order_by(TradePlan.created_at.desc())
            .limit(1)
        )
        trade_plan = trade_plan_result.scalar_one_or_none()
        
        # Get recent AI reasoning/logs (for AI portfolios or as placeholder)
        ai_reasoning = None
        ai_risk_insight = None
        # Try to get latest AI action log for this portfolio
        ai_log_result = await db.execute(
            select(AiActionLog)
            .join(AiActionLog.agent)  # Join with AiAgent to get target_portfolio_id
            .where(AiAgent.target_portfolio_id == portfolio.portfolio_id)
            .order_by(AiActionLog.created_at.desc())
            .limit(1)
        )
        ai_log = ai_log_result.scalar_one_or_none()
        if ai_log:
            ai_reasoning = ai_log.reasoning
            # Extract risk insight from reasoning or use a placeholder
            ai_risk_insight = "Risk metrics based on recent AI analysis" if ai_log.reasoning else None
        
        # Get spread pairs (orders with spread_pair_id set)
        spread_orders = [order for order in active_orders if order.spread_pair_id]
        spread_pairs_dict = {}
        
        # Group orders by spread_pair_id
        for order in spread_orders:
            if order.spread_pair_id not in spread_pairs_dict:
                spread_pairs_dict[order.spread_pair_id] = []
            spread_pairs_dict[order.spread_pair_id].append(order)
        
        # Create spread pairs (expecting pairs of orders)
        spread_pairs = []
        for pair_id, orders in spread_pairs_dict.items():
            if len(orders) >= 2:
                # Take first two orders as the pair
                leg_a = orders[0]
                leg_b = orders[1]
                
                # Calculate net P/L for the spread (simplified)
                leg_a_pl = 0.0
                leg_b_pl = 0.0
                
                # Get realized P/L from trade history if available
                for order in [leg_a, leg_b]:
                    trade_history_result = await db.execute(
                        select(TradeHistory).where(TradeHistory.order_id == order.order_id)
                    )
                    trade_history = trade_history_result.scalar_one_or_none()
                    if trade_history and trade_history.realized_pl is not None:
                        pl_value = _to_float(trade_history.realized_pl)
                        if order == leg_a:
                            leg_a_pl = pl_value
                        else:
                            leg_b_pl = pl_value
                
                net_pl = float(leg_a_pl or 0) + float(leg_b_pl or 0)
                
                # Calculate spread difference (simplified)
                spread_diff = None
                if leg_a.entry_price and leg_b.entry_price:
                    spread_diff = float(leg_b.entry_price or 0) - float(leg_a.entry_price or 0)
                
                spread_pairs.append(SpreadPair(
                    pair_id=pair_id,
                    leg_a={
                        "order_id": leg_a.order_id,
                        "asset_type": leg_a.asset_type,
                        "side": leg_a.side,
                        "qty": leg_a.qty,
                        "entry_price": leg_a.entry_price,
                        "current_price": leg_a.current_price,
                        "tp_price": leg_a.tp_price,
                        "leverage": leg_a.leverage,
                        "margin_rate": leg_a.margin_rate,
                        "order_status": leg_a.order_status,
                        "executed_by": leg_a.executed_by,
                        "created_at": leg_a.created_at.isoformat() if leg_a.created_at else None
                    },
                    leg_b={
                        "order_id": leg_b.order_id,
                        "asset_type": leg_b.asset_type,
                        "side": leg_b.side,
                        "qty": leg_b.qty,
                        "entry_price": leg_b.entry_price,
                        "current_price": leg_b.current_price,
                        "tp_price": leg_b.tp_price,
                        "leverage": leg_b.leverage,
                        "margin_rate": leg_b.margin_rate,
                        "order_status": leg_b.order_status,
                        "executed_by": leg_b.executed_by,
                        "created_at": leg_b.created_at.isoformat() if leg_b.created_at else None
                    },
                    net_pl=net_pl,
                    spread_diff=spread_diff,
                    zone="Active"  # Default zone based on order status
                ))
        
        # Get recent trades (last 5)
        recent_trades_result = await db.execute(
            select(TradeHistory)
            .where(TradeHistory.portfolio_id == portfolio.portfolio_id)
            .order_by(TradeHistory.created_at.desc())
            .limit(5)
        )
        recent_trades = recent_trades_result.scalars().all()
        
        recent_trades_list = []
        for trade in recent_trades:
            recent_trades_list.append({
                "history_id": trade.history_id,
                "type": trade.type,
                "asset": trade.asset,
                "amount": _to_float(trade.amount),
                "exit_price": _to_float(trade.exit_price),
                "realized_pl": _to_float(trade.realized_pl),
                "executed_by": trade.executed_by,
                "decision_note": trade.decision_note,
                "entry_date": trade.entry_date.isoformat() if trade.entry_date else None,
                "exit_date": trade.exit_date.isoformat() if trade.exit_date else None
            })
        
        # Build active orders list (excluding spread legs to avoid duplication)
        active_orders_list = []
        spread_order_ids = {order.order_id for order in spread_orders}
        
        # Get entry_zone from trade plan for zone calculation
        trade_plan_entry_zone = getattr(trade_plan, 'entry_zone', None) if trade_plan else None
        
        for order in active_orders:
            if order.order_id not in spread_order_ids:
                # Calculate zone based on trade plan entry_zone
                entry_price_val = _to_float(order.entry_price)
                order_zone = order.zone or _calculate_zone(
                    entry_price_val if entry_price_val is not None else 0.0, 
                    trade_plan_entry_zone if trade_plan_entry_zone else None
                )
                active_orders_list.append({
                    "order_id": order.order_id,
                    "plan_id": order.plan_id,
                    "asset_type": order.asset_type,
                    "side": order.side,
                    "qty": order.qty,
                    "entry_price": entry_price_val,
                    "current_price": _to_float(order.current_price),
                    "tp_price": _to_float(order.tp_price),
                    "sl_price": _to_float(order.sl_price),
                    "leverage": order.leverage,
                    "margin_rate": order.margin_rate,
                    "order_status": order.order_status,
                    "executed_by": order.executed_by,
                    "grid_group_id": order.grid_group_id,
                    "zone": order_zone,
                    "spread_pair_id": order.spread_pair_id,
                    "created_at": order.created_at.isoformat() if order.created_at else None
                })
        
        grid_data.append(PortfolioGridData(
            portfolio_id=portfolio.portfolio_id,
            portfolio_name=portfolio.portfolio_name,
            port_type=portfolio.port_type,
            risk_status=portfolio.risk_status,
            trade_plan_md=portfolio.trade_plan_md or (trade_plan.entry_reason if trade_plan else None),
            internal_notes=portfolio.internal_notes,
            available_cash=_to_float(portfolio.available_cash),
            money_market=_to_float(portfolio.money_market),
            tags=portfolio.tags,
            ai_reasoning=ai_reasoning,
            ai_risk_insight=ai_risk_insight,
            spread_pairs=spread_pairs,
            active_orders=active_orders_list,
            recent_trades=recent_trades_list
        ))
    
    return grid_data


@router.get("/portfolio/{portfolio_id}", tags=["analytics"], response_model=PortfolioGridData)
async def get_portfolio_detail(
    portfolio_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed analytics for a single portfolio by ID."""
    # Validate portfolio exists
    portfolio_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    portfolio = portfolio_result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get active orders for this portfolio
    active_orders_result = await db.execute(
        select(ActiveOrder)
        .where(ActiveOrder.portfolio_id == portfolio_id)
        .order_by(ActiveOrder.created_at.desc())
    )
    active_orders = active_orders_result.scalars().all()
    
    # Get trade plan
    trade_plan_result = await db.execute(
        select(TradePlan)
        .where(TradePlan.portfolio_id == portfolio_id)
        .order_by(TradePlan.created_at.desc())
        .limit(1)
    )
    trade_plan = trade_plan_result.scalar_one_or_none()
    
    # Get AI reasoning/logs
    ai_reasoning = None
    ai_risk_insight = None
    ai_log_result = await db.execute(
        select(AiActionLog)
        .join(AiActionLog.agent)
        .where(AiAgent.target_portfolio_id == portfolio_id)
        .order_by(AiActionLog.created_at.desc())
        .limit(1)
    )
    ai_log = ai_log_result.scalar_one_or_none()
    if ai_log:
        ai_reasoning = ai_log.reasoning
        ai_risk_insight = "Risk metrics based on recent AI analysis" if ai_log.reasoning else None
    
    # Get spread pairs
    spread_orders = [order for order in active_orders if order.spread_pair_id]
    spread_pairs_dict = {}
    for order in spread_orders:
        if order.spread_pair_id not in spread_pairs_dict:
            spread_pairs_dict[order.spread_pair_id] = []
        spread_pairs_dict[order.spread_pair_id].append(order)
    
    spread_pairs = []
    for pair_id, orders in spread_pairs_dict.items():
        if len(orders) >= 2:
            leg_a = orders[0]
            leg_b = orders[1]
            
            leg_a_pl = 0.0
            leg_b_pl = 0.0
            
            for order in [leg_a, leg_b]:
                trade_history_result = await db.execute(
                    select(TradeHistory).where(TradeHistory.order_id == order.order_id)
                )
                trade_history = trade_history_result.scalar_one_or_none()
                if trade_history and trade_history.realized_pl is not None:
                    pl_value = _to_float(trade_history.realized_pl)
                    if order == leg_a:
                        leg_a_pl = pl_value
                    else:
                        leg_b_pl = pl_value
            
            net_pl = leg_a_pl + leg_b_pl
            spread_diff = None
            if leg_a.entry_price and leg_b.entry_price:
                spread_diff = _to_float(leg_b.entry_price) - _to_float(leg_a.entry_price)
            
            spread_pairs.append(SpreadPair(
                pair_id=pair_id,
                leg_a={
                    "order_id": leg_a.order_id,
                    "asset_type": leg_a.asset_type,
                    "side": leg_a.side,
                    "qty": leg_a.qty,
                    "entry_price": _to_float(leg_a.entry_price),
                    "current_price": _to_float(leg_a.current_price),
                    "tp_price": _to_float(leg_a.tp_price),
                    "leverage": leg_a.leverage,
                    "margin_rate": leg_a.margin_rate,
                    "order_status": leg_a.order_status,
                    "executed_by": leg_a.executed_by,
                    "created_at": leg_a.created_at.isoformat() if leg_a.created_at else None
                },
                leg_b={
                    "order_id": leg_b.order_id,
                    "asset_type": leg_b.asset_type,
                    "side": leg_b.side,
                    "qty": leg_b.qty,
                    "entry_price": _to_float(leg_b.entry_price),
                    "current_price": _to_float(leg_b.current_price),
                    "tp_price": _to_float(leg_b.tp_price),
                    "leverage": leg_b.leverage,
                    "margin_rate": leg_b.margin_rate,
                    "order_status": leg_b.order_status,
                    "executed_by": leg_b.executed_by,
                    "created_at": leg_b.created_at.isoformat() if leg_b.created_at else None
                },
                net_pl=net_pl,
                spread_diff=spread_diff
            ))
    
    # Get recent trades
    recent_trades_result = await db.execute(
        select(TradeHistory)
        .where(TradeHistory.portfolio_id == portfolio_id)
        .order_by(TradeHistory.created_at.desc())
        .limit(5)
    )
    recent_trades = recent_trades_result.scalars().all()
    
    recent_trades_list = []
    for trade in recent_trades:
        recent_trades_list.append({
            "history_id": trade.history_id,
            "type": trade.type,
            "asset": trade.asset,
            "amount": _to_float(trade.amount),
            "exit_price": _to_float(trade.exit_price),
            "realized_pl": _to_float(trade.realized_pl),
            "executed_by": trade.executed_by,
            "decision_note": trade.decision_note,
            "entry_date": trade.entry_date.isoformat() if trade.entry_date else None,
            "exit_date": trade.exit_date.isoformat() if trade.exit_date else None
        })
    
    # Build active orders list
    active_orders_list = []
    spread_order_ids = {order.order_id for order in spread_orders}
    
    trade_plan_entry_zone = getattr(trade_plan, 'entry_zone', None) if trade_plan else None
    
    for order in active_orders:
        if order.order_id not in spread_order_ids:
            # Calculate zone based on trade plan entry_zone
            entry_price_float = _to_float(order.entry_price)
            order_zone = order.zone or _calculate_zone(
                entry_price_float if entry_price_float is not None else 0.0, 
                trade_plan_entry_zone if trade_plan_entry_zone else None
            )
            active_orders_list.append({
                "order_id": order.order_id,
                "plan_id": order.plan_id,
                "asset_type": order.asset_type,
                "side": order.side,
                "qty": order.qty,
                "entry_price": entry_price_float,
                "current_price": _to_float(order.current_price),
                "tp_price": _to_float(order.tp_price),
                "sl_price": _to_float(order.sl_price),
                "leverage": order.leverage,
                "margin_rate": order.margin_rate,
                "order_status": order.order_status,
                "executed_by": order.executed_by,
                "grid_group_id": order.grid_group_id,
                "zone": order_zone,
                "spread_pair_id": order.spread_pair_id,
                "created_at": order.created_at.isoformat() if order.created_at else None
            })
    
    return PortfolioGridData(
        portfolio_id=portfolio.portfolio_id,
        portfolio_name=portfolio.portfolio_name,
        port_type=portfolio.port_type,
        risk_status=portfolio.risk_status,
        trade_plan_md=portfolio.trade_plan_md or (trade_plan.entry_reason if trade_plan else None),
        internal_notes=portfolio.internal_notes,
        available_cash=_to_float(portfolio.available_cash),
        money_market=_to_float(portfolio.money_market),
        tags=portfolio.tags,
        ai_reasoning=ai_reasoning,
        ai_risk_insight=ai_risk_insight,
        spread_pairs=spread_pairs,
        active_orders=active_orders_list,
        recent_trades=recent_trades_list
    )