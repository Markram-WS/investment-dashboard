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
│   │   ├── AllAssets.tsx           # One grouped asset registry: editable ticker, collapsible group rows, inline price/spec editing, yfinance/TFEX refresh
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
│   │   ├── AddAssetModal.tsx      # Create asset: ticker, price symbol, type/source/group, broker/multiplier/margin (560px, no Name)
│   │   ├── EditAssetModal.tsx     # Edit/delete asset incl. editable ticker + rename cascade warning; manual price input
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
│   │       └── GroupCombobox.tsx       # Searchable combobox for group selection
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
- `/api/v1/assets` — CRUD + sync-from-orders + sync-from-all + update-price + batch-update-prices
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

One 44px header band, a type-filter toolbar, and one grouped registry table — no per-group cards:

- **Header** — `Assets`, the counts summary (`N assets · N priced · N groups`), the Auto toggle and the manual refresh button only.
- **Type filter tabs** — All / Stock / Future / Option / Crypto; `+ New group`, `+ New asset` and `Sync from Orders` sit on the right.
- **One table** — a single sticky head; group rows (32px, collapse, count, drag-and-drop target) live inside the same `tbody`; an empty group is one `No assets` row. Asset rows are 32px at 11px; the ticker is the identity, and Name is no longer rendered.
- **Editable ticker** — Edit changes the registry key; the backend cascades it to local orders, history and Managed Fund holdings, while mapped broker orders keep their own symbol (the modal warns).
- **Inline price and spec editing** — click Price/Multiplier/Margin → 26px input → save through the API; the per-row refresh icon appears only for `PRICE_SOURCES` (`yfinance`, `tfex`).
- **Price cache** — `localStorage('cached_price_{ticker}')` persists the last known price and follows a rename.
- **Batch / Auto refresh** — `batch-update-prices`; Auto repeats it every 10 minutes.
- **Sync on load + manual button** — `POST /api/v1/assets/sync-from-all` pulls symbols from Active Trading orders, every custom portfolio's orders, and Managed Fund holdings; Managed Fund order history is deliberately not a source.
- **Selects** — source/type/group/broker use the shared in-page `SelectInput` combobox (`Field.tsx`), not a native `<select>`.

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
| `/all-assets` | AllAssets | One grouped registry: editable ticker, collapsible group rows, inline price/spec editing |
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
12. **Asset groups**: collapsible, droppable group section rows inside the one registry table; yfinance + TFEX price sync
13. **Inline price and spec editing**: click Price/Multiplier/Margin → 26px input → API; the ticker is editable and its rename cascades through local orders/history/holdings
14. **Transaction ledger**: data cells at 11px (`--fs-label`) in the shared table shell
15. **Custom Portfolio**: New portfolio type with external database connection form (host, port, DB name, user, password) + Test Connection button
16. **Portfolio-aware API calls**: All order operations (create, update, close, link, unlink), asset CRUD, asset/orders group CRUD accept optional `portfolioId` and append `?portfolio_id=` query param for custom portfolio routing

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

*Last updated: 10 November 2026 (docs aligned with the nginx multi-stage production image; stale tree entries for removed components, assets and tests dropped)*
