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
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with ai_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="Investment Dashboard API",
    description="Professional investment management system",
    version="0.1.0",
    redirect_slashes=False,
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
app.include_router(assets.router, prefix="/api/v1/whitelist_assets", tags=["assets"])
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


@app.get("/")
async def root():
    return {"message": "Investment Dashboard API", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
