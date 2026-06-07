# Investment Dashboard

Full-stack portfolio management system with real-time analytics, options strategy sandbox, and AI agent integration.

## Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React 18 + TypeScript + Vite 5.4.21 + Tailwind CSS 3.4.19 |
| **Backend** | FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL |
| **Container** | Docker Compose with bridge networking |
| **Styling** | Tailwind CSS (npm), dark mode via CSS variables |
| **Drag & Drop** | react-dnd + react-dnd-html5-backend |

## Quick Start

```bash
# From project root
docker compose up -d

# Frontend dev mode (with HMR)
cd frontend && npm run dev

# Backend API
curl http://localhost:8000/health
```

## Architecture

```
Browser → localhost:5173 → Frontend (Docker, bridge network)
                              ↓ Vite Proxy (/api/*)
                           Backend (http://backend:8000, Docker DNS)
                              ↓
                           PostgreSQL (Main :5432, AI :5433)
```

## Key Features

- **Portfolio Overview** — Hero card, Pool Health gauge, Money Reserve, Active Portfolio cards with DnD cash transfer
- **Portfolio Grid** — Zone-grouped orders, drag-drop assignment, contract type filters, order link system (spread/pending-close)
- **Payoff Chart** — Pure SVG: intrinsic + BS IV overlay, crosshair, tooltip, area fill, break-even markers
- **Options Strategy Sandbox** — Frontend-only scratchpad with per-portfolio localStorage persistence
- **Asset Management** — Zone-based group sections, inline price editing, yfinance price cache (`cached_price_{ticker}`)
- **Notification System** — Centralized context with navbar bell icon, unread badge, history dropdown, 3s auto-dismiss
- **Dark Mode** — Class-based toggle with localStorage persistence and anti-flash protection
- **Transaction Ledger** — Deposit, withdraw, transfer between portfolios with full history
- **Risk Analytics** — Pool health, money reserve status, Sharpe/VaR/Drawdown, risk score gauge
- **AI Agents** — Automated scan/plan/execute/adjust cycles per portfolio
- **Drag & Drop** — Transfer cash between portfolios, assign orders to groups, move assets between groups

## Repository Structure

```
InvestmentDashboard/
├── frontend/           # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/     # Navigation, NotificationBell, ThemeToggle, icons
│   │   ├── contexts/       # NotificationContext
│   │   ├── pages/          # Top-level routes
│   │   ├── screens/        # Detail layouts + modals + sub-components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # API client (api.ts)
│   │   ├── types/          # TypeScript interfaces
│   │   ├── constants/      # Design tokens, buttonTheme
│   │   └── utils/          # Formatting, risk helpers
│   ├── tests/              # Vitest test suite
│   ├── tailwind.config.js
│   └── vite.config.ts
├── backend/            # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── database.py
│   │   ├── routers/        # 18 route files
│   │   └── services/       # yfinance_service.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── database/           # SQL schemas
│   ├── main_db_schema.sql
│   └── ai_db_schema.sql
├── requirement/        # Functional specs + UI designs
├── docker-compose.yml
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

*Last updated: 7 June 2026*
