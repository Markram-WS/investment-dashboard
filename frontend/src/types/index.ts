// === Portfolio Overview ===
export interface PortfolioOverviewItem {
  portfolio_id: number;
  portfolio_name: string;
  margin: number;
  buffer: number;
  available_cash: number;
  money_market: number;
  total_pl: number;
  risk_status: string | null;
  profit_percentage?: number;
  portfolio_type?: string;
  is_bot_trading?: boolean;
  status_message?: string;
}

export interface OverviewResponse {
  margin: number;
  buffer: number;
  available_cash: number;
  money_market: number;
  total_pl: number;
  pool_health_index: number;
  money_reserve_status: string;
  portfolios: PortfolioOverviewItem[];
}

// === Portfolio Analytics ===
export interface SpreadOrder {
  order_id: string;
  asset_type: string;
  side: string;
  qty: number | string;
  entry_price: number | null;
  current_price: number | null;
  tp_price: number | null;
  sl_price: number | null;
  leverage: number | null;
  margin_rate: number | null;
  order_status: string;
  executed_by: string;
  created_at: string | null;
  linked_order_id: string | null;
  group_id: number | null;
  group_name: string | null;
  contract_type?: 'spot' | 'future' | 'option';
  direction?: string | null;
  option_type?: string | null;
  expiry_date?: string | null;
  strike_price?: number | null;
  exercise_price?: number | null;
  cost?: number;
  link_type?: 'spread' | 'pending_close' | 'primary' | 'none';
}

export interface GroupOption {
  id: number;
  name: string;
  max_orders: number | null;
  min_price: number | null;
  max_price: number | null;
}

export interface SpreadPair {
  pair_id: string;
  leg_a: SpreadOrder;
  leg_b: SpreadOrder;
  net_pl: number | null;
  spread_diff: number | null;
  zone: string | null;
}

export interface RecentTrade {
  history_id: number;
  type: string;
  asset: string;
  amount: number;
  exit_price: number;
  realized_pl: number;
  executed_by: string;
  decision_note: string;
  entry_date: string;
  exit_date: string;
}

export interface PortfolioData {
  portfolio_id: number;
  portfolio_name: string;
  port_type: string;
  risk_status: string;
  risk_score: number | null;
  trade_plan_md: string | null;
  internal_notes: string | null;
  available_cash: number | null;
  money_market: number | null;
  margin_locked: number | null;
  cash_buffer_limit: number | null;
  tags: Record<string, boolean> | null;
  ai_reasoning: string | null;
  ai_risk_insight: string | null;
  spread_pairs: SpreadPair[];
  active_orders: SpreadOrder[];
  recent_trades: RecentTrade[];
}

export interface ZoneGroup {
  zone: string;
  mainOrders: SpreadOrder[];
  pendingCloseOrders: SpreadOrder[];
}

// === Portfolio Detail Routing ===
export interface PortfolioType {
  portfolio_id: number;
  portfolio_name: string;
  port_type: string;
}

export type AnalyticsLayout = "spread" | "grid" | "managed-fund";

export interface AllocationItem {
  label: string;
  percentage: number;
  color: string;
}

// === Transactions ===
export interface Transaction {
  history_id: number;
  transaction_id?: number;
  portfolio_id: number;
  portfolio_name: string;
  type: string;
  asset: string;
  amount: number | null;
  exit_price: number | null;
  realized_pl: number | null;
  executed_by: string;
  decision_note: string | null;
  entry_date: string | null;
  exit_date: string | null;
  flow: string | null;
  comments: any | null;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
}

// === Managed Fund ===
export interface FundPortfolio {
  portfolio_id: number;
  portfolio_name: string;
  port_type: string;
  current_nav: number;
  margin_locked: number;
  available_cash: number;
  money_market: number;
  cash_buffer_limit: number;
  target_ratio: Record<string, number>;
  current_allocations: Record<string, number>;
  last_rebalance_date: string | null;
  risk_status: string | null;
}

export interface TradePlan {
  plan_id: number;
  portfolio_id: number;
  trade_plan_md: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TradeRecommendation {
  symbol: string;
  side: "Buy" | "Sell";
  qty: number;
  estimated_price: number;
  reason: string;
}

export interface RecommendResponse {
  portfolio_id: number;
  portfolio_name: string;
  current_nav: number;
  target_allocations: Record<string, any>;
  current_allocations: Record<string, any>;
  recommendations: TradeRecommendation[];
  total_drift: number;
}

export interface NavHistoryRecord {
  nav_id: number;
  nav_date: string;
  nav_value: number;
}

export interface NavHistoryResponse {
  portfolio_id: number;
  portfolio_name: string;
  nav_history: NavHistoryRecord[];
}

// === Managed Fund New Data Model ===
export interface MFHolding {
  holding_id: number;
  portfolio_id: number;
  asset: string;
  qty: number;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_pl_pct: number;
  profit_threshold: number;
}

export interface MFOrder {
  order_id: number;
  portfolio_id: number;
  asset: string;
  side: string;
  qty: number;
  price: number | null;
  status: string;
  order_type: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MFOrderCreate {
  asset: string;
  side: string;
  qty: number;
  price?: number | null;
  order_type?: string;
  notes?: string | null;
}

export interface MFOrderUpdate {
  asset?: string;
  side?: string;
  qty?: number;
  price?: number | null;
  notes?: string | null;
}

export interface MFHistory {
  history_id: number;
  portfolio_id: number;
  asset: string;
  side: string;
  qty: number;
  price: number | null;
  status: string;
  order_type: string;
  notes: string | null;
  executed_at: string | null;
}

export interface MFSetting {
  id: number;
  portfolio_id: number;
  target_ratio: Record<string, number> | null;
  global_profit_threshold: number;
  total_invested: number;
  last_rebalance_date: string | null;
}

export interface MFRebalanceRecommendation {
  symbol: string;
  side: string;
  qty: number;
  estimated_price: number;
  reason: string;
  current_allocation: number;
  target_allocation: number;
  drift: number;
}

export interface MFRebalanceResponse {
  portfolio_id: number;
  portfolio_name: string;
  current_nav: number;
  target_allocations: Record<string, number>;
  current_allocations: Record<string, number>;
  recommendations: MFRebalanceRecommendation[];
  total_drift: number;
}

export interface MFAlert {
  asset: string;
  qty: number;
  unrealized_pl_pct: number;
  threshold: number;
  message: string;
}

// === Spread Pairing ===
export interface PortfolioSpreadsData {
  portfolio_id: number;
  portfolio_name: string;
  port_type: string;
  risk_status: string;
  spread_pairs: SpreadPair[];
  unpaired_orders: SpreadOrder[];
}

// === Grid Portfolio ===
export interface PortfolioGridData {
  portfolio_id: number;
  portfolio_name: string;
  port_type: string;
  risk_status: string;
  trade_plan_md: string | null;
  ai_reasoning: string | null;
  ai_risk_insight: string | null;
  spread_pairs: SpreadPair[];
  active_orders: any[];
  recent_trades: any[];
}

// === Link Order Grouping ===
export interface OrderLinkGroup {
  primary: SpreadOrder;
  subs: SpreadOrder[];
  spreadPartner?: SpreadOrder;
  partnerSubs?: SpreadOrder[];
}

// === API response wrapper ===
export interface ApiError {
  status: number;
  message: string;
}
