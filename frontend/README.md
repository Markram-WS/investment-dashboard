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
│   │   ├── AllAssets.tsx           # One collapsible table per broker; two levels (product band + symbol rows); explicit proposal/apply; yfinance/TFEX refresh
│   │   ├── RiskAnalytics.tsx       # Sharpe, VaR, Drawdown charts
│   │   ├── CreateNewPortfolio.tsx  # Portfolio creation form (Managed Fund / Active Trading / Custom Portfolio with external DB connection)
│   │   ├── TradePlanManager.tsx    # Trade plan management
│   │   ├── ActiveOrders.tsx        # Active orders page
│   │   └── PortfolioAnalyticsDetail.tsx # Dynamic layout router (Managed Fund → PortfolioMutualFund; others → PortfolioGrid)
│   │
│   ├── screens/
│   │   ├── PortfolioGrid.tsx      # Per-portfolio payoff state + orders grid + group management
│   │   ├── PortfolioMutualFund.tsx # Managed fund: 4-card summary (NAV/Cash/Invested/P/L), 3-section tree table (Asset List / Orders in Progress / Order History), per-group `<pct>% target share` from the stored mode, rebalance, 3-dot → Edit Portfolio modal (its Allocation section owns the `Neutral` | `Weight (%)` toggle; the header carries none); the `PortfolioHeader` band carries no `extraActions`, so its buttons are exactly `Edit portfolio` and `Refresh` — the Rebalance card's own `Rebalance` button is the only entry point to the recommendation modal
│   │   ├── MFCreateOrderModal.tsx # Managed Fund: create buy/sell order form
│   │   ├── MFEditOrderModal.tsx   # Managed Fund: edit order fields
│   │   ├── MFSellHoldingModal.tsx # Managed Fund: sell holding with manual price entry
│   │   ├── MFRebalanceRecommendModal.tsx # Managed Fund: grouped rebalance ledger — one aggregate row per `groups[]` entry (Current/Target values, `24.7% → 50.0%` allocation, Drift, signed Order value) then its holdings indented (market value, Buy/Sell chip + qty, price, signed order value), every head and cell at `--fs-micro` (10px), columns Asset | Current | Target | Allocation | Drift | Qty | Price | Order value, footer Allocation base + Total drift over `groups[].drift`
│   │   ├── MFEditPortfolioModal.tsx # Managed Fund: unified edit modal (name, cash fields, deposit/withdraw, Danger Zone delete + navbar query invalidation); its Allocation section owns the mode toggle and the grouped editor — one block per allocation group (registry underlying, `Unassigned` last) with a target percent in weight mode or `100 / N % share` in neutral, holdings indented with per-holding `Rebalance weight (%)` inputs, equal-split prefill for an all-null group, blank = null market-value fallback, weights relative
│   │   ├── AddAssetModal.tsx      # Create product (underlying/broker/type/multiplier/margin rate/margin mode/span/source) or symbol (identity picker + inline identity creation, price/sync, option terms); 560px
│   │   ├── EditAssetModal.tsx     # Edit/delete product or symbol; attached-symbols broker guard; symbol move through the identity picker; manual quote price input
│   │   ├── AddOrderModal.tsx      # Add order form with contract_type toggle
│   │   ├── CloseOrderModal.tsx    # Close order form with exit price/P&L
│   │   ├── EditOrderModal.tsx     # Order edit modal with unlink-on-save
│   │   ├── EditPortfolioModal.tsx # Portfolio field editor + live Available Cash projection
│   │   ├── ZoneEditModal.tsx      # Zone edit modal
│   │   ├── ZoneGroupModal.tsx     # Orders Group CRUD
│   │   └── components/
│   │       ├── Button.tsx              # 5 variants (primary/secondary/outline/danger/ghost), 3 sizes
│   │       ├── Field.tsx               # Field + TextInput/NumberInput/SelectInput (in-page combobox, not native)
│   │       ├── BrokerCombobox.tsx      # Editable broker listbox: pick an existing code or type a new one (currency THB/USD)
│   │       ├── ProductSelector.tsx     # Underlying + Broker + Type picker that resolves the owning product; shared by both asset modals
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
│   │       ├── SyncFromOrdersModal.tsx # Proposal editor: per-row Broker select + Assign-to product, create-underlying fields; writes only on Apply
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
- `/api/v1/managed-funds` — settings, holdings, orders, history, rebalance/calculate, sync-prices (12 methods)
- `/api/v1/orders` — CRUD + close/link/unlink
- `/api/v1/analytics/*` — portfolio-grid, performance, NAV
- `/api/v1/assets/products` + `/api/v1/assets/symbols` — two-level registry CRUD, identity-owned specs, symbol move via `product_id`, manual quotes, `update-price` + `batch-update-prices`
- `/api/v1/assets/proposal` + `/api/v1/assets/apply` — explicit, read-only-until-applied sync of order symbols to products/symbols, with a per-choice `broker_id`
- `/api/v1/assets` — custom owned-database flat CRUD only (mapped `GET` returns `[]`; local non-custom returns 404)
- `/api/v1/asset-groups` — retired from the UI; the CRUD endpoints and table remain compatibility-only and listing no longer seeds defaults
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

The page is a **two-level registry rendered as one collapsible table per broker**: a tinted product identity band above its symbol rows. It replaces the old flat one-row-per-asset table.

- **Header** — `Assets`, the counts summary (`N products · M symbols`), the Auto toggle and the manual refresh button. No automatic order-derived sync runs on mount.
- **Toolbar** — type filter tabs (All / Stock / Future / Option / Crypto, filtering products by `asset_type`); `Sync from orders`, `+ New product` and `+ New symbol` sit on the right.
- **One table per broker.** Each broker is its own `<table>` under a heading line `CODE · N` (collapse chevron, code ascending, `Unassigned` last and hidden when empty), 16px below the previous table. Each table has its own sticky head with identical tracks: Product · type / symbol 300px (240px below 1100px), Sync symbol 140px, Price 112px, Change 92px, an auto spacer, and Actions 72px pinned to the card's right edge. There is no in-body section row and no Broker column.
- **Product band (32px).** Surface-tinted row showing the underlying ticker at 11px/600 plus its type in muted 10px (`PTT stock`, `— future` for a NULL underlying). Clicking the name cell toggles only that product's symbol rows; every product starts expanded. Sync and Change cells are empty; the Price cell carries the identity meta right-aligned in 10px muted tabular figures (`multiplier · margin · mode · source`, e.g. `200 · 10% · notional · tfex`). Actions are `Edit product` then `+ New symbol`.
- **Symbol rows (28px).** Indented 22px under the product and sorted by `price_symbol`. The first cell is the price symbol at 11px/600 (with muted `has no price` when a feed-backed product has no quote; `manual`/`-` products show no note and carry a `No quote — this product has no price feed.` title). Then the sync symbol, the inline-editable Price, and Change coloured by sign. Actions are `Edit symbol` then refresh (feed-backed only).
- **Ordering.** Within a broker, products sort by underlying ticker ascending (NULL last), then by type `stock → future → option → crypto → other → NULL`. Symbols sort by `price_symbol` ascending.
- **States.** An empty product renders one `No symbols` row (title `Orders cannot resolve a contract spec for this product.`); the loading row says `Loading symbols…`; an empty registry says `No products`.
- **Product modal.** Fields are Underlying, Broker (editable listbox), Type, Multiplier, Margin rate, Margin mode, Margin per contract (only for `span`) and Source. A product is the identity `(underlying, broker, type)` and owns those values; `name` is not edited. A blank underlying is allowed only when a broker or a type is set; all three blank is the reserved default identity.
- **Symbol modal.** Three dropdowns pick the owning product: `Underlying` (distinct tickers + `— No underlying —`), `Broker` (all brokers + `— Unassigned —`) and `Type` (`— No type —` + stock/future/option/crypto). A match shows the resolved identity and its multiplier/margin/mode/source; an unmatched non-blank combination reveals inline creation with a required **Price source** (`yfinance` / `tfex` / `manual`), which creates the product at multiplier 1, margin 0%, mode `notional`, then the symbol. Symbol fields are Ticker, Sync symbol, and — only for an option identity — Option type / Expiry date / Strike price; there is no Contract kind or Margin per contract field, because the type and span margin belong to the product. Edit sends `product_id` only when the picked identity changed, which moves the symbol.
- **Attached-symbols broker guard.** In Edit product, changing the broker while `symbol_count > 0` makes no API call: the modal keeps focus and shows `Cannot change the broker while {N} contract(s) are attached — move or delete them first.`
- **Rename and broker rules.** Editing the product ticker submits the rename; the backend moves the product, that product's own `price_symbol` rows and local ledger references, while mapped broker orders keep their own symbol (the modal does not enumerate this cascade).
- **Manual quote + refresh.** Clicking a symbol's Price opens a 26px input saved through `PUT /assets/symbols/{id}/quote`; the row refresh icon appears only for `PRICE_SOURCES` (`yfinance`, `tfex`) and calls `POST /assets/symbols/{id}/update-price`. The header/batch refresh calls `POST /assets/symbols/batch-update-prices`, and Auto repeats it every 10 minutes.
- **Sync from orders is explicit.** The modal reads `GET /assets/proposal` and writes nothing until Apply. Each row has a **Broker** select (`— Unassigned —` first, then all brokers, defaulting to the proposal's broker); changing it refilters `Assign to` to that broker and resets a stale pick. A brokerless Active Trading row shows the muted `No broker on the portfolio — pick one here to attach this symbol to a broker-scoped product.` instead of being blocked. Existing-product and create choices (`create_underlying` optional, blank = no underlying; blank type = the default identity when the broker is also Unassigned) are submitted with the row's broker to `POST /assets/apply`. Unknown brokers, an unknown pair, a cross-broker product, an invalid create or an option product that needs its terms in All Assets show the server detail.
- **Price cache** — `localStorage('cached_price_{price_symbol}')` (and the sync symbol when they differ) persists the last known price.
- **Pickers** — the broker and identity controls are in-page listboxes/comboboxes (`BrokerCombobox`, `ProductSelector`, `Field.tsx`), not native `<select>` elements.

**Broker scoping, portfolio identity and prefill elsewhere.** Create Portfolio and Edit Portfolio load `/assets/products?broker_id=` and offer only product underlyings valid for the selected broker; broker selectors display the broker **code**. Both forms label the ticker selection **Underlying** and pair it with a **Type** select (`— No type —` + stock/future/option/crypto): `product_type` is sent on create/update and selects the display identity `(underlying, broker, type)`, while the forms no longer take a multiplier. With one underlying and a type, the resolution line shows that product's multiplier, margin rate and mode; with no match it says multiplier 1 / margin 0% will be used. The backend resolves the same identity for the displayed multiplier/margin only — an ambiguous ticker or a missing type leaves the display at 1 / 0, and per-order margin still uses each order's own broker-scoped symbol spec. On the Active Trading detail, Add Order prefills the free-text `asset_type` only when the portfolio's first product ticker resolves uniquely **and** that product has exactly one symbol; the prefill is that symbol's `price_symbol` (otherwise the field stays empty).

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
| `/all-assets` | AllAssets | One collapsible table per broker; two levels (product identity band + symbol rows); product/symbol modals; explicit proposal/apply |
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

1. **Managed Fund**: Full portfolio rebalancing with separate order lifecycle (Create → Pending → Confirm Done → Asset List + NAV + History), 4-card summary (Current NAV, Available Cash, Total Invested, Unrealized P/L), two underlying-group allocation modes (`neutral` equal split or `weight` stored per-underlying targets) switched inside the Edit Portfolio modal's grouped Allocation section (not the page header), grouped rebalance recommendations (one aggregate row per underlying with its holdings indented, entry point only on the Rebalance card)
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
12. **Two-level asset registry**: one collapsible table per broker (`CODE · N` heading), a tinted product identity band (underlying + type, with multiplier · margin · mode · source in its Price cell) and its symbol rows; broker-scoped product and symbol modals, a three-dropdown identity picker with inline product creation, and yfinance/TFEX quote refresh
13. **Explicit proposal/apply**: active-order symbols are proposed with same-broker product choices or a create option (an already-owned pair is idempotent); each row carries its own Broker select, and nothing is written until Apply, replacing the removed sync-from-orders/sync-from-all flows
14. **Identity-owned specs and quotes**: the product `(underlying, broker, type)` owns multiplier, margin rate, margin mode, span `margin_per_contract` and source; a symbol owns only `price_symbol` (dashboard/order key), `sync_symbol` (provider key) and option terms, and can be moved to another product through `PUT /assets/symbols/{id}`. A product ticker rename cascades through local ledger references while mapped broker orders keep their symbol
15. **Transaction ledger**: data cells at 11px (`--fs-label`) in the shared table shell
16. **Custom Portfolio**: New portfolio type with external database connection form (host, port, DB name, user, password) + Test Connection button
17. **Portfolio-aware API calls**: All order operations (create, update, close, link, unlink), custom asset CRUD, and orders-group CRUD accept optional `portfolioId` and append `?portfolio_id=` query param for custom portfolio routing. Main-registry product/symbol calls are broker-scoped instead; asset-group endpoints remain compatibility-only

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
