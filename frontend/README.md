# Investment Dashboard Frontend

React + TypeScript + Vite frontend สำหรับระบบจัดการพอร์ตโฟลิโอ (Portfolio Management System)

## 📁 Frontend Project Structure

```
frontend/
├── package.json              # Dependencies: React 18, Vite 5.4.21, TanStack Query, React Router, react-dnd
├── vite.config.ts           # Vite config + proxy /api → backend:8000; manualChunks as function
├── Dockerfile               # Multi-stage: node:20-alpine build → nginx:1.27-alpine, listens on :80
├── nginx.conf               # SPA fallback (try_files → /index.html) + /api/ proxy to backend:8000
├── postcss.config.js        # Tailwind CSS + Autoprefixer
├── tailwind.config.js       # Tailwind v3.4.19 with darkMode: 'class'; custom colors + zIndex extend
├── vitest.config.ts         # Vitest + jsdom setup (setupTests.ts)
├── index.html               # Entry point with Sora font + anti-flash dark-mode script
├── src/
│   ├── main.tsx             # React entry: StrictMode + QueryClientProvider
│   ├── App.tsx              # Router + DndProvider + NotificationProvider
│   ├── index.css            # CSS variables (light/dark), Tailwind directives, animations
│   │
│   ├── setupTests.ts        # Vitest setup (jsdom matchers)
│   ├── contexts/
│   │   └── NotificationContext.tsx   # Centralized notifications: list, localStorage, 3s auto-dismiss; toasts render from this context (no standalone component), positioned right-6
│   │
│   ├── types/
│   │   └── index.ts        # Shared TypeScript interfaces (portfolio, transaction, spread, fund, order)
│   │
│   ├── constants/
│   │   └── colors.ts       # Design tokens: colors, rounded, spacing, EXCHANGE_RATE, buttonTheme
│   │
│   ├── utils/
│   │   ├── format.ts       # Currency formatting, date formatting
│   │   └── tags.ts         # Portfolio tag helpers
│   │
│   ├── lib/
│   │   └── api.ts          # API wrapper: 50+ exported endpoints for all backends
│   │
│   ├── hooks/
│   │   ├── useOrderEdit.ts         # Order editing state + API save
│   │   ├── usePortfolioManager.ts  # Portfolio data fetching + selection
│   │   ├── useZoneEditor.ts        # Zone grouping editor
│   │   ├── useAddOrder.ts          # Add order form state
│   │   └── useMarkdownRenderer.ts  # Simple markdown → HTML
│   │
│   ├── components/
│   │   ├── Navigation.tsx        # Sticky nav with feather-style SVG icons + Portfolios dropdown (links to /analytics/portfolio/{id}) + ThemeToggle + inline SVG plus
│   │   ├── GlobalLayout.tsx      # Outlet-based global layout wrapper
│   │   ├── PageLayout.tsx       # Shared container wrapper (max-w-[1200px] mx-auto px-6 py-10) — single point of change
│   │   ├── NotificationBell.tsx  # Bell icon + unread badge + dropdown notification panel
│   │   ├── ThemeToggle.tsx       # Dark/light mode toggle with localStorage persistence
│   │   └── icons/
│   │       └── index.tsx         # 13 feather-style inline SVG icons (IconCheck, IconAlertTriangle, IconBell, etc.)
│   │
│   ├── pages/              # Top-level route components
│   │   ├── PortfolioOverview.tsx    # Hero Card + Pool Health + Portfolio Grid with DnD transfer
│   │   ├── TransactionsPage.tsx     # Transaction table + unified inline form (From/To dropdowns, no modals)
│   │   ├── AllAssets.tsx           # Two-level registry: grouped product rows expand to symbol/quote rows; explicit proposal/apply; yfinance/TFEX refresh
│   │   ├── RiskAnalytics.tsx       # Sharpe, VaR, Drawdown charts
│   │   ├── CreateNewPortfolio.tsx  # Portfolio creation form (Managed Fund / Active Trading / Custom Portfolio with external DB connection)
│   │   ├── TradePlanManager.tsx    # Trade plan management
│   │   ├── ActiveOrders.tsx        # Active orders page
│   │   └── PortfolioAnalyticsDetail.tsx # Dynamic layout router (Managed Fund → PortfolioMutualFund; others → PortfolioGrid)
│   │
│   ├── screens/
│   │   ├── PortfolioGrid.tsx      # Per-portfolio payoff state + orders grid + group management
│   │   ├── PortfolioMutualFund.tsx # Managed fund: 4-card summary (NAV/Cash/Invested/P/L), 3-section tree table (Asset List / Orders in Progress / Order History), rebalance, profit alerts, 3-dot → Edit Portfolio modal
│   │   ├── MFCreateOrderModal.tsx # Managed Fund: create buy/sell order form
│   │   ├── MFEditOrderModal.tsx   # Managed Fund: edit order fields
│   │   ├── MFSellHoldingModal.tsx # Managed Fund: sell holding with manual price entry
│   │   ├── MFRebalanceRecommendModal.tsx # Managed Fund: rebalance recommendations table
│   │   ├── MFEditPortfolioModal.tsx # Managed Fund: unified edit modal (name, cash fields, target ratios, profit thresholds, deposit/withdraw, Danger Zone delete + navbar query invalidation)
│   │   ├── AddAssetModal.tsx      # Create product (ticker/name/broker/type/source/group/multiplier/rate/margin mode) or symbol (price/sync symbol, contract terms); 560px
│   │   ├── EditAssetModal.tsx     # Edit/delete product or symbol; broker-change warning with symbols; manual quote price input
│   │   ├── AssetGroupModal.tsx    # Asset group list: inline rename, footer add, fixed error sentences
│   │   ├── AddOrderModal.tsx      # Add order form with contract_type toggle
│   │   ├── CloseOrderModal.tsx    # Close order form with exit price/P&L
│   │   ├── EditOrderModal.tsx     # Order edit modal with unlink-on-save
│   │   ├── EditPortfolioModal.tsx # Portfolio field editor + live Available Cash projection
│   │   ├── ZoneEditModal.tsx      # Zone edit modal
│   │   ├── ZoneGroupModal.tsx     # Orders Group CRUD
│   │   └── components/
│   │       ├── Button.tsx              # 5 variants (primary/secondary/outline/danger/ghost), 3 sizes
│   │       ├── Field.tsx               # Field + TextInput/NumberInput/SelectInput (in-page combobox, not native)
│   │       ├── controlStyles.ts        # Shared control label/input/helper/button tokens
│   │       ├── LiquidityStack.tsx      # Margin/buffer/available bar; labelled 28px overview bar reveals on mount
│   │       ├── PortfolioHeader.tsx     # Breadcrumb, title, refresh
│   │       ├── SummaryCard.tsx         # 3-col values + formula tooltips + risk gauge
│   │       ├── StrategyNotes.tsx       # Trade Plan + Internal Notes (inline-editable)
│   │       ├── TagsSection.tsx         # Metadata tag pills
│   │       ├── PerformanceSection.tsx  # Equity/Payoff toggle + PayoffChart
│   │       ├── PerformanceChart.tsx    # Equity LineChart via ztd-charts; payoff view lives in PayoffChart
│   │       ├── PayoffChart.tsx         # Pure SVG: intrinsic + BS IV lines, crosshair, tooltip
│   │       ├── OrderManagement.tsx     # Active orders + Controls panel (BS IV toggle, price range, IV%)
│   │       ├── OptionsStrategyTable.tsx # Options sandbox; uses buttonTheme; per-portfolio localStorage
│   │       ├── TradeHistoryTable.tsx   # Collapsible closed-orders table
│   │       ├── TradePlanView.tsx       # Trade plan markdown display
│   │       ├── ModalShell.tsx          # Shared modal shell (overlay + panel)
│   │       ├── TransferModal.tsx       # Two-step transfer (create → confirm)
│   │       ├── ZoneGroupRow.tsx        # Grouped order row with drag handle + link icon
│   │       ├── GroupCombobox.tsx       # Searchable combobox for group selection
│   │       ├── SyncFromOrdersModal.tsx # Read-only proposal of order symbols; choose same-broker product or create; writes only on Apply
│   │
│   └── (Vitest tests are colocated with their sources: *.test.tsx)
│
└── public/
    └── vite.svg            # Custom favicon
```

Tests live beside the sources they cover (`src/components/Navigation.test.tsx`, `src/pages/PortfolioOverview.test.tsx`, `src/pages/RiskAnalytics.test.tsx`, `src/screens/PortfolioAnalytics.test.tsx`) with `src/setupTests.ts` as the Vitest setup file.

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5.4.21 (downgraded from Vite 8 due to optimizer hang on Linux/podman)
- **Routing**: React Router DOM v7
- **State/Data**: TanStack React Query v5
- **Drag & Drop**: react-dnd + react-dnd-html5-backend
- **Styling**: Tailwind CSS v3.4.19 (npm package, not CDN) with `darkMode: 'class'`
- **Testing**: Vitest + React Testing Library
- **UI Style**: Miro-inspired design tokens (light + dark mode)
- **Payoff Chart**: Pure SVG (no charting library)
- **Font**: Sora (Google Fonts)

## 🎨 Design System

ใช้ CSS variables จาก `src/index.css` สำหรับ design tokens ทั้ง light และ dark mode:

```css
/* Light (default) */
--color-primary: #1c1c1e;          /* Main background */
--color-brand-teal: #0fbcb0;       /* Positive/Safe status */
--color-brand-yellow: #ffd02f;     /* Warning */
--color-brand-coral: #ff9999;      /* Danger/Loss */
--color-brand-blue: #4262ff;       /* Info */

/* Dark (triggered by .dark class on <html>) */
.dark {
  --color-canvas: #1a1a2e;         /* Card background */
  --color-surface: #16213e;        /* Page background */
  --color-ink: #e0e0e0;            /* Text color */
  --color-slate: #8892b0;          /* Muted text */
  --color-hairline: #2a2a4a;       /* Borders */
}
```

### Centralized Button Theme (`constants/colors.ts`)

| Toggle | Value | Tailwind Classes |
|--------|-------|------------------|
| **Side** | LONG | `bg-emerald-600 text-white border-emerald-600` |
| | SHORT | `bg-red-500 text-white border-red-500` |
| **Option Type** | Call | `bg-blue-600 text-white border-blue-600` |
| | Put | `bg-orange-500 text-white border-orange-500` |

### Reusable Button Component

`Button.tsx` — 5 variants (`primary`=teal pill, `secondary`=white+hairline, `outline`=teal border, `danger`=red, `ghost`=transparent+border), 3 sizes (`sm`/`md`/`lg`). Used across all modals.

## 🔌 API Endpoints

See `src/lib/api.ts` for the complete list of 65+ endpoints. Key categories:
- `/api/v1/portfolios` — CRUD + `test-connection`
- `/api/v1/managed-funds` — settings, holdings, orders, history, rebalance/calculate, sync-prices, alerts (15 methods)
- `/api/v1/orders` — CRUD + close/link/unlink
- `/api/v1/analytics/*` — portfolio-grid, performance, NAV
- `/api/v1/assets/products` + `/api/v1/assets/symbols` — two-level registry CRUD, manual quotes, `update-price` + `batch-update-prices`
- `/api/v1/assets/proposal` + `/api/v1/assets/apply` — explicit, read-only-until-applied sync of order symbols to products/symbols
- `/api/v1/assets` — custom owned-database flat CRUD only (mapped `GET` returns `[]`; local non-custom returns 404)
- `/api/v1/asset-groups` — CRUD (seeds Ungrouped/Watchlist)
- `/api/v1/transfers` — create + confirm
- `/api/v1/transactions` — deposit/withdraw/transfer history
- `/api/v1/*` — trade-plans, trade-history, orders-groups, journal

## 🔔 Notification System

Centralized via `NotificationContext` (wraps entire app in App.tsx):

- **`notify(message, type)`** — add a notification, auto-dismiss toast after 3s
- **NotificationBell** in navbar — unread badge count, dropdown panel with history
- Types: `success` (green check), `warning` (yellow triangle), `danger` (red x)
- Persisted to `localStorage('app_notifications')` — survives refresh
- Per-notification dismiss, Mark all read, Clear all
- Toasts are rendered from `NotificationContext` itself — there is no standalone toast component

## 📊 Asset Page (AllAssets.tsx)

The page is a **two-level registry**: grouped product rows, each expandable to its contract symbols and quotes. It replaces the old flat one-row-per-asset table.

- **Header** — `Assets`, the counts summary (`N products · N symbols · N specs`), the Auto toggle and the manual refresh button. No automatic order-derived sync runs on mount.
- **Type filter tabs** — All / Stock / Future / Option / Crypto (filters products by `asset_type`); `+ New group`, `Sync from orders` and `+ New product` sit on the right.
- **One table, two levels.** A single sticky head; group rows (32px, collapse, count, drag-and-drop target) live inside the same `tbody`; product rows are 32px at 11px. An empty group is one `No products` row. Product identity is its ticker plus an optional display name; expanding a product fetches `/assets/symbols?product_id=` and renders its symbol sub-rows (price symbol, sync symbol, contract kind/option terms, price, change, updated, actions). A product with no symbols says orders cannot resolve a contract spec.
- **Product rows** carry the broker code (not the numeric id), type, multiplier, margin rate, margin mode (`notional`/`premium`/`span`), source and `symbol_count`; Edit opens the product modal. **Symbol rows** carry the dashboard `price_symbol`, provider `sync_symbol`, contract terms and current quote; Edit opens the symbol modal.
- **Product and symbol modals.** `AddAssetModal`/`EditAssetModal` run in `mode="product"` or `mode="symbol"`: product fields are ticker, optional Name, broker, type, source, group, multiplier, margin rate and margin mode; symbol fields are price symbol, required sync symbol, contract kind/option type/expiry/strike, and optional multiplier/rate overrides plus margin per contract. The helper states that sync symbol is the provider key used for quotes while price symbol is the dashboard contract key orders use.
- **Rename and broker rules.** Editing the product ticker submits the rename; the backend moves the product, that product's own `price_symbol` rows and local ledger references, while mapped broker orders keep their own symbol (the modal does not enumerate this cascade). Changing the broker while symbols are attached shows the inline warning that the symbols must be removed first.
- **Manual quote + refresh.** Clicking a symbol's Price opens a 26px input saved through `PUT /assets/symbols/{id}/quote`; the row refresh icon appears only for `PRICE_SOURCES` (`yfinance`, `tfex`) and calls `POST /assets/symbols/{id}/update-price`. The header/batch refresh calls `POST /assets/symbols/batch-update-prices`, and Auto repeats it every 10 minutes.
- **Sync from orders is explicit.** The modal reads `GET /assets/proposal` and writes nothing until Apply. Each proposed symbol row selects either an existing same-broker product or "create new", then `POST /assets/apply` submits those choices. A brokerless Active Trading symbol cannot be assigned until a broker is set in Edit portfolio; a pair not in the proposal, a cross-broker product or an invalid choice shows the server detail.
- **Price cache** — `localStorage('cached_price_{price_symbol}')` (and the sync symbol when they differ) persists the last known price.
- **Selects** — source/type/group/broker use the shared in-page `SelectInput` combobox (`Field.tsx`), not a native `<select>`.

**Broker scoping and prefill elsewhere.** Create Portfolio and Edit Portfolio load `/assets/products?broker_id=` and show only product tickers valid for the selected broker; broker selectors display the broker **code**. The portfolio summary resolves a unique broker+ticker product and shows its multiplier, margin rate, mode and symbol count. On the Active Trading detail, Add Order prefills the free-text `asset_type` only when the portfolio's first product ticker resolves uniquely **and** that product has exactly one symbol; the prefill is that symbol's `price_symbol` (otherwise the field stays empty).

## 🎨 UI Architecture

### Visual Hierarchy

```
Header (sticky top-0 z-100)
  ├─ Branding (InvestDesk/ Dashboard)
  ├─ Navigation Links (Overview, Asset, Transactions)
  ├─ Portfolios Dropdown (+ Create Portfolio)
  └─ ThemeToggle + NotificationBell

Hero Card
  ├─ Asset Total + Overall P/L
  └─ Cash Breakdown: Lock / Buffer / Available

Widgets Row (2-column grid)
  ├─ Pool Health Gauge (semi-circle SVG)
  └─ Money Reserve Status

Portfolio Grid (xl:grid-cols-2)
  └─ Portfolio Cards with DnD transfer, risk-color borders
```

### Animation & Effects

| Feature | CSS Animation | Purpose |
|---------|---------------|---------|
| `animate-fade-up` | `fadeInUp` (0.6s) | Staggered entrance |
| `pulse-available` | `scale(1 → 1.02)` | Available card highlight |
| `shimmer-bar` | `linear-gradient` sweep | Visual interest |
| `#health-gauge-path` | `stroke-dashoffset` transition | Gauge fill animation |
| `liquidity-reveal` | `clip-path: inset(0 100% 0 0)` → `inset(0)`, 650ms | Labelled cash-allocation bar enters once on mount; segment widths use a 450ms `flex-grow` transition |
| `payoff-line-draw` | `stroke-dashoffset: 1` → `0`, 700ms | Payoff line entry; area/IV/break-even fade in at 220–250ms with 120–180ms delays |
| reduced motion | `animation: none` / `transition: none` | Disables the liquidity reveal, segment glide and payoff entry |

## 📱 Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | PortfolioOverview | Cash breakdown + portfolio grid |
| `/transactions` | TransactionsPage | Transaction table + unified inline form (From/To dropdowns, no modals) |
| `/all-assets` | AllAssets | Two-level registry: grouped products expand to symbol/quote rows, product/symbol modals, explicit proposal/apply |
| `/analytics/portfolio/{id}` | PortfolioAnalyticsDetail | Dynamic layout per port_type (Managed Fund → PortfolioMutualFund with 4-card summary; all others → PortfolioGrid) |
| `/analytics/detail` | PortfolioGrid | Grid view |
| `/managed-fund/{portfolioId}` | PortfolioMutualFund | Managed fund view (summary, holdings, orders, history, rebalance) |
| `/create-portfolio` | CreateNewPortfolio | Portfolio creation form (Managed Fund / Active Trading / Custom Portfolio with external DB connection form) |
| `/trades` | TradePlanManager | Trade plan management |
| `/orders` | ActiveOrders | Active orders page |

## 🚀 Production build

`frontend/Dockerfile` is a multi-stage build:

1. `node:20-alpine` runs `npm ci && npm run build` (Vite → `dist/`).
2. The `dist/` output is copied into an `nginx:1.27-alpine` runtime image.
3. `frontend/nginx.conf` serves the SPA — `try_files $uri $uri/ /index.html` — and proxies `/api/` to `http://backend:8000` (the Kubernetes Service name).
4. The image listens on port **80**. In the local kind cluster the frontend Service is a NodePort (`30080`) mapped to <http://localhost:8080>.

```bash
# Build the image locally
podman build -t investment-dashboard/frontend:dev frontend

# Or bring up the whole stack (builds, loads and applies the overlay)
./scripts/kind-up.sh
```

### Local dev server

Vite's dev server is now only for local HMR work outside the cluster:

```bash
npm run dev     # http://localhost:5173, proxies /api → BACKEND_API_BASE_URL (default http://localhost:8000)
npm run build   # production bundle in dist/
npm run test    # vitest run
npm run test:ui # vitest watch mode
```

### Environment Variables

| Variable | File | Purpose |
|----------|------|---------|
| `BACKEND_API_BASE_URL` | vite.config.ts | Vite dev proxy target (default `http://localhost:8000`) |

In the cluster no frontend env vars are needed: the browser calls `/api/v1/...` on the same origin and nginx proxies it to `http://backend:8000`.

## 🧩 Key Features

1. **Managed Fund**: Full portfolio rebalancing with separate order lifecycle (Create → Pending → Confirm Done → Asset List + NAV + History), 4-card summary (Current NAV, Available Cash, Total Invested, Unrealized P/L), profit threshold alerts on page load, rebalance recommendations from target ratio
2. **Portfolio Overview**: Hero Card + Pool Health gauge + Money Reserve + Portfolio cards with DnD transfer
2. **Portfolio Grid**: Orders grouped by zone, drag-and-drop, contract type filters, link system
3. **Payoff Chart**: Pure SVG — intrinsic + BS IV overlay, crosshair, tooltip, area fill
4. **Options Strategy Table**: Frontend-only sandbox, per-portfolio localStorage
5. **Controls Panel**: BS IV toggle, price range, current price slider, active IV% inputs
6. **Formula tooltips**: Total Value, Cash, Available Cash, Risk Level with calculation formulas
7. **Live Available Cash projection**: Edit Portfolio modal updates projected cash as user types
8. **Toast/Notification**: Centralized NotificationContext with bell icon dropdown in navbar
9. **Dark mode**: `.dark` class toggle, localStorage persistence, anti-flash script
10. **Tailwind CSS npm**: v3.4.19 with `darkMode: 'class'`, custom color variables
11. **Inline styles minimized**: 254 → 35 (only dynamic runtime values)
12. **Two-level asset registry**: collapsible, droppable group rows, expandable product rows, and symbol/quote sub-rows in one table; broker-scoped product and symbol modals; yfinance/TFEX quote refresh
13. **Explicit proposal/apply**: active-order symbols are proposed with same-broker product choices or a create option (an already-owned pair is idempotent); nothing is written until Apply, replacing the removed sync-from-orders/sync-from-all flows
14. **Contract specs and quotes**: product margin mode (notional/premium/span) and multiplier/rate; symbol `price_symbol` (dashboard/order key) vs `sync_symbol` (provider key); editable manual quote per symbol; a product ticker rename cascades through local ledger references while mapped broker orders keep their symbol
15. **Transaction ledger**: data cells at 11px (`--fs-label`) in the shared table shell
16. **Custom Portfolio**: New portfolio type with external database connection form (host, port, DB name, user, password) + Test Connection button
17. **Portfolio-aware API calls**: All order operations (create, update, close, link, unlink), custom asset CRUD, asset/orders group CRUD accept optional `portfolioId` and append `?portfolio_id=` query param for custom portfolio routing. Main-registry product/symbol calls are broker-scoped instead

### Key Business Logic

- **Cash** = `available_cash + cumulativePl`
- **Total Value** = `Cash + marginLocked + cashBufferLimit + totalNotional`
- **Available Cash** (raw) = `available_cash` from DB
- **Available Cash** (tooltip) = `Cash + Total P/L`
- **P/L %** = `(cumulativePl / available_cash) × 100`
- **Edit Portfolio auto-adjust**: `newAvailable = max(0, rawAvailableCash − totalDiff)`

### Testing Strategy

```typescript
// Unit tests (*.test.tsx), colocated with their sources
- src/components/Navigation.test.tsx
- src/pages/PortfolioOverview.test.tsx
- src/pages/RiskAnalytics.test.tsx
- src/screens/PortfolioAnalytics.test.tsx

// Vitest config (vitest.config.ts)
- environment: 'jsdom', setupFiles: ['./src/setupTests.ts']

// npm scripts
- test: "vitest run" (CI)
- test:ui: "vitest" (watch mode)
```

### Build Optimization

```typescript
// vite.config.ts (Vite 5.4.21 compat)
manualChunks(id) { /* function syntax */ }
optimizeDeps: { include: ['react', 'react-dom', ...] }
```

---

*Last updated: 24 November 2026 (two-level All Assets registry of products and expandable symbols; product/symbol modals with margin modes and price vs sync symbols; explicit proposal/apply replacing auto-sync; broker-code selectors and single-symbol Add Order prefill; nginx multi-stage production image retained)*
