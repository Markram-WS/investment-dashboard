from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ScanAssetType(str, Enum):
    stock = "stock"
    future = "future"
    option = "option"
    crypto = "crypto"


class MarketScanRequest(BaseModel):
    """Request for AI market scanning - Section 4.2.1"""
    portfolio_id: int = Field(..., description="Target AI-managed portfolio ID")
    watchlist_tickers: Optional[List[str]] = Field(None, description="Tickers to scan from watchlist")
    whitelist_tickers: Optional[List[str]] = Field(None, description="Tickers to scan from whitelist")
    scan_depth: Optional[int] = Field(1, ge=1, le=5, description="Depth of market analysis (1-5)")
    include_options: Optional[bool] = Field(False, description="Include options chain analysis")


class ScanResult(BaseModel):
    """Individual asset scan result"""
    ticker: str
    asset_type: str
    current_price: float
    signal: Optional[str] = None
    confidence: Optional[float] = None
    reasoning: Optional[str] = None


class MarketScanResponse(BaseModel):
    """Response from AI market scanning"""
    scan_id: str
    portfolio_id: int
    scanned_at: datetime
    results: List[ScanResult]
    summary: str


# Strategy Planning - Section 4.2.2

class StrategyType(str, Enum):
    momentum = "momentum"
    mean_reversion = "mean_reversion"
    breakout = "breakout"
    spread = "spread"


class PlanRequest(BaseModel):
    """Request for AI strategy planning - Section 4.2.2"""
    portfolio_id: int = Field(..., description="Target AI-managed portfolio ID")
    scan_id: str = Field(..., description="Reference to previous scan results")
    max_plans: Optional[int] = Field(5, ge=1, le=20, description="Maximum number of trade plans to generate")
    risk_limits: Optional[Dict[str, Any]] = Field(None, description="Risk limits for plan generation")


class TradePlanItem(BaseModel):
    """Generated trade plan details"""
    ticker: str
    asset_type: str
    side: str
    quantity: float
    entry_zone: Optional[str] = None
    exit_zone: Optional[str] = None
    tp_levels: Optional[List[float]] = None
    sl_level: Optional[float] = None
    leverage: Optional[float] = None
    reasoning: str


class PlanResponse(BaseModel):
    """Response from AI strategy planning"""
    plan_id: str
    portfolio_id: int
    generated_at: datetime
    strategy_type: StrategyType
    trade_plans: List[TradePlanItem]
    risk_assessment: Dict[str, Any]


# Autonomous Execution - Section 4.2.3

class ExecutionMode(str, Enum):
    paper = "paper"
    live = "live"


class ExecuteRequest(BaseModel):
    """Request for AI autonomous execution - Section 4.2.3"""
    portfolio_id: int = Field(..., description="Target AI-managed portfolio ID")
    plan_id: str = Field(..., description="Reference to strategy plan")
    mode: ExecutionMode = Field(ExecutionMode.paper, description="Execution mode: paper or live")
    max_orders: Optional[int] = Field(10, ge=1, le=50, description="Maximum orders to execute")
    risk_check: Optional[bool] = Field(True, description="Whether to check risk limits before execution")


class ExecutedOrder(BaseModel):
    """Individual executed order"""
    order_id: int
    ticker: str
    side: str
    quantity: float
    status: str
    message: Optional[str] = None


class ExecuteResponse(BaseModel):
    """Response from AI autonomous execution"""
    execution_id: str
    portfolio_id: int
    executed_at: datetime
    orders: List[ExecutedOrder]
    summary: str


# Emergency Stop - Section 4.2.4

class EmergencyStopRequest(BaseModel):
    """Request for emergency stop - Section 4.2.4"""
    portfolio_id: Optional[int] = Field(None, description="Specific portfolio to stop (null = all AI portfolios)")
    reason: str = Field(..., description="Reason for emergency stop")
    manual_override: bool = Field(True, description="Whether this is a manual override")
    duration_minutes: Optional[int] = Field(30, ge=1, le=1440, description="Stop duration in minutes (max 24h)")


class EmergencyStopResponse(BaseModel):
    """Response from emergency stop"""
    stop_id: str
    portfolio_id: Optional[int]
    stopped_at: datetime
    reason: str
    active_orders_paused: int
    ai_status: str
    resumed_at: Optional[datetime] = None


# AI Log-Driven Intelligence - Section 4.1

class AiLogCreate(BaseModel):
    """Request to create AI reasoning/risk log entry"""
    agent_id: int = Field(..., description="AI agent ID that generated this log")
    action_type: str = Field(..., description="Type of AI action (e.g., market_scan, strategy_plan, execute, risk_assessment)")
    reasoning: str = Field(..., description="AI's reasoning/logic for this action")
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score 0.0-1.0")
    risk_assessment: Optional[Dict[str, Any]] = Field(None, description="Risk assessment details")
    raw_data_snapshot: Optional[Dict[str, Any]] = Field(None, description="Raw data snapshot for context")
    linked_plan_id: Optional[int] = Field(None, description="Optional link to trade plan")
    linked_order_id: Optional[int] = Field(None, description="Optional link to executed order")


class AiLogResponse(BaseModel):
    """Response model for AI action log"""
    log_id: int
    agent_id: int
    action_type: str
    reasoning: str
    confidence_score: Optional[float]
    risk_assessment: Optional[Dict[str, Any]]
    raw_data_snapshot: Optional[Dict[str, Any]]
    linked_plan_id: Optional[int]
    linked_order_id: Optional[int]
    created_at: datetime

    class Config:
        orm_mode = True