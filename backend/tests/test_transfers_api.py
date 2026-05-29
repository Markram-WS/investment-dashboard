import pytest
from httpx import AsyncClient


# -------------------------------------------------------------------------
# Cash Pool Transfer API Tests (Section 2.2)
# -------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_initiate_transfer_success(async_client):
    """Test successful transfer initiation with balance verification."""
    # First create two portfolios
    portfolio_data_1 = {
        "portfolio_name": "Source Portfolio",
        "port_type": "Active Trading",
        "available_cash": 1000.0,
        "money_market": 0.0
    }
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_1)
    assert resp.status_code == 201
    source_id = resp.json()["portfolio_id"]

    portfolio_data_2 = {
        "portfolio_name": "Dest Portfolio",
        "port_type": "Active Trading",
        "available_cash": 500.0,
        "money_market": 0.0
    }
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_2)
    assert resp.status_code == 201
    dest_id = resp.json()["portfolio_id"]

    # Initiate transfer
    transfer_data = {
        "source_portfolio_id": source_id,
        "destination_portfolio_id": dest_id,
        "amount": 300.0,
        "asset": "USD",
        "executed_by": "Manual",
        "reference_id": "TRANSFER_TEST_001"
    }
    resp = await async_client.post("/api/v1/transfers/", json=transfer_data)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending_confirmation"
    assert data["source_portfolio_id"] == source_id
    assert data["destination_portfolio_id"] == dest_id
    assert data["amount"] == 300.0


@pytest.mark.asyncio
async def test_initiate_transfer_insufficient_balance(async_client):
    """Test transfer fails when source has insufficient balance."""
    # Create portfolios
    portfolio_data_1 = {
        "portfolio_name": "Low Balance Portfolio",
        "port_type": "Active Trading",
        "available_cash": 100.0,
        "money_market": 0.0
    }
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_1)
    source_id = resp.json()["portfolio_id"]

    portfolio_data_2 = {
        "portfolio_name": "Recipient Portfolio",
        "port_type": "Active Trading",
        "available_cash": 500.0,
        "money_market": 0.0
    }
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_2)
    dest_id = resp.json()["portfolio_id"]

    # Try to transfer more than available
    transfer_data = {
        "source_portfolio_id": source_id,
        "destination_portfolio_id": dest_id,
        "amount": 500.0  # More than 100 available
    }
    resp = await async_client.post("/api/v1/transfers/", json=transfer_data)
    assert resp.status_code == 400
    assert "Insufficient balance" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_initiate_transfer_same_portfolio(async_client):
    """Test transfer fails when source equals destination."""
    transfer_data = {
        "source_portfolio_id": 1,
        "destination_portfolio_id": 1,  # Same as source
        "amount": 100.0
    }
    resp = await async_client.post("/api/v1/transfers/", json=transfer_data)
    assert resp.status_code == 400
    assert "different" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_confirm_transfer_success(async_client):
    """Test successful transfer confirmation and balance update."""
    # Setup portfolios
    portfolio_data_1 = {
        "portfolio_name": "Source",
        "port_type": "Active Trading",
        "available_cash": 1000.0,
        "money_market": 0.0
    }
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_1)
    source_id = resp.json()["portfolio_id"]

    portfolio_data_2 = {
        "portfolio_name": "Dest",
        "port_type": "Active Trading",
        "available_cash": 500.0,
        "money_market": 0.0
    }
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_2)
    dest_id = resp.json()["portfolio_id"]

    # Initiate transfer
    transfer_data = {
        "source_portfolio_id": source_id,
        "destination_portfolio_id": dest_id,
        "amount": 250.0
    }
    resp = await async_client.post("/api/v1/transfers/", json=transfer_data)
    tx_id = resp.json()["transaction_id"]

    # Verify initial balances
    resp = await async_client.get(f"/api/v1/portfolios/{source_id}")
    assert resp.json()["available_cash"] == 1000.0

    resp = await async_client.get(f"/api/v1/portfolios/{dest_id}")
    assert resp.json()["available_cash"] == 500.0

    # Confirm transfer
    confirm_data = {
        "confirmation_token": "CONFIRM_123",
        "confirmed_by": "John Doe"
    }
    resp = await async_client.post(f"/api/v1/transfers/{tx_id}/confirm", json=confirm_data)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["source_balance_after"] == 750.0
    assert data["destination_balance_after"] == 750.0

    # Verify balances updated in DB
    resp = await async_client.get(f"/api/v1/portfolios/{source_id}")
    assert resp.json()["available_cash"] == 750.0

    resp = await async_client.get(f"/api/v1/portfolios/{dest_id}")
    assert resp.json()["available_cash"] == 750.0


@pytest.mark.asyncio
async def test_confirm_nonexistent_transfer(async_client):
    """Test confirming a non-existent transfer."""
    confirm_data = {
        "confirmation_token": "TOKEN",
        "confirmed_by": "John"
    }
    resp = await async_client.post("/api/v1/transfers/99999/confirm", json=confirm_data)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_confirm_already_completed_transfer(async_client):
    """Test confirming a transfer that's already completed."""
    # Setup and complete a transfer
    portfolio_data_1 = {
        "portfolio_name": "Source",
        "port_type": "Active Trading",
        "available_cash": 1000.0
    }
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_1)
    source_id = resp.json()["portfolio_id"]

    portfolio_data_2 = {
        "portfolio_name": "Dest",
        "port_type": "Active Trading",
        "available_cash": 500.0
    }
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_2)
    dest_id = resp.json()["portfolio_id"]

    # Initiate and confirm
    transfer_data = {
        "source_portfolio_id": source_id,
        "destination_portfolio_id": dest_id,
        "amount": 100.0
    }
    resp = await async_client.post("/api/v1/transfers/", json=transfer_data)
    tx_id = resp.json()["transaction_id"]

    confirm_data = {
        "confirmation_token": "TOKEN",
        "confirmed_by": "John"
    }
    await async_client.post(f"/api/v1/transfers/{tx_id}/confirm", json=confirm_data)

    # Try confirming again
    resp = await async_client.post(f"/api/v1/transfers/{tx_id}/confirm", json=confirm_data)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_list_pending_transfers(async_client):
    """Test listing pending transfers."""
    # Setup portfolios
    portfolio_data_1 = {
        "portfolio_name": "Source",
        "port_type": "Active Trading",
        "available_cash": 1000.0
    }
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_1)
    source_id = resp.json()["portfolio_id"]

    portfolio_data_2 = {
        "portfolio_name": "Dest",
        "port_type": "Active Trading",
        "available_cash": 500.0
    }
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_2)
    dest_id = resp.json()["portfolio_id"]

    # Create multiple pending transfers
    for i in range(3):
        transfer_data = {
            "source_portfolio_id": source_id,
            "destination_portfolio_id": dest_id,
            "amount": 100.0 * (i + 1)
        }
        await async_client.post("/api/v1/transfers/", json=transfer_data)

    # List pending
    resp = await async_client.get("/api/v1/transfers/pending")
    assert resp.status_code == 200
    data = resp.json()
    # Check that the 3 newly created transfers are in the list
    # (there may be leftover transfers from other tests due to shared test DB)
    amounts = [tx["amount"] for tx in data]
    assert 100.0 in amounts
    assert 200.0 in amounts
    assert 300.0 in amounts
    for tx in data:
        assert tx["status"] == "pending_confirmation"


@pytest.mark.asyncio
async def test_get_specific_transfer(async_client):
    """Test getting a specific transfer by ID."""
    # Setup
    portfolio_data_1 = {"portfolio_name": "Source", "port_type": "Active Trading", "available_cash": 1000.0}
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_1)
    source_id = resp.json()["portfolio_id"]

    portfolio_data_2 = {"portfolio_name": "Dest", "port_type": "Active Trading", "available_cash": 500.0}
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_2)
    dest_id = resp.json()["portfolio_id"]

    # Create transfer
    transfer_data = {
        "source_portfolio_id": source_id,
        "destination_portfolio_id": dest_id,
        "amount": 150.0
    }
    resp = await async_client.post("/api/v1/transfers/", json=transfer_data)
    tx_id = resp.json()["transaction_id"]

    # Get transfer
    resp = await async_client.get(f"/api/v1/transfers/{tx_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["transaction_id"] == tx_id
    assert data["amount"] == 150.0


@pytest.mark.asyncio
async def test_transfer_uses_money_market(async_client):
    """Test transfer uses money_market when available_cash is insufficient."""
    # Setup with low available_cash but high money_market
    portfolio_data_1 = {
        "portfolio_name": "Source",
        "port_type": "Active Trading",
        "available_cash": 100.0,
        "money_market": 500.0
    }
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_1)
    source_id = resp.json()["portfolio_id"]

    portfolio_data_2 = {"portfolio_name": "Dest", "port_type": "Active Trading", "available_cash": 500.0}
    resp = await async_client.post("/api/v1/portfolios/", json=portfolio_data_2)
    dest_id = resp.json()["portfolio_id"]

    # Transfer should succeed (100 available + 500 money_market = 600 total)
    transfer_data = {
        "source_portfolio_id": source_id,
        "destination_portfolio_id": dest_id,
        "amount": 300.0
    }
    resp = await async_client.post("/api/v1/transfers/", json=transfer_data)
    assert resp.status_code == 201
    tx_id = resp.json()["transaction_id"]

    # Confirm
    confirm_data = {"confirmation_token": "TOKEN", "confirmed_by": "John"}
    resp = await async_client.post(f"/api/v1/transfers/{tx_id}/confirm", json=confirm_data)
    data = resp.json()
    
    # Available_cash should be 0, money_market should be 300 (100-300=-200→0, 500-200=300)
    resp = await async_client.get(f"/api/v1/portfolios/{source_id}")
    portfolio = resp.json()
    assert portfolio["available_cash"] == 0.0
    assert portfolio["money_market"] == 300.0


@pytest.mark.asyncio
async def test_transfer_validation_required_fields(async_client):
    """Test validation of required fields."""
    # Missing amount
    resp = await async_client.post("/api/v1/transfers/", json={
        "source_portfolio_id": 1,
        "destination_portfolio_id": 2
    })
    assert resp.status_code == 422

    # Missing portfolio IDs
    resp = await async_client.post("/api/v1/transfers/", json={
        "amount": 100.0
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_transfer_negative_amount(async_client):
    """Test that negative amounts are rejected."""
    resp = await async_client.post("/api/v1/transfers/", json={
        "source_portfolio_id": 1,
        "destination_portfolio_id": 2,
        "amount": -100.0
    })
    assert resp.status_code == 422