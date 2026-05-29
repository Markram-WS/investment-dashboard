import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models import Base, configure_mappers, Portfolio, TradePlan, ActiveOrder
from app.database import get_db
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from decimal import Decimal


# Module-level test engine (created once per session)
test_engine = None
TestSessionLocal = None


def get_test_engine():
    global test_engine, TestSessionLocal
    if test_engine is None:
        test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        TestSessionLocal = sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)
    return test_engine, TestSessionLocal


async def override_get_db():
    _, Session = get_test_engine()
    async with Session() as session:
        yield session


@pytest.fixture(scope="session", autouse=True)
async def setup_test_engine():
    """Create test database tables once per session."""
    configure_mappers()
    engine, _ = get_test_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture
async def async_client():
    """Async HTTP client for testing."""
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client


@pytest.fixture
async def sample_portfolios():
    """Seed test portfolios for risk API tests with guaranteed isolation."""
    _, Session = get_test_engine()
    
    # Ensure clean state before inserting - delete all portfolios and reset sequence
    async with Session() as session:
        # Delete all dependent records first
        await session.execute(text("DELETE FROM active_orders"))
        await session.execute(text("DELETE FROM trade_plans"))
        await session.execute(text("DELETE FROM trade_history"))
        await session.execute(text("DELETE FROM portfolio_nav_history"))
        await session.execute(text("DELETE FROM simulation_models"))
        await session.execute(text("DELETE FROM decision_journals"))
        await session.execute(text("DELETE FROM transactions"))
        # Delete all portfolios
        await session.execute(text("DELETE FROM portfolios"))
        await session.commit()
    
    # Portfolio 1: Safe (id=1) - margin=10000, buffer=5000, available=3000, money_market=1000
    p1 = Portfolio(
        portfolio_name="Safe Portfolio",
        port_type="Main",
        risk_status="Safe",
        margin_locked=Decimal("10000"),
        cash_buffer_limit=Decimal("5000"),
        available_cash=Decimal("3000"),
        money_market=Decimal("1000")
    )
    
    # Portfolio 2: Warning (id=2) - margin=5000, buffer=2000, available=500, money_market=300
    p2 = Portfolio(
        portfolio_name="Warning Portfolio",
        port_type="Secondary",
        risk_status="Warning",
        margin_locked=Decimal("5000"),
        cash_buffer_limit=Decimal("2000"),
        available_cash=Decimal("500"),
        money_market=Decimal("300")
    )
    
    # Portfolio 3: Danger (id=3) - zero cash
    p3 = Portfolio(
        portfolio_name="Danger Portfolio",
        port_type="Hedge",
        risk_status="Danger",
        margin_locked=Decimal("8000"),
        cash_buffer_limit=Decimal("4000"),
        available_cash=Decimal("0"),
        money_market=Decimal("0")
    )
    
    # Portfolio 4: Main pool data (id=4) - the values from test expectations
    # margin=23000, buffer=11000, available=3800, money_market=1600
    p4 = Portfolio(
        portfolio_name="Main Pool",
        port_type="Main",
        risk_status="Safe",
        margin_locked=Decimal("23000"),
        cash_buffer_limit=Decimal("11000"),
        available_cash=Decimal("3800"),
        money_market=Decimal("1600")
    )
    
    async with Session() as session:
        session.add_all([p1, p2, p3, p4])
        await session.commit()
        # Refresh to get assigned IDs
        for p in [p1, p2, p3, p4]:
            await session.refresh(p)
    
    yield [p1, p2, p3, p4]
    
    # Cleanup - delete in reverse order to handle foreign key constraints
    async with Session() as session:
        # Delete dependent records first
        await session.execute(text("DELETE FROM active_orders"))
        await session.execute(text("DELETE FROM trade_plans"))
        await session.execute(text("DELETE FROM trade_history"))
        await session.execute(text("DELETE FROM portfolio_nav_history"))
        await session.execute(text("DELETE FROM simulation_models"))
        await session.execute(text("DELETE FROM decision_journals"))
        await session.execute(text("DELETE FROM transactions"))
        # Then delete portfolios
        for p in [p1, p2, p3, p4]:
            await session.delete(p)
        await session.commit()