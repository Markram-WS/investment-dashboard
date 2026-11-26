// === Portfolio Overview ===
export interface PortfolioOverviewItem {
  portfolio_id: number;
  portfolio_name: string;
  margin: number;
  buffer: number;
  available_cash: number;
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
  total_pl: number;
  pool_health_index: number;
  money_reserve_status: string;
  portfolios: PortfolioOverviewItem[];
}

// === Portfolio Analytics ===

/** Which store an active order or history row came from. */
export type OrderSource = "dashboard" | "mapped";
export type HistorySource = OrderSource;

/** Write capabilities for a mapped portfolio's connected (foreign) active orders. */
export interface MappedOrderWriteCapabilities {
  insert: boolean;
  update: boolean;
  delete: boolean;
  /** Canonical order fields writable on the foreign table. */
  fields: string[];
  key_generated: boolean;
}

/** Local option CRUD always lives in the dashboard PostgreSQL. */
export interface DashboardOptionWrites {
  insert: boolean;
  update: boolean;
  delete: boolean;
}

/**
 * Store-scoped write capabilities for a mapped portfolio.
 *
 * `mapped === null` when the connected database is unreachable or the mapping
 * has no write block; `dashboard_options` stays true so local option CRUD is
 * still offered.
 */
export interface OrderWrites {
  mapped: MappedOrderWriteCapabilities | null;
  dashboard_options: DashboardOptionWrites;
}

/** Compact mapped-write descriptor handed to the order form modals. */
export interface MappedOrderFields {
  fields: string[];
  keyGenerated: boolean;
}

export interface SpreadOrder {
  order_id: string;
  /** Store that owns this row; source-qualified identity is (source, order_id). */
  order_source?: OrderSource | null;
  /** Foreign broker's human order number for a mapped order. */
  order_ref?: string | null;
  asset_type: string;
  /** Product ticker that owns this order's contract spec; "" when none resolves. */
  underlying: string;
  side: string;
  qty: number | string;
  entry_price: number | null;
  current_price: number | null;
  /** Foreign broker mark (display only; Net P&L uses current_price). */
  mark_price?: number | null;
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
  /** Foreign broker fee on a mapped order (display/edit only). */
  fee?: number | null;
  link_type?: 'spread' | 'pending_close' | 'primary' | 'none';
  remark?: string | null;
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
  /** Legacy integer id retained for compatibility; identity is (source, key). */
  history_id: number;
  history_source?: HistorySource | null;
  history_key?: string;
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

/** Option bucket keyed by side × option type. */
export interface PortfolioRiskBucket {
  orders: number;
  lots: number;
  avg_premium: number;
  pl: number;
}

/** Computed risk model for one portfolio (no snapshot: reads the live asset row). */
export interface PortfolioRisk {
  x_amount: number;
  multiplier: number;
  margin_rate: number;
  margin_locked: number;
  available_cash: number;
  available_at_x: number;
  risk: number;
  eq: {
    orders: number;
    lots: number;
    avg_price: number;
    size0: number;
    size_at_x_mark: number;
    size_at_x_entry: number;
    pl: number;
  };
  options: {
    buckets: Record<"short_call" | "short_put" | "long_call" | "long_put", PortfolioRiskBucket>;
    unclassified: number;
    net_premium: number;
    pl: number;
  };
  pl_total: number;
  net_premium: number;
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
  /** Computed by the backend; never written by the client. */
  margin_locked: number | null;
  broker_id: number | null;
  /** Broker code for the portfolio; null when the portfolio has no broker. */
  broker_code?: string | null;
  product_ticker: string | null;
  product_tickers?: string[] | null;
  /** Identity type for the portfolio's multiplier/margin display. */
  product_type?: string | null;
  x_amount: number;
  initial_capital: number;
  cash_buffer_limit: number | null;
  tags: Record<string, boolean> | null;
  risk?: PortfolioRisk | null;
  spread_pairs: SpreadPair[];
  active_orders: SpreadOrder[];
  recent_trades: RecentTrade[];
  /** Mapped external databases are read-through: every write is refused. */
  read_only?: boolean;
  /** Built-in mapping template name for a custom portfolio; null when unmapped. */
  mapping_template?: string | null;
  /** Foreign-write capabilities; null/absent when the mapping has no write block. */
  order_writes?: OrderWrites | null;
  /** Set only when a mapped database was unreachable; the rest is metadata. */
  load_error?: string | null;
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
  remark: unknown;
  order_remark?: string | null;
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
  product_type: string | null;
  current_nav: number;
  margin_locked: number;
  available_cash: number;
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
  target_allocations: Record<string, number>;
  current_allocations: Record<string, number>;
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
  /** Relative share of this holding's underlying-group drift; null/0 means market-value fallback. */
  rebalance_weight: number | null;
  /** Registry identity derived from `asset`; null when unregistered. */
  broker_id: number | null;
  broker_code: string | null;
  underlying: string | null;
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

/** How per-group target shares are chosen: equal weights or stored percentages. */
export type MFAllocationMode = "neutral" | "weight";

export interface MFSetting {
  id: number;
  portfolio_id: number;
  /** Allocation-group label -> percent (0..100); null until targets are set. */
  target_ratio: Record<string, number> | null;
  allocation_mode: MFAllocationMode;
  total_invested: number;
  last_rebalance_date: string | null;
}

export interface MFRebalanceGroup {
  /** Allocation-group label (registry underlying or "Unassigned"). */
  label: string;
  /** Sum(qty × current_price) for the group's holdings, live marks. */
  current_value: number;
  /** allocation_base × target_pct / 100. */
  target_value: number;
  /** Current share of the allocation base (e.g. 24.71). */
  current_pct: number;
  /** Target share of the allocation base (e.g. 50.0). */
  target_pct: number;
  /** |target_pct − current_pct| rounded to 0.01. */
  drift: number;
  /** Signed sum of the group's order lines; 0 when the group needs no trade. */
  order_value: number;
}

export interface MFRebalanceRecommendation {
  symbol: string;
  underlying: string;
  side: string;
  qty: number;
  estimated_price: number;
  /** Positive currency magnitude of the order; `side` supplies the sign. */
  estimated_value: number;
  reason: string;
  current_allocation: number;
  target_allocation: number;
  drift: number;
}

export interface MFRebalanceResponse {
  portfolio_id: number;
  portfolio_name: string;
  current_nav: number;
  /** Live holdings + available cash + calculation-only top-up. */
  allocation_base: number;
  target_allocations: Record<string, number>;
  current_allocations: Record<string, number>;
  recommendations: MFRebalanceRecommendation[];
  /** One aggregate row per allocation group, first-seen order, no-trade groups included. */
  groups: MFRebalanceGroup[];
  total_drift: number;
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
  spread_pairs: SpreadPair[];
  active_orders: SpreadOrder[];
  recent_trades: RecentTrade[];
  read_only?: boolean;
  mapping_template?: string | null;
  order_writes?: OrderWrites | null;
  /** Set only when a mapped database was unreachable; the row is still rendered. */
  load_error?: string | null;
}

// === Link Order Grouping ===
export interface OrderLinkGroup {
  primary: SpreadOrder;
  subs: SpreadOrder[];
  spreadPartner?: SpreadOrder;
  partnerSubs?: SpreadOrder[];
}

// === Asset registry: products, symbols, quotes ===

export type MarginMode = "notional" | "premium" | "span";

/** Broker-scoped contract product (the main asset registry). */
export interface AssetProduct {
  product_id: number;
  ticker: string | null;
  broker_id: number | null;
  broker_code: string | null;
  asset_type: string | null;
  multiplier: number | null;
  margin_rate: number | null;
  margin_mode: MarginMode | string;
  source: string;
  /** Only used when margin_mode is 'span'; owned by the product identity. */
  margin_per_contract?: number | null;
  group_id: number | null;
  name: string | null;
  symbol_count: number;
}

/** Contract symbol joined to its latest quote. */
export interface AssetSymbol {
  symbol_id: number;
  product_id: number;
  price_symbol: string | null;
  sync_symbol: string;
  contract_kind: string;
  option_type: string | null;
  expiry_date: string | null;
  strike_price: number | null;
  multiplier_override: number | null;
  margin_rate_override: number | null;
  margin_per_contract: number | null;
  /** Symbol override when set, else the product default. */
  multiplier_effective: number;
  /** Symbol override when set, else the product default. */
  margin_rate_effective: number;
  /** True when the multiplier comes from the product (no symbol override). */
  multiplier_inherited: boolean;
  /** True when the margin rate comes from the product (no symbol override). */
  margin_rate_inherited: boolean;
  price: number | null;
  change_24h: number | null;
  updated_at: string | null;
}

/** Product detail; only this shape carries the symbol list. */
export interface AssetProductDetail extends AssetProduct {
  symbols: AssetSymbol[];
}

export interface AssetProductQuery {
  broker_id?: number;
  asset_type?: string;
  group_id?: number;
  source?: string;
}

export interface AssetSymbolQuery {
  product_id?: number;
}

export interface AssetProductPayload {
  ticker?: string | null;
  broker_id?: number | null;
  asset_type?: string | null;
  multiplier?: number;
  margin_rate?: number;
  margin_mode?: string;
  margin_per_contract?: number | null;
  source?: string;
  group_id?: number | null;
  name?: string | null;
}

export interface AssetProductUpdatePayload {
  ticker?: string;
  broker_id?: number | null;
  asset_type?: string | null;
  multiplier?: number;
  margin_rate?: number;
  margin_mode?: string;
  margin_per_contract?: number | null;
  source?: string;
  group_id?: number | null;
  name?: string | null;
}

export interface AssetSymbolPayload {
  price_symbol?: string;
  sync_symbol: string;
  /** Option terms only; omitted for non-option identities. */
  option_type?: string | null;
  expiry_date?: string | null;
  strike_price?: number | null;
  multiplier_override?: number | null;
  margin_rate_override?: number | null;
}

export interface AssetSymbolUpdatePayload {
  price_symbol?: string | null;
  sync_symbol?: string;
  /** Move the symbol to another product; omitted when the product is unchanged. */
  product_id?: number;
  /** Option terms only; omitted for non-option identities. */
  option_type?: string | null;
  expiry_date?: string | null;
  strike_price?: number | null;
  multiplier_override?: number | null;
  margin_rate_override?: number | null;
}

export interface AssetQuotePayload {
  price?: number | null;
  change_24h?: number | null;
}

export interface BatchUpdatePricesResult {
  updated: number;
  tickers: string[];
}

/** One existing same-broker product offered for a proposed symbol. */
export interface SyncProposalProduct {
  product_id: number;
  ticker: string | null;
  asset_type: string | null;
  multiplier: number | null;
  margin_rate: number | null;
  margin_mode: string;
  symbol_count: number;
}

export interface SyncProposalCreate {
  /** Order symbol the create branch will use as the contract's price symbol. */
  symbol: string;
}

export interface SyncProposalItem {
  symbol: string;
  broker_id: number | null;
  broker_code: string | null;
  broker_required: boolean;
  /** True when this normalized dashboard key already has a contract spec in the pair's broker scope. */
  resolved: boolean;
  products: SyncProposalProduct[];
  /** Asset types recorded on the orders behind this pair — a hint, never a default. */
  order_asset_types: string[];
  create: SyncProposalCreate;
}

export interface AssetSyncProposal {
  items: SyncProposalItem[];
}

/** Exactly one of `product_id` or `create_product` per proposed pair. */
export interface AssetSyncChoice {
  symbol: string;
  broker_id: number | null;
  product_id?: number;
  create_product?: boolean;
  create_source?: 'yfinance' | 'tfex' | 'manual';
  create_sync_symbol?: string;
  create_asset_type?: 'stock' | 'future' | 'option' | 'crypto' | 'mutual_fund';
  /** Optional grouping ticker for the new product; "" means no underlying. */
  create_underlying?: string;
}

export interface AssetSyncApplyResult {
  created: number;
  choices: number;
}

// === API response wrapper ===
export interface ApiError {
  status: number;
  message: string;
}
