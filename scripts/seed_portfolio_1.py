#!/usr/bin/env python3
"""
Mock data script for Portfolio 1 (Binance Futures - Grid/Margin trading)
Adds active orders, trade history, and NAV history for realistic testing.
"""
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"
PORTFOLIO_ID = 1

# ============= STEP 1: Create Trade Plan =============
print("Creating trade plan...")
trade_plan_data = {
    "portfolio_id": PORTFOLIO_ID,
    "entry_zone": "BTC: 95000-98000, ETH: 3500-3700",
    "exit_zone": "BTC: 105000, ETH: 4200",
    "leverage": 10,
    "margin_rate": 0.02,
    "tp_levels": [102000, 105000],
    "sl_level": 92000,
    "entry_reason": "# Grid Strategy\n- Target Zone: ZONE A ($95K-$98K for BTC, $3.5K-$3.7K for ETH)\n- Grid Levels: 2% spacing\n- Max Spread Diff: 3%",
}

try:
    resp = requests.post(f"{BASE_URL}/api/v1/trade-plans/", json=trade_plan_data)
    plan_result = resp.json()
    PLAN_ID = plan_result.get("plan_id", 1)
    print(f"✓ Trade plan created: plan_id={PLAN_ID}")
except Exception as e:
    print(f"⚠ Trade plan creation: {e}")
    PLAN_ID = 1

# ============= STEP 2: Create Active Orders =============
print("\nCreating active orders...")

active_orders = [
    # BTC Orders
    {
        "plan_id": PLAN_ID,
        "portfolio_id": PORTFOLIO_ID,
        "asset_type": "BTC",
        "side": "BUY",
        "qty": 0.5,
        "entry_price": 95000,
        "current_price": 98500,
        "tp_price": 102000,
        "leverage": 10,
        "margin_rate": 0.02,
        "linked_order_id": None,  # Active grid order
    },
    {
        "plan_id": PLAN_ID,
        "portfolio_id": PORTFOLIO_ID,
        "asset_type": "BTC",
        "side": "SELL",
        "qty": 0.3,
        "entry_price": 97500,
        "current_price": 98200,
        "tp_price": 96000,
        "leverage": 10,
        "margin_rate": 0.02,
        "linked_order_id": None,  # Active grid order
    },
    # ETH Orders  
    {
        "plan_id": PLAN_ID,
        "portfolio_id": PORTFOLIO_ID,
        "asset_type": "ETH",
        "side": "BUY",
        "qty": 2.5,
        "entry_price": 3550,
        "current_price": 3680,
        "tp_price": 3900,
        "leverage": 5,
        "margin_rate": 0.01,
        "linked_order_id": None,
    },
    {
        "plan_id": PLAN_ID,
        "portfolio_id": PORTFOLIO_ID,
        "asset_type": "ETH",
        "side": "SELL",
        "qty": 1.8,
        "entry_price": 3620,
        "current_price": 3650,
        "tp_price": 3500,
        "leverage": 5,
        "margin_rate": 0.01,
        "linked_order_id": None,
    },
    # SOL Order (closed)
    {
        "plan_id": PLAN_ID,
        "portfolio_id": PORTFOLIO_ID,
        "asset_type": "SOL",
        "side": "BUY",
        "qty": 15,
        "entry_price": 220,
        "current_price": 235,
        "tp_price": 245,
        "leverage": 3,
        "margin_rate": 0.015,
        "linked_order_id": "shsojvp",  # Will link with another for spread demo
    },
]

created_order_ids = []
for i, order in enumerate(active_orders):
    try:
        resp = requests.post(f"{BASE_URL}/api/v1/orders/", json=order)
        if resp.ok:
            result = resp.json()
            created_order_ids.append(result["order_id"])
            print(f"✓ Order {i+1}: {order['asset_type']} {order['side']} @ ${order['entry_price']}")
    except Exception as e:
        print(f"⚠ Order {i+1} creation failed: {e}")

# ============= STEP 3: Create Trade History (Closed Trades) =============
print("\nCreating trade history...")

# We need to manually create trade_history records since they're not auto-created
# Let's check if there's a trade-history endpoint
try:
    # Check the transactions endpoint for creating history
    history_data = [
        {
            "portfolio_id": PORTFOLIO_ID,
            "type": "Sell",
            "asset": "SOL",
            "amount": 15,
            "exit_price": 240,
            "realized_pl": 225.0,  # (240-220) * 15
            "executed_by": "Manual",
            "decision_note": "Take profit hit - closed spread pair",
            "entry_date": (datetime.utcnow() - timedelta(days=5)).isoformat(),
            "exit_date": datetime.utcnow().isoformat(),
        },
        {
            "portfolio_id": PORTFOLIO_ID,
            "type": "Buy",
            "asset": "LINK",
            "amount": 50,
            "exit_price": 25.50,
            "realized_pl": 125.0,  # Hypothetical
            "executed_by": "Bot",
            "decision_note": "Grid level 2 completed",
            "entry_date": (datetime.utcnow() - timedelta(days=3)).isoformat(),
            "exit_date": datetime.utcnow().isoformat(),
        },
        {
            "portfolio_id": PORTFOLIO_ID,
            "type": "Sell",
            "asset": "ADA",
            "amount": 1000,
            "exit_price": 0.45,
            "realized_pl": -50.0,
            "executed_by": "AI",
            "decision_note": "Stop loss triggered",
            "entry_date": (datetime.utcnow() - timedelta(days=2)).isoformat(),
            "exit_date": datetime.utcnow().isoformat(),
        },
    ]
    
    # Try to find trade_history endpoint
    for hist in history_data:
        try:
            resp = requests.post(f"{BASE_URL}/api/v1/trade-history/", json=hist)
            if resp.ok:
                print(f"✓ Trade history: {hist['asset']} {hist['type']} - P/L ${hist['realized_pl']}")
        except:
            pass
            
except Exception as e:
    print(f"⚠ Trade history creation: {e}")

# ============= STEP 4: Verify Portfolio Data =============
print("\n=== Verifying mock data ===")

# Check orders
resp = requests.get(f"{BASE_URL}/api/v1/orders/")
if resp.ok:
    orders = resp.json()
    print(f"✓ Total orders in DB: {len(orders)}")

# Check portfolio
resp = requests.get(f"{BASE_URL}/api/v1/portfolios/{PORTFOLIO_ID}")
if resp.ok:
    portfolio = resp.json()
    print(f"✓ Portfolio: {portfolio['portfolio_name']} (type: {portfolio['port_type']})")

# Check analytics
resp = requests.get(f"{BASE_URL}/api/v1/analytics/portfolio-grid")
if resp.ok:
    data = resp.json()
    p1 = next((p for p in data if p["portfolio_id"] == PORTFOLIO_ID), None)
    if p1:
        print(f"✓ Portfolio analytics: {len(p1.get('active_orders', []))} active orders")

print("\n✅ Mock data seeding complete!")