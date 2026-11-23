from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, ai_engine
from app.models import Base
import app.managed_fund_models  # noqa: F401 - register models for table creation
from app.routers import (
    portfolios,
    trade_plans,
    active_orders,
    analytics,
    ai_agents,
    overview,
    transactions,
    transfers,
    journal,
    risk,
    rebalance,
    trade_history,
    assets,
    asset_groups,
    brokers,
    orders_groups,
    performance,
    managed_funds,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        # Migrate existing whitelist_assets table with new columns
        for col in ("name VARCHAR", "source VARCHAR DEFAULT 'manual'", "group_id INTEGER REFERENCES asset_groups(id)", "price NUMERIC(20,8)", "change_24h NUMERIC(10,4)", "updated_at TIMESTAMP DEFAULT NOW()"):
            col_name = col.split()[0]
            result = await conn.execute(
                text(f"SELECT column_name FROM information_schema.columns WHERE table_name='whitelist_assets' AND column_name='{col_name}'")
            )
            if not result.scalar():
                await conn.execute(text(f"ALTER TABLE whitelist_assets ADD COLUMN {col}"))
        # 2026-11-23: provider symbol used to fetch prices (may differ from the
        # dashboard ticker, e.g. PTT.BK). Backfill existing rows with the ticker.
        try:
            await conn.execute(text(
                "ALTER TABLE whitelist_assets ADD COLUMN IF NOT EXISTS price_symbol VARCHAR"
            ))
            await conn.execute(text(
                "UPDATE whitelist_assets SET price_symbol = ticker WHERE price_symbol IS NULL"
            ))
        except Exception:
            pass
        # Migrate portfolios table with is_custom column
        result = await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name='portfolios' AND column_name='is_custom'")
        )
        if not result.scalar():
            await conn.execute(text("ALTER TABLE portfolios ADD COLUMN is_custom BOOLEAN DEFAULT FALSE"))
        # 2026-11-18: per-order remark; trade history keeps its JSON payload, renamed.
        try:
            await conn.execute(text("ALTER TABLE active_orders ADD COLUMN IF NOT EXISTS remark VARCHAR"))
            await conn.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trade_history' AND column_name = 'comments')
                       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trade_history' AND column_name = 'remark') THEN
                        ALTER TABLE trade_history RENAME COLUMN comments TO remark;
                    END IF;
                END $$;
            """))
        except Exception:
            pass
        # 2026-11-23: custom portfolios may map a foreign broker schema instead
        # of owning tables. Null keeps the legacy custom behaviour.
        try:
            await conn.execute(text(
                "ALTER TABLE custom_portfolio_connections "
                "ADD COLUMN IF NOT EXISTS mapping_config JSON"
            ))
        except Exception:
            pass
        # 2026-11-18: closed/canceled orders keep their own free-text remark.
        try:
            await conn.execute(text("ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS order_remark VARCHAR"))
        except Exception:
            pass
        # 2026-11-18: risk model phase 1 - brokers, contract spec on the asset row,
        # portfolio product/X/initial capital. Product spec key (broker_id, ticker).
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS brokers (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR NOT NULL UNIQUE,
                    name VARCHAR NOT NULL,
                    default_margin_rate NUMERIC(10,6) DEFAULT 0,
                    currency VARCHAR DEFAULT 'USD',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            await conn.execute(text(
                "INSERT INTO brokers (code, name) VALUES ('DF', 'Unassigned') "
                "ON CONFLICT (code) DO NOTHING"
            ))
            # Backfill brokers rows created before server defaults existed.
            await conn.execute(text(
                "UPDATE brokers SET default_margin_rate = 0 WHERE default_margin_rate IS NULL"
            ))
            await conn.execute(text(
                "UPDATE brokers SET currency = 'USD' WHERE currency IS NULL"
            ))
            await conn.execute(text(
                "UPDATE brokers SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"
            ))
            await conn.execute(text(
                "ALTER TABLE whitelist_assets ADD COLUMN IF NOT EXISTS broker_id INTEGER"
            ))
            await conn.execute(text(
                "ALTER TABLE whitelist_assets ADD COLUMN IF NOT EXISTS multiplier NUMERIC(20,8) NOT NULL DEFAULT 1"
            ))
            await conn.execute(text(
                "ALTER TABLE whitelist_assets ADD COLUMN IF NOT EXISTS margin_rate NUMERIC(10,6) NOT NULL DEFAULT 0"
            ))
            await conn.execute(text(
                "UPDATE whitelist_assets SET broker_id = (SELECT id FROM brokers WHERE code = 'DF') "
                "WHERE broker_id IS NULL"
            ))
            await conn.execute(text(
                "ALTER TABLE whitelist_assets DROP CONSTRAINT IF EXISTS whitelist_assets_ticker_key"
            ))
            await conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_broker_ticker ON whitelist_assets (broker_id, ticker)"
            ))
            await conn.execute(text(
                "ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS broker_id INTEGER"
            ))
            await conn.execute(text(
                "ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS product_ticker VARCHAR"
            ))
            await conn.execute(text(
                "ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS x_amount NUMERIC(20,8) NOT NULL DEFAULT 0"
            ))
            await conn.execute(text(
                "ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS initial_capital NUMERIC(20,8) NOT NULL DEFAULT 0"
            ))
            await conn.execute(text(
                "UPDATE portfolios p SET broker_id = (SELECT id FROM brokers WHERE code = 'DF') "
                "WHERE p.broker_id IS NULL AND p.port_type = 'Active Trading'"
            ))
            await conn.execute(text(
                "UPDATE portfolios p SET product_ticker = ("
                "  SELECT a.asset_type FROM active_orders a WHERE a.portfolio_id = p.portfolio_id "
                "  GROUP BY a.asset_type ORDER BY count(*) DESC LIMIT 1"
                ") WHERE p.product_ticker IS NULL AND p.port_type = 'Active Trading'"
            ))
            await conn.execute(text(
                "UPDATE portfolios SET initial_capital = available_cash WHERE initial_capital = 0"
            ))
        except Exception:
            pass
    async with ai_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="Investment Dashboard API",
    description="Professional investment management system",
    version="0.1.0",

    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(assets.router, prefix="/api/v1/assets", tags=["assets"])
app.include_router(asset_groups.router, prefix="/api/v1/asset-groups", tags=["asset-groups"])
app.include_router(brokers.router, prefix="/api/v1/brokers", tags=["brokers"])
app.include_router(portfolios.router, prefix="/api/v1/portfolios", tags=["portfolios"])
app.include_router(
    trade_plans.router, prefix="/api/v1/trade-plans", tags=["trade-plans"]
)
app.include_router(active_orders.router, prefix="/api/v1/orders", tags=["orders"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(ai_agents.router, prefix="/api/v1/ai", tags=["ai-agents"])
app.include_router(overview.router, prefix="/api/v1/overview", tags=["overview"])
app.include_router(
    transactions.router, prefix="/api/v1/transactions", tags=["transactions"]
)
app.include_router(
    trade_history.router, prefix="/api/v1/trade-history", tags=["trade-history"]
)
app.include_router(transfers.router, prefix="/api/v1/transfers", tags=["transfers"])
app.include_router(journal.router, prefix="/api/v1/journal", tags=["journal"])
app.include_router(risk.router, prefix="/api/v1/risk", tags=["risk"])
app.include_router(rebalance.router, prefix="/api/v1/rebalance", tags=["rebalance"])
app.include_router(orders_groups.router, prefix="/api/v1/orders-groups", tags=["orders-groups"])
app.include_router(performance.router, prefix="/api/v1/analytics/performance", tags=["analytics"])
app.include_router(managed_funds.router, prefix="/api/v1/managed-funds", tags=["managed-funds"])


@app.get("/")
async def root():
    return {"message": "Investment Dashboard API", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
