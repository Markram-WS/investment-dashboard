# Investment Dashboard – Backend

A FastAPI-powered backend for professional investment management, including portfolio tracking, trade plans, active orders, AI agent integration, whitelist asset management with yfinance price sync, and **dynamic multi-database custom portfolios**.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start – Docker Compose](#quick-start--docker-compose)
4. [Environment Variables](#environment-variables)
5. [API Reference](#api-reference)
6. [Project Structure](#project-structure)
7. [Custom Portfolio – Multi-Database Architecture](#custom-portfolio--multi-database-architecture)
8. [Hands-On Tests](#hands-on-tests)
9. [Advanced Usage](#advanced-usage)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This backend is built with:

- **FastAPI** – modern, async REST API
- **SQLAlchemy 2.0 (async)** – ORM & DB engine
- **PostgreSQL** – two core databases (`investment_main`, `investment_ai`) plus user-configured external databases for Custom Portfolios
- **Podman / Docker** – containerization

**Key additions:**

- **Managed Fund** (`port_type = "Managed Fund"`) — portfolio rebalancing with separate order flow: holdings, orders (pending→done→history), NAV tracking, target allocation ratio, profit threshold alerts, and auto-sync of symbols to whitelist_assets
- **Custom Portfolio type** replaces `Spread Strategy` — portfolios with isolated external PostgreSQL databases
- **`CustomPortfolioConnection` model** — stores encrypted credentials (Fernet) for external DB connections
- **`POST /api/v1/portfolios/test-connection`** — validates external DB connectivity at form time
- **Dynamic engine manager** — caches `AsyncEngine` instances per portfolio_id; lazy-connects only on first request
- **`CustomTradePlan` model** — FK-free replica of `TradePlan` for custom DBs, resolves FK constraint errors when creating orders against custom portfolio trade plans
- **`ensure_custom_tables` auto-migration** — compares model columns vs `information_schema.columns`; runs `ALTER TABLE ADD COLUMN IF NOT EXISTS` for missing columns; drops all FK constraints to match FK-free model design
- **Targeted schema sync** — custom DBs receive FK-free replicas of `active_orders`, `transactions`, `trade_plans`, `whitelist_assets`, `asset_groups`, `orders_groups` on first access
- **`resolve_portfolio_db(db, portfolio_id)`** — per-request session routing helper; replaces `get_custom_session_maker`
- **All order endpoints refactored** — `POST`, `PUT`, `PATCH status`, `close`, `link`, `unlink` accept `?portfolio_id=` query param and route to correct DB
- **All CRUD endpoints refactored** — `assets.py`, `asset_groups.py`, `orders_groups.py` POST/PUT/DELETE accept `?portfolio_id=` for custom portfolio support
- **`group_name` resolution for custom orders** — analytics endpoints query `CustomOrdersGroup` table to populate `order.group_name` (since custom models have no ORM relationship)
- **`GET /api/v1/transactions` global query** — aggregates transactions from `investment_main` + all custom DBs concurrently via `asyncio.gather(return_exceptions=True)`; includes `partial_data` and `failed_portfolios` warning flags when external nodes fail

---

## Prerequisites

- Podman **or** Docker
- Podman Compose **or** Docker Compose v2+
- (Optional) Python 3.11+ if running locally without containers

---

## Quick Start – Docker Compose

```bash
# 1. Enter the backend directory
cd /mnt/d/InvestmentDashboard/backend

# 2. Build & start all services
docker compose up -d       # or: podman compose up -d

# 3. Verify the API is running
curl http://localhost:8000/health
# → {"status":"healthy"}

# 4. Open Swagger UI
open http://localhost:8000/docs
```

> Tables are auto-created on first startup via the FastAPI `lifespan` handler.
> Custom DB connections are **never** initialized during startup — they are established lazily on first per-portfolio API request.
> `order_id` in `active_orders` is a **UUID string** (not auto-increment integer).
> `portfolios.internal_notes` stores free-text observations; editable via `PUT /api/v1/portfolios/{id}`.
> `portfolios.tags` is a JSONB map of key→bool for metadata filtering.
> `risk_score` (0–100) is computed server-side from `available_cash`, `margin_locked`, `cash_buffer_limit`.
> Order status values are uppercase: `PENDING`, `FILLED`, `CLOSE`, `CANCELED`.
> All services auto-restart unless stopped. Logs: `docker compose logs -f backend`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://dashboard:dashboard@db_main:5432/investment_main` | Main DB connection |
| `AI_DATABASE_URL` | `postgresql+asyncpg://dashboard:dashboard@db_ai:5433/investment_ai` | AI-specific DB |
| `PORT` | `8000` | HTTP port exposed by the container |
| `FERNET_KEY` | *(required for Custom Portfolio)* | Symmetric key for encrypting DB passwords. Generate: `python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'` |

---

## API Reference

### Portfolios
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/portfolios` | List all portfolios |
| `POST` | `/api/v1/portfolios` | Create a new portfolio (supports connection fields for Custom Portfolio; target_ratio auto-normalized from decimal→percentage) |
| `GET` | `/api/v1/portfolios/types` | List available portfolio types (Managed Fund, Active Trading, Custom Portfolio) |
| `GET` | `/api/v1/portfolios/{id}` | Retrieve portfolio by ID (includes connection metadata for custom) |
| `PUT` | `/api/v1/portfolios/{id}` | Update portfolio fields |
| `PATCH` | `/api/v1/portfolios/{id}/connection` | Update custom portfolio DB connection details |
| `DELETE` | `/api/v1/portfolios/{id}` | Delete portfolio with cascade (also cleans managed_fund_* tables) |
| `POST` | `/api/v1/portfolios/test-connection` | Test external DB connectivity (host, port, db_name, user, password) |

### Managed Fund
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/managed-funds/{portfolio_id}/settings` | Get MF settings (target_ratio, profit thresholds); auto-creates row if missing, backfills target_ratio from Portfolio table |
| `PUT` | `/api/v1/managed-funds/{portfolio_id}/settings` | Update MF settings (target_ratio, global_profit_threshold) |
| `GET` | `/api/v1/managed-funds/{portfolio_id}/holdings` | List asset holdings |
| `POST` | `/api/v1/managed-funds/{portfolio_id}/holdings` | Create a holding (manual) |
| `PUT` | `/api/v1/managed-funds/{portfolio_id}/holdings/{holding_id}` | Update holding (profit_threshold) |
| `POST` | `/api/v1/managed-funds/{portfolio_id}/holdings/{holding_id}/sell` | Create a Sell order from a holding |
| `GET` | `/api/v1/managed-funds/{portfolio_id}/orders` | List orders in progress |
| `POST` | `/api/v1/managed-funds/{portfolio_id}/orders` | Create a new order (auto-syncs symbol to whitelist_assets) |
| `PUT` | `/api/v1/managed-funds/{portfolio_id}/orders/{order_id}` | Update order fields |
| `PATCH` | `/api/v1/managed-funds/{portfolio_id}/orders/{order_id}/status` | Confirm (→done) or Cancel order; on done: updates holdings, adjusts available_cash, records NAV history, moves to history table |
| `GET` | `/api/v1/managed-funds/{portfolio_id}/history` | List order history |
| `POST` | `/api/v1/managed-funds/{portfolio_id}/rebalance/calculate` | Calculate rebalance recommendations from target_ratio vs current allocation (auto-normalizes decimal→percentage) |
| `POST` | `/api/v1/managed-funds/{portfolio_id}/sync-prices` | Sync current prices from whitelist_assets |
| `GET` | `/api/v1/managed-funds/{portfolio_id}/alerts` | Get profit threshold alerts |

### Active Orders
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `POST` | `/api/v1/orders` | Place a new order |
| `GET` | `/api/v1/orders` | List orders (optional `?portfolio_id=`) |
| `GET` | `/api/v1/orders/{order_id}` | Get order details |
| `PUT` | `/api/v1/orders/{order_id}` | Update order fields |
| `PATCH` | `/api/v1/orders/{order_id}/status` | Change order status |
| `POST` | `/api/v1/orders/{order_id}/close` | Close order with exit price/P&L |
| `POST` | `/api/v1/orders/{order_id}/link` | Link order to a target order |
| `POST` | `/api/v1/orders/{order_id}/unlink` | Unlink order |

### Overview
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/overview` | Global dashboard overview (supports `?portfolio_id=`) |

### Analytics
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/analytics/portfolio-grid` | Full grid data (supports `?portfolio_id=`) |
| `GET` | `/api/v1/analytics/portfolio/{portfolio_id}` | Single portfolio detail |
| `GET` | `/api/v1/analytics/performance/{portfolio_id}` | Performance data |

### Risk
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/risk/pool-health` | Pool health summary |
| `GET` | `/api/v1/risk/money-reserve-status` | Money reserve status |
| `GET` | `/api/v1/risk/portfolio-safety/{id}` | Per-portfolio safety metrics |
| `GET` | `/api/v1/risk/analytics` | Computed risk metrics |

### Transactions
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/transactions` | List transactions (supports `?portfolio_id=`; global query aggregates all custom DBs) |
| `POST` | `/api/v1/transactions` | Create transaction (supports `?portfolio_id=` to write to custom DB) |
| `GET` | `/api/v1/transactions/{id}` | Get transaction by ID (supports `?portfolio_id=`) |

### Transfers
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/transfers` | List transfers |
| `POST` | `/api/v1/transfers` | Create a transfer |
| `POST` | `/api/v1/transfers/{id}/confirm` | Confirm a pending transfer |

### Assets
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/assets` | List assets (optional `?asset_type=`, `?portfolio_id=`) |
| `POST` | `/api/v1/assets` | Create a new asset |
| `PUT` | `/api/v1/assets/{id}` | Update asset fields |
| `DELETE` | `/api/v1/assets/{id}` | Delete asset |
| `POST` | `/api/v1/assets/sync-from-orders` | Sync active order tickers as new assets |
| `POST` | `/api/v1/assets/sync-from-all` | Sync asset symbols from ALL sources (active_orders + managed_fund_holdings + managed_fund_order_history) |
| `POST` | `/api/v1/assets/{id}/update-price` | Fetch live price from Yahoo Finance |
| `POST` | `/api/v1/assets/batch-update-prices` | Batch update all yfinance asset prices |

### Asset Groups
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/asset-groups` | List asset groups (seeds Ungrouped/Watchlist on first query) |
| `POST` | `/api/v1/asset-groups` | Create a new group |
| `PUT` | `/api/v1/asset-groups/{id}` | Update group name |
| `DELETE` | `/api/v1/asset-groups/{id}` | Delete group (default groups cannot be deleted) |

### Orders Groups
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/orders-groups` | List groups for a portfolio (supports `?portfolio_id=`) |
| `POST` | `/api/v1/orders-groups` | Create a group |
| `PUT` | `/api/v1/orders-groups/{id}` | Update a group |
| `DELETE` | `/api/v1/orders-groups/{id}` | Delete a group |

### AI Agents
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/ai/agents` | List AI agents |
| `POST` | `/api/v1/ai/agents` | Create agent |
| `POST` | `/api/v1/ai/agents/{agent_id}/run` | Trigger agent execution |
| `GET` | `/api/v1/ai/status` | AI status for a portfolio |
| `GET` | `/api/v1/ai/logs/{portfolio_id}` | AI action logs |

### Trade History
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/trade-history` | List records (optional `?portfolio_id=`) |
| `POST` | `/api/v1/trade-history` | Create record |

### Other
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET/POST` | `/api/v1/trade-plans` | Trade plan CRUD |
| `DELETE` | `/api/v1/trade-plans/{plan_id}` | Delete trade plan |
| `GET/POST` | `/api/v1/journal` | Decision journal |
| `GET/POST` | `/api/v1/rebalance/*` | Rebalance engine |

---

## Project Structure

```text
backend/
├── app/
│   ├── main.py                  # FastAPI app + lifespan (auto-create tables, register managed_fund_models)
│   ├── database.py              # Async engine + session factories + custom engine manager
│   ├── models.py                # SQLAlchemy ORM models (18 tables incl. CustomPortfolioConnection)
│   ├── custom_models.py         # FK-free models for custom DB tables (active_orders, transactions, trade_plans, etc.)
│   ├── managed_fund_models.py   # 4 SQLAlchemy models for Managed Fund: ManagedFundHolding, ManagedFundOrder, ManagedFundOrderHistory, ManagedFundSetting
│   ├── utils/
│   │   ├── crypto.py            # Fernet encrypt/decrypt for DB passwords
│   │   └── __init__.py
│   ├── services/
│   │   └── yfinance_service.py  # Direct HTTP to Yahoo Finance (no yfinance library)
│   └── routers/
│       ├── portfolios.py        # Portfolio CRUD + test-connection + connection management
│       ├── active_orders.py     # Order management (create, update, close, link, unlink)
│       ├── analytics.py         # Portfolio grid + detail analytics
│       ├── performance.py       # Equity curve + payoff bars
│       ├── overview.py          # Global dashboard
│       ├── risk.py              # Pool health, money reserve, safety
│       ├── transactions.py      # Transaction history (global + per-portfolio routing)
│       ├── trade_history.py     # Historical trade records
│       ├── transfers.py         # Cash pool transfers
│       ├── assets.py            # Asset CRUD + sync/price endpoints
│       ├── asset_groups.py      # Asset group CRUD
│       ├── orders_groups.py     # Orders group CRUD
│       ├── trade_plans.py       # Trade plan CRUD
│       ├── journal.py           # Decision journal
│       ├── managed_funds.py     # Managed Fund CRUD: settings, holdings, orders, history, rebalance, sync-prices, alerts
│       ├── rebalance.py         # Dual-mode rebalancing
│       ├── ai_agents.py         # AI autonomy
│       └── etl_sync.py          # ETL sync utilities
├── tests/
├── requirements.txt             # cryptography added for Fernet password encryption
├── Dockerfile
└── README.md
```

---

## Custom Portfolio – Multi-Database Architecture

### Architecture Overview

```
investment_main (Control Plane)
  ├── portfolios                    ← metadata + is_custom flag
  ├── custom_portfolio_connections  ← encrypted credentials (Fernet)
  ├── trade_plans                   ← shared config
  └── ... (core tables)

External DB (Data Plane) — ONE per Custom Portfolio
  ├── active_orders                 ← FK-free (portfolio_id as plain Integer)
  ├── transactions
  ├── trade_plans                   ← FK-free replica (avoids plan_id FK errors)
  ├── whitelist_assets
  ├── asset_groups
  └── orders_groups
```

### How it works

1. **Creation**: User creates a `Custom Portfolio` via `POST /api/v1/portfolios` with `db_host`, `db_port`, `db_name`, `db_user`, `db_password`. Password is encrypted with Fernet (`FERNET_KEY` env var) before storage in `custom_portfolio_connections`.

2. **First access**: Backend lazy-connects to the external DB on the first API request for that portfolio. Creates FK-free table replicas via `custom_models.metadata.create_all()`.

3. **Routing**: `resolve_portfolio_db(db, portfolio_id)` in `database.py` detects `is_custom=True` and returns a session bound to the external DB engine. Engines are cached 30 minutes (`CUSTOM_ENGINES` dict). Replaces the removed `get_custom_session_maker`.

4. **Auto-migration**: `ensure_custom_tables()` is called on first access for each custom portfolio. It queries `information_schema.columns` for each custom table, runs `ALTER TABLE ADD COLUMN IF NOT EXISTS` for any columns missing from the external DB, and drops all FK constraints via `ALTER TABLE ... DROP CONSTRAINT` to match the FK-free model design (required because main-DB IDs don't exist in external DBs).

5. **Global queries**: `GET /api/v1/transactions` without `portfolio_id` aggregates from `investment_main` + all custom DBs via `asyncio.gather(return_exceptions=True)`. Failed nodes are skipped and reported as `failed_portfolios` in response.

5. **Security**: Passwords encrypted with Fernet, never stored in plaintext. `test-connection` endpoint validates credentials without persisting them.

---

## Hands-On Tests

```bash
# Health check
curl http://localhost:8000/health

# Create a standard portfolio
curl -X POST http://localhost:8000/api/v1/portfolios \
  -H "Content-Type: application/json" \
  -d '{"portfolio_name":"Binance Grid","port_type":"Active Trading"}'

# Create a custom portfolio (with external DB)
curl -X POST http://localhost:8000/api/v1/portfolios \
  -H "Content-Type: application/json" \
  -d '{
    "portfolio_name":"Self-Hosted Futures",
    "port_type":"Custom Portfolio",
    "db_host":"192.168.1.100",
    "db_port":5432,
    "db_name":"custom_futures",
    "db_user":"dashboard",
    "db_password":"secret123"
  }'

# Test external connection
curl -X POST http://localhost:8000/api/v1/portfolios/test-connection \
  -H "Content-Type: application/json" \
  -d '{"db_host":"192.168.1.100","db_port":5432,"db_name":"custom_futures","db_user":"dashboard","db_password":"secret123"}'

# Fetch price for an asset
curl -X POST http://localhost:8000/api/v1/assets/1/update-price
```

> **Tip:** Open `http://localhost:8000/docs` for interactive Swagger UI.

---

## Advanced Usage

### Rebuilding the Container

```bash
cd /mnt/d/InvestmentDashboard/backend
docker compose build --no-cache    # force full rebuild
docker compose up -d
```

> Use `--no-cache` when crypto.py, database.py, or requirements.txt changes.

### Accessing the Database

```bash
# Main database
psql -h localhost -p 5432 -U dashboard -d investment_main

# AI database
psql -h localhost -p 5433 -U dashboard -d investment_ai
```

### Viewing Logs

```bash
docker compose logs -f backend
docker compose logs -f db_main
docker compose logs -f db_ai
```

### Swagger UI

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

## Troubleshooting

### API Not Responding

```bash
docker compose ps
docker compose logs backend
curl http://localhost:8000/health
```

### Yfinance Returns 0.0

The yfinance service uses direct HTTP to Yahoo Finance. If prices return 0.0, the API has likely been rate-limited. Wait a few minutes and retry. The frontend caches the last known price in `localStorage('cached_price_{ticker}')`.

### Custom Portfolio Connection Fails

- Verify `FERNET_KEY` is set in the environment
- Check `test-connection` endpoint with the same credentials
- Ensure the external PostgreSQL accepts connections from the backend container's network
- Check logs: `docker compose logs backend`

### Database Connection Issues

```bash
docker compose ps
docker compose logs db_main
docker compose logs db_ai
```

---

*Last updated: 8 June 2026 (Managed Fund feature: 4 new tables + 15 API endpoints; sync-from-all endpoint; target_ratio auto-normalization; portfolio cascade deletes for managed_fund tables; navbar query invalidation on delete)*
