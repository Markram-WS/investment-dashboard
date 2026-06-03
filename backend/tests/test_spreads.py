"""Tests for portfolio spreads endpoint."""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import get_db
from app.models import Base, configure_mappers, Portfolio, ActiveOrder, TradeHistory
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from decimal import Decimal


# Test engine setup
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


@pytest.mark.asyncio
async def test_portfolio_spreads_endpoint_empty(async_client):
    """Test the portfolio spreads endpoint with no spread pairs."""
    # Create a portfolio without spread pairs
    portfolio_resp = await async_client.post("/api/v1/portfolios/", json={
        "portfolio_name": "Test Portfolio",
        "port_type": "Spread Strategy",
        "risk_status": "Safe",
    })
    assert portfolio_resp.status_code == 201
    portfolio_id = portfolio_resp.json()["portfolio_id"]

    # Call the spreads endpoint
    resp = await async_client.get(f"/api/v1/portfolios/{portfolio_id}/spreads")
    assert resp.status_code == 200
    data = resp.json()
    
    # Verify response structure
    assert data["portfolio_id"] == portfolio_id
    assert data["portfolio_name"] == "Test Portfolio"
    assert data["port_type"] == "Spread Strategy"
    assert data["risk_status"] == "Safe"
    assert data["spread_pairs"] == []
    assert data["unpaired_orders"] == []


@pytest.mark.asyncio
async def test_portfolio_spreads_endpoint_with_pairs(async_client):
    """Test the portfolio spreads endpoint with spread pairs."""
    # Create a portfolio
    portfolio_resp = await async_client.post("/api/v1/portfolios/", json={
        "portfolio_name": "Spread Portfolio",
        "port_type": "Spread Strategy",
        "risk_status": "Safe",
    })
    assert portfolio_resp.status_code == 201
    portfolio_id = portfolio_resp.json()["portfolio_id"]

    # Create a trade plan
    plan_resp = await async_client.post("/api/v1/trade-plans/", json={
        "portfolio_id": portfolio_id,
        "entry_zone": "100-110",
        "exit_zone": "90-80",
        "tp_levels": [115, 130],
        "sl_level": 85,
        "leverage": 5,
        "margin_rate": 0.2,
        "entry_reason": "test spread",
    })
    assert plan_resp.status_code == 201
    plan_id = plan_resp.json()["plan_id"]

    # Create two orders with the same linked_order_id to form a pair
    for i in range(2):
        order_resp = await async_client.post("/api/v1/orders/", json={
            "plan_id": plan_id,
            "portfolio_id": portfolio_id,
            "asset_type": "Crypto",
            "side": "Buy" if i == 0 else "Sell",
            "qty": 1.0,
            "entry_price": 100.0 + i,
            "tp_price": 115.0,
            "linked_order_id": "spread_test_1",
        })
        assert order_resp.status_code == 201

    # Call the spreads endpoint
    resp = await async_client.get(f"/api/v1/portfolios/{portfolio_id}/spreads")
    assert resp.status_code == 200
    data = resp.json()
    
    # Verify the spread pair was formed
    assert len(data["spread_pairs"]) == 1
    pair = data["spread_pairs"][0]
    assert pair["pair_id"] == "spread_test_1"
    assert "leg_a" in pair
    assert "leg_b" in pair
    
    # Verify zone is calculated based on spread_diff (not index-based)
    assert "zone" in pair
    # spread_diff = 101 - 100 = 1, so Zone 1 (< 5)
    assert pair["zone"] == "Zone 1"
    
    # Verify one leg is Buy and one is Sell (they should be different)
    assert pair["leg_a"]["side"] in ["Buy", "Sell"]
    assert pair["leg_b"]["side"] in ["Buy", "Sell"]
    assert pair["leg_a"]["side"] != pair["leg_b"]["side"]  # One Buy, one Sell