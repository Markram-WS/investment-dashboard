# 📊 Investment Dashboard

Professional investment management system — Unified Dashboard for Manual + Bot Trade portfolio management.

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |
| **Backend** | FastAPI (Python) + SQLAlchemy + asyncpg |
| **Database** | PostgreSQL (main:5432, AI:5433) |
| **Runtime** | Node.js (frontend), Python 3.11 (backend) |
| **Container** | Docker Compose |
| **AI Orchestrator** | Hermes Agent |

## 🚀 Quick Start

### Prerequisites
- Docker + Docker Compose
- Node.js 18+ (for local frontend dev)
- Python 3.11+ (for local backend dev)

### Run with Docker Compose
```bash
# Start all services
docker compose up -d

# Check status
docker ps
```

### Access
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Backend Services
| Service | Port | Description |
|---------|------|-------------|
| backend | 8000 | FastAPI REST API |
| db_main | 5432 | PostgreSQL — main database |
| db_ai | 5433 | PostgreSQL — AI agent database |
| frontend | 5173 | Vite dev server |

### 🐳 Docker Network Architecture

```
Browser (host machine)
    ↓ http://localhost:5173
Frontend Container (network_mode: host)
    ↓ Vite Proxy: /api/* → http://localhost:8000
Backend Container (investment-network)
    ↓ http://localhost:8000
```

**ทำไมใช้ `network_mode: host` สำหรับ frontend?**

- Browser ทำงานบน host machine ไม่ได้อยู่ใน Docker network
- หาก frontend อยู่ Docker network เดียวกับ backend JavaScript จะต้องเรียก `http://backend:8000` แต่ browser ไม่เข้าใจ service name จึงเกิด `ERR_CONNECTION_REFUSED`
- วิธีนี้ทำให้ frontend อยู่บน host network เรียก backend ผ่าน `localhost:8000` ได้โดยตรง
- Vite dev server proxy สำหรับ `/api/*` paths ไปยัง backend โดยอัตโนมัติ (see vite.config.ts)

**Environment Variables**

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_BASE_URL` | `""` (empty) | Vite dev mode - uses relative paths for proxy |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Production build (browser direct to backend) |

## 📋 API Endpoints

### Portfolios
- `GET /api/v1/portfolios` — List all portfolios
- `GET /api/v1/portfolios/{id}` — Get portfolio by ID
- `POST /api/v1/portfolios` — Create new portfolio
- `PUT /api/v1/portfolios/{id}` — Update portfolio
- `DELETE /api/v1/portfolios/{id}` — Delete portfolio
- `GET /api/v1/portfolios/types` — Get portfolio types (Managed Fund, Active Trading, Spread Strategy)

### Transactions
- `GET /api/v1/transactions` — List transactions
- `POST /api/v1/transactions` — Create transaction
- `GET /api/v1/transactions/{id}` — Get single transaction

### Risk Management
- `GET /api/v1/risk/pool-health` — Pool Health Index (Gauge 0-100)
- `GET /api/v1/risk/money-reserve-status` — Money Reserve Status (Danger/Optimal/Inefficient)
- `GET /api/v1/risk/portfolio-safety/{id}` — Portfolio Safety (Danger/Warning/Safe)

### Analytics & Rebalancing
- `GET /api/v1/analytics/portfolio-grid` — Portfolio analytics grid
- `POST /api/v1/rebalance/calculate` — Calculate rebalancing recommendations
- `POST /api/v1/rebalance/recommend` — Get rebalancing recommendations
- `POST /api/v1/rebalance/execute` — Execute rebalancing (→ active_orders)
- `GET /api/v1/rebalance/nav-history/{portfolio_id}` — NAV history

### AI Agents
- `POST /api/v1/ai/scan` — Market scanning
- `POST /api/v1/ai/plan` — Strategy planning
- `POST /api/v1/ai/execute` — Autonomous execution
- `POST /api/v1/ai/emergency-stop` — Emergency stop AI
- `POST /api/v1/ai/resume` — Resume AI

### Other
- `GET /api/v1/transfers` — Cash pool transfers
- `POST /api/v1/journal` — Decision journal entries
- `GET /api/v1/overview` — Dashboard overview

## 🧪 Testing

### Run All Tests
```bash
docker run --rm --network investmentdashboard_investment-network \
  -v /mnt/d/InvestmentDashboard/backend:/app -w /app \
  investmentdashboard-backend python -m pytest tests/ -v
```

### Test Results
- **71/71 tests PASSED** ✅
- Coverage: transactions, risk, analytics, AI, transfers, trade plans, journal

## 🗄️ Database Schema

### Main DB (investment_main)
| Table | Description |
|-------|-------------|
| portfolios | Portfolio master data |
| trade_plans | Trading plans |
| active_orders | Active orders |
| option_details | Options data |
| portfolio_nav_history | NAV history |
| transactions | Transaction ledger |
| decision_journal | Journal entries |
| whitelist_assets | Whitelisted assets |
| watchlist | Watchlist items |

### AI DB (investment_ai)
| Table | Description |
|-------|-------------|
| ai_agents | AI agent registry |
| ai_action_logs | AI action logs |
| ai_agent_state | AI agent state |

## 📁 Project Structure

```
InvestmentDashboard/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── screens/   # Page components
│   │   ├── components/ # Shared components
│   │   └── ...
│   └── ...
├── backend/           # FastAPI + Python
│   ├── app/
│   │   ├── routers/   # API endpoints
│   │   ├── models.py  # SQLAlchemy models
│   │   └── database.py
│   ├── tests/         # Pytest suite
│   └── ...
├── requirement/       # Documentation
│   ├── UI/            # UI layout specs
│   └── ...
├── docker-compose.yml
└── README.md
```

## 🔄 Development Workflow

### Kanban Task Management
This project uses Hermes Kanban for task orchestration:

```
Hermes (Orchestrator)
  ├── Creates tasks with priority ordering
  ├── Coder picks highest-priority READY task
  ├── Tester verifies after coder done
  └── Bug reports → new coder tasks

Coder: READY → pick → IN_PROGRESS → DONE → pick next
Tester: READY → pick → IN_PROGRESS → comment PASS/FAIL → DONE
```

### Profiles
- **coder** (William) — Software developer
- **tester** (Sophia) — QA specialist

## 📊 Requirements Compliance

### Detailed-Functional-Requirements Coverage
| Section | Status |
|---------|--------|
| 1.1 Overview Screen | ✅ |
| 1.2 Transactions Screen | ✅ |
| 1.3 Portfolio Analytics | ✅ |
| 1.4 Create Portfolio | ✅ |
| 2.1 Portfolio Types | ✅ |
| 2.2 Liquidity Safety / Risk Framework | ✅ |
| 2.3 Decision Journal | ✅ |
| 3.1 Rebalancing Engine | ✅ |
| 3.2 Rebalancing Workflow | ✅ |
| 4.1 AI Log-Driven Intelligence | ✅ |
| 4.2 AI Autonomous Cycle | ✅ |
| 5. Technical Rules | ✅ |

## 🚧 Roadmap

### Phase 1: Foundation ✅
- [x] Database setup
- [x] Backend API
- [x] Frontend screens
- [x] Testing

### Phase 2: Intelligence (Planned)
- [ ] Mem0 + Qdrant integration
- [ ] Risk Veto logic
- [ ] AI reasoning logs

### Phase 3: Production (Planned)
- [ ] CI/CD pipeline
- [ ] Monitoring (Prometheus + Grafana)
- [ ] Production deployment

## 📝 License

Proprietary — ZOO Company
