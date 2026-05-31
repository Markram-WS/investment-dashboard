const fs = require('fs');
let content = fs.readFileSync('README.md', 'utf8');

// Lines 47-85: the project structure section
const startMarker = '│   ├── pages/              # Main routes (pages)';
const endMarker = '\n└── tests/';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);
if (startIdx !== -1 && endIdx !== -1) {
  const newBlock = `│   ├── pages/              # Main routes (pages)
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
│   │   ├── ZoneEditModal.tsx        # Zone edit modal
│   │   ├── ZoneGroupModal.tsx       # Zone group CRUD (add/edit/delete zone definitions)
│   │   └── components/
│   │       ├── PortfolioHeader.tsx    # Breadcrumb, title, Refresh + Add Order buttons
│   │       ├── SummaryCard.tsx        # 3-col values, Cash Details grid, Risk gauge, Asset Allocation, Tags
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
└── tests/`;

  content = content.slice(0, startIdx) + newBlock + content.slice(endIdx);
  fs.writeFileSync('README.md', content, 'utf8');
  console.log('OK');
} else {
  console.log('Not found:', startIdx, endIdx);
}
