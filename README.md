# Investment Dashboard

Full-stack portfolio management system with real-time analytics, options strategy sandbox, AI agent integration, **Managed Fund rebalancing**, and **dynamic multi-database custom portfolios**.

## Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React 18 + TypeScript + Vite 5.4.21 + Tailwind CSS 3.4.19 |
| **Backend** | FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL |
| **Deployment** | Kubernetes (kustomize) |
| **Styling** | Tailwind CSS (npm), dark mode via CSS variables |
| **Drag & Drop** | react-dnd + react-dnd-html5-backend |
| **Password Encryption** | Fernet (cryptography library, `FERNET_KEY` env var) |

## Quick Start

```bash
# From project root
cp deploy/base/secrets.env.example deploy/base/secrets.env
# edit deploy/base/secrets.env with real values

./scripts/kind-up.sh

# UI
open http://localhost:8080
```

The dev cluster runs on podman via kind. Tear it down with `./scripts/kind-down.sh`.

## Architecture

```
Browser → frontend Service (nginx, NodePort 30080 → localhost:8080)
                              ↓ /api/*
                           backend Service (:8000)
                              ↓
                           PostgreSQL (main, ai)
                              ↓
                           External DBs (Custom Portfolios)
```

Custom Portfolios use **isolated external PostgreSQL databases** configured by the user. Metadata stays on `investment_main`; transactional data (orders, transactions, assets) routes to the external DB. Connections are lazy-initialized on first request. Passwords are encrypted with Fernet.

A Custom Portfolio runs in one of two modes:

| Mode | Storage | Writes |
|------|---------|--------|
| **Owned tables** (default) | The backend creates and migrates its own FK-free tables (`active_orders`, `transactions`, `trade_plans`, …) in the external DB | Full CRUD |
| **Read-through mapping** | `custom_portfolio_connections.mapping_config` (JSON) maps an existing broker schema onto our entities; no DDL, no tables created | Data-plane writes rejected with `409 Portfolio is read-only (mapped external database)`; the UI renders no write affordance |

The read-through mode ships with the `tfex-settrade-v1` template (`usd_pct_abc.opened_orders` / `order_history` / `account_history`); the JSON config is the contract between the two schemas, and the frontend hides every write affordance when the grid response carries `read_only`.

## Key Features

- **Managed Fund** — Full portfolio rebalancing with separate order lifecycle (Create→Confirm→History), auto cash tracking, 4-card summary (NAV/Cash/Invested/P/L), target allocation ratios, rebalance recommendations, profit threshold alerts
- **Portfolio Overview** — Hero card, Pool Health gauge, Money Reserve, Active Portfolio cards with DnD cash transfer
- **Portfolio Grid** — Zone-grouped orders, drag-drop assignment, contract type filters, order link system
- **Payoff Chart** — Pure SVG: intrinsic + BS IV overlay, crosshair, tooltip, area fill, break-even markers
- **Options Strategy Sandbox** — Frontend-only scratchpad with per-portfolio localStorage persistence
- **Asset Management** — Zone-based group sections, inline price editing, yfinance price cache (`cached_price_{ticker}`)
- **Notification System** — Centralized context with navbar bell icon, unread badge, history dropdown, 3s auto-dismiss
- **Dark Mode** — Class-based toggle with localStorage persistence and anti-flash protection
- **Transaction Ledger** — Deposit, withdraw, transfer between portfolios with full history; global aggregation across all custom DBs
- **Risk Analytics** — Pool health, money reserve status, Sharpe/VaR/Drawdown, risk score gauge
- **AI Agents** — Automated scan/plan/execute/adjust cycles per portfolio
- **Custom Portfolio** — User-configured external PostgreSQL databases for isolated data storage, with Test Connection diagnostics. Either the backend owns the tables, or a JSON mapping config (`mapping_config`, template `tfex-settrade-v1`) turns the portfolio into a **read-only read-through view** over a foreign broker schema: mapped orders/history/account balances, no DDL, every write answered with 409, and row-level diagnostics on the connection test; the ladder's `Mark` column shows the broker's `mark_price` while Net P&L uses the local All Assets current price
- **Drag & Drop** — Transfer cash between portfolios, assign orders to groups, move assets between groups
- **Encrypted Credentials** — DB passwords encrypted with Fernet symmetric key (`FERNET_KEY`), never stored in plaintext

## Repository Structure

```
InvestmentDashboard/
├── frontend/           # React + TypeScript + Vite
│   ├── src/                # Sources; Vitest tests live beside them (*.test.tsx)
│   │   ├── components/     # Navigation, NotificationBell, ThemeToggle, icons
│   │   ├── contexts/       # NotificationContext
│   │   ├── pages/          # Top-level routes
│   │   ├── screens/        # Detail layouts + modals + sub-components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── types/          # TypeScript interfaces
│   │   ├── constants/      # Design tokens, buttonTheme
│   │   └── utils/          # Formatting, risk helpers
│   ├── Dockerfile          # Multi-stage build, served by nginx
│   ├── nginx.conf          # SPA fallback + /api proxy
│   ├── tailwind.config.js
│   └── vite.config.ts
├── backend/            # FastAPI
│   ├── app/
│   │   ├── models.py
│   │   ├── managed_fund_models.py  # 4 Managed Fund models
│   │   ├── custom_models.py    # FK-free models for custom DBs
│   │   ├── database.py         # Engine manager + session routing
│   │   ├── utils/
│   │   │   └── crypto.py       # Fernet password encryption
│   │   ├── routers/            # 20+ route files (incl. managed_funds.py)
│   │   └── services/           # yfinance_service.py
│   ├── tests/
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── Dockerfile
├── database/           # SQL schemas
│   ├── main_db_schema.sql
│   ├── ai_db_schema.sql
│   ├── mock/                   # Dev-only fixtures (usd_pct_abc_dev_seed.sql: foreign-schema seed)
│   └── README.md               # Schema docs incl. custom_portfolio_connections
├── deploy/             # Kubernetes base + kind dev overlay
│   ├── base/                   # Environment-agnostic resources
│   └── overlays/kind/          # Dev-only kind cluster adapter
├── scripts/            # kind-up.sh / kind-down.sh
├── requirement/        # Functional specs + UI designs
└── .opencode/          # AI agent governance
```

## Docs

- [Backend API](backend/README.md)
- [Frontend](frontend/README.md)
- [Database Schema](database/README.md)
- [Agent Context](.opencode/AGENT.md)

## Design System

Uses CSS variables for theming with automatic dark mode switching:

| Token | Light | Dark |
|-------|-------|------|
| `--color-primary` | `#1c1c1e` | `#1a1a2e` |
| `--color-brand-teal` | `#0fbcb0` | `#0fbcb0` |
| `--color-brand-yellow` | `#ffd02f` | `#ffd02f` |
| `--color-brand-coral` | `#ff9999` | `#ff9999` |

*Last updated: 23 November 2026 (Read-through Custom Portfolios: JSON `mapping_config` + `tfex-settrade-v1` template map a foreign broker schema read-only, `database/mock/usd_pct_abc_dev_seed.sql` dev fixture, mapping endpoints and 409 write guard, mapping/connection UI on the grid)*
