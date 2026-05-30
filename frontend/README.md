# Investment Dashboard Frontend

React + TypeScript + Vite frontend สำหรับระบบจัดการพอร์ตโฟลเลียรีนับตามออเดอร์ (Portfolio Management System) 🚀

## 📋 สรุปโครงสร้างโปรเจค

```
frontend/
├── package.json              # Dependencies: React 18, Vite, TanStack Query, React Router
├── vite.config.ts          # Vite config + define VITE_API_BASE_URL สำหรับ Docker env
├── Dockerfile              # Node 20 Alpine - expose 5173
├── .env                    # Environment variables (API URL)
├── index.html              # Entry point
├── src/
│   ├── main.tsx            # React entry: StrictMode + QueryClientProvider
│   ├── App.tsx             # Router + Navigation layout
│   ├── index.css           # Design tokens (Miro-inspired: --color-brand-teal, --color-primary)
│   │
│   ├── lib/
│   │   └── api.ts          # API wrapper: get/post/put/del + all endpoints
│   │
│   ├── services/
│   │   ├── overviewService.ts
│   │   └── transactionsService.ts
│   │
│   ├── components/
│   │   └── Navigation.tsx  # Top nav with portfolio dropdown + mobile menu
│   │
│   ├── pages/              # Main routes (pages)
│   │   ├── PortfolioOverview.tsx    # Overview: Cash stats + portfolio grid
│   │   ├── TransactionsPage.tsx     # Transaction history + filters
│   │   ├── CreateNewPortfolio.tsx   # Portfolio creation form
│   │   ├── RiskAnalytics.tsx        # Sharpe, VaR, Drawdown charts
│   │   ├── AllAssets.tsx            # Asset listing table
│   │   ├── TradePlanManager.tsx     # Placeholder page
│   │   ├── ActiveOrders.tsx         # Active orders placeholder
│   │   ├── AnalyticsDashboard.tsx   # NAV + risk summary + grid
│   │   ├── PortfolioAnalyticsGrid.tsx # Portfolio grid view
│   │   └── PortfolioAnalyticsDetail.tsx # Individual portfolio analytics
│   │
│   └── screens/            # Secondary layouts (screens)
│       ├── ManagedFund.tsx        # Managed fund: NAV, allocation, rebalance
│       └── SpreadPairing.tsx      # Spread pairing: order pairs + zones
│
└── tests/
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
| Rebalance | `/api/v1/rebalance/recommend` | POST |
| AI | `/api/v1/ai/status?portfolio_id` | GET |
| Trade Plans | `/api/v1/trade-plans` | GET/POST |
| Orders | `/api/v1/orders` | GET |

## 📱 Pages & Routes

| Route | Component | File | Description |
|-------|-----------|------|-------------|
| `/` | PortfolioOverview | pages/PortfolioOverview.tsx | Cash breakdown + portfolio grid |
| `/transactions` | TransactionsPage | pages/TransactionsPage.tsx | Transaction history + filters |
| `/all-assets` | AllAssets | pages/AllAssets.tsx | Asset listing table |
| `/risk-analytics` | RiskAnalytics | pages/RiskAnalytics.tsx | Risk metrics (Sharpe, VaR, Drawdown) |
| `/analytics` | AnalyticsDashboard | pages/AnalyticsDashboard.tsx | NAV time series + summary |
| `/analytics/portfolio/{id}` | PortfolioAnalyticsDetail | pages/PortfolioAnalyticsDetail.tsx | Individual portfolio analytics |
| `/analytics/detail` | PortfolioAnalytics | screens/PortfolioAnalytics.tsx | Portfolio detail view |
| `/create-portfolio` | CreateNewPortfolio | pages/CreateNewPortfolio.tsx | Portfolio creation form |
| `/managed-fund` | ManagedFund | screens/ManagedFund.tsx | Asset allocation + rebalance |
| `/managed-fund/{portfolioId}` | ManagedFund | screens/ManagedFund.tsx | Portfolio-specific Managed Fund |
| `/spread-pairing` | SpreadPairing | screens/SpreadPairing.tsx | Spread pairing zone-based |
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

```typescript
// Portfolio Overview Item
interface PortfolioOverviewItem {
  portfolio_id: number;
  portfolio_name: string;
  margin: number;
  buffer: number;
  available: number;
  risk_status: 'Safe' | 'Warning' | 'Danger' | null;
}

// Transaction
interface Transaction {
  history_id: number;
  type: 'Buy' | 'Sell' | 'Deposit' | 'Withdraw' | 'Transfer';
  asset: string;
  amount: number | null;
  executed_by: 'Manual' | 'Bot' | 'AI';
  // ...
}

// Spread Pair
interface SpreadPair {
  pair_id: string;
  leg_a: SpreadOrder;
  leg_b: SpreadOrder;
  net_pl: number | null;
  zone: string;
}
```

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

### Services Layer (Legacy)

```typescript
// services/*.ts - Legacy wrappers (not used in favor of lib/api.ts)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
console.info(API_BASE_URL); // Debug logging

// Note: These services use direct fetch without Vite proxy benefits
// Prefer lib/api.ts for consistent environment handling
```

### API Route Consistency Note

> **FastAPI trailing slash**: Routes ที่มี `/` ท้ายปละที่ไม่มี ถืกเป็น endpoint ต่างกัน  
> ตัวอย่าง: `/api/v1/portfolios/` (มี)  vs `/api/v1/portfolios` (ไม่มี)  
> อย่าให้เกิด redirect 307 - ให้ใช้ route definitions ที่สม่ำเสมอกัน

---

*อัปเดตโดย Hermes Agent - 30 พฤษภาคม 2026 (network fix verified)*