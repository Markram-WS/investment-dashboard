# Investment Dashboard – Backend

A FastAPI-powered backend for professional investment management, including portfolio tracking, trade plans, active orders, AI agent integration, and whitelist asset management with yfinance price sync.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start – Docker Compose](#quick-start--docker-compose)
4. [Environment Variables](#environment-variables)
5. [API Reference](#api-reference)
6. [Project Structure](#project-structure)
7. [Hands-On Tests](#hands-on-tests)
8. [Advanced Usage](#advanced-usage)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This backend is built with:

- **FastAPI** – modern, async REST API
- **SQLAlchemy 2.0 (async)** – ORM & DB engine
- **PostgreSQL** – two databases (`investment_main`, `investment_ai`)
- **Podman / Docker** – containerization

**Key additions since last update:**

- **Assets router** (`/api/v1/assets`) — full CRUD, `sync-from-orders`, `update-price`, `batch-update-prices`
- **Asset Groups router** (`/api/v1/asset-groups`) — CRUD; seeds Ungrouped/Watchlist on first query
- **Yfinance service rewritten** — uses direct HTTP to Yahoo Finance API (`query1.finance.yahoo.com/v8/finance/chart/`) instead of the `yfinance` library, which had aggressive in-process rate limiting. Errors propagate as HTTP 502.
- **WhitelistAssets model extended** — added columns: `name`, `source` (yfinance/manual), `group_id` FK→`asset_groups`, `price`, `change_24h`, `updated_at`
- **Notification system** — centralized `NotificationContext` on frontend, no backend changes needed

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
> `order_id` in `active_orders` is a **UUID string** (not auto-increment integer).
> `portfolios.internal_notes` stores free-text observations; editable via `PUT /api/v1/portfolios/{id}`.
> `portfolios.tags` is a JSONB map of key→bool for metadata filtering.
> `available_cash`, `money_market`, `margin_locked`, `cash_buffer_limit` are returned in the portfolio-grid analytics response.
> `available_cash` is auto-computed when editing Money Market/Margin Locked/Cash Buffer Limit via `PUT /api/v1/portfolios/{id}`: `newAvailable = rawAvailableCash - totalDiff` (diff of new vs old values for the three deduction fields).
> `risk_score` (0–100) is computed server-side from `available_cash`, `margin_locked`, `cash_buffer_limit`.
> `active_orders.group_id` is an **Integer FK** to `orders_groups.id` (was `ZoneGroup`).
> Order status values are uppercase: `PENDING`, `FILLED`, `CLOSE`, `CANCELED`.
> All services auto-restart unless stopped. Logs: `docker compose logs -f backend`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://dashboard:dashboard@db_main:5432/investment_main` | Main DB connection |
| `AI_DATABASE_URL` | `postgresql+asyncpg://dashboard:dashboard@db_ai:5433/investment_ai` | AI-specific DB |
| `PORT` | `8000` | HTTP port exposed by the container |

---

## API Reference

> **Note on trailing slashes:** `redirect_slashes=False` has been removed from `main.py`. All routes use `""` (not `"/"`) in decorators. Both `/api/v1/portfolios` and `/api/v1/portfolios/` now resolve to the same endpoint.

### Portfolios
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/portfolios` | List all portfolios |
| `POST` | `/api/v1/portfolios` | Create a new portfolio |
| `GET` | `/api/v1/portfolios/{id}` | Retrieve portfolio by ID |
| `PUT` | `/api/v1/portfolios/{id}` | Update portfolio fields |
| `DELETE` | `/api/v1/portfolios/{id}` | Delete portfolio with cascade |

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
| `GET` | `/api/v1/overview` | Global dashboard overview |

### Analytics
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/analytics/nav/{portfolio_id}` | NAV time-series |
| `GET` | `/api/v1/analytics/risk/{portfolio_id}` | Risk summary |
| `GET` | `/api/v1/analytics/performance/{portfolio_id}` | Performance data |
| `GET` | `/api/v1/analytics/portfolio-grid` | Full grid data |
| `GET` | `/api/v1/analytics/portfolio/{portfolio_id}` | Single portfolio detail |

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
| `GET` | `/api/v1/transactions` | List transactions |
| `POST` | `/api/v1/transactions` | Create transaction |
| `GET` | `/api/v1/transactions/{id}` | Get transaction by ID |

### Transfers
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/transfers` | List transfers |
| `POST` | `/api/v1/transfers` | Create a transfer |
| `POST` | `/api/v1/transfers/{id}/confirm` | Confirm a pending transfer |

### Assets (new)
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/assets` | List assets (optional `?asset_type=`) |
| `POST` | `/api/v1/assets` | Create a new asset |
| `PUT` | `/api/v1/assets/{id}` | Update asset fields |
| `DELETE` | `/api/v1/assets/{id}` | Delete asset |
| `POST` | `/api/v1/assets/sync-from-orders` | Sync active order tickers as new assets |
| `POST` | `/api/v1/assets/{id}/update-price` | Fetch live price from Yahoo Finance |
| `POST` | `/api/v1/assets/batch-update-prices` | Batch update all yfinance asset prices |

### Asset Groups (new)
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/asset-groups` | List asset groups (seeds Ungrouped/Watchlist on first query) |
| `POST` | `/api/v1/asset-groups` | Create a new group |
| `PUT` | `/api/v1/asset-groups/{id}` | Update group name |
| `DELETE` | `/api/v1/asset-groups/{id}` | Delete group (default groups cannot be deleted) |

### Orders Groups
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/orders-groups` | List groups for a portfolio |
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

### Other
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET/POST` | `/api/v1/trade-plans` | Trade plan CRUD |
| `DELETE` | `/api/v1/trade-plans/{plan_id}` | Delete trade plan |
| `GET/POST` | `/api/v1/trade-history` | Trade history records |
| `GET/POST` | `/api/v1/journal/{portfolio_id}` | Decision journal |
| `GET/POST` | `/api/v1/rebalance/*` | Rebalance engine |
| `GET/POST` | `/api/v1/whitelist_assets` | Legacy asset list (deprecated in favor of `/api/v1/assets`) |

---

## Project Structure

```text
backend/
├── app/
│   ├── main.py                  # FastAPI app + lifespan (auto-create tables)
│   ├── database.py              # Async engine + session factories
│   ├── models.py                # SQLAlchemy ORM models (16 tables incl. AssetGroup)
│   ├── services/
│   │   └── yfinance_service.py  # Direct HTTP to Yahoo Finance (no yfinance library)
│   └── routers/
│       ├── portfolios.py        # Portfolio CRUD
│       ├── active_orders.py     # Order management (create, update, close, link, unlink)
│       ├── analytics.py         # Portfolio grid + detail analytics
│       ├── performance.py       # Equity curve + payoff bars
│       ├── overview.py          # Global dashboard
│       ├── risk.py              # Pool health, money reserve, safety
│       ├── transactions.py      # Transaction history
│       ├── trade_history.py     # Historical trade records
│       ├── transfers.py         # Cash pool transfers
│       ├── assets.py            # Asset CRUD + sync/price endpoints (NEW)
│       ├── asset_groups.py      # Asset group CRUD (NEW)
│       ├── orders_groups.py     # Orders group CRUD (was zone_groups)
│       ├── trade_plans.py       # Trade plan CRUD
│       ├── journal.py           # Decision journal
│       ├── rebalance.py         # Dual-mode rebalancing
│       ├── ai_agents.py         # AI autonomy
│       └── etl_sync.py          # ETL sync utilities
├── tests/
├── requirements.txt             # yfinance REMOVED; uses requests (built-in)
├── Dockerfile
└── README.md
```

---

## Hands-On Tests

```bash
# Health check
curl http://localhost:8000/health

# Create a portfolio
curl -X POST http://localhost:8000/api/v1/portfolios \
  -H "Content-Type: application/json" \
  -d '{"portfolio_name":"Binance Grid","port_type":"Active Trading"}'

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

> Use `--no-cache` when yfinance_service.py or requirements.txt changes.

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

### Database Connection Issues

```bash
docker compose ps
docker compose logs db_main
docker compose logs db_ai
```

---

*Last updated: 7 June 2026 (added assets router, asset_groups router, yfinance direct HTTP, removed yfinance library)*
