# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React 18 + TypeScript + Vite 5.4.21 + Tailwind CSS 3.4.19 |
| **Backend** | FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL |
| **Container** | Docker Compose (bridge network: `investment-network`) |
| **Styling** | Tailwind CSS (npm), dark mode via `.dark` class on `<html>` |
| **Drag & Drop** | react-dnd + react-dnd-html5-backend |
| **Encryption** | Fernet (`cryptography` lib, `FERNET_KEY` env var) |

## Quick Start

```bash
# All services (frontend, backend, db_main, db_ai)
docker compose up -d

# Frontend dev mode (HMR) — run from project root
cd frontend && npm run dev    # http://localhost:5173

# Verify backend
curl http://localhost:8000/health
```

## How the App Routes Requests

```
Browser → localhost:5173 → Frontend
                              ↓ Vite Proxy (/api/* → http://backend:8000)
                           Backend (Docker DNS: `backend:8000`)
                              ↓
                           PostgreSQL: db_main (:5432), db_ai (:5433)
                              ↓
                           External DBs (Custom Portfolios, lazy-connected)
```

- Frontend calls use **relative paths** (`/api/v1/...`). Vite dev server proxies `/api/*` to `http://backend:8000`.
- `BACKEND_API_BASE_URL` env var controls the proxy target; `VITE_API_BASE_URL` must be empty for relative paths.

## Build, Lint, Test

### Frontend

```bash
cd frontend
npm install          # install deps (once)
npm run dev          # Vite dev server with HMR
npm run build        # production bundle → /dist
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:ui      # Vitest (watch mode)
```

### Backend

```bash
docker compose up -d        # start backend + DBs
curl http://localhost:8000/health
docker compose logs -f backend

# Backend has NO volume mount — code changes require:
docker compose build backend --no-cache && docker compose up -d backend

# Local Python (alternative):
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://127.0.0.1:8000
```

## Multi-Database Architecture

```
investment_main (Control Plane)
  ├── portfolios                    ← metadata + is_custom flag
  ├── custom_portfolio_connections  ← encrypted credentials (Fernet)
  ├── managed_fund_*                ← 4 Managed Fund tables
  └── ... (core tables)

investment_ai (AI agent tables)
  ├── ai_agents, ai_action_logs, ai_agent_state

External DBs (Data Plane, one per Custom Portfolio)
  ├── active_orders, transactions, trade_plans  (FK-free)
  ├── whitelist_assets, asset_groups, orders_groups
```

Key concepts:
- **`is_custom` flag** on `portfolios` routes data to external PostgreSQL DBs
- **FK-free models** (`custom_models.py`) — all FK constraints are dropped on external DBs because main-DB IDs don't exist there
- **Lazy connections** — `resolve_portfolio_db(db, portfolio_id)` creates + caches `AsyncEngine` on first request; `ensure_custom_tables()` runs auto-migration (ALTER ADD COLUMN, DROP CONSTRAINT)
- **Global queries** — `GET /api/v1/transactions` without `portfolio_id` aggregates across all DBs via `asyncio.gather(return_exceptions=True)`

## Key Backend Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app + lifespan (table creation, `is_custom` migration) |
| `backend/app/models.py` | 22 SQLAlchemy ORM models (Portfolio, ActiveOrder, WhitelistAsset, etc.) |
| `backend/app/custom_models.py` | FK-free replicas for external DB tables |
| `backend/app/managed_fund_models.py` | 4 Managed Fund models (holding, order, history, setting) |
| `backend/app/database.py` | Async engine manager, `resolve_portfolio_db`, `ensure_custom_tables` |
| `backend/app/routers/` | 20+ route files (`portfolios.py`, `managed_funds.py`, `active_orders.py`, etc.) |
| `backend/app/services/yfinance_service.py` | Direct HTTP to Yahoo Finance (no yfinance library) |
| `backend/app/utils/crypto.py` | Fernet encrypt/decrypt for DB passwords |

## Key Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/api.ts` | 65+ API endpoint functions |
| `frontend/src/App.tsx` | Router + DndProvider + NotificationProvider |
| `frontend/src/pages/` | Top-level route components (PortfolioOverview, AllAssets, TransactionsPage, etc.) |
| `frontend/src/screens/` | Detail layouts + modals (PortfolioGrid, PortfolioMutualFund, MF* modals) |
| `frontend/src/components/` | Navigation, NotificationBell, ThemeToggle, icons |
| `frontend/src/contexts/NotificationContext.tsx` | Centralized notifications (bell, toast, localStorage) |
| `frontend/src/constants/colors.ts` | Design tokens + buttonTheme |
| `frontend/src/types/index.ts` | Shared TypeScript interfaces |
| `frontend/src/index.css` | CSS variables (light/dark), Tailwind directives |

## Environment Variables (`.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Main DB connection string |
| `AI_DATABASE_URL` | AI DB connection string |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | Main DB credentials |
| `AI_POSTGRES_USER` / `AI_POSTGRES_PASSWORD` | AI DB credentials |
| `FERNET_KEY` | Fernet symmetric key for encrypting custom DB passwords. Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

## API Reference

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- Full endpoint listing in `backend/README.md` (portfolios, managed funds, orders, analytics, risk, transactions, assets, AI agents)

## Common Pitfalls

- **Vite 5.4.21** — not Vite 8 (Vite 8 optimizer hangs on Linux/Docker)
- **Backend has NO volume mount** — code changes require `docker compose build backend --no-cache && docker compose up -d backend`
- **React hooks before early returns** — all hooks must precede any early return statement
- **Number inputs** — use local string state to avoid controlled-input "delete 0" bug
- **Custom DB lazy-init** — external connections established on first API request, NOT at startup
- **`ensure_custom_tables` drops FK constraints** — one-time per portfolio_id; assumes sole ownership of external DB
- **yfinance rate limits** — direct HTTP to Yahoo Finance; wait and retry if prices return 0.0
- **`FERNET_KEY` required** — Custom Portfolio creation fails without it
- **Trade history for custom portfolios** — queries `TradeHistory` from main DB (not `CustomTransaction` from custom DB)
- **Group CRUD refresh** — after creating/editing/deleting zone groups, must call `fetchAnalyticsData()` (not just refresh `groups` state) to update `group_id`/`group_name` on active_orders

## Business Logic

- **Cash** = `available_cash + cumulativePl`
- **Total Value** = `Cash + marginLocked + cashBufferLimit + money_market + totalNotional`
- **P/L %** = `(cumulativePl / (available_cash + money_market + marginLocked + cashBufferLimit)) × 100`
- **Risk Level**: `cashBufferLimit ≠ 0` → `((availableCash − marginLocked) / cashBufferLimit) × 100`; `cashBufferLimit = 0` → `((availableCash − marginLocked) / marginLocked) × 100`; both $0 → `100` (Safe)
- **Managed Fund NAV** = `available_cash + money_market + sum(holding.qty × holding.current_price)`
- **Managed Fund order flow**: Create (pending) → PATCH status=done → update holdings + adjust available_cash + record NAV → move to order_history

## Design System

CSS variables in `src/index.css` for light/dark mode. Key tokens:
- `--color-brand-teal: #0fbcb0` (positive/safe)
- `--color-brand-yellow: #ffd02f` (warning)
- `--color-brand-coral: #ff9999` (danger/loss)
- `--color-brand-blue: #4262ff` (info)

Dark mode: `.dark` class on `<html>` toggles all tokens. Persisted in `localStorage`. Anti-flash script in `index.html`.

## Docs

- [Backend API](backend/README.md) — full API reference, architecture, troubleshooting
- [Frontend](frontend/README.md) — component structure, routes, features
- [Database Schema](database/README.md) — table definitions, custom portfolio architecture
- [Agent Governance](.opencode/AGENT.md) — detailed architecture, pitfalls, feature specs
