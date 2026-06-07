from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, ai_engine
from app.models import Base
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
    orders_groups,
    performance,
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
        # Migrate portfolios table with is_custom column
        result = await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name='portfolios' AND column_name='is_custom'")
        )
        if not result.scalar():
            await conn.execute(text("ALTER TABLE portfolios ADD COLUMN is_custom BOOLEAN DEFAULT FALSE"))
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


@app.get("/")
async def root():
    return {"message": "Investment Dashboard API", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
