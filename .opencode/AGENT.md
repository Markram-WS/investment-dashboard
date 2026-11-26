# Project Context & AI Agent Governance (Linux · Podman · kind Edition)

## 1. System Environment & Execution Constraints
- **OS:** Linux workstation; repository checked out at `/mnt/storage/investment-dashboard`.
- **Containerization:** Rootless Podman. The local dev/test cluster is a kind cluster on rootless podman, created by `scripts/kind-up.sh` (which sets `KIND_EXPERIMENTAL_PROVIDER=podman`) and deleted by `scripts/kind-down.sh`. All workloads run in the `investment-dashboard` namespace.
- **Cluster access:** the UI is served at `http://localhost:8080`; reach the backend with `kubectl -n investment-dashboard port-forward svc/backend 8000:8000`. Windows/WSL port forwarding is no longer used.
- **Shell Preference:** Bash-like Syntax ONLY (via Git Bash, MinGW, or equivalent).
- **Command Constraints:** ALWAYS use `/` for paths. NEVER recommend PowerShell-specific cmdlets.
- **Workflow:** Verify Before Done (VBD). Check if service is up after changes.
- **Disk Space:** If a build fails with disk full, run `podman system prune -f`.

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
- **Local cluster:** `./scripts/kind-up.sh` from the repo root creates the kind cluster, builds and loads both images, applies `deploy/overlays/kind`, and waits for rollouts. Tear it down with `./scripts/kind-down.sh`.
- **UI:** <http://localhost:8080>.
- **Backend API from the host:** `kubectl -n investment-dashboard port-forward svc/backend 8000:8000`.
- **Manifests:** `deploy/base` (environment-agnostic) + `deploy/overlays/kind` (dev adapter); apply them with `kubectl apply -k deploy/overlays/kind`.
- **Production** is the existing homelab Talos cluster and is not managed from this repository.
- **Tests:** `cd backend && pytest` (collects `tests/` only per `pytest.ini`; dev deps in `requirements-dev.txt`) and `cd frontend && npm run test`.

## 6. Architecture Overview

### Backend (FastAPI)
- **16 routers** in `backend/app/routers/`: `active_orders.py`, `analytics.py`, `asset_groups.py`, `assets.py`, `brokers.py`, `journal.py`, `managed_funds.py`, `orders_groups.py`, `overview.py`, `performance.py`, `portfolios.py`, `rebalance.py`, `trade_history.py`, `trade_plans.py`, `transactions.py`, `transfers.py`
- **25 SQLAlchemy models**: Portfolio, CustomPortfolioConnection, TradePlan, ActiveOrder, OptionDetails, PortfolioNavHistory, SimulationModels, TradeHistory, Transaction, DecisionJournal, Broker, WhitelistAssets, AssetGroup, Watchlist, OrdersGroup (in `models.py`), CustomActiveOrder, CustomTransaction, CustomWhitelistAssets, CustomAssetGroup, CustomOrdersGroup, CustomTradePlan (in `custom_models.py`), ManagedFundHolding, ManagedFundOrder, ManagedFundOrderHistory, ManagedFundSetting (in `managed_fund_models.py`)
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
  - `overview.py` — custom portfolio P/L fixed: uses `TradeHistory.realized_pl` (same as regular portfolios) instead of `CustomTransaction.amount`.
- `WhitelistAssets` extended: `name`, `source` (yfinance/manual), `group_id` FK→`asset_groups`, `price`, `change_24h`, `updated_at`
- One core PostgreSQL database: `investment_main` (port 5432)

### Managed Fund Feature
- **4 new DB tables**: `managed_fund_holdings`, `managed_fund_orders`, `managed_fund_order_history`, `managed_fund_settings`
- **Router**: `backend/app/routers/managed_funds.py` — 13 endpoints (settings CRUD, holdings CRUD + sell, orders CRUD with confirm/cancel, history, rebalance/calculate, sync-prices); the alerts endpoint is retired
- **Threshold columns dropped**: `managed_fund_models.py` no longer declares `ManagedFundHolding.profit_threshold` or `ManagedFundSetting.global_profit_threshold`, and `database/main_db_schema.sql` no longer lists them. The idempotent startup `asset_registry_migration.py` drops both from legacy databases via `_drop_column` (`_column_exists`-guarded `ALTER TABLE … DROP COLUMN`) in the startup transaction; holdings and settings rows are preserved
- **Order flow**: Create (pending) → PATCH status=done → update holdings + adjust available_cash + record NAV history → move to order_history table
- **Cash tracking**: Buy confirm deducts `available_cash`; Sell confirm adds to `available_cash`
- **NAV**: Recalculated on order confirm as `available_cash + sum(holding.qty × current_price)`
- **Rebalance**: Reads `allocation_mode` (`neutral` | `weight`) and the label-keyed `target_ratio` from `ManagedFundSetting`; `neutral` targets `100/N %` per underlying group, `weight` targets each group's stored percentage (must sum to 100); recommends buy/sell/qty/estimated_price; there is no 0.5% drift suppression — only an exactly balanced group emits no order
- **Rebalance response `groups[]`**: `MFRebalanceResponse.groups: List[MFRebalanceGroup] = []` carries one entry per allocation group in first-seen order, each with `label`, `current_value` (group `sum(qty × current_price)`), `target_value`, `current_pct`, `target_pct`, `drift` (absolute percentage points, quantized 0.01) and `order_value` (the group's signed sum of its holdings' order lines); groups whose `order_value` is `0` are included, and the no-groups path returns `groups=[]` (with `recommendations=[]`), so the UI never has to reconstruct aggregates from the symbol-level `recommendations`
- **Auto-sync**: New order symbols auto-inserted into `whitelist_assets` with `source='manual'`
- **target_ratio contract**: label-keyed percentages (`asset_products.ticker` or `Unassigned`), values `0..100`, at most 4 decimals; weight mode requires the sum to be 100 within `1e-6` on `PUT .../settings` (400) and on calculate (422). Legacy symbol-keyed rows are resolved through the registry on read — `resolve_allocation_labels` maps `asset_symbols.price_symbol` to its product ticker, and a row with max value ≤1.0 and non-label keys is scaled by 100 first; the UI writes labels
- **Settings auto-creation**: First GET settings copies `target_ratio` from `Portfolio` table if `ManagedFundSetting` row doesn't exist; also backfills NULL target_ratio for existing rows
- **Portfolio delete cascade**: `portfolios.py` delete endpoint cleans all 4 managed_fund tables + navbar query invalidation via `useQueryClient`

### Frontend Managed Fund Components
- **`PortfolioMutualFund.tsx`**: Main screen with 4-card summary (Current NAV, Available Cash, Total Invested, Unrealized P/L), 3-section tree table (Asset List with Entry Price/Current Price, Orders in Progress, Order History), per-group `<pct>% target share` from the stored `allocation_mode`, 3-dot → Edit Portfolio modal; the `PortfolioHeader` band carries no `extraActions` and therefore renders only `Edit portfolio` → `Refresh`, and the Rebalance card's `Rebalance` button is the single entry point to the recommendation modal (it loads `res.groups` and `res.recommendations` and passes the page's `holdings`); each group header is a `<button type="button" className="mf-row mf-group-row">` collapse toggle (shared `Chevron` from `components/Chevron.tsx`, `aria-expanded`, `aria-label` `Collapse <label>` / `Expand <label>`) that hides only that group's `mf-split-row` and holding rows while the header keeps its `% target share`; holding rows render at `--fs-micro` (10px) via `.mf-holdings .mf-row` while card headers and the split row keep their size; collapsed state is a component-level `Set<string>` that starts empty, so the page's list is expanded by default; the header carries no allocation-mode toggle (the edit modal owns it) and the profit alert banner is retired
- **`MFCreateOrderModal.tsx`**: Create Buy/Sell order form
- **`MFEditOrderModal.tsx`**: Edit existing order fields
- **`MFSellHoldingModal.tsx`**: Sell holding form with manual qty + price entry
- **`MFRebalanceRecommendModal.tsx`**: Grouped rebalance ledger, every head and cell at `--fs-micro` (10px), columns `Asset | Current | Target | Allocation | Drift | Qty | Price | Order value`; one group row per `groups[]` entry (surface-tinted, 600 weight — `Current` = `current_value`, `Target` = `target_value`, `Allocation` = `<current_pct>% → <target_pct>%` at one decimal, `Drift` = `drift` tinted coral >15 / yellow >5 / success, empty `Qty`+`Price`, signed `Order value` = `order_value` coral negative / teal positive / ink zero), then its holdings indented from the page's `holdings` (`data-testid` `rebalance-group-<label>` / `rebalance-holding-<id>`): `Current` = `market_value`, `Qty` = Buy/Sell chip + `qty` at four decimals only when that symbol has a recommendation, `Price` = `estimated_price`, `Order value` = `estimated_value` signed by `side`, all three blank for an unrecommended holding; the footer prints `Allocation base` and `Total drift` summed over `groups[].drift` (per group, not per holding); a debounced `Top-up cash ($)` field recalculates through `onRecalculate`
- **`MFEditPortfolioModal.tsx`**: Unified edit modal (portfolio name, cash fields, deposit/withdraw, Danger Zone delete with navbar invalidation via `useQueryClient`); its Allocation section owns the `role="group"` `aria-label="Allocation mode"` `Neutral` | `Weight (%)` toggle and the grouped editor: one block per allocation-group label (registry underlying, `Unassigned` last) with a target-percent input in weight mode or a read-only `100 / N % share` in neutral, then that group's holdings indented with per-holding `Rebalance weight (%)` inputs; an all-null group prefills its equal split (`100 / n`, remainder on the last holding, `n = 1` → `100`), a partially configured group leaves the remaining inputs blank (blank saves `null` → server market-value fallback), weights are relative, group targets sum to 100 only in weight mode, and the save sends `allocation_mode` + `target_ratio` + each `rebalance_weight`; each group row is also a collapse toggle (same shared `Chevron`, `aria-expanded`, `aria-label` `Collapse <label>` / `Expand <label>`) that hides only that group's holding weight inputs while the group target input or `% share` and the `sum <X> / 100` helper stay visible; its component-level `Set<string>` is seeded with every current group label when the modal opens, so every allocation group starts collapsed while the page's asset list stays expanded, and the collapsed weight inputs keep their prefilled `perAssetWeight` values so a save without expanding still writes them; the holding asset name and its `%` suffix render at `--fs-micro` (10px) while the group label and group-target input keep their size; no separate Rebalance-weights section, no profit-threshold fields
- **12 API methods** in `api.ts` under `mf*` prefix
- **Types**: `FundPortfolio`, `MFHolding`, `MFOrder`, `MFOrderCreate`, `MFOrderUpdate`, `MFHistory`, `MFSetting`, `MFAllocationMode`, `MFRebalanceRecommendation`, `MFRebalanceGroup`, `MFRebalanceResponse` (which carries `groups: MFRebalanceGroup[]`)
- **Asset auto-sync**: `AllAssets.tsx` calls `POST /api/v1/assets/sync-from-all` on page load and on manual Sync button; endpoint aggregates from active_orders + managed_fund_holdings + managed_fund_order_history
- **Route**: `PortfolioAnalyticsDetail.tsx` routes `port_type` containing "managed" → `PortfolioMutualFund`

### Frontend (React 18 + TypeScript + Vite 5.4.21)
- **Vite 5.4.21** (downgraded from Vite 8 due to optimizer hang on Linux/podman)
- **Tailwind CSS v3.4.19** npm package (not CDN) with `darkMode: 'class'`
- **Dark mode**: `.dark` class on `<html>` toggles all CSS variables; ThemeToggle with localStorage + anti-flash script
- **Font**: Sora (Google Fonts) replaces Inter + Plus Jakarta Sans
- **Notification system**: `NotificationContext` — `notify(msg, type)` centralizes all toasts. `NotificationBell` in navbar with unread badge + dropdown history panel. Persisted to localStorage. Auto-dismiss 3s. Toasts render from the context itself (no standalone component), positioned `right-6`.
- **PageLayout component**: `max-w-[1200px] mx-auto px-6 py-10` shared container used by PortfolioOverview, TransactionsPage, AllAssets, RiskAnalytics — single change point for layout.
- **TransactionsPage redesign**: Unified inline form (From/To dropdowns) replaces 3 separate Deposit/Withdraw/Transfer modals. Table uses From/To columns instead of single Flow column. Always-visible form (no toggle). Same-port and deposit-vs-withdraw conflicts enforced in dropdowns. Filters and New Transaction in same row (50/50).
- **Custom Portfolio form**: `CreateNewPortfolio.tsx` has "Custom Portfolio" type with external DB connection fields (host, port, DB name, user, password) + Test Connection button
- **Portfolio routing**: `PortfolioAnalyticsDetail.tsx` routes Managed Fund → `PortfolioMutualFund`, all others (including Custom Portfolio) → `PortfolioGrid`
- **Removed**: `/spread-pairing` route, `PortfolioSpread` import, spread-pair API calls
- **Asset page**: Zone-style group sections (collapsible, droppable) replace filter tabs. Inline price editing. Yfinance price cached to `localStorage('cached_price_{ticker}')`. Per-asset refresh + batch refresh.
- **AssetGroupModal**: Table-layout CRUD (matches ZoneGroupModal style). Default groups (Ungrouped/Watchlist) cannot be deleted.
- **AddAssetModal / EditAssetModal**: Create/edit assets with group, type, source selection.
- **ToastAlert** removed from 4 pages — replaced by centralized `useNotification().notify()`
- **Navigation**: Portfolio dropdown links navigate to `/analytics/portfolio/{id}`; +Portfolio button uses `text-brand-teal` (green text, no background/border); `IconPlus` replaced with inline SVG
- **CreateNewPortfolio**: All emoji icons replaced with inline SVGs (bullseye target, trending-up chart, link chain). Now uses Activity SVG (Active Trading), Chart Bar SVG (Managed Fund), Database SVG (Custom Portfolio).
- **DndProvider** wraps entire app in App.tsx (moved from PortfolioOverview)
- **Inline styles**: 254 → 35 (only dynamic runtime values)
- **Z-index 100**: custom `zIndex` extend in tailwind.config.js for navbar
- **Networking**: the production image serves the SPA from nginx and proxies `/api/` to `http://backend:8000` (in-cluster Service); Vite's dev proxy uses `BACKEND_API_BASE_URL` (default `http://localhost:8000`)
- **`manualChunks`**: function syntax (Vite 5 compat)
- **Button component**: 5 variants (primary/secondary/outline/danger/ghost), 3 sizes. Replaces all inline button styling.
- **PageLayout component**: `max-w-[1200px] mx-auto px-6 py-10` shared container; used by 4 pages (PortfolioOverview, TransactionsPage, AllAssets, RiskAnalytics)
- **TransactionsPage redesign**: Unified inline form (From/To dropdowns) replaces 3 separate modals (Deposit/Withdraw/Transfer). Table shows From/To columns instead of Flow. Filters + form in same row (50/50). Always-visible form (no toggle). Validates same-port and deposit-vs-withdraw conflicts in dropdowns.
- **Navigation updates**: Portfolio dropdown links navigate to `/analytics/portfolio/{id}`; +Portfolio button uses `text-brand-teal` (green text, no background/border); `IconPlus` replaced with inline SVG. Each portfolio item has a colored dot: `bg-emerald-500` (green = profit), `bg-red-500` (red = loss), `bg-slate/30` (gray = zero/unknown) — P/L fetched from overview endpoint.
- **StrategyNotes**: Internal Notes textarea focus ring changed to `focus:ring-2 focus:ring-yellow-500` to match Primary Strategy yellow theme.
- **Toasts**: rendered inline in `NotificationContext` (no separate component). Positioned `right-6` instead of centered. Auto-dismisses after 3s (was 5s).

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
- **Total Value** = `available_cash + cumulativePl + marginLocked + cashBufferLimit + totalNotional`
- **Available Cash** (raw) = `available_cash` (DB field)
- **Available Cash** (tooltip) = `Cash + Total P/L`
- **P/L %** = `(cumulativePl / (available_cash + marginLocked + cashBufferLimit)) × 100` (allCash denominator — synced across Overview cards, Overview hero, and Portfolio Summary)
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
- **Cash field order**: Lock → Buffer → Available

## 9. Common Pitfalls
- **Vite 5.4.21** — not Vite 8 (Vite 8 optimizer hangs on Linux/podman)
- **Networking** — the frontend nginx proxies `/api/` to the `backend` Service inside the cluster; no host networking
- **React Hooks before early returns** — all hooks must precede any early return
- **Number inputs**: Use local string state to avoid "delete 0" controlled-input bug
- **Backend rebuild**: no volume mount — `podman build -t investment-dashboard/backend:dev backend`, then `kind load docker-image --name investment-dashboard investment-dashboard/backend:dev`, then `kubectl -n investment-dashboard rollout restart deploy/backend`
- **Frontend dependencies**: the image build uses `npm ci` from `package-lock.json`; run `npm install` only for local dev outside the cluster
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

## backend detail : backend/README.md
## frontend detail : frontend/README.md
## database : database/README.md
## overall detail : README.md
## design : DESIGN.md
