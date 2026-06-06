# Investment Dashboard Frontend

React + TypeScript + Vite frontend สำหรับระบบจัดการพอร์ตโฟลเลียรีนับตามออเดอร์ (Portfolio Management System)

## 📁 Frontend Project Structure

```
frontend/
├── package.json              # Dependencies: React 18, Vite, TanStack Query, React Router
├── vite.config.ts           # Vite config + proxy /api → backend:8000
├── Dockerfile               # Node 20 Alpine - expose 5173
├── index.html              # Entry point with Inter font + Tailwind CDN
├── src/
│   ├── main.tsx            # React entry: StrictMode + QueryClientProvider
│   ├── App.tsx             # Router + Navigation layout (z-index: 100)
│   ├── index.css           # Design tokens + animations (pulse, shimmer, gauge)
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
│   │   ├── Navigation.tsx  # Sticky nav with feather-style SVG icons (w-5 h-5, hover animate-pulse) + dropdown
│   │   ├── GlobalLayout.tsx # Outlet-based global layout wrapper (max-w-[1200px] mx-auto px-6, breadcrumb, loading/error/missing states)
│   │   └── icons/          # Unified barrel export (index.tsx), feather-style inline SVGs
│   │       └── index.tsx   # IconDashboard, IconTransactions, IconAdd, IconClose, IconEdit, IconLayers, IconLink, IconPlus, etc.
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
│   │   └── PortfolioAnalyticsDetail.tsx # Dynamic layout router with breadcrumb bar, LoadingSkeleton (pulse-animated), ErrorState (red card with icon), MissingPortfolio (info card), consistent max-w-[1200px] wrapper
│   │
│   ├── screens/            # Secondary layouts (detail screens)
│   │   ├── PortfolioGrid.tsx        # Slim orchestrator composing sub-components; payoff state with per-portfolio localStorage
│   │   ├── PortfolioSpread.tsx      # Spread pairing: pairs + payoff
│   │   ├── PortfolioMutualFund.tsx  # Managed fund: allocation, rebalance, NAV
│   │   ├── AddOrderModal.tsx       # Add order form (editable Order ID UUID, asset, side BUY/SELL spot or LONG/SHORT future/option, option_type dropdown Call/Put for options, qty, Cost above TP/SL, Strike on same row as Cost, group combobox, status, contract_type toggle using buttonTheme)
│   │   ├── CloseOrderModal.tsx     # Close order form (editable Close ID UUID, exit price, P/L, auto-calc, shows linked order info for spread/pending_close via link_type)
│   │   ├── EditOrderModal.tsx       # Order edit modal (group combobox, contract_type toggle using buttonTheme, Call=blue-600/Put=orange-500)
│   │   ├── EditPortfolioModal.tsx   # Portfolio field editor: name, margin, buffer, MM, tags; live projected Available Cash auto-adjusts as user types (same formula as Save); deposit/withdraw; max validation per field; Danger Zone delete; save error display
│   │   ├── ZoneEditModal.tsx        # Zone edit modal
│   │   ├── ZoneGroupModal.tsx       # Orders Group CRUD (add/edit/delete), "Group" column, bottom-left add
│   │   └── components/
│   │       ├── PortfolioHeader.tsx    # Breadcrumb, title, Refresh button (no Add Order in header)
│   │       ├── SummaryCard.tsx        # 3-col values with formula tooltips (Total Value, Cash, Available Cash, Risk Level), Cash Details (MM/Margin/Buffer), Risk gauge (dynamic, color-coded), Asset Allocation (real data), Tags, triple-dot edit
│   │       ├── StrategyNotes.tsx      # Trade Plan + Internal Notes (both inline-editable, yellow sticky)
│   │       ├── TagsSection.tsx        # Metadata tag pills
│   │       ├── PerformanceSection.tsx # Performance wrapper + Equity/Payoff toggle; passes payoff state to PayoffChart
│   │       ├── PerformanceChart.tsx   # Dynamic SVG: equity line chart (cumulative P/L) or payoff bar chart (grouped by month with summed realized_pl)
│   │       ├── OrderManagement.tsx    # Active orders table (grouped or flat), Group toggle, two-row header with Add Order pill, drag-and-drop support, Link Order button in left column, contract_type filter tabs that actually filter orders. All tab adapts columns dynamically. Has Controls panel (BS IV mode, min/max price with commit-on-blur inputs, current price slider, active IV inputs with Apply All master input, clearable IV fields via local string state)
│   │       ├── OptionsStrategyTable.tsx # Options strategy sandbox table; outputs OptionRow; uses buttonTheme; onRowsChange callback; per-portfolio localStorage
│   │       ├── PayoffChart.tsx       # SVG payoff chart: Put-Call Parity with intrinsic (blue) + optional BS IV (orange dashed) lines; area fill (pale green above / pale red below baseline); vertical dashed yellow BE lines (no label boxes, uses ivBePoints when IV mode ON); hover crosshair (vertical dashed gray line + dots on P/L curves); tooltip with Price (toFixed(2)), Intrinsic P/L, BS IV P/L; axis labels toFixed(1); D3-like pure SVG
│   │       ├── TradeHistoryTable.tsx  # Collapsible closed-orders table (bg-gray-50 pill badge matching Ungrouped style); drop target (even when collapsed)
│   │       ├── TradePlanView.tsx      # Trade plan markdown display (click-to-edit, Save/Cancel)
│   │       ├── QuickStatsView.tsx     # Active pairs/positions stats
│   │       ├── ZoneGroupRow.tsx       # Grouped order row (exports OrderGroupRow) with edit/close buttons (no borders), drag handle, Link Order button in left column, drop target (counter-ref prevents flicker), custom drag ghost pill. Receives showLev/showExp/showStrikePrice as props from parent (no longer computes internally)
│   │       ├── GroupCombobox.tsx      # Searchable combobox dropdown for group selection in modals
│   │       ├── ToastAlert.tsx         # Fixed-position dismissible toast (z-[9999], below nav bar, auto-dismiss 4s)
│   │       └── HistoricalGridView.tsx # Historical trades accordion
│   │
│   └── assets/             # SVG icons (Material Symbols style)
│       ├── dashboard.svg, wallet.svg, swap.svg, security.svg
│       ├── folder.svg, expand.svg, notifications.svg, more.svg
│       └── hero.png, react.svg, vite.svg
│
├── public/
│   └── vite.svg            # Custom favicon: rounded-square indigo→purple gradient with 3 ascending bars
│
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
- **Payoff Chart**: Pure SVG (no charting library) — intrinsic P/L + Black-Scholes IV overlay

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

### Centralized Button Theme (`constants/colors.ts`)

| Toggle | Value | Tailwind Classes |
|--------|-------|------------------|
| **Side** | LONG | `bg-emerald-600 text-white border-emerald-600` |
| | SHORT | `bg-red-500 text-white border-red-500` |
| **Option Type** | Call | `bg-blue-600 text-white border-blue-600` |
| | Put | `bg-orange-500 text-white border-orange-500` |

Used by: `OptionsStrategyTable`, `AddOrderModal`, `EditOrderModal`

## 🔌 API Endpoints (ผ่าน api.ts)

| Category | Endpoint | Method |
|----------|----------|--------|
| Portfolios | `/api/v1/portfolios/` | GET/POST |
| Portfolios | `/api/v1/portfolios/{id}` | GET/PUT/DELETE |
| Portfolios | `/api/v1/portfolios/types` | GET |
| Assets | `/api/v1/whitelist_assets` | GET |
| Transactions | `/api/v1/transactions` | GET/POST |
| Transactions | `/api/v1/transactions/{id}` | GET |
| Risk | `/api/v1/risk/analytics` | GET |
| Risk | `/api/v1/risk/pool-health` | GET |
| Risk | `/api/v1/risk/money-reserve-status` | GET |
| Risk | `/api/v1/risk/portfolio-safety/{id}` | GET |
| Analytics | `/api/v1/analytics/portfolio-grid` | GET |
| Analytics | `/api/v1/analytics/portfolio/{id}` | GET |
| Analytics | `/api/v1/analytics/performance/{portfolio_id}` | GET |
| Analytics | `/api/v1/analytics/nav/{portfolio_id}` | GET |
| Rebalance | `/api/v1/rebalance/modes` | GET |
| Rebalance | `/api/v1/rebalance/calculate` | POST |
| Rebalance | `/api/v1/rebalance/recommend` | POST |
| Rebalance | `/api/v1/rebalance/execute` | POST |
| Rebalance | `/api/v1/rebalance/nav-history/{portfolio_id}` | GET |
| Rebalance | `/api/v1/rebalance/nav-history/upsert` | POST |
| AI | `/api/v1/ai/status?portfolio_id` | GET |
| AI | `/api/v1/ai/logs/{portfolio_id}` | GET |
| Trade Plans | `/api/v1/trade-plans` | GET/POST |
| Trade Plans | `/api/v1/trade-plans/{id}` | GET/PUT |
| Orders | `/api/v1/orders/` | POST (create with optional UUID order_id) |
| Orders | `/api/v1/orders` | GET (list) |
| Orders | `/api/v1/orders/{order_id}/close` | POST (close + trade history) |
| Orders | `/api/v1/orders/{order_id}` | GET/PUT |
| Orders | `/api/v1/orders/{order_id}/status` | PATCH (cancel → `{"new_status":"CANCELED"}`) |
| Orders | `/api/v1/orders/{order_id}/unlink` | POST (unlink order + partner) |
| Orders | `/api/v1/orders/{order_id}/link` | POST (link to target order) |
| Trade History | `/api/v1/trade-history/` | GET/POST (optional `?portfolio_id=`) |
| Orders Groups | `/api/v1/orders-groups/?portfolio_id=` | GET/POST (was zone-groups) |
| Orders Groups | `/api/v1/orders-groups/{id}` | PUT/DELETE |
| Spread Pairs | `/api/v1/spread-pairs/` | POST/DELETE |
| Journal | `/api/v1/journal/{portfolio_id}` | GET |
| Journal | `/api/v1/journal/` | POST |
| Transfers | `/api/v1/transfers/` | GET/POST |
| Transfers | `/api/v1/transfers/confirm` | POST |
| Overview | `/api/v1/overview/` | GET |

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
       ├─ Full border with risk color tint (side-stripe replaced in polish pass)
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

The risk donut and gauge are computed dynamically from cash data (both client and server):

- **`cashBufferLimit ≠ 0`**: `((availableCash − marginLocked) / cashBufferLimit) × 100` (capped at 100)
- **`cashBufferLimit = 0`**: `((availableCash − marginLocked) / marginLocked) × 100` (capped at 100)
- **Both $0$**: returns `100` (Safe — no exposure)
- Color: 🟢 teal (`≥100%` Safe), 🟡 yellow (`≥50%` Warning), 🔴 red (`<50%` Danger)
- `risk_score` is also computed server-side via `analytics.py` → `_compute_risk_score()`; returned in portfolio-grid API response as `risk_score`

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

## 📱 Pages & Routes

| Route | Component | File | Description |
|-------|-----------|------|-------------|
| `/` | PortfolioOverview | pages/PortfolioOverview.tsx | Cash breakdown + portfolio grid |
| `/transactions` | TransactionsPage | pages/TransactionsPage.tsx | Transaction history + filters |
| `/all-assets` | AllAssets | pages/AllAssets.tsx | Asset listing table |
| `/risk-analytics` | RiskAnalytics | pages/RiskAnalytics.tsx | Risk metrics (Sharpe, VaR, Drawdown) |
| `/analytics` | AnalyticsDashboard | pages/AnalyticsDashboard.tsx | NAV time series + summary |
| `/analytics/portfolio/{id}` | PortfolioAnalyticsDetail | pages/PortfolioAnalyticsDetail.tsx | **Dynamic Layout** - auto-selects based on port_type (spread/grid/managed-fund). Grid type renders PortfolioGrid with 12-col layout: Left SummaryCard + StrategyNotes, PerformanceSection, OrderManagement, TradeHistory |
| `/analytics/detail` | PortfolioAnalytics | screens/PortfolioAnalytics.tsx | **Grid View** - Split view: Left Orders+Payoff, Right Sticky Notes (Canary Yellow) |
| `/spread-pairing` | SpreadPairing | screens/SpreadPairing.tsx | **Spread View** - Order Pairs table + Payoff chart, Side-by-side Long/Short legs |
| `/managed-fund` | PortfolioMutualFund | screens/PortfolioMutualFund.tsx | **Managed Fund** overview |
| `/managed-fund/{portfolioId}` | PortfolioMutualFund | screens/PortfolioMutualFund.tsx | **Managed Fund View** - Asset Allocation (Target vs Current) + Rebalance + NAV History |
| `/create-portfolio` | CreateNewPortfolio | pages/CreateNewPortfolio.tsx | Portfolio creation form |
| `/trades` | TradePlanManager | pages/TradePlanManager.tsx | Trade plan management |
| `/orders` | ActiveOrders | pages/ActiveOrders.tsx | Active orders page |

## 🎨 Analytics Layout Varieties

Portfolio Analytics มี 3 รูปแบบใหญ่ ๆ ที่เลือกแสดงโดยอัตโนมัติตาม `port_type`:

### 1. Grid View (`/analytics/portfolio/{id}`)
- **Route**: `/analytics/detail` (fallback) + `/analytics/portfolio/{id}` (dynamic)
- **Port Type**: `grid*` (default)
- **Layout**: Split View
  - **Left Panel (Main Command)**: Payoff Chart (intrinsic + BS IV) + Active Orders Table + Controls (BS IV toggle, price range, current price slider, active IV%)
  - **Right Panel (Strategy & Notes)**: Canary Yellow Sticky Note Panel (350px)
    - Trade Plan (Markdown)
    - Quick Stats (active pairs / unpaired count)
    - Decision Journal (completed cycles from orders with linked_order_id)
- **Mock Data (Binance Futures)**:
  ```typescript
  active_orders: [
    { order_id: 101, asset_type: "BTC", side: "BUY", qty: 0.5, status: "ACTIVE" },
    { order_id: 102, asset_type: "ETH", side: "SELL", qty: 2.0, status: "ACTIVE" },
    { order_id: 103, asset_type: "SOL", side: "BUY", qty: 10, status: "CLOSED", linked_order_id: "shsojvp" }
  ]
  ```
- **Features**:
  - Active Orders table with Side/Status color coding
  - Manual Refresh with timestamp
  - Risk Status Header with info tooltip (ⓘ)
  - Decision Journal from closed orders with linked_order_id

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

1. **Portfolio Overview**: Hero Card (teal bg) with Asset Total, P/L trend, 4-col breakdown; Pool Health semi-circle gauge; Money Reserve Status bar with zones; Active Portfolios cards with DnD and risk-color border tint
2. **Risk Status**: แสดงสีตามความเสี่ยง (Safe/Warning/Danger)
3. **Live Available Cash projection**: Edit Portfolio modal shows projected Available Cash updating live as user types MM/Margin/Buffer (same auto-adjust formula as Save)
4. **Formula tooltips**: "i" tooltips on Total Value, Cash, Available Cash (Cash Details), and Risk Level showing calculation formulas
5. **Portfolio Grid**: คลิกเข้าสู่ analytics ของแต่ละพอร์ต
6. **Spread Pairing**: จัดคู่ออเดอร์แบบ 1:1 พร้อม zone grouping
7. **Rebalance**: คำนวณและแสดงคำแนะนำการทำซ้ำ (rebalance)
8. **Payoff chart groups by month**: Payoff bars are grouped by month with summed `realized_pl` — one bar per month instead of per trade. Date labels show YYYY-MM format.
9. **Orders Groups**: จัดกลุ่มออเดอร์ด้วย Orders Groups (rename from Zone Groups) — group_id FK to orders_groups
10. **Drag & Drop Assign Group**: ลากออเดอร์ไปวางบน Group header, Ungrouped section, หรือ Trade History
    - Drag handle (6-dot grip icon) visible on hover — เฉพาะ icon เท่านั้นที่ draggable
    - Custom drag ghost: dark pill badge แสดง `#id | ASSET | SIDE | $price`
    - Drop area expanded to all order rows in group (ไม่ใช่แค่ header), counter-ref ป้องกัน flicker
    - Drop บน Group header → กำหนด group_id
    - Drop บน Ungrouped section → ยกเลิก group assignment
    - Drop บน Trade History (even when collapsed) → close (FILLED) หรือ cancel (PENDING)
    - Group validation alerts (non-blocking toast): max_orders, min_price, max_price
11. **Contract Type Filter Tabs**: Filter orders by `contract_type` (Spot=indigo, Future=blue, Option=purple) in the order table header. Tabs actually filter displayed orders (not just columns). **All** tab adapts columns dynamically: spot-only → basic cols, has futures → lev/margin/expiry, has options → all cols (lev/margin/expiry/strike)
12. **Link Order Button**: Chain-link icon (`IconLink`) in the left column (next to drag handle) — links orders via `linked_order_id` using `POST /api/v1/orders/{id}/link`
13. **EditOrderModal unlink**: Hovering the linked order info row shows a ghost link icon; clicking toggles a red broken-link icon with "Will unlink" label. On Save, calls `POST /api/v1/orders/{order_id}/unlink` before saving other changes.
14. **Active orders sorted by Asset asc, Entry desc**: Both grouped and flat views sort active orders by asset_type ascending, then created_at (entry date) descending.
15. **Tier Spread / Link Types**: Each order has `link_type` field:
    - `"spread"` — cross-linked (A↔B), forms a spread pair
    - `"pending_close"` — one-way sub-order (B→A, B is a pending close of A)
    - `"primary"` — no link but has sub-orders linking to it (A with C→A)
    - `"none"` — no linking
16. **Close auto-closes subs**: Closing a primary order (or a spread leg) auto-closes all its one-way sub-orders server-side; response includes `auto_closed[]`. For spread pair legs, returns `paired_order_id` to auto-open close modal for the partner.
17. **Link UI**: Link icon in white circle (`bg-white rounded-full p-0.5`, no border, `shadow-sm`) with per-type color (blue `text-blue-600` for spread, yellow `text-yellow-500` for pending_close, gray `text-gray-300` for unlinked). Icon is **absolutely positioned** at `top: 0` aligned to the SVG line center — sits at the front/start of the vertical connecting line. SVG vertical lines: spread pair = blue (`#93c5fd`) continuous line from first icon to bottom (`y1="0"→y2="100%"`), last icon sits alone (`y1="0"→y2="0"`); pending_close = yellow (`#fde047`) from top to middle (`y1="0"→y2="50%"`). SVG constrained to content area via explicit `top: 0; height: 100%`. 6-dot grip hidden + non-draggable on sub-orders. Drag parent carries linked children via `text/x-linked-ids`.
18. **Ungrouped Orders section**: Always visible (drop target for unassigning)
19. **Order status**: PENDING / FILLED / CLOSE / CANCELED (uppercase)
20. **Portfolio Delete**: Cascade cleanup with activeOrderCount guard + per-portfolio localStorage cleanup
21. **Header layout**: Two-row header — title + ACTIVE badge (row 1), Order Groups icon + Group toggle (row 2), Add Order pill button centered vertically on right
22. **Trade History styling**: Matches Ungrouped Orders section — `bg-gray-50` with pill badge, `border border-hairline`, `rounded-b-xl`
23. **ToastAlert position**: Centered below nav bar (`top-20 left-1/2 -translate-x-1/2 z-[9999]`)
24. **Options Strategy Table**: Local-scratchpad for option strategy rows (frontend-only, per-portfolio localStorage). Side=emerald/red, Call=blue-600/Put=orange-500 via buttonTheme. Price column renamed to Premium.
25. **Payoff Chart (Performance tab)**: Pure SVG — Put-Call parity visualization. Intrinsic line (blue #3B82F6, strokeWidth 2). BS IV overlay (orange #F97316, dashed, optional via toggle). Area fill: pale green (#DCFCE7, 0.6) above baseline, pale red (#FEE2E2, 0.6) below, fades to 0 at baseline. Break-even markers (amber dot + "BE: XXX" label). **Break Event** label (amber rect at top, no vertical bar) — shows intrinsic BE when IV OFF, IV BE when IV ON. Hover tooltip with P/L values. Dynamic ~200 points. Y-axis symmetric around 0.
26. **Payoff localStorage per portfolio**: 6 keys (`payoff_{key}_{portfolio_id}`) — strategy_rows, iv_mode, min_price, max_price, active_ivs, current_price. One-time migration from old flat keys. Delete portfolio clears its keys.
27. **Controls panel (beside Options Strategy)**: BS IV mode toggle, Min/Max price range inputs, Current Price slider, per-order Active IV% inputs.
28. **Edit Portfolio live projection**: Available Cash display updates live as user types MM/Margin/Buffer — `projectedAvailableCash = Math.max(0, rawAvailableCash − totalDiff)`
29. **Formula tooltips in SummaryCard**: "i" tooltips on Total Value (`Cash + P/L + MM + Margin + Buffer + Notional`), Available Cash in Cash Details (`Available Cash = Cash + Total P/L`), and Risk Level (`min(100%, (Cash − Margin) ÷ max(Buffer, Margin) × 100)`)
30. **Save error feedback**: Edit Portfolio modal shows error message on save failure (network errors, validation)
31. **PayoffChart crosshair**: Vertical dashed gray line snaps to nearest data point on mouse hover; circles on P/L curves at hovered price. Uses direct index-based `snappedX` (`MARGIN.left + (clampedIdx / (len-1)) * CHART_W`) for perfect alignment with rendered line.
32. **BE vertical lines**: Break-even points shown as vertical dashed yellow lines (strokeWidth=1, `#FCD34D`) instead of label boxes with BE text. BE text legend shows `ivBePoints` when IV mode is ON.
33. **Price Range auto-compute stabilized**: `onPayoffMinMaxChange` wrapped in a ref to prevent re-firing on every render when parent passes inline arrow function. Formula: `max * 1.5`, `min * 0.5` (capped at 0). Sync from props treats both 0 as "unset" (shows `""` placeholder).
34. **Price Range commit on blur**: Min/Max price inputs commit on blur (not keystroke). Empty input reverts to previous value. Auto-adjusts the other bound when `min >= max`.
35. **Active IV Apply All**: Master IV% input + Apply All button sets all active orders to the same IV% in one click. Individual IV inputs use local string state to allow clearing to empty (sends `0` to parent on blur → parent deletes the key from localStorage).
36. **GlobalLayout**: Outlet-based global layout component extracted from App.tsx. Wraps all child routes with `max-w-[1200px] mx-auto px-6 py-6`. Used by PortfolioAnalyticsDetail for consistent page structure.
37. **PortfolioAnalyticsDetail states**: Three explicit states: LoadingSkeleton (pulse animation placeholder cards), ErrorState (red card with error message + icon), and MissingPortfolio (info card when portfolio not found). Breadcrumb bar visible in all states.
38. **Decimal formatting**: PayoffChart Y-axis labels use `toFixed(1)` (was `toFixed(0)`), tooltip Price uses `toFixed(2)` (was `toFixed(0)`).

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
- Design tokens via CSS variables (colors tokenized from hard-coded hex values in polish pass)
- Responsive grid layout with breakpoint-aware column counts

### Data Models (TypeScript)

All shared types are defined in `src/types/index.ts`:

| Domain | Key Interfaces | Notes |
|--------|---------------|-------|
| **Portfolio Overview** | `PortfolioOverviewItem`, `OverviewResponse` | |
| **Grid Analytics** | `PortfolioData`, `SpreadOrder`, `SpreadPair`, `ZoneGroup`, `RecentTrade` | `order_id` is **string** (UUID); `risk_score` (0–100) computed server-side; `group_id` is `number \| null`; `linked_order_id` replaces `spread_pair_id`; `contract_type`, `option_type` (Call/Put), `expiry_date`, `strike_price`, `exercise_price`, `cost` added; `side`: `BUY`/`SELL` for spot, `LONG`/`SHORT` for futures/options (direction field removed); `link_type`: `"spread"` (cross-linked), `"pending_close"` (one-way sub), `"primary"` (has subs), `"none"` |
| **Orders Groups** | `GroupOption` | Fields: `id`, `name`, `max_orders` (null = ∞), `min_price`, `max_price` |
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
| **Constants** | `constants/` | Design tokens (colors, spacing, exchange rate, buttonTheme) |
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

*อัปเดตโดย Hermes Agent - 6 มิถุนายน 2026 (removed /analytics route; PerformanceChart fluid aspect-[4/1] fix; PayoffChart 4:1 viewBox, nice round ticks, stats sidebar overlay, clip-path area fill green/red; Price Range auto-compute uses strike for option, entry_price for spot/future, multiplier max*1.25/min*0.75)*
