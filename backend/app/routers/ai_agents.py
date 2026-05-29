from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, get_ai_db
from app.models import (
    Portfolio, AiAgent, AiActionLog, AiAgentState,
    WhitelistAssets, Watchlist, ActiveOrder, TradePlan
)
from app.schemas.ai_autonomy import (
    MarketScanRequest, MarketScanResponse, ScanResult,
    PlanRequest, PlanResponse, TradePlanItem, StrategyType,
    ExecuteRequest, ExecuteResponse, ExecutedOrder, ExecutionMode,
    EmergencyStopRequest, EmergencyStopResponse,
    AiLogCreate, AiLogResponse
)
from pydantic import BaseModel

router = APIRouter()


class AiAgentCreate(BaseModel):
    agent_name: str
    model_name: str
    target_portfolio_id: Optional[int] = None
    strategy_config: Optional[dict] = None
    status: Optional[str] = "Active"


class AiAgentResponse(BaseModel):
    agent_id: int
    agent_name: str
    model_name: str
    target_portfolio_id: Optional[int]
    strategy_config: Optional[dict]
    status: str

    class Config:
        orm_mode = True


@router.post("/", tags=["ai-agents"], status_code=status.HTTP_201_CREATED, response_model=AiAgentResponse)
async def create_ai_agent(agent: AiAgentCreate, db: AsyncSession = Depends(get_db)):
    """Create a new AI agent."""
    db_agent = AiAgent(
        agent_name=agent.agent_name,
        model_name=agent.model_name,
        target_portfolio_id=agent.target_portfolio_id,
        strategy_config=agent.strategy_config,
        status=agent.status
    )
    db.add(db_agent)
    await db.commit()
    await db.refresh(db_agent)
    return db_agent


# Helper: Record AI action log
async def log_ai_action(
    db: AsyncSession, agent_id: int, action_type: str,
    reasoning: str, confidence: float = None,
    risk_assessment: dict = None, raw_data_snapshot: dict = None,
    linked_plan_id: int = None, linked_order_id: int = None
):
    """Log AI action for audit trail"""
    log = AiActionLog(
        agent_id=agent_id,
        action_type=action_type,
        reasoning=reasoning,
        confidence_score=confidence,
        risk_assessment=risk_assessment,
        raw_data_snapshot=raw_data_snapshot,
        linked_plan_id=linked_plan_id,
        linked_order_id=linked_order_id
    )
    db.add(log)
    await db.commit()
    return log


@router.post("/scan", response_model=MarketScanResponse, tags=["ai-autonomy"])
async def market_scan(request: MarketScanRequest, db: AsyncSession = Depends(get_db)):
    """
    Section 4.2.1: Market Scanning
    Analyze market data from Watchlist/Whitelist for AI-managed portfolios.
    """
    # Verify portfolio exists and is AI-managed
    result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == request.portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Determine tickers to scan
    tickers_to_scan = []
    if request.watchlist_tickers:
        tickers_to_scan.extend(request.watchlist_tickers)
    if request.whitelist_tickers:
        tickers_to_scan.extend(request.whitelist_tickers)

    # Fallback: get all from watchlist/whitelist if none specified
    if not tickers_to_scan:
        watchlist_result = await db.execute(select(Watchlist))
        tickers_to_scan.extend([w.ticker for w in watchlist_result.scalars().all()])
        whitelist_result = await db.execute(select(WhitelistAssets))
        tickers_to_scan.extend([a.ticker for a in whitelist_result.scalars().all()])

    # Simulate market scanning results (in production, connect to broker/market API)
    results = []
    for ticker in tickers_to_scan[:5]:  # Limit to 5 for demo
        results.append(ScanResult(
            ticker=ticker,
            asset_type="stock",
            current_price=100.0 + hash(ticker) % 100,  # Simulated price
            signal="buy" if hash(ticker) % 2 == 0 else "hold",
            confidence=0.75 + (hash(ticker) % 25) / 100,
            reasoning=f"Technical analysis suggests {ticker} in favorable zone"
        ))

    response = MarketScanResponse(
        scan_id=str(uuid.uuid4()),
        portfolio_id=request.portfolio_id,
        scanned_at=datetime.utcnow(),
        results=results,
        summary=f"Scanned {len(results)} assets, {sum(1 for r in results if r.signal == 'buy')} buy signals identified"
    )

    # Log the scan action
    ai_db = None
    try:
        async for ai_session in get_ai_db():
            ai_db = ai_session
            result = await ai_db.execute(
                select(AiAgent).where(AiAgent.target_portfolio_id == request.portfolio_id)
            )
            agent = result.scalar_one_or_none()
            if agent:
                await log_ai_action(
                    ai_db, agent.agent_id, "market_scan",
                    f"Scanned {len(results)} assets", confidence=0.9
                )
            break
    except Exception:
        pass

    return response


@router.post("/plan", response_model=PlanResponse, tags=["ai-autonomy"])
async def strategy_plan(request: PlanRequest, db: AsyncSession = Depends(get_db)):
    """
    Section 4.2.2: Strategy Planning
    Generate trade_plans based on market scan results.
    """
    # Verify portfolio exists
    result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == request.portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Generate trade plans based on scan (simulated)
    trade_plans = []
    symbols = ["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"][:request.max_plans]

    for symbol in symbols:
        trade_plans.append(TradePlanItem(
            ticker=symbol,
            asset_type="stock",
            side="buy" if hash(symbol) % 2 == 0 else "sell",
            quantity=10.0 * (1 + hash(symbol) % 5),
            entry_zone=f"{150.0 + hash(symbol) % 20}-{152.0 + hash(symbol) % 20}",
            exit_zone=f"{160.0 + hash(symbol) % 20}-{165.0 + hash(symbol) % 20}",
            tp_levels=[1.05, 1.10],
            sl_level=0.95,
            leverage=1.0,
            reasoning=f"Mean reversion setup for {symbol} based on scan results"
        ))

        # Create actual TradePlan in database
        plan = TradePlan(
            portfolio_id=request.portfolio_id,
            entry_zone=trade_plans[-1].entry_zone,
            exit_zone=trade_plans[-1].exit_zone,
            tp_levels=trade_plans[-1].tp_levels,
            sl_level=trade_plans[-1].sl_level,
            leverage=trade_plans[-1].leverage,
            entry_reason=trade_plans[-1].reasoning
        )
        db.add(plan)
        await db.commit()
        await db.refresh(plan)

    response = PlanResponse(
        plan_id=str(uuid.uuid4()),
        portfolio_id=request.portfolio_id,
        generated_at=datetime.utcnow(),
        strategy_type=StrategyType.mean_reversion,
        trade_plans=trade_plans,
        risk_assessment={"max_risk": "2%", "portfolio_exposure": "15%"}
    )

    # Log the planning action
    try:
        async for ai_session in get_ai_db():
            result = await ai_session.execute(
                select(AiAgent).where(AiAgent.target_portfolio_id == request.portfolio_id)
            )
            agent = result.scalar_one_or_none()
            if agent:
                await log_ai_action(
                    ai_session, agent.agent_id, "strategy_plan",
                    f"Generated {len(trade_plans)} trade plans"
                )
            break
    except Exception:
        pass

    return response


@router.post("/execute", response_model=ExecuteResponse, tags=["ai-autonomy"])
async def autonomous_execute(request: ExecuteRequest, db: AsyncSession = Depends(get_db)):
    """
    Section 4.2.3: Autonomous Execution
    Execute trade plans and create active_orders within risk limits.
    """
    # Verify portfolio exists
    result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == request.portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Risk check placeholder
    if request.risk_check:
        if portfolio.available_cash < 1000:
            raise HTTPException(
                status_code=400, detail="Insufficient cash for execution"
            )

    # Get pending trade plans for this portfolio
    plans_result = await db.execute(
        select(TradePlan).where(TradePlan.portfolio_id == request.portfolio_id)
    )
    plans = plans_result.scalars().all()

    executed_orders = []
    for i, plan in enumerate(plans[:request.max_orders]):
        # Create active order from plan
        order = ActiveOrder(
            plan_id=plan.plan_id,
            portfolio_id=request.portfolio_id,
            asset_type="stock",
            side="buy",
            qty=100.0,
            entry_price=150.0,
            current_price=150.0,
            tp_price=165.0,
            leverage=1.0,
            margin_rate=0.1,
            order_status="active" if request.mode == ExecutionMode.live else "paper",
            executed_by="AI"
        )
        db.add(order)
        await db.commit()
        await db.refresh(order)

        executed_orders.append(ExecutedOrder(
            order_id=order.order_id,
            ticker="SYMBOL",  # Would map from plan
            side="buy",
            quantity=100.0,
            status=order.order_status,
            message="Order created successfully"
        ))

    response = ExecuteResponse(
        execution_id=str(uuid.uuid4()),
        portfolio_id=request.portfolio_id,
        executed_at=datetime.utcnow(),
        orders=executed_orders,
        summary=f"Executed {len(executed_orders)} orders in {request.mode} mode"
    )

    # Log the execution action
    try:
        async for ai_session in get_ai_db():
            result = await ai_session.execute(
                select(AiAgent).where(AiAgent.target_portfolio_id == request.portfolio_id)
            )
            agent = result.scalar_one_or_none()
            if agent:
                await log_ai_action(
                    ai_session, agent.agent_id, "execute",
                    f"Executed {len(executed_orders)} orders in {request.mode} mode"
                )
            break
    except Exception:
        pass

    return response


@router.post("/emergency-stop", response_model=EmergencyStopResponse, tags=["ai-autonomy"])
async def emergency_stop(request: EmergencyStopRequest, db: AsyncSession = Depends(get_db)):
    """
    Section 4.2.4: Emergency Stop
    Pause/Stop AI immediately with manual override capability.
    """
    # Pause active orders
    pause_query = update(ActiveOrder).values(order_status="paused")
    if request.portfolio_id:
        pause_query = pause_query.where(ActiveOrder.portfolio_id == request.portfolio_id)

    result = await db.execute(pause_query)
    paused_count = result.rowcount
    await db.commit()

    # Update AI agent status
    if request.portfolio_id:
        agents_result = await db.execute(
            select(AiAgent).where(AiAgent.target_portfolio_id == request.portfolio_id)
        )
    else:
        agents_result = await db.execute(select(AiAgent))

    agents = agents_result.scalars().all()
    for agent in agents:
        agent.status = "Paused"

    await db.commit()

    # Log emergency stop
    try:
        async for ai_session in get_ai_db():
            for agent in agents:
                await log_ai_action(
                    ai_session, agent.agent_id, "emergency_stop",
                    request.reason, confidence=1.0
                )
            break
    except Exception:
        pass

    response = EmergencyStopResponse(
        stop_id=str(uuid.uuid4()),
        portfolio_id=request.portfolio_id,
        stopped_at=datetime.utcnow(),
        reason=request.reason,
        active_orders_paused=paused_count,
        ai_status="paused",
        resumed_at=None  # Would be set when AI is resumed
    )

    return response


@router.post("/resume", tags=["ai-autonomy"])
async def resume_ai(
    portfolio_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Resume AI operations after emergency stop.
    """
    # Resume active orders
    resume_query = update(ActiveOrder).values(order_status="active")
    if portfolio_id:
        resume_query = resume_query.where(
            ActiveOrder.portfolio_id == portfolio_id,
            ActiveOrder.order_status == "paused"
        )

    await db.execute(resume_query)

    # Update AI agent status
    agents_query = update(AiAgent).values(status="Active")
    if portfolio_id:
        agents_query = agents_query.where(AiAgent.target_portfolio_id == portfolio_id)

    await db.execute(agents_query)
    await db.commit()

    return {"status": "resumed", "portfolio_id": portfolio_id}


@router.get("/status", tags=["ai-autonomy"])
async def ai_status(portfolio_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """
    Get current AI status and active operations.
    """
    if portfolio_id:
        agents_result = await db.execute(
            select(AiAgent).where(AiAgent.target_portfolio_id == portfolio_id)
        )
    else:
        agents_result = await db.execute(select(AiAgent))

    agents = agents_result.scalars().all()

    # Get active orders count
    orders_query = select(ActiveOrder).where(ActiveOrder.order_status == "active")
    if portfolio_id:
        orders_query = orders_query.where(ActiveOrder.portfolio_id == portfolio_id)

    orders_result = await db.execute(orders_query)
    active_orders = orders_result.scalars().all()

    return {
        "agents": [{"agent_id": a.agent_id, "name": a.agent_name, "status": a.status} for a in agents],
        "active_orders": len(active_orders),
        "portfolio_id": portfolio_id
    }


# AI Log-Driven Intelligence - Section 4.1

@router.post("/logs", tags=["ai-logs"], response_model=AiLogResponse, status_code=status.HTTP_201_CREATED)
async def create_ai_log(
    log_data: AiLogCreate,
    db: AsyncSession = Depends(get_ai_db)
):
    """
    Section 4.1: Create AI Reasoning & Risk Log
    
    Record AI reasoning and risk assessment for AI-managed portfolios.
    This is used by AI agents to log their decision-making process.
    """
    # Verify agent exists
    result = await db.execute(
        select(AiAgent).where(AiAgent.agent_id == log_data.agent_id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="AI agent not found")
    
    # Create the log entry
    log = AiActionLog(
        agent_id=log_data.agent_id,
        action_type=log_data.action_type,
        reasoning=log_data.reasoning,
        confidence_score=log_data.confidence_score,
        risk_assessment=log_data.risk_assessment,
        raw_data_snapshot=log_data.raw_data_snapshot,
        linked_plan_id=log_data.linked_plan_id,
        linked_order_id=log_data.linked_order_id
    )
    
    db.add(log)
    await db.commit()
    await db.refresh(log)
    
    return AiLogResponse(
        log_id=log.log_id,
        agent_id=log.agent_id,
        action_type=log.action_type,
        reasoning=log.reasoning,
        confidence_score=log.confidence_score,
        risk_assessment=log.risk_assessment,
        raw_data_snapshot=log.raw_data_snapshot,
        linked_plan_id=log.linked_plan_id,
        linked_order_id=log.linked_order_id,
        created_at=log.created_at
    )


@router.get("/logs/{portfolio_id}", tags=["ai-logs"], response_model=List[AiLogResponse])
async def get_ai_logs(
    portfolio_id: int,
    db: AsyncSession = Depends(get_db),
    limit: int = 100
):
    """
    Section 4.1: Get AI Reasoning & Risk Logs by Portfolio
    
    Retrieve all AI action logs for a specific AI-managed portfolio.
    Returns logs ordered by created_at descending (newest first).
    """
    # Verify portfolio exists and is AI-managed
    result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get AI agent for this portfolio
    ai_agent_result = await db.execute(
        select(AiAgent).where(AiAgent.target_portfolio_id == portfolio_id)
    )
    ai_agent = ai_agent_result.scalar_one_or_none()
    
    if not ai_agent:
        return []  # No AI agent assigned to this portfolio
    
    # Get logs from AI database
    async for ai_session in get_ai_db():
        logs_result = await ai_session.execute(
            select(AiActionLog)
            .where(AiActionLog.agent_id == ai_agent.agent_id)
            .order_by(AiActionLog.created_at.desc())
            .limit(limit)
        )
        logs = logs_result.scalars().all()
        
        return [
            AiLogResponse(
                log_id=log.log_id,
                agent_id=log.agent_id,
                action_type=log.action_type,
                reasoning=log.reasoning,
                confidence_score=log.confidence_score,
                risk_assessment=log.risk_assessment,
                raw_data_snapshot=log.raw_data_snapshot,
                linked_plan_id=log.linked_plan_id,
                linked_order_id=log.linked_order_id,
                created_at=log.created_at
            )
            for log in logs
        ]