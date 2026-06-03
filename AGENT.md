# Project Context & AI Agent Governance (Native Windows Edition)

## 1. System Environment & Execution Constraints
- **OS:** Windows 11 (Native Execution)
- **Containerization:** Docker inside WSL (Ubuntu-26.04) — `docker compose` commands run from WSL shell
  - Podman Desktop was retired after the Podman machine SSH connection broke repeatedly
  - WSL Docker uses `network_mode: "host"` for frontend (Vite HMR directly on WSL host network)
- **Port Forwarding:** Windows → WSL via `netsh interface portproxy`:
  - `127.0.0.1:8000` → WSL_IP:8000 (backend)
  - `127.0.0.1:5173` → WSL_IP:5173 (frontend)
  - `127.0.0.1:5432` → WSL_IP:5432 (PostgreSQL main)
  - Check current WSL IP with `wsl -- hostname -I`
- **Shell Preference:** Bash-like Syntax ONLY (via Git Bash, MinGW, or equivalent).
- **Command Constraints:** 
  - ALWAYS use `/` for paths in code and commands.
  - NEVER recommend PowerShell-specific cmdlets (e.g., `Get-ChildItem`).
- **Workflow:** Verify Before Done (VBD). AI must check if the service is up after changes.
- **Disk Space:** If backend crashes with disk full, run `docker system prune -f` inside WSL.

## 2. Coding Philosophy: SOLID & Modularization
- **Core Principle:** Strictly follow SOLID principles.
- **Single Responsibility (SRP):** One file, one purpose. If a component or function grows too large, split it.
- **Dependency Inversion:** Use Interfaces/Abstract classes. High-level modules must not depend on low-level modules.
- **No Monolith Blocks:** 
  - ❌ PROHIBITED: Putting Logic, Types, and UI in a single massive file.
  - ✅ REQUIRED: Separate concerns into:
    - `components/` (Presentation only)
    - `hooks/` or `services/` (Business logic & API calls)
    - `types/` or `interfaces/` (Definitions)
    - `utils/` (Pure helper functions)

## 3. Component Architecture Guidelines
- **Granularity:** Break down UI into small, reusable atoms.
- **Composition over Inheritance:** Build complex features by composing smaller, well-defined components.
- **Clean Props:** Keep component interfaces lean. Pass only what is necessary.
- **React Hooks Rule:** ALL hooks (`useState`, `useMemo`, `useCallback`, `useEffect`) must be called BEFORE any early return statements. Violating this causes "Rendered more hooks than during the previous render" errors.

## 4. Operational Risk Framework (Mark's Policy)
- **R0 (No Magic):** Do not assume Infrastructure. If Podman machine is not initialized, ask the user first.
- **R1 (Edit & Notify):** For refactoring into SOLID patterns, do it and report the structural changes immediately.
- **R2 (Direct Action):** Minor logic fixes and unit test updates.

## 5. Deployment & Testing
- Run `docker compose up -d` from WSL (Ubuntu 26.04) at `D:\InvestmentDashboard` (mounted as `/mnt/d/InvestmentDashboard`).
- Ensure every new component has a corresponding unit test file (e.g., `*.test.ts`) to maintain Data Integrity.
- `npm run test` uses Vitest; frontend has volume mount (`./frontend:/app`) for live HMR.
- Backend has NO volume mount — code changes require `docker compose build backend && docker compose up -d backend` inside WSL.
- Verify WSL Docker status: `wsl -- docker compose ps`.

## 6. Architecture Overview (Post-Refactor)

### Backend (FastAPI)
- **16 routers** in `backend/app/routers/`: `active_orders.py`, `ai_agents.py`, `analytics.py`, `assets.py`, `etl_sync.py`, `journal.py`, `overview.py`, `performance.py`, `portfolios.py`, `rebalance.py`, `risk.py`, `trade_history.py`, `trade_plans.py`, `transactions.py`, `transfers.py`, `orders_groups.py`
- **15 SQLAlchemy models** in `models.py`: Portfolio, TradePlan, ActiveOrder, OptionDetails, PortfolioNavHistory, SimulationModels, TradeHistory, Transaction, DecisionJournal, WhitelistAssets, Watchlist, AiAgent, AiActionLog, AiAgentState, OrdersGroup
- **Key endpoints**:
  - `GET /api/v1/analytics/performance/{portfolio_id}` — equity curve (cumulative realized P/L), payoff bars, total P/L
  - `GET /api/v1/analytics/portfolio-grid?portfolio_id=` — full grid data with cash details, `risk_score` (0–100), tags, trade plan, internal notes
  - `PUT /api/v1/portfolios/{id}` — update `portfolio_name`, `current_nav`, `margin_locked`, `cash_buffer_limit`, `available_cash`, `money_market`, `trade_plan_md`, `internal_notes`, `tags`
  - `POST /api/v1/orders/` — create order with optional UUID `order_id`, `contract_type`, `linked_order_id`, `direction`, `expiry_date`, `strike_price`
  - `POST /api/v1/orders/{order_id}/close` — close order with exit price/P&L, creates TradeHistory record; auto-closes all sub-orders (one-way links to this order) server-side; returns `auto_closed[]` and `paired_order_id` for cross-linked spread partner
  - `POST /api/v1/orders/{order_id}/link` — link order to target via `linked_order_id` (one-way = pending close; reciprocal = spread pair)
  - `POST /api/v1/orders/{order_id}/unlink` — clear `linked_order_id` on both sides; used by EditOrderModal
- `redirect_slashes=False` — trailing slash matters on routes
- Two PostgreSQL databases: `investment_main` (port 5432) and `investment_ai` (port 5433)

### Frontend (React 18 + TypeScript + Vite)
- **PortfolioGrid.tsx** — slim orchestrator (~241 lines, down from 1194) composing sub-components
- **Screen modals** in `src/screens/`: `AddOrderModal` (editable UUID order_id, contract_type toggle indigo/blue/purple), `CloseOrderModal` (auto Close ID, uses `link_type` to show spread/pending_close linked order info), `EditOrderModal` (contract_type toggle, linked_order_id), `EditPortfolioModal` (name, NAV, margin, buffer, cash, MM, tags), `ZoneEditModal`, `ZoneGroupModal`
- **Screen components** in `src/screens/components/`:
  - `PortfolioHeader.tsx` — breadcrumb, title, Refresh + teal Add Order button
  - `SummaryCard.tsx` — 3-col values (Total Value, Total P/L, Available Cash), Cash Details (Total Notional, MM, Margin, Buffer), Risk gauge (dynamic via 3-branch formula), Asset Allocation donut (real data from active orders, excludes cash), Metadata Tags, triple-dot edit button
  - `StrategyNotes.tsx` — Trade Plan + Internal Notes (both inline-editable, yellow sticky style, border-yellow-300 on Primary Strategy)
  - `TagsSection.tsx` — metadata tag pills
  - `PerformanceSection.tsx` — chart wrapper + Equity/Payoff toggle
  - `PerformanceChart.tsx` — dynamic SVG: equity line chart (cumulative P/L) or payoff bar chart
  - `OrderManagement.tsx` — active orders table (zone-grouped or flat), Group-by-Zone toggle, contract_type filter tabs (indigo/blue/purple), Link Order button in left column, footer Add Order + Zone Group buttons
  - `TradeHistoryTable.tsx` — collapsible closed-orders table
  - `TradePlanView.tsx` — click-to-edit markdown with Save/Cancel
  - `ZoneGroupRow.tsx` — zone-grouped order row with edit/close buttons (no borders), Link Order button in left column, drag handle
- **Custom hooks** in `src/hooks/`: `useOrderEdit`, `useAddOrder`, `usePortfolioManager`, `useZoneEditor`, `useMarkdownRenderer`
- **API layer** (`src/lib/api.ts`): 44 exported endpoints, centralized `fetchJson<T>()` wrapper, Vite proxy `/api/*` → `localhost:8000`
- **Tailwind CDN** loaded in `index.html` with custom config for all project colors (ink, brand-teal, brand-coral, brand-blue, hairline, surface, slate, etc.)

### Database (`database/`)
- `main_db_schema.sql` — 11 tables for Manual/Bot data
  - `portfolios` has `internal_notes TEXT` and `tags JSONB` columns
  - `active_orders.order_id` is TEXT (UUID, not auto-increment INT); `linked_order_id` TEXT (replaces old `spread_pair_id`) — supports one-way (pending close) and two-way cross-linking (spread pair); `contract_type` ('spot'/'future'/'option'), `direction`, `expiry_date`, `strike_price`, `cost` columns added
  - `active_orders.option_id` references `option_details` table (greeks & pricing)
  - `active_orders` API now includes computed `link_type` field: `"spread"` (cross-linked), `"pending_close"` (one-way sub), `"primary"` (has subs), `"none"`
  - `trade_history.close_order_id` stores UUID from close action
- `ai_db_schema.sql` — 3 tables for AI agent state (agents, action logs, agent state)

### Link / Tier Spread Logic
- **One-way link (pending close):** `B.linked_order_id = A`, `A.linked_order_id = null` → B is a pending-close sub-order of A. Closing A auto-closes B.
- **Two-way cross-link (spread pair):** `A.linked_order_id = B` AND `B.linked_order_id = A` → A and B form a spread pair. Closing one signals `paired_order_id` for frontend to handle the other.
- **Tier spread:** A can be both a spread partner of B (A↔B) AND have its own pending-close sub-order C (C→A). Closing A auto-closes C and signals frontend for spread partner B.
- **`link_type` field** in order API responses: `"spread"` (cross-linked), `"pending_close"` (one-way sub), `"primary"` (has subs), `"none"` (no linking).
- Spread pair detection uses **reciprocal linking**, not shared `linked_order_id` value (old `spread_pair_id` behavior).

## 7. Key Business Logic
- **Total Value** = `(available_cash + money_market) + cumulativeP/L`
- **P/L %** = `(cumulativeP/L / (available_cash + money_market)) * 100`
- **Available Cash** = `totalCash + P/L − money_market − margin_locked − cash_buffer_limit`
- **Total Notional** (Cash Details) = `Σ(qty × entry_price)` across active orders — shows market exposure deployed
- **Asset Allocation** = computed from active orders by `asset_type` grouped by notional value, sorted descending; excludes Cash
- **Performance equity curve** uses cumulative realized P/L from trade history (no `initial_funding`)
- **Risk Level gauge** (3-branch formula, mirrored on frontend + backend `_compute_risk_score()`):
  - `cashBufferLimit ≠ 0`: `((availableCash − marginLocked) / cashBufferLimit) × 100` (capped at 100)
  - `cashBufferLimit = 0`: `((availableCash − marginLocked) / marginLocked) × 100` (capped at 100)
  - Both $0$: returns `100` (Safe — no exposure)
  - Color: teal (`≥100%` Safe), yellow (`≥50%` Warning), red (`<50%` Danger)

## 8. Design Conventions
- **Global Focus Ring**: All `<input>`, `<select>`, `<textarea>` use `ink` (#1c1c1e) ring via `index.css` — no per-component focus classes needed across AddOrder, EditOrder, CloseOrder, EditPortfolio, Zone modals
- **Tailwind CDN** in `index.html` extended with all project colors (ink, brand-teal, brand-coral, brand-blue, hairline, surface, slate) — no separate `tailwind.config.js`

## 9. Common Pitfalls
- **esbuild scanner** cannot handle HTML/JSX tags inside `{...}` expressions in JSX. Extract all conditional JSX (ternaries, `&&` with tags, `.map()` returning JSX) into separate components or pre-computed variables.
- **React Hooks before early returns** — all hooks must precede any `if (loading) return ...` guard.
- **`<div>` inside `<p>`** is invalid HTML. Tooltip elements with block children must use `<div>` not `<p>`.
- **Container restarts needed** for backend code changes (no volume mount). Frontend auto-reloads via Vite HMR.
- **npm install on WSL** with mounted Windows drives (`/mnt/d/`) requires `--no-bin-links` flag to avoid EPERM symlink errors. Vite build works via `node node_modules/vite/bin/vite.js build`.

## 10. Link Feature Implementation Status

### Backend (✅ Complete)
- `POST /api/v1/orders/{order_id}/link` — sets one-way `linked_order_id` (source → target). Two-way spread requires reciprocal drag.
- `POST /api/v1/orders/{order_id}/unlink` — clears `linked_order_id` on both sides (order + partner). Used by EditOrderModal unlink-on-save flow.
- `analytics.py` `_link_type(o)` — computes `"spread"` (cross-linked), `"pending_close"` (one-way sub), `"primary"` (has subs), `"none"` for every order in API responses.
- Cross-link detection: reciprocal check `A.linked == B AND B.linked == A` (not shared ID value).
- Close endpoint auto-closes all one-way sub-orders of the closed primary; returns `auto_closed[]` and `paired_order_id` for spread partner.
- Both `get_portfolio_grid_data` and `get_portfolio_detail` endpoints include `link_type` in each order dict.

### Frontend (✅ Working)
- **Link icon**: chain-link SVG inside `bg-white rounded-full p-0.5` (white circle, no border, `shadow-sm`). Per-type color: blue (`text-blue-600`) for spread, yellow (`text-yellow-500`) for pending_close, gray (`text-gray-300`) for unlinked.
- **Link icon positioning**: **Absolutely positioned** at `top: 0` (front of SVG line), `left: 36px` (spread) / `68px` (sub), aligned to SVG line center with `z-10`. Fallback inline icon in flex flow when no line shown.
- **Link icon visibility**: `opacity-100` when `link_type !== 'none'`, else `opacity-0 group-hover:opacity-100`.
- **SVG vertical lines**: Spread pair = blue (`#93c5fd`): first row `y1="0"`→`y2="100%"` (icon at top, line to bottom), last row `y1="0"`→`y2="0"` (no segment, icon alone). Pending-close = yellow (`#fde047`) `y1="0"`→`y2="50%"` (icon at top, line to middle). SVG constrained to content area via `top: 0; height: 100%`.
- **Sub-order**: 6-dot grip hidden + non-draggable (`draggable={!linkInfo?.isSub}`, `opacity-0`). Only link icon gets `ml-8` indent.
- **Parent drag carries children**: Dragging a primary order includes all linked children via `text/x-linked-ids`.
- **Link drop target**: Per-row `handleLinkDrop` on both grouped (`ZoneGroupRow.tsx`) and flat (`OrderManagement.tsx`) views. Requires `text/x-link` MIME type.
- **`computeLinkGroup()`** in `PortfolioGrid.tsx` — groups orders by link relationships, reorders primaries with sub-orders interleaved.
- **Flat view** (`OrderManagement.tsx`): same link group/reorder logic via `useMemo`.
- **`CloseOrderModal`** uses `link_type` to show linked order info.
- **`EditOrderModal` unlink**: Hover linked order row → ghost link icon; click → red broken-link icon + "Will unlink" label. On Save → `POST /orders/{id}/unlink` + parent save.

### Files involved
| File | Role |
|------|------|
| `backend/app/routers/analytics.py` | `_link_type()` computation + response dict |
| `backend/app/routers/active_orders.py` | `POST /{id}/link` + `POST /{id}/unlink` endpoints |
| `frontend/src/types/index.ts` | `OrderLinkGroup`, `link_type` in `SpreadOrder` |
| `frontend/src/lib/api.ts` | `linkOrder()`, `unlinkOrder()` API calls |
| `frontend/src/hooks/usePortfolioManager.ts` | `fetchAnalyticsData()` — fetches + sets state |
| `frontend/src/screens/PortfolioGrid.tsx` | `handleLinkOrder`, `zoneGroups` useMemo with `computeLinkGroup` |
| `frontend/src/screens/components/OrderManagement.tsx` | Flat view link groups + reorder |
| `frontend/src/screens/components/ZoneGroupRow.tsx` | Row-level link icon, SVG lines, drop handler |
| `frontend/src/screens/EditOrderModal.tsx` | Unlink-on-save flow |
| `frontend/src/screens/CloseOrderModal.tsx` | Link type display in close form |
| `database/main_db_schema.sql` | `linked_order_id TEXT` column |

## requirement
requirement\Detailed-Functional-Requirements.md

## Main Page
### DESIND : D:\InvestmentDashboard\requirement\UI\DESIGN.md
### SPREAD detail
requirement\UI\UI-LAYOUT-PORTFOLIO-ANALYTICS-SPREAD.md
requirement\UI\portfolio_analytics_grid(layout)
### GRID detail
requirement\UI\UI-LAYOUT-PORTFOLIO-ANALYTICS0-GRID.md
requirement\UI\portfolio_analytics_spread(layout)
## FUND detail
requirement\UI\UI-LAYOUT-MANAGED-FUND.md

## backend detail : D:\InvestmentDashboard\backend\README.md
## fontend detail : D:\InvestmentDashboard\frontend\README.md
## database : D:\InvestmentDashboard\database

requirement
requirement\Detailed-Functional-Requirements.md