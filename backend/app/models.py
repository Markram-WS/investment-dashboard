import uuid
from sqlalchemy import create_engine, Column, Integer, String, JSON, DateTime, Boolean, ForeignKey, CheckConstraint, Numeric, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, configure_mappers
from datetime import datetime
from decimal import Decimal

Base = declarative_base()

# Main Database Models
class Portfolio(Base):
    __tablename__ = 'portfolios'
    
    portfolio_id = Column(Integer, primary_key=True)
    portfolio_name = Column(String, nullable=False)
    port_type = Column(String, nullable=False)
    target_ratio = Column(JSON)
    current_nav = Column(Numeric(20, 8), default=Decimal('0.00'))
    margin_locked = Column(Numeric(20, 8), default=Decimal('0.00'))
    cash_buffer_limit = Column(Numeric(20, 8), default=Decimal('0.00'))
    available_cash = Column(Numeric(20, 8), default=Decimal('0.00'))
    money_market = Column(Numeric(20, 8), default=Decimal('0.00'))
    trade_plan_md = Column(String)
    internal_notes = Column(String)
    risk_status = Column(String, check_constraint="risk_status IN ('Safe', 'Warning', 'Danger')")
    tags = Column(JSON)
    last_rebalance_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Manual/Bot isolation - Option flag for data source identification
    data_source = Column(String, default='Manual', check_constraint="data_source IN ('Manual', 'Bot')")
    # ETL sync marker
    etl_synced = Column(Boolean, default=False)
    
    # Relationships
    trade_plans = relationship("TradePlan", back_populates="portfolio")
    active_orders = relationship("ActiveOrder", back_populates="portfolio")
    nav_history = relationship("PortfolioNavHistory", back_populates="portfolio")
    simulation_models = relationship("SimulationModels", back_populates="portfolio")
    trade_history = relationship("TradeHistory", back_populates="portfolio")
    zone_groups = relationship("ZoneGroup", back_populates="portfolio")
    # Note: No direct transaction relationship due to ambiguity with source/destination FKs

class TradePlan(Base):
    __tablename__ = 'trade_plans'
    
    plan_id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=False)
    trade_plan_md = Column(String)
    entry_zone = Column(String)
    exit_zone = Column(String)
    tp_levels = Column(JSON)
    sl_level = Column(Numeric(20, 8))
    leverage = Column(Numeric(20, 8))
    margin_rate = Column(Numeric(20, 8))
    entry_reason = Column(String)
    # Manual/Bot isolation
    data_source = Column(String, default='Manual', check_constraint="data_source IN ('Manual', 'Bot')")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    portfolio = relationship("Portfolio", back_populates="trade_plans")
    active_orders = relationship("ActiveOrder", back_populates="plan")


class ActiveOrder(Base):
    __tablename__ = 'active_orders'
    
    order_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    plan_id = Column(Integer, ForeignKey('trade_plans.plan_id'), nullable=False)
    portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=False)
    asset_type = Column(String, nullable=False)
    side = Column(String, nullable=False)
    qty = Column(Numeric(20, 8))
    entry_price = Column(Numeric(20, 8))
    current_price = Column(Numeric(20, 8))
    tp_price = Column(Numeric(20, 8))
    leverage = Column(Numeric(20, 8))
    margin_rate = Column(Numeric(20, 8))
    order_status = Column(String, default='pending_sync')
    sl_price = Column(Numeric(20, 8))
    grid_group_id = Column(String)
    zone = Column(String)  # Zone grouping: ZONE A, ZONE B, etc.
    spread_pair_id = Column(String)
    executed_by = Column(String)
    option_id = Column(Integer, ForeignKey('option_details.option_id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    # Manual/Bot isolation
    data_source = Column(String, default='Manual', check_constraint="data_source IN ('Manual', 'Bot')")
    # ETL sync marker
    etl_synced = Column(Boolean, default=False)
    
    plan = relationship("TradePlan", back_populates="active_orders")
    portfolio = relationship("Portfolio", back_populates="active_orders")
    option = relationship("OptionDetails", back_populates="active_orders")
    trade_history = relationship("TradeHistory", back_populates="order")

class OptionDetails(Base):
    __tablename__ = 'option_details'
    
    option_id = Column(Integer, primary_key=True)
    strike_price = Column(Numeric(20, 8))
    option_type = Column(String, check_constraint="option_type IN ('Call', 'Put')")
    expiry_date = Column(DateTime, nullable=False)
    premium_entry = Column(Numeric(20, 8))
    premium_exit = Column(Numeric(20, 8))
    delta_at_entry = Column(Numeric(10, 6))
    IV_at_entry = Column(Numeric(10, 6))
    # Greeks calculated fields
    theta = Column(Numeric(10, 6))
    gamma = Column(Numeric(10, 6))
    vega = Column(Numeric(10, 6))
    rho = Column(Numeric(10, 6))
    # Underlying price at entry
    underlying_price = Column(Numeric(20, 8))
    
    active_orders = relationship("ActiveOrder", back_populates="option")

class PortfolioNavHistory(Base):
    __tablename__ = 'portfolio_nav_history'
    
    nav_id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=False)
    nav_date = Column(DateTime, nullable=False)
    nav_value = Column(Numeric(20, 8), nullable=False)
    
    portfolio = relationship("Portfolio", back_populates="nav_history")

class SimulationModels(Base):
    __tablename__ = 'simulation_models'
    
    sim_id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=False)
    model_name = Column(String, nullable=False)
    draft_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    portfolio = relationship("Portfolio", back_populates="simulation_models")

class TradeHistory(Base):
    __tablename__ = 'trade_history'
    
    history_id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=False)
    order_id = Column(String, ForeignKey('active_orders.order_id'), nullable=True)
    close_order_id = Column(String, nullable=True)
    type = Column(String, nullable=False)
    asset = Column(String, nullable=False)
    amount = Column(Numeric(20, 8), nullable=True)
    entry_price = Column(Numeric(20, 8))
    exit_price = Column(Numeric(20, 8))
    realized_pl = Column(Numeric(20, 8))
    executed_by = Column(String)
    decision_note = Column(String)
    entry_date = Column(DateTime)
    exit_date = Column(DateTime)
    comments = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Manual/Bot isolation
    data_source = Column(String, default='Manual', check_constraint="data_source IN ('Manual', 'Bot')")
    
    portfolio = relationship("Portfolio", back_populates="trade_history")
    order = relationship("ActiveOrder", back_populates="trade_history")

# Transaction Model (Consolidated Ledger)
class Transaction(Base):
    __tablename__ = 'transactions'
    
    transaction_id = Column(Integer, primary_key=True)
    transaction_type = Column(String, nullable=False)  # Funding, Trade, Transfer, Withdrawal, etc.
    asset = Column(String, nullable=False)
    amount = Column(Numeric(20, 8), nullable=False)
    source_portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=True)
    destination_portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=True)
    executed_by = Column(String, nullable=False)
    status = Column(String, default='completed')  # pending, completed, failed, cancelled
    reference_id = Column(String)  # External reference ID
    audit_labels = Column(JSON)  # Flexible audit metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Manual/Bot isolation
    data_source = Column(String, default='Manual', check_constraint="data_source IN ('Manual', 'Bot')")
    
    # Relationships
    source_portfolio = relationship("Portfolio", foreign_keys=[source_portfolio_id])
    destination_portfolio = relationship("Portfolio", foreign_keys=[destination_portfolio_id])

# Decision Journal Model (Section 2.3 - Mini Post-it Notes)
class DecisionJournal(Base):
    __tablename__ = 'decision_journals'

    journal_id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=False)
    # Using id from trade_history for linking (nullable because journal can be created independently)
    history_id = Column(Integer, ForeignKey('trade_history.history_id'), nullable=True)
    entry_text = Column(String, nullable=False)  # The journal entry content
    created_at = Column(DateTime, default=datetime.utcnow)
    # Manual/Bot isolation
    data_source = Column(String, default='Manual', check_constraint="data_source IN ('Manual', 'Bot')")

    # Relationships
    portfolio = relationship("Portfolio")
    trade_history = relationship("TradeHistory")


class WhitelistAssets(Base):
    __tablename__ = 'whitelist_assets'

    asset_id = Column(Integer, primary_key=True)
    ticker = Column(String, nullable=False, unique=True)
    asset_type = Column(String, nullable=False)

class Watchlist(Base):
    __tablename__ = 'watchlist'
    
    watch_id = Column(Integer, primary_key=True)
    ticker = Column(String, nullable=False)
    alert_price = Column(Numeric(20, 8))
    notes = Column(String)

# AI Database Models
class AiAgent(Base):
    __tablename__ = 'ai_agents'
    
    agent_id = Column(Integer, primary_key=True)
    agent_name = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    target_portfolio_id = Column(Integer)
    strategy_config = Column(JSON)
    status = Column(String, default='Active')
    created_at = Column(DateTime, default=datetime.utcnow)
    action_logs = relationship("AiActionLog", back_populates="agent")
    state = relationship("AiAgentState", back_populates="agent", uselist=False)
    
class AiActionLog(Base):
    __tablename__ = 'ai_action_logs'
    
    log_id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, ForeignKey('ai_agents.agent_id'), nullable=False)
    action_type = Column(String, nullable=False)
    reasoning = Column(String)
    confidence_score = Column(Numeric(20, 8))
    risk_assessment = Column(JSON)
    raw_data_snapshot = Column(JSON)
    linked_plan_id = Column(Integer)
    linked_order_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    agent = relationship("AiAgent", back_populates="action_logs")

class AiAgentState(Base):
    __tablename__ = 'ai_agent_state'
    
    agent_id = Column(Integer, ForeignKey('ai_agents.agent_id'), primary_key=True)
    last_run_timestamp = Column(DateTime)
    current_task = Column(String)
    is_busy = Column(Boolean, default=False)
    error_logs = Column(String)
    
    agent = relationship("AiAgent", back_populates="state")


class ZoneGroup(Base):
    __tablename__ = 'zone_groups'

    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=False)
    name = Column(String, nullable=False)
    max_orders = Column(Integer, nullable=True)
    min_price = Column(Numeric(20, 8), nullable=True)
    max_price = Column(Numeric(20, 8), nullable=True)
    range = Column(Numeric(20, 8), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="zone_groups")