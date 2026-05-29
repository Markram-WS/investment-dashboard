import pytest
import json
from httpx import AsyncClient

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
        }
    }

# ----------------------------------------------------------------------
# Transaction tests (the consolidated ledger)
# ----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_get_transactions_empty(async_client):
    """Test getting transactions when database is empty"""
    resp = await async_client.get("/api/v1/transactions/")
    assert resp.status_code == 200
    assert resp.json() == []

@pytest.mark.asyncio
async def test_create_and_get_transaction(async_client):
    """Test creating a transaction and retrieving it"""
    # Create a funding transaction
    transaction_data = {
        "transaction_type": "Funding",
        "asset": "USD",
        "amount": 1000.0,
        "source_portfolio_id": None,
        "destination_portfolio_id": None,
        "executed_by": "Manual",
        "status": "completed",
        "reference_id": "DEPOSIT_001",
        "audit_labels": {"source": "bank_transfer"}
    }

    # Create transaction
    resp = await async_client.post("/api/v1/transactions/", json=transaction_data)
    assert resp.status_code == 201
    created = resp.json()
    transaction_id = created["transaction_id"]

    # Get the transaction
    resp = await async_client.get(f"/api/v1/transactions/{transaction_id}")
    assert resp.status_code == 200
    fetched = resp.json()
    assert fetched["transaction_id"] == transaction_id
    assert fetched["transaction_type"] == "Funding"
    assert fetched["amount"] == 1000.0

@pytest.mark.asyncio
async def test_get_transactions_with_data(async_client):
    """Test getting transactions list with multiple transactions"""
    # Create multiple transactions
    transactions = [
        {
            "transaction_type": "Funding",
            "asset": "USD",
            "amount": 500.0,
            "executed_by": "Manual",
            "reference_id": "DEP_001"
        },
        {
            "transaction_type": "Trade",
            "asset": "BTC",
            "amount": 0.01,
            "source_portfolio_id": 1,
            "destination_portfolio_id": 2,
            "executed_by": "Bot",
            "reference_id": "TRADE_001"
        },
        {
            "transaction_type": "Transfer",
            "asset": "ETH",
            "amount": 0.5,
            "source_portfolio_id": 1,
            "destination_portfolio_id": 3,
            "executed_by": "AI",
            "reference_id": "XFER_001"
        }
    ]

    created_ids = []
    for tx_data in transactions:
        resp = await async_client.post("/api/v1/transactions/", json=tx_data)
        assert resp.status_code == 201
        created_ids.append(resp.json()["transaction_id"])

    # Get all transactions
    resp = await async_client.get("/api/v1/transactions/")
    assert resp.status_code == 200
    data = resp.json()
    # Check that each transaction is present by reference_id
    # (may include transactions from earlier tests due to shared DB)
    ref_ids = {t["reference_id"] for t in data}
    assert "DEP_001" in ref_ids
    assert "TRADE_001" in ref_ids
    assert "XFER_001" in ref_ids
    # Verify at least our 3 transactions are present
    assert len(data) >= 3

@pytest.mark.asyncio
async def test_get_nonexistent_transaction(async_client):
    """Test getting a transaction that doesn't exist"""
    resp = await async_client.get("/api/v1/transactions/99999")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Transaction not found"

@pytest.mark.asyncio
async def test_transaction_types(async_client):
    """Test different transaction types"""
    tx_types = [
        ("Funding", "USD", 1000.0, None, None, "Manual"),
        ("Trade", "BTC", 0.05, 1, 2, "Bot"),
        ("Transfer", "ETH", 2.0, 1, 3, "AI"),
        ("Withdrawal", "USD", 200.0, 1, None, "Manual")
    ]

    for tx_type, asset, amount, source, dest, executed_by in tx_types:
        transaction_data = {
            "transaction_type": tx_type,
            "asset": asset,
            "amount": amount,
            "source_portfolio_id": source,
            "destination_portfolio_id": dest,
            "executed_by": executed_by,
            "status": "completed"
        }

        resp = await async_client.post("/api/v1/transactions/", json=transaction_data)
        assert resp.status_code == 201
        created = resp.json()
        assert created["transaction_type"] == tx_type
        assert created["asset"] == asset
        assert created["amount"] == amount

@pytest.mark.asyncio
async def test_transaction_pagination(async_client):
    """Test pagination of transactions"""
    # Create 5 transactions with unique reference_ids (avoid collision with earlier tests)
    created_ref_ids = []
    for i in range(5):
        transaction_data = {
            "transaction_type": "Funding",
            "asset": "USD",
            "amount": 100.0 * (i + 1),
            "executed_by": "Manual",
            "reference_id": f"PAG_{i+1:03d}"
        }
        resp = await async_client.post("/api/v1/transactions/", json=transaction_data)
        assert resp.status_code == 201
        created_ref_ids.append(f"PAG_{i+1:03d}")

    # Get all transactions to find where our batch starts
    resp = await async_client.get("/api/v1/transactions/")
    assert resp.status_code == 200
    all_data = resp.json()

    # Find the index of our first created transaction (use unique PAG_ ref)
    first_ref = created_ref_ids[0]
    start_idx = next(i for i, t in enumerate(all_data) if t["reference_id"] == first_ref)

    # Get first page (limit 2) starting from our first transaction
    offset = start_idx
    resp = await async_client.get(f"/api/v1/transactions/?offset={offset}&limit=2")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    # Oldest first within our batch: PAG_001 (100.0), PAG_002 (200.0)
    assert data[0]["reference_id"] == "PAG_001"
    assert data[0]["amount"] == 100.0
    assert data[1]["reference_id"] == "PAG_002"
    assert data[1]["amount"] == 200.0

    # Get second page (offset 2 from start, limit 2)
    resp = await async_client.get(f"/api/v1/transactions/?offset={offset+2}&limit=2")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["reference_id"] == "PAG_003"
    assert data[0]["amount"] == 300.0
    assert data[1]["reference_id"] == "PAG_004"
    assert data[1]["amount"] == 400.0

@pytest.mark.asyncio
async def test_transaction_validation(async_client):
    """Test validation of transaction data"""
    # Test missing required fields
    resp = await async_client.post("/api/v1/transactions/", json={
        "transaction_type": "Funding",
        # missing amount
        "executed_by": "Manual"
    })
    assert resp.status_code == 422  # Validation error

    # Test invalid transaction type
    resp = await async_client.post("/api/v1/transactions/", json={
        "transaction_type": "Invalid",
        "asset": "USD",
        "amount": 100.0,
        "executed_by": "Manual"
    })
    assert resp.status_code == 422

    # Test negative amount
    resp = await async_client.post("/api/v1/transactions/", json={
        "transaction_type": "Funding",
        "asset": "USD",
        "amount": -10.0,
        "executed_by": "Manual"
    })
    assert resp.status_code == 422