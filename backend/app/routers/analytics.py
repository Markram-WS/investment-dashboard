from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, resolve_portfolio_db
from app.models import Portfolio, ActiveOrder, TradePlan, AiActionLog, TradeHistory, AiAgent
from app.custom_models import CustomActiveOrder, CustomTransaction, CustomOrdersGroup
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
router = APIRouter()

# Alias endpoint for PortfolioAnalytics screen
@router.get("", tags=["analytics"])
async def get_analytics_portfolio_grid(
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """Alias for portfolio-grid endpoint - used by PortfolioAnalytics screen."""
    return await get_portfolio_grid_data(db, portfolio_id)

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
    risk_score: Optional[float] = None
    trade_plan_md: Optional[str] = None
    internal_notes: Optional[str] = None
    available_cash: Optional[float] = None
    money_market: Optional[float] = None
    margin_locked: Optional[float] = None
    cash_buffer_limit: Optional[float] = None
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

def _compute_risk_score(available_cash: Optional[float], margin_locked: Optional[float], cash_buffer_limit: Optional[float]) -> float:
    """Compute risk score (0-100) matching frontend logic."""
    ac = available_cash or 0
    ml = margin_locked or 0
    cbl = cash_buffer_limit or 0
    if ml <= 0 and cbl == 0:
        return 100.0
    if cbl != 0:
        if ac <= ml:
            return 0.0
        return min(100.0, ((ac - ml) / cbl) * 100)
    if ml <= 0:
        return 0.0
    return min(100.0, ((ac - ml) / ml) * 100)

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
async def get_portfolio_grid_data(
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """Get portfolio grid data for the analytics screen."""
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        # Get all portfolios with their related data
        portfolios_result = await db.execute(select(Portfolio))
        portfolios = portfolios_result.scalars().all()

        grid_data = []

        for portfolio in portfolios:
            # Determine if this portfolio should use custom session
            use_custom = is_custom and (portfolio_id is None or portfolio.portfolio_id == portfolio_id)
            query_session = session if use_custom else db
            OrderModel = CustomActiveOrder if use_custom else ActiveOrder
            HistoryModel = CustomTransaction if use_custom else TradeHistory

            # Get active orders for this portfolio
            active_orders_result = await query_session.execute(
                select(OrderModel)
                .where(OrderModel.portfolio_id == portfolio.portfolio_id)
                .order_by(OrderModel.created_at.desc())
            )
            active_orders = active_orders_result.scalars().all()

            # Get trade plan (always from main db)
            trade_plan_result = await db.execute(
                select(TradePlan)
                .where(TradePlan.portfolio_id == portfolio.portfolio_id)
                .order_by(TradePlan.created_at.desc())
                .limit(1)
            )
            trade_plan = trade_plan_result.scalar_one_or_none()

            # Get recent AI reasoning/logs (always from main db)
            ai_reasoning = None
            ai_risk_insight = None
            ai_log_result = await db.execute(
                select(AiActionLog)
                .join(AiActionLog.agent)
                .where(AiAgent.target_portfolio_id == portfolio.portfolio_id)
                .order_by(AiActionLog.created_at.desc())
                .limit(1)
            )
            ai_log = ai_log_result.scalar_one_or_none()
            if ai_log:
                ai_reasoning = ai_log.reasoning
                ai_risk_insight = "Risk metrics based on recent AI analysis" if ai_log.reasoning else None

            # Build order_id lookup for link detection
            order_map = {o.order_id: o for o in active_orders}

            # Detect cross-linked spread pairs
            spread_pair_legs = set()
            spread_pairs = []

            for a in active_orders:
                if a.linked_order_id and a.linked_order_id in order_map:
                    b = order_map[a.linked_order_id]
                    if b.linked_order_id == a.order_id:
                        pair_key = tuple(sorted([a.order_id, b.order_id]))
                        if pair_key not in spread_pair_legs:
                            spread_pair_legs.add(pair_key)

                            leg_a_pl = 0.0
                            leg_b_pl = 0.0
                            for order in [a, b]:
                                if use_custom:
                                    tr = await query_session.execute(
                                        select(HistoryModel).where(HistoryModel.reference_id == order.order_id)
                                    )
                                else:
                                    tr = await query_session.execute(
                                        select(HistoryModel).where(HistoryModel.order_id == order.order_id)
                                    )
                                th = tr.scalar_one_or_none()
                                if th is not None:
                                    pl_val = _to_float(getattr(th, 'realized_pl', None))
                                    if pl_val is not None:
                                        if order == a:
                                            leg_a_pl = pl_val
                                        else:
                                            leg_b_pl = pl_val

                            net_pl = float(leg_a_pl or 0) + float(leg_b_pl or 0)
                            spread_diff = None
                            if a.entry_price and b.entry_price:
                                spread_diff = float(b.entry_price or 0) - float(a.entry_price or 0)

                            def _serialize_leg(o):
                                return {
                                    "order_id": o.order_id,
                                    "asset_type": o.asset_type,
                                    "side": o.side,
                                    "qty": o.qty,
                                    "entry_price": o.entry_price,
                                    "current_price": o.current_price,
                                    "tp_price": o.tp_price,
                                    "leverage": o.leverage,
                                    "margin_rate": o.margin_rate,
                                    "order_status": o.order_status,
                                    "executed_by": o.executed_by,
                                    "created_at": o.created_at.isoformat() if o.created_at else None
                                }

                            spread_pairs.append(SpreadPair(
                                pair_id=a.linked_order_id,
                                leg_a=_serialize_leg(a),
                                leg_b=_serialize_leg(b),
                                net_pl=net_pl,
                                spread_diff=spread_diff,
                                zone="Active"
                            ))

            cross_linked_ids = set()
            for pair_key in spread_pair_legs:
                cross_linked_ids.update(pair_key)

            sub_order_targets = set()
            for o in active_orders:
                if o.linked_order_id and o.linked_order_id in order_map:
                    if order_map[o.linked_order_id].linked_order_id != o.order_id:
                        sub_order_targets.add(o.linked_order_id)

            def _link_type(o):
                if o.order_id in cross_linked_ids:
                    return "spread"
                if o.linked_order_id and o.linked_order_id in order_map:
                    target = order_map[o.linked_order_id]
                    if target.linked_order_id != o.order_id:
                        return "pending_close"
                if not o.linked_order_id and o.order_id in sub_order_targets:
                    return "primary"
                return "none"

            # Get recent trades (last 5)
            if use_custom:
                recent_trades_result = await query_session.execute(
                    select(HistoryModel)
                    .where(HistoryModel.source_portfolio_id == portfolio.portfolio_id)
                    .order_by(HistoryModel.created_at.desc())
                    .limit(5)
                )
            else:
                recent_trades_result = await query_session.execute(
                    select(HistoryModel)
                    .where(HistoryModel.portfolio_id == portfolio.portfolio_id)
                    .order_by(HistoryModel.created_at.desc())
                    .limit(5)
                )
            recent_trades = recent_trades_result.scalars().all()

            recent_trades_list = []
            for trade in recent_trades:
                recent_trades_list.append({
                    "history_id": getattr(trade, 'history_id', getattr(trade, 'transaction_id', None)),
                    "type": getattr(trade, 'type', getattr(trade, 'transaction_type', None)),
                    "asset": trade.asset,
                    "amount": _to_float(trade.amount),
                    "exit_price": _to_float(getattr(trade, 'exit_price', None)),
                    "realized_pl": _to_float(getattr(trade, 'realized_pl', None)),
                    "executed_by": trade.executed_by,
                    "decision_note": getattr(trade, 'decision_note', None),
                    "entry_date": trade.created_at.isoformat() if trade.created_at else None,
                    "exit_date": getattr(trade, 'exit_date', None) or (trade.updated_at.isoformat() if hasattr(trade, 'updated_at') and trade.updated_at else None)
                })

            # Build active orders list
            active_orders_list = []
            trade_plan_entry_zone = getattr(trade_plan, 'entry_zone', None) if trade_plan else None

            # Resolve group name for custom portfolios (no ORM relationship)
            if use_custom:
                groups_result = await query_session.execute(
                    select(CustomOrdersGroup).where(CustomOrdersGroup.portfolio_id == portfolio.portfolio_id)
                )
                group_map = {g.id: g.name for g in groups_result.scalars().all()}
            else:
                group_map = {}

            for order in active_orders:
                entry_price_val = _to_float(order.entry_price)
                exercise_price_val = _to_float(getattr(order.option, 'strike_price', None)) if hasattr(order, 'option') and order.option else None
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
                    "group_id": order.group_id,
                    "group_name": group_map.get(order.group_id) if use_custom else (order.group.name if hasattr(order, 'group') and order.group else None),
                    "linked_order_id": order.linked_order_id,
                    "contract_type": order.contract_type,
                    "direction": order.direction,
                    "option_type": order.option_type,
                    "expiry_date": order.expiry_date.isoformat() if order.expiry_date else None,
                    "strike_price": _to_float(order.strike_price),
                    "exercise_price": exercise_price_val,
                    "cost": _to_float(order.cost) if order.cost else 0,
                    "link_type": _link_type(order),
                    "created_at": order.created_at.isoformat() if order.created_at else None
                })

            grid_data.append(PortfolioGridData(
                portfolio_id=portfolio.portfolio_id,
                portfolio_name=portfolio.portfolio_name,
                port_type=portfolio.port_type,
                risk_status=portfolio.risk_status,
                risk_score=_compute_risk_score(
                    _to_float(portfolio.available_cash),
                    _to_float(portfolio.margin_locked),
                    _to_float(portfolio.cash_buffer_limit)
                ),
                trade_plan_md=portfolio.trade_plan_md or (trade_plan.entry_reason if trade_plan else None),
                internal_notes=portfolio.internal_notes,
                available_cash=_to_float(portfolio.available_cash),
                money_market=_to_float(portfolio.money_market),
                margin_locked=_to_float(portfolio.margin_locked),
                cash_buffer_limit=_to_float(portfolio.cash_buffer_limit),
                tags=portfolio.tags,
                ai_reasoning=ai_reasoning,
                ai_risk_insight=ai_risk_insight,
                spread_pairs=spread_pairs,
                active_orders=active_orders_list,
                recent_trades=recent_trades_list
            ))

        return grid_data
    finally:
        if is_custom:
            await session.close()


@router.get("/portfolio/{portfolio_id}", tags=["analytics"], response_model=PortfolioGridData)
async def get_portfolio_detail(
    portfolio_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed analytics for a single portfolio by ID."""
    portfolio_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    portfolio = portfolio_result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        OrderModel = CustomActiveOrder if is_custom else ActiveOrder
        HistoryModel = CustomTransaction if is_custom else TradeHistory

        # Get active orders
        if is_custom:
            active_orders_result = await session.execute(
                select(OrderModel)
                .where(OrderModel.portfolio_id == portfolio_id)
                .order_by(OrderModel.created_at.desc())
            )
        else:
            active_orders_result = await session.execute(
                select(OrderModel)
                .options(selectinload(ActiveOrder.group), selectinload(ActiveOrder.option))
                .where(OrderModel.portfolio_id == portfolio_id)
                .order_by(OrderModel.created_at.desc())
            )
        active_orders = active_orders_result.scalars().all()

        # Get trade plan (always main db)
        trade_plan_result = await db.execute(
            select(TradePlan)
            .where(TradePlan.portfolio_id == portfolio_id)
            .order_by(TradePlan.created_at.desc())
            .limit(1)
        )
        trade_plan = trade_plan_result.scalar_one_or_none()

        # AI logs
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

        order_map = {o.order_id: o for o in active_orders}
        spread_pair_legs = set()
        spread_pairs = []

        for a in active_orders:
            if a.linked_order_id and a.linked_order_id in order_map:
                b = order_map[a.linked_order_id]
                if b.linked_order_id == a.order_id:
                    pair_key = tuple(sorted([a.order_id, b.order_id]))
                    if pair_key not in spread_pair_legs:
                        spread_pair_legs.add(pair_key)

                        leg_a_pl = 0.0
                        leg_b_pl = 0.0
                        for order in [a, b]:
                            if is_custom:
                                tr = await session.execute(
                                    select(HistoryModel).where(HistoryModel.reference_id == order.order_id)
                                )
                            else:
                                tr = await db.execute(
                                    select(HistoryModel).where(HistoryModel.order_id == order.order_id)
                                )
                            th = tr.scalar_one_or_none()
                            if th is not None:
                                pl_val = _to_float(getattr(th, 'realized_pl', None))
                                if pl_val is not None:
                                    if order == a:
                                        leg_a_pl = pl_val
                                    else:
                                        leg_b_pl = pl_val

                        net_pl = leg_a_pl + leg_b_pl
                        spread_diff = None
                        if a.entry_price and b.entry_price:
                            spread_diff = _to_float(b.entry_price) - _to_float(a.entry_price)

                        spread_pairs.append(SpreadPair(
                            pair_id=a.linked_order_id,
                            leg_a={
                                "order_id": a.order_id,
                                "asset_type": a.asset_type,
                                "side": a.side,
                                "qty": a.qty,
                                "entry_price": _to_float(a.entry_price),
                                "current_price": _to_float(a.current_price),
                                "tp_price": _to_float(a.tp_price),
                                "leverage": a.leverage,
                                "margin_rate": a.margin_rate,
                                "order_status": a.order_status,
                                "executed_by": a.executed_by,
                                "created_at": a.created_at.isoformat() if a.created_at else None
                            },
                            leg_b={
                                "order_id": b.order_id,
                                "asset_type": b.asset_type,
                                "side": b.side,
                                "qty": b.qty,
                                "entry_price": _to_float(b.entry_price),
                                "current_price": _to_float(b.current_price),
                                "tp_price": _to_float(b.tp_price),
                                "leverage": b.leverage,
                                "margin_rate": b.margin_rate,
                                "order_status": b.order_status,
                                "executed_by": b.executed_by,
                                "created_at": b.created_at.isoformat() if b.created_at else None
                            },
                            net_pl=net_pl,
                            spread_diff=spread_diff
                        ))

        cross_linked_ids = set()
        for pair_key in spread_pair_legs:
            cross_linked_ids.update(pair_key)

        sub_order_targets = set()
        for o in active_orders:
            if o.linked_order_id and o.linked_order_id in order_map:
                if order_map[o.linked_order_id].linked_order_id != o.order_id:
                    sub_order_targets.add(o.linked_order_id)

        def _link_type(o):
            if o.order_id in cross_linked_ids:
                return "spread"
            if o.linked_order_id and o.linked_order_id in order_map:
                target = order_map[o.linked_order_id]
                if target.linked_order_id != o.order_id:
                    return "pending_close"
            if not o.linked_order_id and o.order_id in sub_order_targets:
                return "primary"
            return "none"

        # Recent trades
        if is_custom:
            recent_trades_result = await session.execute(
                select(HistoryModel)
                .where(HistoryModel.source_portfolio_id == portfolio_id)
                .order_by(HistoryModel.created_at.desc())
                .limit(5)
            )
        else:
            recent_trades_result = await db.execute(
                select(HistoryModel)
                .where(HistoryModel.portfolio_id == portfolio_id)
                .order_by(HistoryModel.created_at.desc())
                .limit(5)
            )
        recent_trades = recent_trades_result.scalars().all()

        recent_trades_list = []
        for trade in recent_trades:
            recent_trades_list.append({
                "history_id": getattr(trade, 'history_id', getattr(trade, 'transaction_id', None)),
                "type": getattr(trade, 'type', getattr(trade, 'transaction_type', None)),
                "asset": trade.asset,
                "amount": _to_float(trade.amount),
                "exit_price": _to_float(getattr(trade, 'exit_price', None)),
                "realized_pl": _to_float(getattr(trade, 'realized_pl', None)),
                "executed_by": trade.executed_by,
                "decision_note": getattr(trade, 'decision_note', None),
                "entry_date": trade.created_at.isoformat() if trade.created_at else None,
                "exit_date": getattr(trade, 'exit_date', None) or (trade.updated_at.isoformat() if hasattr(trade, 'updated_at') and trade.updated_at else None)
            })

        active_orders_list = []
        trade_plan_entry_zone = getattr(trade_plan, 'entry_zone', None) if trade_plan else None

        # Resolve group name for custom portfolios (no ORM relationship)
        if is_custom:
            groups_result = await session.execute(
                select(CustomOrdersGroup).where(CustomOrdersGroup.portfolio_id == portfolio_id)
            )
            group_map = {g.id: g.name for g in groups_result.scalars().all()}
        else:
            group_map = {}

        for order in active_orders:
            entry_price_val = _to_float(order.entry_price)
            exercise_price = _to_float(order.option.strike_price) if (not is_custom and order.option) else None
            group_name = group_map.get(order.group_id) if is_custom else (order.group.name if order.group else None)
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
                "group_id": order.group_id,
                "group_name": group_name,
                "linked_order_id": order.linked_order_id,
                "contract_type": order.contract_type,
                "direction": order.direction,
                "option_type": order.option_type,
                "expiry_date": order.expiry_date.isoformat() if order.expiry_date else None,
                "strike_price": _to_float(order.strike_price),
                "exercise_price": exercise_price,
                "cost": _to_float(order.cost) if order.cost else 0,
                "link_type": _link_type(order),
                "created_at": order.created_at.isoformat() if order.created_at else None
            })

        return PortfolioGridData(
            portfolio_id=portfolio.portfolio_id,
            portfolio_name=portfolio.portfolio_name,
            port_type=portfolio.port_type,
            risk_status=portfolio.risk_status,
            risk_score=_compute_risk_score(
                _to_float(portfolio.available_cash),
                _to_float(portfolio.margin_locked),
                _to_float(portfolio.cash_buffer_limit)
            ),
            trade_plan_md=portfolio.trade_plan_md or (trade_plan.entry_reason if trade_plan else None),
            internal_notes=portfolio.internal_notes,
            available_cash=_to_float(portfolio.available_cash),
            money_market=_to_float(portfolio.money_market),
            margin_locked=_to_float(portfolio.margin_locked),
            cash_buffer_limit=_to_float(portfolio.cash_buffer_limit),
            tags=portfolio.tags,
            ai_reasoning=ai_reasoning,
            ai_risk_insight=ai_risk_insight,
            spread_pairs=spread_pairs,
            active_orders=active_orders_list,
            recent_trades=recent_trades_list
        )
    finally:
        if is_custom:
            await session.close()