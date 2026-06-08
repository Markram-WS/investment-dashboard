from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from decimal import Decimal
from app.models import Base


class ManagedFundHolding(Base):
    __tablename__ = 'managed_fund_holdings'

    holding_id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=False)
    asset = Column(String, nullable=False)
    qty = Column(Numeric(20, 8), nullable=False, default=Decimal('0'))
    avg_entry_price = Column(Numeric(20, 8), default=Decimal('0'))
    current_price = Column(Numeric(20, 8), default=Decimal('0'))
    market_value = Column(Numeric(20, 8), default=Decimal('0'))
    unrealized_pl = Column(Numeric(20, 8), default=Decimal('0'))
    unrealized_pl_pct = Column(Numeric(10, 4), default=Decimal('0'))
    profit_threshold = Column(Numeric(10, 4), default=Decimal('0'))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    portfolio = relationship("Portfolio", backref="managed_fund_holdings")


class ManagedFundOrder(Base):
    __tablename__ = 'managed_fund_orders'

    order_id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=False)
    asset = Column(String, nullable=False)
    side = Column(String, nullable=False)
    qty = Column(Numeric(20, 8), nullable=False)
    price = Column(Numeric(20, 8))
    status = Column(String, nullable=False, default='pending')
    order_type = Column(String, nullable=False, default='manual')
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    portfolio = relationship("Portfolio", backref="managed_fund_orders")


class ManagedFundOrderHistory(Base):
    __tablename__ = 'managed_fund_order_history'

    history_id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=False)
    asset = Column(String, nullable=False)
    side = Column(String, nullable=False)
    qty = Column(Numeric(20, 8), nullable=False)
    price = Column(Numeric(20, 8))
    status = Column(String, nullable=False)
    order_type = Column(String, nullable=False, default='manual')
    notes = Column(Text)
    executed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    portfolio = relationship("Portfolio", backref="managed_fund_order_history")


class ManagedFundSetting(Base):
    __tablename__ = 'managed_fund_settings'

    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.portfolio_id'), nullable=False, unique=True)
    target_ratio = Column(JSON)
    global_profit_threshold = Column(Numeric(10, 4), default=Decimal('0'))
    total_invested = Column(Numeric(20, 8), default=Decimal('0'))
    last_rebalance_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    portfolio = relationship("Portfolio", backref="managed_fund_settings")
