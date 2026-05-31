# Investment Dashboard – Backend

A FastAPI-powered backend for professional investment management, including portfolio tracking, trade plans, active orders, and AI agent integration.

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
podman compose up -d       # or: docker compose up -d

# 3. Verify the API is running
curl http://localhost:8000/health
# → {"status":"healthy"}

# 4. Open Swagger UI
open http://localhost:8000/docs
```

> Tables are auto-created on first startup via the FastAPI `lifespan` handler.
> All services auto-restart unless stopped. Logs: `podman compose logs -f backend`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://dashboard:dashboard@db_main:5432/investment_main` | Main DB connection |
| `AI_DATABASE_URL` | `postgresql+asyncpg://dashboard:dashboard@db_ai:5433/investment_ai` | AI-specific DB |
| `PORT` | `8000` | HTTP port exposed by the container |

---

## API Reference

> **Trailing slash note:** `redirect_slashes=False` — `/api/v1/portfolios` and `/api/v1/portfolios/` are **different** routes. GET uses no trailing slash; POST uses trailing slash.

### Portfolios
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/portfolios` | List all portfolios |
| `POST` | `/api/v1/portfolios/` | Create a new portfolio |
| `GET` | `/api/v1/portfolios/{id}` | Retrieve portfolio by ID |
| `DELETE` | `/api/v1/portfolios/{id}` | Delete portfolio |

### Trade Plans
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `POST` | `/api/v1/trade-plans/` | Create a trade plan |
| `GET` | `/api/v1/trade-plans/` | List trade plans (optional query: `portfolio_id`) |
| `GET` | `/api/v1/trade-plans/{plan_id}` | Get trade plan details |
| `DELETE` | `/api/v1/trade-plans/{plan_id}` | Delete a trade plan |

### Active Orders
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `POST` | `/api/v1/orders/` | Place a new order |
| `GET` | `/api/v1/orders/` | List orders (optional query: `portfolio_id`) |
| `GET` | `/api/v1/orders/{order_id}` | Get order details |
| `PATCH` | `/api/v1/orders/{order_id}/status` | Update order status |
| `DELETE` | `/api/v1/orders/{order_id}` | Cancel order |

### Analytics
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/analytics/nav/{portfolio_id}` | NAV time-series |
| `GET` | `/api/v1/analytics/risk/{portfolio_id}` | Risk summary |

### AI Agents
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/ai/agents/` | List AI agents |
| `POST` | `/api/v1/ai/agents/` | Create agent |
| `POST` | `/api/v1/ai/agents/{agent_id}/run` | Trigger agent execution |

---

## Project Structure

```text
backend/
├── app/
│   ├── main.py              # FastAPI app + lifespan (auto-create tables)
│   ├── database.py           # Async engine + session factories
│   ├── models.py             # SQLAlchemy ORM models (14 tables)
│   └── routers/
│       ├── portfolios.py     # Portfolio CRUD + types
│       ├── trade_plans.py    # Trade plan CRUD
│       ├── active_orders.py  # Order management
│       ├── analytics.py      # Portfolio grid + detail analytics
│       ├── overview.py       # Global dashboard overview
│       ├── risk.py           # Pool health, money reserve, safety
│       ├── rebalance.py      # Dual-mode rebalancing engine
│       ├── transactions.py   # Transaction history
│       ├── trade_history.py  # Historical trade records
│       ├── transfers.py      # Cash pool transfers
│       ├── journal.py        # Decision journal
│       ├── ai_agents.py      # AI autonomy (scan, plan, execute)
│       ├── assets.py         # Whitelist assets
│       └── etl_sync.py       # ETL sync utilities
├── tests/
├── requirements.txt
├── Dockerfile
└── README.md
```

---

## Hands-On Tests

```bash
# Health check
curl http://localhost:8000/health

# Create a portfolio
curl -X POST http://localhost:8000/api/v1/portfolios/ \
  -H "Content-Type: application/json" \
  -d '{"portfolio_name":"Binance Grid","port_type":"Active Trading"}'

# Create a trade plan
curl -X POST http://localhost:8000/api/v1/trade-plans/ \
  -H "Content-Type: application/json" \
  -d '{"portfolio_id":1,"entry_zone":"100-105","exit_zone":"95-90","leverage":5,"margin_rate":0.2}'

# List trade plans
curl http://localhost:8000/api/v1/trade-plans/
```

> **Tip:** Open `http://localhost:8000/docs` in any browser for an interactive Swagger UI powered by FastAPI.

---

## Advanced Usage

### Running Tests

```bash
# Install test dependencies
pip install pytest httpx[http2]

# Run the test suite
pytest -q
```

All tests are located in the `tests/` directory and use an in-memory SQLite database for isolation.

### Rebuilding the Container

```bash
cd /mnt/d/InvestmentDashboard/backend
podman compose build
podman compose up -d
```

### Accessing the Database

You can connect to the PostgreSQL databases using any PostgreSQL client:

```bash
# Main database
psql -h localhost -p 5432 -U dashboard -d investment_main

# AI database
psql -h localhost -p 5433 -U dashboard -d investment_ai
```

### Viewing Logs

```bash
# View backend logs
podman compose logs -f backend

# View database logs
podman compose logs -f db_main
podman compose logs -f db_ai
```

### Swagger UI

The API documentation is automatically generated and available at:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

You can interact with the API directly from the Swagger UI, test endpoints, and view request/response examples.

### Environment Configuration

The backend reads environment variables from the Docker Compose file or from a `.env` file in the same directory. You can override any variable by setting it in the `.env` file or in your shell.

---

## Troubleshooting

### API Not Responding

1. Check if containers are running:
   ```bash
   podman compose ps
   ```

2. Check backend logs:
   ```bash
   podman compose logs backend
   ```

3. Verify database connections:
   ```bash
   curl http://localhost:8000/health
   ```

### Database Connection Issues

1. Ensure PostgreSQL containers are running:
   ```bash
   podman compose ps
   ```

2. Check database logs:
   ```bash
   podman compose logs db_main
   podman compose logs db_ai
   ```

3. Verify environment variables are set correctly.

### Tests Failing

1. Make sure you have the required test dependencies installed:
   ```bash
   pip install pytest httpx[http2]
   ```

2. Run tests with verbose output to see details:
   ```bash
   pytest -v
   ```

3. Check if the database is accessible.

### Container Build Failures

1. Check the Dockerfile for any errors.
2. Ensure you have the necessary build dependencies (e.g., Python 3.11, pip).
3. Try rebuilding with:
   ```bash
   podman compose build --no-cache
   ```

---

> **Note:** This backend is designed to be lightweight and easy to extend. Feel free to add new endpoints, models, or features as needed. The architecture is modular, making it simple to integrate with front-end applications or other services.