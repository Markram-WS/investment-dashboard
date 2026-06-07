from sqlalchemy import Column, Integer, String, JSON, DateTime, Boolean, Numeric, text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

CustomBase = declarative_base()


class CustomActiveOrder(CustomBase):
    __tablename__ = 'active_orders'

    order_id = Column(String, primary_key=True)
    plan_id = Column(Integer, nullable=False)
    portfolio_id = Column(Integer, nullable=False)
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
    group_id = Column(Integer, nullable=True)
    linked_order_id = Column(String)
    executed_by = Column(String)
    option_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    data_source = Column(String, default='Manual')
    contract_type = Column(String, default='spot')
    direction = Column(String, nullable=True)
    option_type = Column(String, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    strike_price = Column(Numeric(20, 8), nullable=True)
    cost = Column(Numeric(20, 8), default=0.0)
    etl_synced = Column(Boolean, default=False)


class CustomTransaction(CustomBase):
    __tablename__ = 'transactions'

    transaction_id = Column(Integer, primary_key=True)
    transaction_type = Column(String, nullable=False)
    asset = Column(String, nullable=False)
    amount = Column(Numeric(20, 8), nullable=False)
    source_portfolio_id = Column(Integer, nullable=True)
    destination_portfolio_id = Column(Integer, nullable=True)
    executed_by = Column(String, nullable=False)
    status = Column(String, default='completed')
    reference_id = Column(String)
    audit_labels = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    data_source = Column(String, default='Manual')


class CustomWhitelistAssets(CustomBase):
    __tablename__ = 'whitelist_assets'

    asset_id = Column(Integer, primary_key=True)
    ticker = Column(String, nullable=False)
    asset_type = Column(String, nullable=False)
    name = Column(String, nullable=True)
    source = Column(String, default='manual')
    group_id = Column(Integer, nullable=True)
    price = Column(Numeric(20, 8), nullable=True)
    change_24h = Column(Numeric(10, 4), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CustomAssetGroup(CustomBase):
    __tablename__ = 'asset_groups'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class CustomOrdersGroup(CustomBase):
    __tablename__ = 'orders_groups'

    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    max_orders = Column(Integer, nullable=True)
    min_price = Column(Numeric(20, 8), nullable=True)
    max_price = Column(Numeric(20, 8), nullable=True)
    range = Column(Numeric(20, 8), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CustomTradePlan(CustomBase):
    __tablename__ = 'trade_plans'

    plan_id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, nullable=False)
    trade_plan_md = Column(String)
    entry_zone = Column(String)
    exit_zone = Column(String)
    tp_levels = Column(JSON)
    sl_level = Column(Numeric(20, 8))
    leverage = Column(Numeric(20, 8))
    margin_rate = Column(Numeric(20, 8))
    entry_reason = Column(String)
    data_source = Column(String, default='Manual')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


custom_metadata = CustomBase.metadata
