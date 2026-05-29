import pytest
import json
from httpx import AsyncClient

# ----------------------------------------------------------------------
# Helper utilities
# ----------------------------------------------------------------------
def payloads():
    """Simple factory for common request payloads."""
    return {
        "portfolio": {
            "portfolio_name": "Alpha Grid",
            "port_type": "Active Trading",
            "target_ratio": {"BTC": 0.4, "ETH": 0.3, "USD": 0.3},
            "cash_buffer_limit": 1000,
        },
        "trade_plan": {
            "portfolio_id": 1,
            "entry_zone": "100-110",
            "exit_zone": "90-80",
            "tp_levels": [115, 130],
            "sl_level": 85,
            "leverage": 5,
            "margin_rate": 0.2,
            "entry_reason": "momentum breakout",
        },
        "order": {
            "plan_id": 1,
            "asset_type": "Crypto",
            "side": "Buy",
            "qty": 0.5,
            "entry_price": 102.0,
            "tp_price": 115.0,
        },
    }

# ----------------------------------------------------------------------
# Portfolio tests
# ----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_portfolio_create_and_read(async_client):
    payload = payloads()["portfolio"]

    # 1️⃣ Create
    resp = await async_client.post("/api/v1/portfolios/", json=payload)
    assert resp.status_code == 201
    portfolio_id = resp.json()["portfolio_id"]

    # 2️⃣ List – should contain at least the created portfolio
    resp = await async_client.get("/api/v1/portfolios/")
    assert resp.status_code == 200
    data = resp.json()
    assert any(p["portfolio_id"] == portfolio_id for p in data)

    # 3️⃣ Retrieve by id
    resp = await async_client.get(f"/api/v1/portfolios/{portfolio_id}")
    assert resp.status_code == 200
    assert resp.json()["portfolio_name"] == payload["portfolio_name"]

    # 4️⃣ Delete (if the API supports DELETE – optional
    resp = await async_client.delete(f"/api/v1/portfolios/{portfolio_id}")
    assert resp.status_code in (200, 204)

# ----------------------------------------------------------------------
# Trade‑Plan tests
# ----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_trade_plan_create_read_delete(async_client):
    # First create a portfolio to own the plan
    portfolio_resp = await async_client.post("/api/v1/portfolios/", json=payloads()["portfolio"])
    portfolio_id = portfolio_resp.json()["portfolio_id"]

    plan_payload = payloads()["trade_plan"]
    plan_payload["portfolio_id"] = portfolio_id

    # 1️⃣ Create trade plan
    resp = await async_client.post("/api/v1/trade-plans/", json=plan_payload)
    assert resp.status_code == 201
    plan_id = resp.json()["plan_id"]

    # 2️⃣ List – should include the newly created plan
    resp = await async_client.get("/api/v1/trade-plans/")
    assert resp.status_code == 200
    plans = resp.json()
    assert any(p["plan_id"] == plan_id for p in plans)

    # 3️⃣ Retrieve by id
    resp = await async_client.get(f"/api/v1/trade-plans/{plan_id}")
    assert resp.status_code == 200
    assert resp.json()["entry_zone"] == plan_payload["entry_zone"]

    # 4️⃣ Delete the plan
    resp = await async_client.delete(f"/api/v1/trade-plans/{plan_id}")
    assert resp.status_code == 204

# ----------------------------------------------------------------------
# Active‑Order tests
# ----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_active_order_create_status(async_client):
    # Setup: portfolio + trade plan
    portfolio_resp = await async_client.post("/api/v1/portfolios/", json=payloads()["portfolio"])
    portfolio_id = portfolio_resp.json()["portfolio_id"]

    plan_resp = await async_client.post("/api/v1/trade-plans/", json={**payloads()["trade_plan"], "portfolio_id": portfolio_id})
    plan_id = plan_resp.json()["plan_id"]

    # Create order linked to the plan
    order_payload = payloads()["order"]
    order_payload["plan_id"] = plan_id
    order_payload["portfolio_id"] = portfolio_id

    resp = await async_client.post("/api/v1/orders/", json=order_payload)
    assert resp.status_code == 201
    order_id = resp.json()["order_id"]

    # Verify order retrieval
    resp = await async_client.get(f"/api/v1/orders/{order_id}")
    assert resp.status_code == 200
    assert resp.json()["order_status"] in ("pending_sync", "filled", "cancel_pending")

    # Update order status via PATCH (status transition endpoint)
    resp = await async_client.patch(f"/api/v1/orders/{order_id}/status", json={"new_status": "filled"})
    assert resp.status_code == 200

    # Verify new status persisted
    resp = await async_client.get(f"/api/v1/orders/{order_id}")
    assert resp.json()["order_status"] == "filled"


# ----------------------------------------------------------------------
# Portfolio Types tests (Section 2.1)
# ----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_portfolio_types(async_client):
    """Test the GET /api/v1/portfolios/types endpoint."""
    resp = await async_client.get("/api/v1/portfolios/types")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 3

    # Check for required portfolio types
    type_names = [p["type_name"] for p in data]
    assert "Managed Fund" in type_names
    assert "Active Trading" in type_names
    assert "Spread Strategy" in type_names

    # Check structure of each type
    for ptype in data:
        assert "type_name" in ptype
        assert "description" in ptype
        assert "logic" in ptype