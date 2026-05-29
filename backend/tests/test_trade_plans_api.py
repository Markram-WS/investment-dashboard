import pytest
from httpx import AsyncClient

# ----------------------------------------------------------------------
# Trade Plan API tests
# ----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_create_trade_plan(async_client):
    """Test creating a trade plan with valid payload."""
    # First create a portfolio (required for trade plan)
    portfolio_payload = {
        "portfolio_name": "Test Portfolio",
        "port_type": "Active Trading",
        "target_ratio": {"BTC": 0.4, "ETH": 0.3, "USD": 0.3},
        "cash_buffer_limit": 1000,
    }
    portfolio_resp = await async_client.post("/api/v1/portfolios/", json=portfolio_payload)
    assert portfolio_resp.status_code == 201
    portfolio_id = portfolio_resp.json()["portfolio_id"]

    # Create trade plan with required portfolio_id
    plan_payload = {
        "portfolio_id": portfolio_id,
        "entry_zone": "100-110",
        "exit_zone": "90-80",
        "tp_levels": [115, 130],
        "sl_level": 85,
        "leverage": 5,
        "margin_rate": 0.2,
        "entry_reason": "momentum breakout",
    }
    
    response = await async_client.post("/api/v1/trade-plans/", json=plan_payload)
    assert response.status_code == 201, f"Expected 201 Created, got {response.status_code}"
    data = response.json()
    assert "plan_id" in data
    assert data["entry_zone"] == "100-110"