from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, resolve_portfolio_db, get_or_create_custom_engine
from app.models import (
    Portfolio, Broker, ActiveOrder, TradePlan, AiActionLog, TradeHistory,
    AiAgent, CustomPortfolioConnection,
)
from app.custom_models import CustomActiveOrder, CustomTransaction, CustomOrdersGroup
from app.custom_mapping import (
    fetch_mapped_account, fetch_mapped_history, fetch_mapped_orders,
)
from app.risk_calc import compute_margin_locked, compute_risk
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from types import SimpleNamespace
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
    margin_by_portfolio = {
        p.portfolio_id: await compute_margin_locked(db, p) for p in portfolios
    }
    total_margin = sum(margin_by_portfolio.values())
    total_buffer = sum(p.cash_buffer_limit or 0 for p in portfolios)
    total_available_cash = sum(p.available_cash or 0 for p in portfolios)

    global_cash = total_available_cash

    # Global risk alert: show when (Total Margin + Total Buffer) / Total Cash > 85%
    global_risk_alert_show = False
    global_risk_alert_message = ""
    if global_cash > 0:
        ratio = (total_margin + total_buffer) / global_cash
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
        money_reserve_percentage = (global_cash / (total_margin + total_buffer)) * 100
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
            "margin_locked": margin_by_portfolio[p.portfolio_id],
            "cash_buffer_limit": p.cash_buffer_limit,
            "available_cash": p.available_cash,
            "risk_status": p.risk_status,
            "trade_plan_md": p.trade_plan_md
        })

    return {
        "global_cash_breakdown": {
            "margin": total_margin,
            "buffer": total_buffer,
            "available_cash": total_available_cash
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
    margin_locked: Optional[float] = None
    cash_buffer_limit: Optional[float] = None
    broker_id: Optional[int] = None
    broker_code: Optional[str] = None
    product_ticker: Optional[str] = None
    x_amount: float = 0
    initial_capital: float = 0
    tags: Optional[Dict[str, Any]] = None
    ai_reasoning: Optional[str] = None
    ai_risk_insight: Optional[str] = None
    spread_pairs: List[SpreadPair] = []
    active_orders: List[Dict[str, Any]] = []
    recent_trades: List[Dict[str, Any]] = []
    risk: Optional[dict] = None
    read_only: bool = False
    mapping_template: Optional[str] = None

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


async def _get_mapped_connection(db: AsyncSession, portfolio: Portfolio):
    """The connection when this custom portfolio is mapped, else None."""
    if not portfolio.is_custom:
        return None
    result = await db.execute(
        select(CustomPortfolioConnection).where(
            CustomPortfolioConnection.portfolio_id == portfolio.portfolio_id
        )
    )
    connection = result.scalar_one_or_none()
    if connection is None or not connection.mapping_config:
        return None
    return connection


async def _load_portfolio_context(db: AsyncSession, portfolio: Portfolio):
    """Main-DB metadata shared by the native and mapped grid builders."""
    trade_plan_result = await db.execute(
        select(TradePlan)
        .where(TradePlan.portfolio_id == portfolio.portfolio_id)
        .order_by(TradePlan.created_at.desc())
        .limit(1)
    )
    trade_plan = trade_plan_result.scalar_one_or_none()

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
        ai_risk_insight = (
            "Risk metrics based on recent AI analysis" if ai_log.reasoning else None
        )

    broker_code = None
    if portfolio.broker_id is not None:
        broker_code_result = await db.execute(
            select(Broker.code).where(Broker.id == portfolio.broker_id)
        )
        broker_code = broker_code_result.scalar_one_or_none()

    return trade_plan, ai_reasoning, ai_risk_insight, broker_code


def _risk_order_proxy(order: dict) -> SimpleNamespace:
    """Order-shaped view of a mapped order dict for ``compute_risk``.

    Only the attributes the risk model reads are projected. The foreign schema
    has no mark price, so ``current_price`` stays ``None`` and the risk model
    falls back to ``entry_price`` (counts/size are right, mark P/L is 0).
    """
    return SimpleNamespace(
        qty=order.get("qty"),
        current_price=order.get("current_price"),
        entry_price=order.get("entry_price"),
        contract_type=order.get("contract_type"),
        side=order.get("side"),
        option_type=order.get("option_type"),
        strike_price=order.get("strike_price"),
        expiry_date=order.get("expiry_date"),
    )


def _serialize_mapped_order(order: dict, plan_id: Optional[int]) -> dict:
    return {
        "order_id": order.get("order_id"),
        "plan_id": plan_id,
        "asset_type": order.get("asset_type"),
        "side": order.get("side"),
        "qty": _to_float(order.get("qty")),
        "entry_price": _to_float(order.get("entry_price")),
        "current_price": _to_float(order.get("current_price")),
        "tp_price": _to_float(order.get("tp_price")),
        "sl_price": _to_float(order.get("sl_price")),
        "leverage": _to_float(order.get("leverage")),
        "margin_rate": _to_float(order.get("margin_rate")),
        "order_status": order.get("order_status"),
        "executed_by": order.get("executed_by"),
        "group_id": None,
        "group_name": None,
        "linked_order_id": None,
        "contract_type": order.get("contract_type"),
        "direction": order.get("direction"),
        "option_type": order.get("option_type"),
        "expiry_date": order.get("expiry_date"),
        "strike_price": _to_float(order.get("strike_price")),
        "exercise_price": _to_float(order.get("exercise_price")),
        "cost": _to_float(order.get("cost")) or 0,
        "remark": order.get("remark"),
        "link_type": "none",
        "created_at": order.get("created_at"),
    }


def _serialize_mapped_trade(trade: dict) -> dict:
    return {
        "history_id": trade.get("history_id"),
        "type": trade.get("type"),
        "asset": trade.get("asset"),
        "amount": _to_float(trade.get("amount")),
        "exit_price": _to_float(trade.get("exit_price")),
        "realized_pl": _to_float(trade.get("realized_pl")),
        "executed_by": trade.get("executed_by"),
        "decision_note": trade.get("decision_note"),
        "remark": trade.get("remark"),
        "entry_date": trade.get("entry_date"),
        "exit_date": trade.get("exit_date"),
    }


async def _build_mapped_grid_data(
    db: AsyncSession,
    portfolio: Portfolio,
    connection,
    include_risk: bool,
) -> PortfolioGridData:
    """Read-through view over a foreign broker schema (never writes)."""
    config = connection.mapping_config
    engine = await get_or_create_custom_engine(connection)

    orders = await fetch_mapped_orders(engine, config)
    history = await fetch_mapped_history(engine, config)
    account = await fetch_mapped_account(engine, config)

    def money(key: str, fallback) -> Optional[float]:
        if account and account.get(key) is not None:
            return float(account[key])
        return _to_float(fallback)

    available_cash = money("available_cash", portfolio.available_cash)
    margin_locked = money("margin_locked", portfolio.margin_locked)
    cash_buffer_limit = _to_float(portfolio.cash_buffer_limit)

    trade_plan, ai_reasoning, ai_risk_insight, broker_code = (
        await _load_portfolio_context(db, portfolio)
    )
    plan_id = trade_plan.plan_id if trade_plan else None

    history.sort(key=lambda row: row.get("exit_date") or "", reverse=True)
    recent_trades = [
        _serialize_mapped_trade(row) for row in history[:5]
    ]

    risk = None
    if include_risk:
        proxy = SimpleNamespace(
            portfolio_id=portfolio.portfolio_id,
            broker_id=portfolio.broker_id,
            product_ticker=portfolio.product_ticker,
            x_amount=portfolio.x_amount,
            available_cash=available_cash or 0,
            margin_locked=margin_locked or 0,
        )
        risk = await compute_risk(
            db, proxy, [_risk_order_proxy(order) for order in orders]
        )
        # Money comes from the foreign account row, not from local orders.
        risk["margin_locked"] = round(margin_locked or 0.0, 2)
        risk["available_cash"] = round(available_cash or 0.0, 2)

    return PortfolioGridData(
        portfolio_id=portfolio.portfolio_id,
        portfolio_name=portfolio.portfolio_name,
        port_type=portfolio.port_type,
        risk_status=portfolio.risk_status,
        risk_score=_compute_risk_score(
            available_cash, margin_locked, cash_buffer_limit
        ),
        trade_plan_md=(
            portfolio.trade_plan_md
            or (trade_plan.entry_reason if trade_plan else None)
        ),
        internal_notes=portfolio.internal_notes,
        available_cash=available_cash,
        margin_locked=margin_locked,
        cash_buffer_limit=cash_buffer_limit,
        broker_id=portfolio.broker_id,
        broker_code=broker_code,
        product_ticker=portfolio.product_ticker,
        x_amount=_to_float(portfolio.x_amount) or 0,
        initial_capital=_to_float(portfolio.initial_capital) or 0,
        tags=portfolio.tags,
        ai_reasoning=ai_reasoning,
        ai_risk_insight=ai_risk_insight,
        spread_pairs=[],
        active_orders=[
            _serialize_mapped_order(order, plan_id) for order in orders
        ],
        recent_trades=recent_trades,
        risk=risk,
        read_only=True,
        mapping_template=config.get("template"),
    )

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
            # A mapped custom portfolio is a read-through view over a foreign
            # broker schema; bypass the local/custom ORM paths entirely.
            mapped_connection = await _get_mapped_connection(db, portfolio)
            if mapped_connection is not None:
                grid_data.append(
                    await _build_mapped_grid_data(
                        db, portfolio, mapped_connection, include_risk=False
                    )
                )
                continue

            # Determine if this portfolio should use custom session
            use_custom = is_custom and (portfolio_id is None or portfolio.portfolio_id == portfolio_id)
            query_session = session if use_custom else db
            OrderModel = CustomActiveOrder if use_custom else ActiveOrder
            HistoryModel = CustomTransaction if use_custom else TradeHistory

            # Get active orders for this portfolio.
            # Response assembly reads .group and .option, so eager-load them for
            # the main-db model; a lazy load there would fire IO outside the
            # greenlet (MissingGreenlet). CustomActiveOrder has no relationships.
            active_orders_stmt = (
                select(OrderModel)
                .where(OrderModel.portfolio_id == portfolio.portfolio_id)
                .order_by(OrderModel.created_at.desc())
            )
            if not use_custom:
                active_orders_stmt = active_orders_stmt.options(
                    selectinload(ActiveOrder.group),
                    selectinload(ActiveOrder.option),
                )
            active_orders_result = await query_session.execute(active_orders_stmt)
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
                    "remark": getattr(trade, 'remark', None),
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
                    "remark": order.remark,
                    "link_type": _link_type(order),
                    "created_at": order.created_at.isoformat() if order.created_at else None
                })

            margin_locked = await compute_margin_locked(db, portfolio)

            grid_data.append(PortfolioGridData(
                portfolio_id=portfolio.portfolio_id,
                portfolio_name=portfolio.portfolio_name,
                port_type=portfolio.port_type,
                risk_status=portfolio.risk_status,
                risk_score=_compute_risk_score(
                    _to_float(portfolio.available_cash),
                    margin_locked,
                    _to_float(portfolio.cash_buffer_limit)
                ),
                trade_plan_md=portfolio.trade_plan_md or (trade_plan.entry_reason if trade_plan else None),
                internal_notes=portfolio.internal_notes,
                available_cash=_to_float(portfolio.available_cash),
                margin_locked=margin_locked,
                cash_buffer_limit=_to_float(portfolio.cash_buffer_limit),
                broker_id=portfolio.broker_id,
                product_ticker=portfolio.product_ticker,
                x_amount=_to_float(portfolio.x_amount) or 0,
                initial_capital=_to_float(portfolio.initial_capital) or 0,
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

    mapped_connection = await _get_mapped_connection(db, portfolio)
    if mapped_connection is not None:
        return await _build_mapped_grid_data(
            db, portfolio, mapped_connection, include_risk=True
        )

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
                "remark": getattr(trade, 'remark', None),
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
                "remark": order.remark,
                "link_type": _link_type(order),
                "created_at": order.created_at.isoformat() if order.created_at else None
            })

        margin_locked = await compute_margin_locked(db, portfolio)
        risk = await compute_risk(db, portfolio, active_orders)

        broker_code = None
        if portfolio.broker_id is not None:
            broker_code_result = await db.execute(
                select(Broker.code).where(Broker.id == portfolio.broker_id)
            )
            broker_code = broker_code_result.scalar_one_or_none()

        return PortfolioGridData(
            portfolio_id=portfolio.portfolio_id,
            portfolio_name=portfolio.portfolio_name,
            port_type=portfolio.port_type,
            risk_status=portfolio.risk_status,
            risk_score=_compute_risk_score(
                _to_float(portfolio.available_cash),
                margin_locked,
                _to_float(portfolio.cash_buffer_limit)
            ),
            trade_plan_md=portfolio.trade_plan_md or (trade_plan.entry_reason if trade_plan else None),
            internal_notes=portfolio.internal_notes,
            available_cash=_to_float(portfolio.available_cash),
            margin_locked=margin_locked,
            cash_buffer_limit=_to_float(portfolio.cash_buffer_limit),
            broker_id=portfolio.broker_id,
            broker_code=broker_code,
            product_ticker=portfolio.product_ticker,
            x_amount=_to_float(portfolio.x_amount) or 0,
            initial_capital=_to_float(portfolio.initial_capital) or 0,
            tags=portfolio.tags,
            ai_reasoning=ai_reasoning,
            ai_risk_insight=ai_risk_insight,
            spread_pairs=spread_pairs,
            active_orders=active_orders_list,
            recent_trades=recent_trades_list,
            risk=risk
        )
    finally:
        if is_custom:
            await session.close()