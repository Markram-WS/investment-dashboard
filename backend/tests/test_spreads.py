"""Spread-pair coverage via the portfolio analytics endpoint.

Spread pairs used to be exposed by a dedicated /portfolios/{id}/spreads route.
They now live in the portfolio analytics payload as ``spread_pairs``: two
active orders form a pair only when they cross-link each other
(``a.linked_order_id == b.order_id`` and ``b.linked_order_id == a.order_id``).
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import get_db
from app.models import Base, configure_mappers
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker


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
async def test_portfolio_analytics_spread_pairs_empty(async_client):
    """A portfolio without cross-linked orders reports no spread pairs."""
    portfolio_resp = await async_client.post("/api/v1/portfolios", json={
        "portfolio_name": "Test Portfolio",
        "port_type": "Managed Fund",
        "risk_status": "Safe",
    })
    assert portfolio_resp.status_code == 201
    portfolio_id = portfolio_resp.json()["portfolio_id"]

    resp = await async_client.get(f"/api/v1/analytics/portfolio/{portfolio_id}")
    assert resp.status_code == 200
    data = resp.json()

    assert data["portfolio_id"] == portfolio_id
    assert data["portfolio_name"] == "Test Portfolio"
    assert data["spread_pairs"] == []


@pytest.mark.asyncio
async def test_portfolio_analytics_spread_pairs_with_pair(async_client):
    """Two mutually cross-linked orders form exactly one spread pair."""
    portfolio_resp = await async_client.post("/api/v1/portfolios", json={
        "portfolio_name": "Spread Portfolio",
        "port_type": "Managed Fund",
        "risk_status": "Safe",
    })
    assert portfolio_resp.status_code == 201
    portfolio_id = portfolio_resp.json()["portfolio_id"]

    plan_resp = await async_client.post("/api/v1/trade-plans", json={
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

    legs = [
        {"order_id": "spread_leg_a", "side": "Buy", "entry_price": 100.0, "linked_order_id": "spread_leg_b"},
        {"order_id": "spread_leg_b", "side": "Sell", "entry_price": 101.0, "linked_order_id": "spread_leg_a"},
    ]
    for leg in legs:
        order_resp = await async_client.post("/api/v1/orders", json={
            "plan_id": plan_id,
            "portfolio_id": portfolio_id,
            "asset_type": "Crypto",
            "qty": 1.0,
            "tp_price": 115.0,
            **leg,
        })
        assert order_resp.status_code == 201, order_resp.text

    resp = await async_client.get(f"/api/v1/analytics/portfolio/{portfolio_id}")
    assert resp.status_code == 200
    data = resp.json()

    # Exactly one pair is detected for the two mutually-linked orders.
    assert len(data["spread_pairs"]) == 1
    pair = data["spread_pairs"][0]

    leg_ids = {pair["leg_a"]["order_id"], pair["leg_b"]["order_id"]}
    assert leg_ids == {"spread_leg_a", "spread_leg_b"}
    assert pair["pair_id"] in leg_ids
    assert pair["leg_a"]["side"] != pair["leg_b"]["side"]
    assert abs(pair["spread_diff"]) == pytest.approx(1.0)
    # The detail payload keeps the zone field; no zone is derived for a pair.
    assert "zone" in pair

    # Both orders are marked as spread legs in the order list.
    link_types = {o["order_id"]: o["link_type"] for o in data["active_orders"]}
    assert link_types["spread_leg_a"] == "spread"
    assert link_types["spread_leg_b"] == "spread"
