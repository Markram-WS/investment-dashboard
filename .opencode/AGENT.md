# Project Context & AI Agent Governance (Native Windows Edition)

## 1. System Environment & Execution Constraints
- **OS:** Windows 11 (Native Execution)
- **Containerization:** Docker inside WSL (Ubuntu-26.04) — `docker compose` commands run from WSL shell
  - WSL Docker uses bridge networking with `networks: - investment-network` for frontend
  - Backend accessible at `http://backend:8000` via Docker DNS
- **Port Forwarding:** Windows → WSL via `netsh interface portproxy`:
  - `127.0.0.1:8000` → WSL_IP:8000 (backend)
  - `127.0.0.1:5173` → WSL_IP:5173 (frontend)
  - `127.0.0.1:5432` → WSL_IP:5432 (PostgreSQL main)
  - Check current WSL IP with `wsl -- hostname -I`
- **Shell Preference:** Bash-like Syntax ONLY (via Git Bash, MinGW, or equivalent).
- **Command Constraints:** ALWAYS use `/` for paths. NEVER recommend PowerShell-specific cmdlets.
- **Workflow:** Verify Before Done (VBD). Check if service is up after changes.
- **Disk Space:** If backend crashes with disk full, run `docker system prune -f` inside WSL.

## 2. Coding Philosophy: SOLID & Modularization
- **Core Principle:** Strictly follow SOLID principles.
- **Single Responsibility (SRP):** One file, one purpose.
- **Dependency Inversion:** Use Interfaces/Abstract classes.
- **No Monolith Blocks:** Separate concerns into `components/`, `hooks/`, `types/`, `utils/`.

## 3. Component Architecture Guidelines
- **Granularity:** Break down UI into small, reusable atoms.
- **Composition over Inheritance:** Build complex features by composing smaller components.
- **Clean Props:** Keep component interfaces lean.
- **React Hooks Rule:** ALL hooks must be called BEFORE any early return statements.

## 4. Operational Risk Framework (Mark's Policy)
- **R0 (No Magic):** Do not assume Infrastructure.
- **R1 (Edit & Notify):** Refactor into SOLID patterns and report structural changes.
- **R2 (Direct Action):** Minor logic fixes and unit test updates.

## 5. Deployment & Testing
- Run `docker compose up -d` from WSL (Ubuntu 26.04) at `D:\InvestmentDashboard` (mounted as `/mnt/d/InvestmentDashboard`).
- Frontend has volume mount (`./frontend:/app`) for live HMR.
- Backend has NO volume mount — code changes require `docker compose build backend --no-cache && docker compose up -d backend` inside WSL.
- `npm install` on WSL with mounted Windows drives requires `--no-bin-links` flag.
- Verify WSL Docker status: `wsl -- docker compose ps`.

## 6. Architecture Overview

### Backend (FastAPI)
- **19+ routers** in `backend/app/routers/`: `active_orders.py`, `ai_agents.py`, `analytics.py`, `asset_groups.py`, `assets.py`, `etl_sync.py`, `journal.py`, `orders_groups.py`, `overview.py`, `performance.py`, `portfolios.py`, `rebalance.py`, `risk.py`, `trade_history.py`, `trade_plans.py`, `transactions.py`, `transfers.py` (+ `yfinance_service.py` in services/)
- **18 SQLAlchemy models**: Portfolio, CustomPortfolioConnection, TradePlan, ActiveOrder, OptionDetails, PortfolioNavHistory, SimulationModels, TradeHistory, Transaction, DecisionJournal, WhitelistAssets, Watchlist, AssetGroup, OrdersGroup, AiAgent, AiActionLog, AiAgentState, CustomTradePlan (in custom_models.py)
- **Custom Portfolio** (`port_type = "Custom Portfolio"`) replaces legacy "Spread Strategy" — requires external PostgreSQL connection.
- **Multi-DB Architecture**:
  - `is_custom` flag on `Portfolio` routes transactional data to user-configured external databases
  - `CustomPortfolioConnection` stores encrypted credentials (Fernet, `FERNET_KEY` env var)
  - `custom_models.py` defines FK-free table replicas for external DBs (`active_orders`, `transactions`, `trade_plans`, `whitelist_assets`, `asset_groups`, `orders_groups`)
  - Dynamic engine manager (`database.py`) caches `AsyncEngine` instances per portfolio_id; lazy-connects on first request
  - `resolve_portfolio_db(db, portfolio_id)` helper provides per-request session routing (replaces removed `get_custom_session_maker`)
  - `ensure_custom_tables()` runs on first access — queries `information_schema.columns`, runs `ALTER TABLE ADD COLUMN IF NOT EXISTS` for missing columns, drops all FK constraints
  - `POST /api/v1/portfolios/test-connection` validates external DB credentials
  - `GET /api/v1/transactions` without `portfolio_id` aggregates from `investment_main` + all custom DBs concurrently via `asyncio.gather(return_exceptions=True)`
- **Key additions:**
  - `assets.py` — full CRUD for whitelist assets + `sync-from-orders`, `update-price`, `batch-update-prices`; all endpoints support `?portfolio_id=` for custom portfolios
  - `asset_groups.py` — CRUD for asset groups; seeds Ungrouped/Watchlist defaults; all endpoints support `?portfolio_id=`
  - `orders_groups.py` — CRUD for orders groups (`Zone Groups`); all endpoints support `?portfolio_id=` for custom portfolios
  - `active_orders.py` — all order endpoints (create, update, close, link, unlink, cancel) accept `?portfolio_id=` query param and route via `resolve_portfolio_db`
  - `analytics.py` — both `get_portfolio_grid_data` and `get_portfolio_detail` build `group_name` mapping by querying `CustomOrdersGroup` table for custom portfolios (since `CustomActiveOrder` has no ORM `group` relationship)
  - `trade_history.py` — `get_trade_history` now always queries `TradeHistory` from main DB for custom portfolios (close endpoint writes `TradeHistory` to main DB, not `CustomTransaction` to custom DB)
  - `yfinance_service.py` — rewritten to use direct HTTP to Yahoo Finance (`query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=2d&interval=1d`). No yfinance library. Errors propagate as HTTP 502.
- `WhitelistAssets` extended: `name`, `source` (yfinance/manual), `group_id` FK→`asset_groups`, `price`, `change_24h`, `updated_at`
- Two core PostgreSQL databases: `investment_main` (port 5432) and `investment_ai` (port 5433)

### Frontend (React 18 + TypeScript + Vite 5.4.21)
- **Vite 5.4.21** (downgraded from Vite 8 due to optimizer hang on Linux/Docker)
- **Tailwind CSS v3.4.19** npm package (not CDN) with `darkMode: 'class'`
- **Dark mode**: `.dark` class on `<html>` toggles all CSS variables; ThemeToggle with localStorage + anti-flash script
- **Font**: Sora (Google Fonts) replaces Inter + Plus Jakarta Sans
- **Notification system**: `NotificationContext` — `notify(msg, type)` centralizes all toasts. `NotificationBell` in navbar with unread badge + dropdown history panel. Persisted to localStorage. Auto-dismiss 3s. ToastAlert inline in context (not separate component), positioned `right-6`.
- **PageLayout component**: `max-w-[1200px] mx-auto px-6 py-10` shared container used by PortfolioOverview, TransactionsPage, AllAssets, RiskAnalytics — single change point for layout.
- **TransactionsPage redesigned**: Unified inline form (From/To dropdowns) replaces 3 separate Deposit/Withdraw/Transfer modals. Table uses From/To columns instead of single Flow column. Always-visible form (no toggle). Same-port and deposit-vs-withdraw conflicts enforced in dropdowns.
- **Custom Portfolio form**: `CreateNewPortfolio.tsx` has "Custom Portfolio" type with external DB connection fields (host, port, DB name, user, password) + Test Connection button
- **Portfolio routing**: `PortfolioAnalyticsDetail.tsx` routes Managed Fund → `PortfolioMutualFund`, all others (including Custom Portfolio) → `PortfolioGrid`
- **Removed**: `/spread-pairing` route, `PortfolioSpread` import, spread-pair API calls
- **Asset page**: Zone-style group sections (collapsible, droppable) replace filter tabs. Inline price editing. Yfinance price cached to `localStorage('cached_price_{ticker}')`. Per-asset refresh + batch refresh.
- **AssetGroupModal**: Table-layout CRUD (matches ZoneGroupModal style). Default groups (Ungrouped/Watchlist) cannot be deleted.
- **AddAssetModal / EditAssetModal**: Create/edit assets with group, type, source selection.
- **ToastAlert** removed from 4 pages — replaced by centralized `useNotification().notify()`
- **Navigation**: Portfolio dropdown links navigate to `/analytics/portfolio/{id}`; +Portfolio button uses `text-brand-teal` (green text, no background/border); `IconPlus` replaced with inline SVG
- **CreateNewPortfolio**: All emoji icons replaced with inline SVGs (bullseye target, trending-up chart, link chain)
- **DndProvider** wraps entire app in App.tsx (moved from PortfolioOverview)
- **Inline styles**: 254 → 35 (only dynamic runtime values)
- **Z-index 100**: custom `zIndex` extend in tailwind.config.js for navbar
- **Docker networking**: bridge network (`investment-network`); `BACKEND_API_BASE_URL=http://backend:8000`
- **`manualChunks`**: function syntax (Vite 5 compat)
- **Button component**: 5 variants (primary/secondary/outline/danger/ghost), 3 sizes. Replaces all inline button styling.
- **PageLayout component**: `max-w-[1200px] mx-auto px-6 py-10` shared container; used by 4 pages (PortfolioOverview, TransactionsPage, AllAssets, RiskAnalytics)
- **TransactionsPage redesign**: Unified inline form (From/To dropdowns) replaces 3 separate modals (Deposit/Withdraw/Transfer). Table shows From/To columns instead of Flow. Filters + form in same row (50/50). Always-visible form (no toggle). Validates same-port and deposit-vs-withdraw conflicts in dropdowns.
- **Navigation updates**: Portfolio dropdown links navigate to `/analytics/portfolio/{id}`; +Portfolio button uses `text-brand-teal` (green text, no background/border); `IconPlus` replaced with inline SVG
- **ToastAlert**: Now inline in `NotificationContext` (not a separate rendered component). Positioned `right-6` instead of centered. Auto-dismisses after 3s (was 5s).

### Database (`database/`)
- **Main DB** — 14 tables (added `custom_portfolio_connections`)
- **Portfolio** — `is_custom` Boolean flag (added via ALTER TABLE migration)
- **WhitelistAssets** — extended with `name`, `source`, `group_id`, `price`, `change_24h`, `updated_at`
- **AssetGroup** — `id`, `name` (unique), `is_default`, `created_at`. Seeds Ungrouped + Watchlist.
- **CustomPortfolioConnection** — `id`, `portfolio_id` (unique FK), `db_host`, `db_port`, `db_name`, `db_user`, `encrypted_password`
- `active_orders.order_id` is TEXT (UUID); `contract_type` (spot/future/option), `option_type` (Call/Put), `side` (BUY/SELL/LONG/SHORT)
- `link_type` computed server-side (not stored): `"spread"`, `"pending_close"`, `"primary"`, `"none"`
- Frontend-only data (not in DB): OptionsStrategy rows, IV values, payoff controls — per-portfolio localStorage

### Payoff Chart — localStorage per-portfolio
- 6 keys: `payoff_strategy_rows_{pid}`, `payoff_iv_mode_{pid}`, `payoff_min_price_{pid}`, `payoff_max_price_{pid}`, `payoff_active_ivs_{pid}`, `payoff_current_price_{pid}`
- One-time migration from old flat keys; delete portfolio clears its 6 keys

### Payoff Chart — Technical
- **Layout**: `aspect-[4/1]` container, 4:1 viewBox (800×200). Stats sidebar overlaid absolutely on right.
- **Lines**: Intrinsic (blue) + BS IV (orange, dashed, togglable). Area fill: pale green (#DCFCE7, 0.6) above baseline → transparent → pale red (#FEE2E2, 0.6) below.
- **Break-even**: Vertical dashed yellow lines at BE prices. Uses IV BE when IV mode ON.
- **Crosshair**: Dashed gray vertical line + circles on P/L curves + hover tooltip.
- **Y-axis**: Symmetric around 0. `niceTicks()` for clean round labels.

## 7. Key Business Logic
- **Cash** = `available_cash + cumulativePl`
- **Total Value** = `available_cash + cumulativePl + marginLocked + cashBufferLimit + money_market + totalNotional`
- **Available Cash** (raw) = `available_cash` (DB field)
- **Available Cash** (tooltip) = `Cash + Total P/L`
- **P/L %** = `(cumulativePl / (available_cash + money_market)) × 100`
- **Edit Portfolio auto-adjust**: `newAvailable = max(0, rawAvailableCash − totalDiff)`
- **Risk Level gauge**: 3-branch formula (mirrored frontend + backend):
  - `cashBufferLimit ≠ 0`: `((availableCash − marginLocked) / cashBufferLimit) × 100`
  - `cashBufferLimit = 0`: `((availableCash − marginLocked) / marginLocked) × 100`
  - Both $0$: returns `100` (Safe)

### Price Range Auto-Compute
- Formula: `max = max(strike, entry_price) × 1.5`, `min = max(0, min(strike, entry_price) × 0.5)`
- Commit on blur (not keystroke). Empty → reverts to previous value. Auto-adjusts when `min ≥ max`.

## 8. Design Conventions
- **Tailwind config**: `darkMode: 'class'`, custom colors via CSS variables, `zIndex: { '100': '100' }`
- **buttonTheme** (`constants/colors.ts`): side (LONG=emerald-600, SHORT=red-500), optionType (Call=blue-600, Put=orange-500)
- **Global Focus Ring**: All `<input>`, `<select>`, `<textarea>` use `ink` ring via `index.css`
- **Font**: Sora replaces Inter + Plus Jakarta Sans
- **Anti-pattern fixes**: 254 → 35 inline styles; `side-tab` → `border-l-2`; `btn-primary`/`btn-ghost` CSS classes removed (use `<Button variant="primary">`)
- **Cash field order**: Lock → Buffer → Money Market → Available

## 9. Common Pitfalls
- **Vite 5.4.21** — not Vite 8 (Vite 8 optimizer hangs on Linux/Docker)
- **Docker networking** — bridge network (`investment-network`), not `network_mode: host`
- **React Hooks before early returns** — all hooks must precede any early return
- **Number inputs**: Use local string state to avoid "delete 0" controlled-input bug
- **Backend rebuild**: No volume mount — `docker compose build backend --no-cache && docker compose up -d backend`
- **npm install on WSL**: needs `--no-bin-links` flag for `/mnt/d/` mounts
- **yfinance**: Direct HTTP to Yahoo Finance (no yfinance library). Rate limits apply — wait and retry.
- **FERNET_KEY required**: Custom Portfolio creation requires `FERNET_KEY` env var. Generate: `python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'`
- **Custom DB lazy-init**: External connections are established on first API request, NOT at startup. If a custom DB is unreachable, individual portfolio endpoints return 503.
- **ensure_custom_tables drops FK constraints**: This is a one-time operation per portfolio_id (tracked in `CUSTOM_INITIALIZED` set). After dropping, the tables become FK-free. If the external DB is shared with other applications, those apps may fail; we assume sole ownership.
- **CustomTradePlan**: Added to `custom_models.py` to resolve `ForeignKeyViolationError` when creating orders referencing main-DB `plan_id`s in external DBs.
- **group_name resolution**: `CustomActiveOrder` has no ORM `group` relationship. Both analytics endpoints now query `CustomOrdersGroup` table to populate `order.group_name` for custom portfolio orders.
- **ZoneGroupModal**: `onSaved` must be destructured from props. `deleteZoneGroup` and `updateZoneGroup` need `portfolioId` to append `?portfolio_id=` for custom portfolios.
- **Group CRUD refresh**: After creating/editing/deleting a zone group, `PortfolioGrid` must call `fetchAnalyticsData()` (not just refresh `groups` state) to update `active_orders` with fresh `group_id`/`group_name` — otherwise the `zoneGroups` computed value still shows the stale group.
- **Trade history for custom portfolios**: `get_trade_history` must query `TradeHistory` from main DB (not `CustomTransaction` from custom DB) because `close_order` always writes `TradeHistory` to main DB regardless of portfolio type.
- **Global transactions query**: `GET /api/v1/transactions` without `portfolio_id` aggregates all custom DBs. Failed nodes are skipped and reported via `failed_portfolios` array in response.

## 10. Impeccable Audit Status (last: 2026-06-07)

- **Score**: 12/20 (Acceptable)
- **Key wins**: 254→35 inline styles, Tailwind CDN→npm migration, CSS variable cleanup (10 unused removed), dark mode theme toggle, responsive table strategy
- **Remaining gaps**: 3 `border-l-2` false positives, 62 form controls lack labels, 17 grids lack responsive variants
- **Full report**: `.impeccable/audit-report.md`

## 11. Link Feature Implementation Status

### Backend (✅ Complete)
- `POST /api/v1/orders/{order_id}/link` — sets one-way `linked_order_id`
- `POST /api/v1/orders/{order_id}/unlink` — clears both sides
- `analytics.py._link_type()` — computes `"spread"`, `"pending_close"`, `"primary"`, `"none"` per order
- Close endpoint auto-closes sub-orders; returns `auto_closed[]` + `paired_order_id`

### Frontend (✅ Complete)
- Link icon (chain-link SVG, white circle) with per-type color (blue spread, yellow pending_close, gray unlinked)
- SVG vertical lines connecting linked orders
- Sub-orders: hidden grip, non-draggable; parent carries children on drag
- `computeLinkGroup()` in PortfolioGrid.tsx; flat view link reorder in OrderManagement.tsx
- CloseOrderModal shows link type; EditOrderModal has unlink-on-save flow

## 12. Custom Portfolio Feature — Key Files

| File | Role |
|------|------|
| `backend/app/models.py` | `Portfolio.is_custom` flag; `CustomPortfolioConnection` model |
| `backend/app/custom_models.py` | FK-free models for external DB tables |
| `backend/app/utils/crypto.py` | Fernet encrypt/decrypt for DB passwords |
| `backend/app/database.py` | Engine cache, `get_portfolio_db`, `get_custom_session`, `resolve_portfolio_db`; `ensure_custom_tables` |
| `backend/app/main.py` | `is_custom` column migration in lifespan |
| `backend/app/routers/portfolios.py` | Custom Portfolio type, create with connection, `test-connection`, `PATCH connection` |
| `backend/app/routers/transactions.py` | Dynamic session routing + global aggregator |
| `backend/app/routers/active_orders.py` | Dynamic session via `resolve_portfolio_db` |
| `backend/app/routers/trade_history.py` | Dynamic session via `resolve_portfolio_db` |
| `backend/app/routers/assets.py` | Dynamic session via `resolve_portfolio_db` |
| `backend/app/routers/asset_groups.py` | Dynamic session via `resolve_portfolio_db` |
| `backend/app/routers/orders_groups.py` | Dynamic session via `resolve_portfolio_db` |
| `backend/app/routers/overview.py` | Dynamic session via `resolve_portfolio_db` |
| `backend/app/routers/analytics.py` | Dynamic session via `resolve_portfolio_db` |
| `frontend/src/pages/CreateNewPortfolio.tsx` | Custom Portfolio form with DB connection fields + Test Connection |
| `frontend/src/pages/PortfolioAnalyticsDetail.tsx` | Routing: Custom Portfolio → PortfolioGrid |
| `frontend/src/lib/api.ts` | `testConnection` API endpoint |
| `frontend/src/App.tsx` | Removed `/spread-pairing` route |
| `database/main_db_schema.sql` | `custom_portfolio_connections` table |
| `database/README.md` | Multi-DB schema documentation |

## backend detail : D:\InvestmentDashboard\backend\README.md
## frontend detail : D:\InvestmentDashboard\frontend\README.md
## database : D:\InvestmentDashboard\database\README.md
## overall detail : D:\InvestmentDashboard\README.md
## design : DESIGN.md/
