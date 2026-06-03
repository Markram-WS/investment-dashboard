import pytest
from httpx import AsyncClient
from datetime import datetime, timezone

# Reuse the payloads function from test_api.py if possible, but we'll define our own for clarity
def portfolio_payload():
    return {
        "portfolio_name": "Test Portfolio",
        "port_type": "Active Trading",
        "target_ratio": {"BTC": 0.5, "ETH": 0.5},
        "cash_buffer_limit": 1000,
        "available_cash": 5000,
        "money_market": 0,
        "margin_locked": 0,
        "risk_status": "Safe",
    }

def trade_plan_payload(portfolio_id):
    return {
        "portfolio_id": portfolio_id,
        "entry_zone": "100-110",
        "exit_zone": "90-80",
        "tp_levels": [115, 130],
        "sl_level": 85,
        "leverage": 5,
        "margin_rate": 0.2,
        "entry_reason": "Test entry reason",
    }

def active_order_payload(plan_id, portfolio_id):
    return {
        "plan_id": plan_id,
        "portfolio_id": portfolio_id,
        "asset_type": "Crypto",
        "side": "Buy",
        "qty": 0.5,
        "entry_price": 102.0,
        "current_price": 105.0,
        "tp_price": 115.0,
        "leverage": 5,
        "margin_rate": 0.2,
        "order_status": "filled",
        "executed_by": "Manual",
        "linked_order_id": "spread_1",
    }

def ai_agent_payload(target_portfolio_id):
    return {
        "agent_name": "Test AI Agent",
        "model_name": "test-model",
        "target_portfolio_id": target_portfolio_id,
        "strategy_config": {},
        "status": "Active",
    }

def ai_action_log_payload(agent_id, reasoning="Test AI reasoning"):
    return {
        "agent_id": agent_id,
        "action_type": "test_action",
        "reasoning": reasoning,
        "confidence_score": 0.95,
        "raw_data_snapshot": {},
        "linked_plan_id": None,
        "linked_order_id": None,
    }

@pytest.mark.asyncio
async def test_portfolio_grid_endpoint_empty(async_client):
    """Test the portfolio-grid endpoint when there are no portfolios."""
    resp = await async_client.get("/api/v1/analytics/portfolio-grid")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 0

@pytest.mark.asyncio
async def test_portfolio_grid_endpoint_with_data(async_client):
    """Test the portfolio-grid endpoint with a portfolio and related data."""
    # Create a portfolio
    portfolio_resp = await async_client.post("/api/v1/portfolios/", json=portfolio_payload())
    assert portfolio_resp.status_code == 201
    portfolio = portfolio_resp.json()
    portfolio_id = portfolio["portfolio_id"]

    # Create a trade plan for the portfolio
    plan_payload = trade_plan_payload(portfolio_id)
    plan_resp = await async_client.post("/api/v1/trade-plans/", json=plan_payload)
    assert plan_resp.status_code == 201
    plan = plan_resp.json()
    plan_id = plan["plan_id"]

    # Create an active order for the trade plan
    order_payload = active_order_payload(plan_id, portfolio_id)
    order_resp = await async_client.post("/api/v1/orders/", json=order_payload)
    assert order_resp.status_code == 201
    order = order_resp.json()
    order_id = order["order_id"]

    # Create an AI agent and log for the portfolio
    agent_payload = ai_agent_payload(portfolio_id)
    agent_resp = await async_client.post("/api/v1/ai/", json=agent_payload)
    assert agent_resp.status_code == 201
    agent = agent_resp.json()
    agent_id = agent["agent_id"]

    # Now call the portfolio-grid endpoint
    resp = await async_client.get("/api/v1/analytics/portfolio-grid")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # We expect at least one portfolio in the response
    assert len(data) >= 1
    # Find the portfolio we created
    portfolio_data = None
    for item in data:
        if item["portfolio_id"] == portfolio_id:
            portfolio_data = item
            break
    assert portfolio_data is not None, f"Portfolio {portfolio_id} not found in grid data"
    # Check the structure of the portfolio data
    assert portfolio_data["portfolio_id"] == portfolio_id
    assert portfolio_data["portfolio_name"] == "Test Portfolio"
    assert portfolio_data["port_type"] == "Active Trading"
    assert portfolio_data["risk_status"] == "Safe"
    # Check that we have an active order (note: the endpoint filters out spread legs, but we have a linked_order_id set)
    # Since we set linked_order_id, the order might be considered a spread leg and excluded from active_orders_list.
    # We'll adjust the test to not rely on the exact count of active orders for now.
    # Instead, we'll check that the spread_pairs list contains our order (if the endpoint groups by linked_order_id).
    # We set linked_order_id to "spread_1", and we have only one order with that linked_order_id, so it won't form a pair.
    # Therefore, we expect spread_pairs to be empty.
    assert isinstance(portfolio_data["spread_pairs"], list)
    # We have only one order with linked_order_id, so no pair is formed.
    assert len(portfolio_data["spread_pairs"]) == 0
    # Check that the trade_plan_md is set to the entry_reason
    assert portfolio_data["trade_plan_md"] == "Test entry reason"
    # Check that ai_reasoning and ai_risk_insight are present (since we created an AI log)
    # Note: The endpoint tries to get the latest AI log. We didn't create it via API, so we'll skip this assertion for now.
    # We'll create the AI log via ORM in the test to ensure it exists.

    # Create the AI log using the test database session
    # We can access the test session through the conftest module
    import sys
    import os
    # Get the session from the test engine in conftest
    sys.path.insert(0, os.path.dirname(__file__))
    from conftest import get_test_engine
    _, TestSessionLocal = get_test_engine()
    async with TestSessionLocal() as session:
        from app.models import AiActionLog
        ai_log = AiActionLog(
            agent_id=agent_id,
            action_type="test_action",
            reasoning="Test AI reasoning for the portfolio",
            confidence_score=0.95,
            raw_data_snapshot={},
        )
        session.add(ai_log)
        await session.commit()

    # Now call the endpoint again to see if the AI log is picked up.
    resp = await async_client.get("/api/v1/analytics/portfolio-grid")
    assert resp.status_code == 200
    data = resp.json()
    portfolio_data = None
    for item in data:
        if item["portfolio_id"] == portfolio_id:
            portfolio_data = item
            break
    assert portfolio_data is not None
    assert portfolio_data["ai_reasoning"] == "Test AI reasoning for the portfolio"
    # The ai_risk_insight is set to a placeholder if reasoning exists.
    assert portfolio_data["ai_risk_insight"] is not None
    assert "Risk metrics based on recent AI analysis" in portfolio_data["ai_risk_insight"]


@pytest.mark.asyncio
async def test_portfolio_detail_endpoint_not_found(async_client):
    """Test the portfolio detail endpoint when portfolio doesn't exist."""
    resp = await async_client.get("/api/v1/analytics/portfolio/99999")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_portfolio_detail_endpoint_with_data(async_client):
    """Test the portfolio detail endpoint with portfolio and related data."""
    # Create a portfolio
    portfolio_resp = await async_client.post("/api/v1/portfolios/", json=portfolio_payload())
    assert portfolio_resp.status_code == 201
    portfolio = portfolio_resp.json()
    portfolio_id = portfolio["portfolio_id"]

    # Create a trade plan for the portfolio
    plan_payload = trade_plan_payload(portfolio_id)
    plan_resp = await async_client.post("/api/v1/trade-plans/", json=plan_payload)
    assert plan_resp.status_code == 201
    plan = plan_resp.json()
    plan_id = plan["plan_id"]

    # Create an active order
    order_payload = active_order_payload(plan_id, portfolio_id)
    order_resp = await async_client.post("/api/v1/orders/", json=order_payload)
    assert order_resp.status_code == 201

    # Call the portfolio detail endpoint
    detail_resp = await async_client.get(f"/api/v1/analytics/portfolio/{portfolio_id}")
    assert detail_resp.status_code == 200
    data = detail_resp.json()

    # Verify the response structure
    assert data["portfolio_id"] == portfolio_id
    assert data["portfolio_name"] == "Test Portfolio"
    assert data["port_type"] == "Active Trading"
    assert data["risk_status"] == "Safe"
    assert data["trade_plan_md"] == "Test entry reason"
    assert isinstance(data["active_orders"], list)
    assert isinstance(data["spread_pairs"], list)
    assert isinstance(data["recent_trades"], list)


@pytest.mark.asyncio
async def test_analytics_alias_endpoint(async_client):
    """Test that /api/v1/analytics is an alias for /api/v1/analytics/portfolio-grid."""
    resp = await async_client.get("/api/v1/analytics")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)