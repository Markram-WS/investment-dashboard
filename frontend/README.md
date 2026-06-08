# Investment Dashboard Frontend

React + TypeScript + Vite frontend สำหรับระบบจัดการพอร์ตโฟลิโอ (Portfolio Management System)

## 📁 Frontend Project Structure

```
frontend/
├── package.json              # Dependencies: React 18, Vite 5.4.21, TanStack Query, React Router, react-dnd
├── vite.config.ts           # Vite config + proxy /api → backend:8000; manualChunks as function
├── Dockerfile               # Node 20 Alpine - expose 5173; npm install (not npm ci)
├── postcss.config.js        # Tailwind CSS + Autoprefixer
├── tailwind.config.js       # Tailwind v3.4.19 with darkMode: 'class'; custom colors + zIndex extend
├── index.html               # Entry point with Sora font + anti-flash dark-mode script
├── src/
│   ├── main.tsx             # React entry: StrictMode + QueryClientProvider
│   ├── App.tsx              # Router + DndProvider + NotificationProvider
│   ├── index.css            # CSS variables (light/dark), Tailwind directives, animations
│   │
│   ├── contexts/
│   │   └── NotificationContext.tsx   # Centralized notifications: list, inline toast overlay, localStorage, 3s auto-dismiss, right-6 position
│   │
│   ├── types/
│   │   └── index.ts        # Shared TypeScript interfaces (portfolio, transaction, spread, fund, order)
│   │
│   ├── constants/
│   │   └── colors.ts       # Design tokens: colors, rounded, spacing, EXCHANGE_RATE, buttonTheme
│   │
│   ├── utils/
│   │   ├── format.ts       # Currency formatting, date formatting
│   │   ├── risk.ts         # Risk color helpers, drift calculation
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
│   │   ├── AllAssets.tsx           # Zone-based asset groups with inline price editing, yfinance cache
│   │   ├── RiskAnalytics.tsx       # Sharpe, VaR, Drawdown charts
│   │   ├── CreateNewPortfolio.tsx  # Portfolio creation form (Managed Fund / Active Trading / Custom Portfolio with external DB connection)
│   │   ├── TradePlanManager.tsx    # Trade plan management
│   │   ├── ActiveOrders.tsx        # Active orders page
│   │   └── PortfolioAnalyticsDetail.tsx # Dynamic layout router (Managed Fund → PortfolioMutualFund; others → PortfolioGrid)
│   │
│   ├── screens/
│   │   ├── PortfolioGrid.tsx      # Per-portfolio payoff state + orders grid + group management
│   │   ├── PortfolioMutualFund.tsx # Managed fund: allocation, rebalance, NAV
│   │   ├── AddAssetModal.tsx      # Create asset form with group/type/source selection
│   │   ├── EditAssetModal.tsx     # Edit/delete asset + manual price input
│   │   ├── AssetGroupModal.tsx    # Asset group CRUD (table layout, inline add/edit/delete)
│   │   ├── AddOrderModal.tsx      # Add order form with contract_type toggle
│   │   ├── CloseOrderModal.tsx    # Close order form with exit price/P&L
│   │   ├── EditOrderModal.tsx     # Order edit modal with unlink-on-save
│   │   ├── EditPortfolioModal.tsx # Portfolio field editor + live Available Cash projection
│   │   ├── TransferModal.tsx      # Two-step transfer (create → confirm)
│   │   ├── ZoneEditModal.tsx      # Zone edit modal
│   │   ├── ZoneGroupModal.tsx     # Orders Group CRUD
│   │   └── components/
│   │       ├── Button.tsx              # 5 variants (primary/secondary/outline/danger/ghost), 3 sizes
│   │       ├── PortfolioHeader.tsx     # Breadcrumb, title, refresh
│   │       ├── SummaryCard.tsx         # 3-col values + formula tooltips + risk gauge
│   │       ├── StrategyNotes.tsx       # Trade Plan + Internal Notes (inline-editable)
│   │       ├── TagsSection.tsx         # Metadata tag pills
│   │       ├── PerformanceSection.tsx  # Equity/Payoff toggle + PayoffChart
│   │       ├── PerformanceChart.tsx    # SVG equity line + payoff bar chart
│   │       ├── PayoffChart.tsx         # Pure SVG: intrinsic + BS IV lines, crosshair, tooltip
│   │       ├── OrderManagement.tsx     # Active orders + Controls panel (BS IV toggle, price range, IV%)
│   │       ├── OptionsStrategyTable.tsx # Options sandbox; uses buttonTheme; per-portfolio localStorage
│   │       ├── TradeHistoryTable.tsx   # Collapsible closed-orders table
│   │       ├── TradePlanView.tsx       # Trade plan markdown display
│   │       ├── QuickStatsView.tsx      # Active pairs/positions stats
│   │       ├── ZoneGroupRow.tsx        # Grouped order row with drag handle + link icon
│   │       ├── GroupCombobox.tsx       # Searchable combobox for group selection
│   │       └── HistoricalGridView.tsx  # Historical trades accordion
│   │
│   └── assets/             # SVG icons
│       ├── dashboard.svg, wallet.svg, swap.svg, security.svg
│       ├── folder.svg, expand.svg, notifications.svg, more.svg
│       └── hero.png, react.svg, vite.svg
│
├── public/
│   └── vite.svg            # Custom favicon
│
└── tests/                  # Vitest test suite
    ├── setupTests.ts
    ├── simple.test.ts
    ├── Navigation.test.tsx
    ├── PortfolioOverview.test.tsx
    ├── RiskAnalytics.test.tsx
    └── PortfolioAnalytics.test.tsx
```

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5.4.21 (downgraded from Vite 8 due to optimizer hang on Linux/Docker)
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

See `src/lib/api.ts` for the complete list of 50+ endpoints. Key categories:
- `/api/v1/portfolios` — CRUD + `test-connection`
- `/api/v1/orders` — CRUD + close/link/unlink
- `/api/v1/analytics/*` — portfolio-grid, performance, NAV
- `/api/v1/assets` — CRUD + sync-from-orders + update-price + batch-update-prices
- `/api/v1/asset-groups` — CRUD (seeds Ungrouped/Watchlist)
- `/api/v1/transfers` — create + confirm
- `/api/v1/transactions` — deposit/withdraw/transfer history
- `/api/v1/risk/*` — pool health, money reserve, analytics
- `/api/v1/*` — trade-plans, trade-history, orders-groups, journal, AI

## 🔔 Notification System

Centralized via `NotificationContext` (wraps entire app in App.tsx):

- **`notify(message, type)`** — add a notification, auto-dismiss toast after 3s
- **NotificationBell** in navbar — unread badge count, dropdown panel with history
- Types: `success` (green check), `warning` (yellow triangle), `danger` (red x)
- Persisted to `localStorage('app_notifications')` — survives refresh
- Per-notification dismiss, Mark all read, Clear all
- Replaces scattered local `useState<ToastAlert>` across 4 pages

## 📊 Asset Page (AllAssets.tsx)

Rewritten with zone-based group sections:

- **Group sections** — collapsible, droppable (drag assets between groups)
- **Type filter tabs** — All / Stock / Future / Option / Crypto
- **Inline price editing** — click price cell → input → save to localStorage + API
- **Yfinance price cache** — `localStorage('cached_price_{ticker}')` persists last known price
- **Per-asset refresh** button for yfinance sources
- **Batch refresh** with success/warning toast
- **Symbol tips** — collapsible `<details>` showing yfinance patterns (`.BK`, `-USD`, `.T`, etc.)

## 🎨 UI Architecture

### Visual Hierarchy

```
Header (sticky top-0 z-100)
  ├─ Branding (InvestDesk/ Dashboard)
  ├─ Navigation Links (Overview, Asset, Transactions, Risk Analytics)
  ├─ Portfolios Dropdown (+ Create Portfolio)
  └─ ThemeToggle + NotificationBell

Hero Card
  ├─ Asset Total + Overall P/L
  └─ Cash Breakdown: Lock / Buffer / Money Market / Available

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

## 📱 Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | PortfolioOverview | Cash breakdown + portfolio grid |
| `/transactions` | TransactionsPage | Transaction table + unified inline form (From/To dropdowns, no modals) |
| `/all-assets` | AllAssets | Zone-based asset groups + inline price editing |
| `/risk-analytics` | RiskAnalytics | Risk metrics (Sharpe, VaR, Drawdown) |
| `/analytics/portfolio/{id}` | PortfolioAnalyticsDetail | Dynamic layout per port_type (Managed Fund → PortfolioMutualFund; all others → PortfolioGrid) |
| `/analytics/detail` | PortfolioGrid | Grid view |
| `/managed-fund/{portfolioId}` | PortfolioMutualFund | Managed fund view |
| `/create-portfolio` | CreateNewPortfolio | Portfolio creation form (Managed Fund / Active Trading / Custom Portfolio with external DB connection form) |
| `/trades` | TradePlanManager | Trade plan management |
| `/orders` | ActiveOrders | Active orders page |

## 🐳 Docker Development

### Network Architecture

```
Browser (host)
   ↓ http://localhost:5173
Frontend Docker (bridge network: investment-network)
   ↓ Vite Proxy: /api/* → http://backend:8000 (Docker DNS)
Backend Docker (bridge network: investment-network)
   ↓ http://backend:8000
```

### Commands

```bash
# Development mode
npm run dev

# Production build
npm run build

# Testing
npm run test
npm run test:ui
```

### Environment Variables

| Variable | File | Purpose |
|----------|------|---------|
| `BACKEND_API_BASE_URL` | vite.config.ts / docker-compose | Proxy target: `http://backend:8000` |
| `VITE_API_BASE_URL` | api.ts / docker-compose | `""` (empty = relative path → Vite Proxy) |

JS calls `/api/v1/...` (relative) → Vite dev server proxy → backend (Docker DNS: `backend:8000`).

## 🧩 Key Features

1. **Portfolio Overview**: Hero Card + Pool Health gauge + Money Reserve + Portfolio cards with DnD transfer
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
12. **Asset groups**: Zone-based collapsible sections, drag-drop between groups, yfinance price sync
13. **Inline price editing**: Click price → edit → save to localStorage + optional API
14. **Custom Portfolio**: New portfolio type with external database connection form (host, port, DB name, user, password) + Test Connection button
15. **Portfolio-aware API calls**: All order operations (create, update, close, link, unlink), asset CRUD, asset/orders group CRUD accept optional `portfolioId` and append `?portfolio_id=` query param for custom portfolio routing

### Key Business Logic

- **Cash** = `available_cash + cumulativePl`
- **Total Value** = `Cash + marginLocked + cashBufferLimit + money_market + totalNotional`
- **Available Cash** (raw) = `available_cash` from DB
- **Available Cash** (tooltip) = `Cash + Total P/L`
- **P/L %** = `(cumulativePl / (available_cash + money_market)) × 100`
- **Edit Portfolio auto-adjust**: `newAvailable = max(0, rawAvailableCash − totalDiff)`

### Testing Strategy

```typescript
// Unit tests (.test.tsx)
- Navigation.test.tsx
- PortfolioOverview.test.tsx
- RiskAnalytics.test.tsx
- PortfolioAnalytics.test.tsx

// Vitest config (via npm scripts)
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

*Last updated: 9 June 2026 (TransactionsPage rewrite: unified inline form replaces 3 modals, From/To table columns; PageLayout component; NotificationContext inline toast; Navigation portfolio links + green +Portfolio + inline SVG plus; AllAssets container fix; ToastAlert position right-6, 3s auto-dismiss)*
