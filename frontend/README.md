# Investment Dashboard Frontend

React + TypeScript + Vite frontend สำหรับระบบจัดการพอร์ตโฟลเลียรีนับตามออเดอร์ (Portfolio Management System) 🚀

## 📁 Frontend Project Structure

```
frontend/
├── package.json              # Dependencies: React 18, Vite, TanStack Query, React Router
├── vite.config.ts           # Vite config + proxy /api → backend:8000
├── Dockerfile               # Node 20 Alpine - expose 5173
├── index.html              # Entry point with Inter font
├── src/
│   ├── main.tsx            # React entry: StrictMode + QueryClientProvider
│   ├── App.tsx             # Router + Navigation layout (z-index: 100)
│   ├── index.css           # Design tokens + animations (pulse, shimmer, gauge)
│   │
│   ├── types/
│   │   └── index.ts        # Shared TypeScript interfaces (portfolio, transaction, spread, fund, order)
│   │
│   ├── constants/
│   │   └── colors.ts       # Design tokens: colors, rounded, spacing, EXCHANGE_RATE
│   │
│   ├── utils/
│   │   ├── format.ts       # Currency formatting, date formatting
│   │   ├── risk.ts         # Risk color helpers, drift calculation
│   │   └── tags.ts         # Portfolio tag helpers
│   │
│   ├── lib/
│   │   └── api.ts          # API wrapper: get/post/put/del + all endpoints
│   │
│   ├── hooks/
│   │   ├── useOrderEdit.ts        # Order editing state + API save
│   │   ├── usePortfolioManager.ts  # Portfolio data fetching + selection
│   │   ├── useZoneEditor.ts       # Zone grouping editor
│   │   ├── useAddOrder.ts         # Add order form state + API create order
│   │   └── useMarkdownRenderer.ts # Simple markdown → HTML + risk status
│   │
│   ├── components/
│   │   ├── Navigation.tsx  # Sticky nav with SVG icons + dropdown
│   │   └── icons/          # Inline SVG icon components
│   │       ├── IconAdd.tsx
│   │       ├── IconClose.tsx
│   │       ├── IconEdit.tsx
│   │       └── IconLayers.tsx
│   │
│   ├── pages/              # Main routes (pages)
│   │   ├── PortfolioOverview.tsx    # Hero Card + Pool Health (SVG) + Grid
│   │   ├── TransactionsPage.tsx     # Transaction history + filters
│   │   ├── CreateNewPortfolio.tsx   # Portfolio creation form
│   │   ├── RiskAnalytics.tsx        # Sharpe, VaR, Drawdown charts
│   │   ├── AllAssets.tsx            # Asset listing table
│   │   ├── TradePlanManager.tsx     # Placeholder page
│   │   ├── ActiveOrders.tsx         # Active orders placeholder
│   │   ├── AnalyticsDashboard.tsx   # NAV + risk summary
│   │   └── PortfolioAnalyticsDetail.tsx # Dynamic layout router
│   │
│   ├── screens/            # Secondary layouts (detail screens)
│   │   ├── PortfolioGrid.tsx        # Slim orchestrator (~241 lines) composing sub-components
│   │   ├── PortfolioSpread.tsx      # Spread pairing: pairs + payoff
│   │   ├── PortfolioMutualFund.tsx  # Managed fund: allocation, rebalance, NAV
│   │   ├── AddOrderModal.tsx       # Add order form (editable Order ID UUID, asset, side, qty, TP/SL, zone, status)
│   │   ├── CloseOrderModal.tsx     # Close order form (editable Close ID UUID, exit price, P/L, auto-calc)
│   │   ├── EditOrderModal.tsx       # Order edit modal
│   │   ├── EditPortfolioModal.tsx   # Portfolio field editor: name, NAV, margin, buffer, cash, MM, tags
│   │   ├── ZoneEditModal.tsx        # Zone edit modal
│   │   ├── ZoneGroupModal.tsx       # Zone group CRUD (add/edit/delete zone definitions)
│   │   └── components/
│   │       ├── PortfolioHeader.tsx    # Breadcrumb, title, Refresh + Add Order buttons
│   │       ├── SummaryCard.tsx        # 3-col values, Cash Details (Total Notional), Risk gauge (dynamic), Asset Allocation (real data), Tags, triple-dot edit
│   │       ├── StrategyNotes.tsx      # Trade Plan + Internal Notes (both inline-editable, yellow sticky)
│   │       ├── TagsSection.tsx        # Metadata tag pills
│   │       ├── PerformanceSection.tsx # Performance wrapper + Equity/Payoff toggle
│   │       ├── PerformanceChart.tsx   # Dynamic SVG: equity line chart or payoff bar chart
│   │       ├── OrderManagement.tsx    # Active orders table (zone-grouped or flat), toggle, footer
│   │       ├── TradeHistoryTable.tsx  # Collapsible closed-orders table
│   │       ├── TradePlanView.tsx      # Trade plan markdown display (click-to-edit, Save/Cancel)
│   │       ├── QuickStatsView.tsx     # Active pairs/positions stats
│   │       ├── ZoneGroupRow.tsx       # Zone-grouped order row with edit/close buttons
│   │       └── HistoricalGridView.tsx # Historical trades accordion
│   │
│   └── assets/             # SVG icons (Material Symbols style)
│       ├── dashboard.svg, wallet.svg, swap.svg, security.svg
│       ├── folder.svg, expand.svg, notifications.svg, more.svg
│       └── hero.png, react.svg, vite.svg
│
└── tests/
└── tests/                # Vitest test suite
    ├── setupTests.ts
    ├── simple.test.ts
    ├── Navigation.test.tsx
    ├── PortfolioOverview.test.tsx
    ├── RiskAnalytics.test.tsx
    └── PortfolioAnalytics.test.tsx
```

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite (dev server ที่ 5173)
- **Routing**: React Router DOM v7
- **State/Data**: TanStack React Query v5
- **Testing**: Vitest + React Testing Library
- **UI Style**: Miro-inspired design tokens (light theme)

## 🎨 Design System

ใช้ CSS variables จาก `src/index.css` สำหรับ design tokens:

```css
--color-primary: #1c1c1e;          /* Main background */
--color-brand-teal: #0fbcb0;       /* Positive/Safe status */
--color-brand-yellow: #ffd02f;     /* Warning */
--color-brand-coral: #ff9999;      /* Danger/Loss */
--color-brand-blue: #4262ff;       /* Info */
--color-canvas: #ffffff;           /* Card background */
--color-surface: #f7f8fa;          /* Page background */
```

คลาสต์ิลไพว์: `.card`, `.btn-primary`, `.btn-ghost`, `.nav-link`, `.select-dropdown`

## 🔌 API Endpoints (ผ่าน api.ts)

| Category | Endpoint | Method |
|----------|----------|--------|
| Portfolios | `/api/v1/portfolios/` | GET/POST |
| Portfolios | `/api/v1/portfolios/{id}` | GET/PUT/DELETE |
| Assets | `/api/v1/whitelist_assets` | GET |
| Transactions | `/api/v1/transactions` | GET |
| Risk | `/api/v1/risk/analytics` | GET |
| Risk | `/api/v1/risk/pool-health` | GET |
| Analytics | `/api/v1/analytics/portfolio-grid` | GET |
| Analytics | `/api/v1/analytics/performance/{portfolio_id}` | GET (equity curve, payoff bars, total P/L) |
| Rebalance | `/api/v1/rebalance/recommend` | POST |
| AI | `/api/v1/ai/status?portfolio_id` | GET |
| Trade Plans | `/api/v1/trade-plans` | GET/POST |
| Orders | `/api/v1/orders/` | POST (create with optional UUID order_id) |
| Orders | `/api/v1/orders` | GET (list) |
| Orders | `/api/v1/orders/{order_id}/close` | POST (close + trade history) |
| Orders | `/api/v1/orders/{order_id}` | PUT (update) |
| Trade History | `/api/v1/trade-history/` | GET (list, optional `?portfolio_id=`) |
| Zone Groups | `/api/v1/zone-groups/?portfolio_id=` | GET/POST |
| Zone Groups | `/api/v1/zone-groups/{id}` | PUT/DELETE |
| Spread Pairs | `/api/v1/spread-pairs/` | POST/DELETE |

## 🎨 UI Architecture (from DESIGN.md spec)

### Visual Hierarchy

```
Header (sticky top-0)
  ├─ Branding (InvestDesk/ Dashboard)
  ├─ Navigation Links (Overview, All Assets, Transactions, Risk Analytics)
  └─ Portfolio Dropdown + Top Right Utilities (notifications, more_vert)

Hero Card
  ├─ Asset Total + Overall P/L (+12.4%)
  └─ Cash Breakdown: Lock / Buffer / Available / T+3

Widgets Row (2-column grid)
  ├─ Pool Health Gauge (semi-circle SVG, 93% animated)
  └─ Money Reserve Status (Danger/Optimal/Neutral threshold bars)

Portfolio Grid (xl:grid-cols-2 on desktop)
  └─ Portfolio Cards:
      ├─ Risk border color: teal (Safe) / yellow (Warning) / coral (Danger)
      ├─ Profit percentage (top-right)
      ├─ Left border accent (3px solid riskColor)
      └─ Status message (pool health warning/rebalance)
```

### Animation & Effects

| Feature | CSS Animation | Purpose |
|---------|---------------|---------|
| `animate-fade-up` | `fadeInUp` (0.6s) | Staggered entrance |
| `pulse-available` | `scale(1 → 1.02)` | Available card highlight |
| `shimmer-bar` | `linear-gradient` sweep | Visual interest |
| `#health-gauge-path` | `stroke-dashoffset` transition | Gauge fill animation |

### Design Tokens (index.css)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#1c1c1e` | Main background, text |
| `--color-brand-teal` | `#0fbcb0` | Safe status, profit |
| `--color-brand-yellow` | `#ffd02f` | Warning, Available highlight |
| `--color-brand-coral` | `#ff9999` | Danger status |
| `--color-brand-blue` | `#4262ff` | Info, Neutral reserve |

### Risk Level Gauge (Portfolio Summary)

The risk donut is computed dynamically from cash data:

- **`cashBufferLimit ≠ 0`**: `((availableCash − marginLocked) / cashBufferLimit) × 100` (capped at 100)
- **`cashBufferLimit = 0`**: `((availableCash − marginLocked) / marginLocked) × 100` (capped at 100)
- **Both $0$**: returns `100` (Safe — no exposure)
- Color: 🟢 teal (`≥100%` Safe), 🟡 yellow (`≥50%` Warning), 🔴 red (`<50%` Danger)
- `risk_score` is also computed server-side via `analytics.py` → `_compute_risk_score()`

### Global Focus Ring

All `<input>`, `<select>`, and `<textarea>` elements use a global focus style in `index.css`:

```css
input:focus,
select:focus,
textarea:focus {
  outline: none;
  --tw-ring-shadow: ... 0 0 0 calc(2px + ...) #1c1c1e;
  box-shadow: ...;
  border-color: #1c1c1e;
}
```

No per-component focus classes needed — every modal (AddOrder, EditOrder, CloseOrder, EditPortfolio, Zone) uses the consistent `ink` (#1c1c1e) ring.

- **Branding**: "M" badge (brand-yellow) + "InvestDesk / Dashboard" text
- **Nav Links**: Overview 📊, All Assets 💰, Transactions 🔁, Risk Analytics 🛡️ อยู่ตรงกลาง (margin: '0 auto')
- **Portfolios Dropdown**: 📁 + รายการพอร์ต + Create Portfolio action
- **Top Right**: 🔔 notifications + ⋮ more_vert icons สำหรับ utilities
- **Responsive**: Mobile menu แยกจาก desktop nav
- **Icons**: ใช้ emoji (📊💰🔁🛡️📁🔔⋮) แทน Material icons (ทำงานได้เสมอ)

### Component Primitives

- `.card` - White background, border, rounded-xl
- `.btn-primary` - Dark pill button (rounded-full)
- `.btn-ghost` - Transparent button
- `.nav-link` - Navigation link styling
- `.select-dropdown` - Portfolio selector dropdown

### 🛠 Architectural Gap Analysis (IMPLEMENTED)

| Current State | Design Spec Requirement | Status |
|---------------|------------------------|--------|
| Header not sticky | sticky top-0 with search/notification icons | ✅ Implemented (search input added) |
| No Hero Card | Teal background, Asset Total + Overall P/L | ✅ Added Hero Card with `--color-teal-light` |
| Cash: Margin/Money Market | Cash: Lock/Buffer/Available/T+3 | ✅ Labels renamed (Margin→Lock, Money Market→T+3) |
| Circle gauge | Semi-circle SVG gauge (93% animated) | ✅ SVG path animation with `stroke-dashoffset` |
| `auto-fill grid` (1-3 cols) | `xl:grid-cols-2` (2 cols) | ✅ Grid changed to `repeat(2, 1fr)` |
| Portfolio cards (basic) | Tags + profit % + status indicator | ✅ Tags (crypto/bot/FUND) + Profit % + Status bar |

**Animations Added** (see index.css):
- `.pulse-available` - Box shadow pulse for Available cash card
- `.shimmer-bar` - Gradient sweep for threshold bars  
- `.health-gauge-path` - SVG stroke-dashoffset transition (1.5s cubic-bezier)

**Pool Health SVG Gauge (2026-05-30):**
- Container: `display: flex` + `alignItems: center` + `width: 192px, height: 96px, overflow: hidden` 
- SVG viewBox: `"0 0 100 100"` with semi-circle path `M 10 50 A 40 40 0 0 1 90 50`
- Animation: strokeDashoffset animated from 125.6 (empty) → value based on pool_health_index
- Centered with flexbox `alignItems: center`, text positioned at `bottom: -20` for proper alignment

## 📱 Pages & Routes

| Route | Component | File | Description |
|-------|-----------|------|-------------|
| `/` | PortfolioOverview | pages/PortfolioOverview.tsx | Cash breakdown + portfolio grid |
| `/transactions` | TransactionsPage | pages/TransactionsPage.tsx | Transaction history + filters |
| `/all-assets` | AllAssets | pages/AllAssets.tsx | Asset listing table |
| `/risk-analytics` | RiskAnalytics | pages/RiskAnalytics.tsx | Risk metrics (Sharpe, VaR, Drawdown) |
| `/analytics` | AnalyticsDashboard | pages/AnalyticsDashboard.tsx | NAV time series + summary |
| `/analytics/portfolio/{id}` | PortfolioAnalyticsDetail | pages/PortfolioAnalyticsDetail.tsx | **Dynamic Layout** - auto-selects based on port_type (spread/grid/managed-fund) |
| `/analytics/detail` | PortfolioAnalytics | screens/PortfolioAnalytics.tsx | **Grid View** - Split view: Left Orders+Payoff, Right Sticky Notes (Canary Yellow) |
| `/spread-pairing` | SpreadPairing | screens/SpreadPairing.tsx | **Spread View** - Order Pairs table + Payoff chart, Side-by-side Long/Short legs |
| `/managed-fund/{portfolioId}` | ManagedFund | screens/ManagedFund.tsx | **Managed Fund View** - Asset Allocation (Target vs Current) + Rebalance + NAV History |

## 🎨 Analytics Layout Varieties

Portfolio Analytics มี 3 รูปแบบใหญ่ ๆ ที่เลือกแสดงโดยอัตโนมัติตาม `port_type`:

### 1. Grid View (`/analytics/portfolio/{id}`)
- **Route**: `/analytics/detail` (fallback) + `/analytics/portfolio/{id}` (dynamic)
- **Port Type**: `grid*` (default)
- **Layout**: Split View
  - **Left Panel (Main Command)**: Payoff Chart (placeholder) + Active Orders Table
  - **Right Panel (Strategy & Notes)**: Canary Yellow Sticky Note Panel (350px)
    - Trade Plan (Markdown)
    - Quick Stats (active pairs / unpaired count)
    - Decision Journal (completed cycles from orders with spread_pair_id)
- **Mock Data (Binance Futures)**:
  ```typescript
  active_orders: [
    { order_id: 101, asset_type: "BTC", side: "BUY", qty: 0.5, status: "ACTIVE" },
    { order_id: 102, asset_type: "ETH", side: "SELL", qty: 2.0, status: "ACTIVE" },
    { order_id: 103, asset_type: "SOL", side: "BUY", qty: 10, status: "CLOSED", spread_pair_id: "shsojvp" }
  ]
  ```
- **Features**:
  - Active Orders table with Side/Status color coding
  - Manual Refresh with timestamp
  - Risk Status Header with info tooltip (ⓘ)
  - Decision Journal from closed orders with spread_pair_id

### 2. Spread View (`/spread-pairing`)
- **Port Type**: `spread*`
- **Layout**: Split View
  - **Left Panel**: Order Pairs table + Payoff chart visualization
  - **Right Panel**: Sticky Note Strategy (Canary Yellow)
- **Features**:
  - Side-by-side Long/Short leg display
  - Consolidated P/L column (teal/coral color coding)
  - Visual Bracket Linking (⎡⎤ brackets)
  - Manual Re-grouping via dropdown
  - Payoff Wizard sandbox simulation

### 3. Managed Fund View (`/managed-fund/{portfolioId}`)
- **Port Type**: `managed-fund*`
- **Layout**: Vertical sections
  ```
  ┌─────────────────────────────────────────┐
  │ Header: Portfolio Name + Type Badge       │
  │ Key Metrics | Asset Allocation          │
  ├─────────────────────────────────────────┤
  │ Trade Plan (Markdown Editor)            │
  ├─────────────────────────────────────────┤
  │ Rebalance Actions: [Calculate] [Execute]│
  │ Recommendations Table                   │
  ├─────────────────────────────────────────┤
  │ NAV History (Line Chart)                │
  └─────────────────────────────────────────┘
  ```
- **Features**:
  - Key Metrics: Current NAV, Margin Locked, Available Cash
  - Asset Allocation: Target vs Current bars with drift indicator dots
    - 🟢 Safe (drift <= 5%)
    - 🟡 Warning (5-15%)
    - 🔴 Danger (drift > 15%)
  - Trade Plan editor (inline markdown)
  - Rebalance: Calculate recommendations + Execute trades
  - NAV History line chart
| `/trades` | TradePlanManager | pages/TradePlanManager.tsx | Trade plan management |
| `/orders` | ActiveOrders | pages/ActiveOrders.tsx | Active orders |

## 🐳 Docker Development

### Network Architecture

```
Browser (host)
   ↓ http://localhost:5173
Frontend (network_mode: host)
   ↓ Vite Proxy: /api/* → http://localhost:8000
Backend (Docker network: investment-network)
   ↓ http://localhost:8000
```

**ทำไมเลือก network_mode: host?**
- Browser ทำงานบน host machine ไม่ได้อยู่ใน Docker network
- ถ้า frontend อยู่ Docker network เดียวกับ backend JS จะต้องเรียก `http://backend:8000` ซึ่ง browser ไม่เข้าใจ
- วิธีนี้ทำให้ frontend อยู่บน host network เรียก backend ผ่าน localhost ได้โดยตรง

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

VITE_API_BASE_URL ถูกกำหนดเป็นค่าว่าง (`""`) เพื่อให้ JS เรียกผ่าน relative path (`/api/...`) ซึ่ง Vite dev server proxy จะส่งต่อไปยัง backend

## 📊 Features หลัก

1. **Portfolio Overview**: แสดง margin/buffer/available/money market พร้อม gauge
2. **Risk Status**: แสดงสีตามความเสี่ยง (Safe/Warning/Danger)
3. **Currency Toggle**: สลับ USD/THB (อัตรา 35)
4. **Portfolio Grid**: คลิกเข้าสู่ analytics ของแต่ละพอร์ต
5. **Spread Pairing**: จัดคู่ออเดอร์แบบ 1:1 พร้อม zone grouping
6. **Rebalance**: คำนวณและแสดงคำแนะนำการทำซ้ำ (rebalance)

## ⚙️ Technical Details

### Environment Configuration

**สองระบบตัวแปรสถานะ (Two Systems):**

| Variable | File | Purpose |
|----------|------|---------|
| `BACKEND_API_BASE_URL` | vite.config.ts | Proxy target: `http://localhost:8000` (สำหรับ Vite dev server) |
| `VITE_API_BASE_URL` | api.ts | Fetch BASE_URL: `""` (ว่าง) สำหรับ relative path → Vite Proxy |

```typescript
// vite.config.ts - Two Configs
const API_BASE_URL = process.env.BACKEND_API_BASE_URL || 'http://localhost:8000';
define: {
  'import.meta.env.BACKEND_API_BASE_URL': JSON.stringify(API_BASE_URL),
},
server: {
  proxy: { '/api': { target: API_BASE_URL } },
},

// api.ts - Runtime Fetch
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''; // ค่าว่าง = Vite proxy
```

**Docker Dev Mode:**

```yaml
# docker-compose.yml
environment:
  BACKEND_API_BASE_URL=http://localhost:8000  # Vite proxy target
  VITE_API_BASE_URL=                         # ค่าว่าง = relative path
```

**ผลลัพธ์:** JS เรียก `/api/v1/...` (relative) → Vite Proxy → backend:8000

### API Route Constants (api.ts)

```typescript
// Base URL resolution
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Wrapper functions
get<T>(path)    // GET request
post<T>(path, body) // POST request
put<T>(path, body)  // PUT request
del(path)        // DELETE request
```

### React Query Caching Strategy

```typescript
// Portfolio list - stale 30 วินาที
staleTime: 30000

// Query Keys สำคัญ
['nav-portfolios']  // รายการพอร์ต
['risk-analytics']  // ข้อมูล risk
['assets']        // สินทรัพย์
```

### Component Patterns

**Navigation.tsx**:
- `useQuery` ดึง portfolios สำหรับ dropdown
- Mobile/desktop responsive
- Click outside ปิด dropdown

**PortfolioOverview.tsx**:
- Grid 2 columns: Cash stats (ซ้าย) + Gauges (ขวา)
- Portfolio grid: `grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))`
- Risk border: `borderLeft: 3px solid ${riskColor}`

### Data Models (TypeScript)

All shared types are defined in `src/types/index.ts`:

| Domain | Key Interfaces | Notes |
|--------|---------------|-------|
| **Portfolio Overview** | `PortfolioOverviewItem`, `OverviewResponse` | |
| **Grid Analytics** | `PortfolioData`, `SpreadOrder`, `SpreadPair`, `ZoneGroup`, `RecentTrade` | `order_id` is **string** (UUID); `risk_score` (0–100) computed server-side |
| **Managed Fund** | `FundPortfolio`, `TradePlan`, `TradeRecommendation`, `NavHistoryRecord` | |
| **Spread Pairing** | `PortfolioSpreadsData` | |
| **Transactions** | `Transaction` | Includes `order_id` and `close_order_id` (both string) |
| **Routing** | `PortfolioType`, `AnalyticsLayout` | |

### Testing Strategy

```typescript
// Unit tests (.test.tsx)
- Navigation.test.tsx
- PortfolioOverview.test.tsx
- RiskAnalytics.test.tsx
- PortfolioAnalytics.test.tsx

// Vitest config (ผ่าน npm scripts)
- test: "vitest run" (CI)
- test:ui: "vitest" (watch mode)
```

### Build Optimization

```typescript
// vite.config.ts
manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom'] }
optimizeDeps: { include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'] }
warmup: { clientFiles: ['./src/main.tsx', './src/App.tsx', ...] }
```

### Architecture: Shared Modules

The frontend follows SOLID principles with clear separation of concerns:

| Layer | Directory | Purpose |
|-------|-----------|---------|
| **Types** | `types/` | All shared interfaces (portfolio, spread, fund, transaction) |
| **Constants** | `constants/` | Design tokens (colors, spacing, exchange rate) |
| **Utilities** | `utils/` | Pure helper functions (formatting, risk calculations, tags) |
| **Hooks** | `hooks/` | Stateful business logic (order editing, portfolio management) |
| **API** | `lib/api.ts` | Centralized HTTP client — all endpoints in one place |
| **Components** | `components/` | Presentation-only UI (Navigation, SVG icons) |
| **Pages** | `pages/` | Top-level route components |
| **Screens** | `screens/` | Detail view layouts with business logic |

All raw `fetch` calls have been replaced with `lib/api.ts` methods.

### API Route Consistency Note

> Backend has `redirect_slashes=False` — routes with and without trailing `/` are **different**.  
> Example: `GET /api/v1/portfolios` (no slash) vs `POST /api/v1/portfolios/` (with slash) are distinct endpoints.  
> The frontend `api.ts` accounts for this: `getPortfolios()` hits no-slash, `createPortfolio()` hits with-slash.

---

*อัปเดตโดย Hermes Agent - 30 พฤษภาคม 2026 (network fix verified)*