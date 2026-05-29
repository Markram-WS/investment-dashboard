from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TradePlanBase(BaseModel):
    portfolio_id: int
    entry_zone: Optional[str] = None
    exit_zone: Optional[str] = None
    tp_levels: Optional[List[float]] = None
    sl_level: Optional[float] = None
    leverage: Optional[float] = None
    margin_rate: Optional[float] = None
    entry_reason: Optional[str] = None

class TradePlanCreate(TradePlanBase):
    pass

class TradePlanUpdate(BaseModel):
    trade_plan_md: Optional[str] = None

class TradePlanResponse(TradePlanBase):
    plan_id: int
    created_at: datetime

    class Config:
        from_attributes = True