import type {
  AssetProduct,
  AssetProductDetail,
  AssetProductPayload,
  AssetProductQuery,
  AssetProductUpdatePayload,
  AssetQuotePayload,
  AssetSymbol,
  AssetSymbolPayload,
  AssetSymbolQuery,
  AssetSymbolUpdatePayload,
  AssetSyncApplyResult,
  AssetSyncChoice,
  AssetSyncProposal,
  BatchUpdatePricesResult,
  GroupOption,
  MFHistory,
  MFHolding,
  MFOrder,
  MFOrderCreate,
  MFOrderUpdate,
  MFRebalanceResponse,
  MFSetting,
  MFAlert,
  MFSyncPricesResult,
  OrderSource,
  OverviewResponse,
  PortfolioData,
  PortfolioRisk,
  SpreadOrder,
} from '../types';

// === Response / payload shapes not exported by ../types ===

export interface ApiError extends Error {
  status: number;
  body: string;
}

export interface PortfolioSummary {
  portfolio_id: number;
  portfolio_name: string;
  risk_status: string | null;
  available_cash: number | null;
  port_type: string;
  is_custom: boolean;
}

export interface PortfolioRecord {
  portfolio_id: number;
  portfolio_name: string;
  port_type: string;
  is_custom?: boolean;
  target_ratio: Record<string, number>;
  current_allocations: Record<string, number>;
  current_nav: number;
  /** Computed by the backend from open orders; ignored on write. */
  margin_locked: number;
  broker_id: number | null;
  broker_code?: string | null;
  product_ticker: string | null;
  product_tickers?: string[] | null;
  product_type?: string | null;
  x_amount: number;
  initial_capital: number;
  available_cash: number;
  cash_buffer_limit: number;
  risk_status: string | null;
  risk?: PortfolioRisk | null;
  last_rebalance_date: string | null;
  tags?: Record<string, boolean> | null;
  trade_plan_md?: string | null;
  internal_notes?: string | null;
  db_host?: string | null;
  db_port?: number | null;
  db_name?: string | null;
  db_user?: string | null;
}

export interface PortfolioPayload {
  portfolio_name: string;
  port_type: string;
  target_ratio?: Record<string, number> | null;
  current_nav?: number | null;
  broker_id?: number | null;
  product_ticker?: string | null;
  product_tickers?: string[] | null;
  product_type?: string | null;
  x_amount?: number;
  initial_capital?: number;
  cash_buffer_limit?: number;
  available_cash?: number;
  trade_plan_md?: string;
  risk_status?: string;
  tags?: Record<string, boolean>;
  db_host?: string;
  db_port?: number;
  db_name?: string;
  db_user?: string;
  db_password?: string;
  /** Mapping JSON for a custom portfolio; null keeps the legacy table layout. */
  mapping_config?: unknown;
}

export interface PortfolioUpdatePayload {
  portfolio_name?: string;
  port_type?: string;
  target_ratio?: Record<string, unknown> | null;
  current_nav?: number;
  broker_id?: number | null;
  product_ticker?: string | null;
  product_tickers?: string[] | null;
  product_type?: string | null;
  x_amount?: number;
  initial_capital?: number;
  cash_buffer_limit?: number;
  available_cash?: number;
  trade_plan_md?: string;
  internal_notes?: string;
  risk_status?: string;
  tags?: Record<string, boolean>;
}

export interface BrokerRecord {
  id: number;
  code: string;
  name: string;
  default_margin_rate: number;
  currency: string;
}

export interface ConnectionTestPayload {
  db_host: string;
  db_port: number;
  db_name: string;
  db_user: string;
  db_password: string;
  mapping_config?: unknown;
}

/** Row counts and a sample mapped order from a mapped test connection. */
export interface MappingDiagnostics {
  orders_rows?: number | null;
  history_rows?: number | null;
  account_rows?: number | null;
  sample_order?: unknown;
  errors?: string[];
}

export interface ConnectionTestResult {
  status: string;
  message: string;
  diagnostics?: MappingDiagnostics;
}

/** One built-in foreign-schema mapping. */
export interface MappingTemplate {
  name: string;
  label: string;
  config: unknown;
}

/** Stored connection of a custom portfolio; the password is never returned. */
export interface PortfolioConnection {
  db_host: string | null;
  db_port: number | null;
  db_name: string | null;
  db_user: string | null;
  mapping_config: unknown | null;
}

export interface ConnectionUpdatePayload {
  db_host?: string;
  db_port?: number;
  db_name?: string;
  db_user?: string;
  db_password?: string;
  mapping_config?: unknown;
}

export interface PerformanceEquityPoint {
  date: string;
  cumulative_pl: number;
}

export interface PerformancePayoffBar {
  date: string;
  realized_pl: number;
}

export interface PerformanceResult {
  equity_curve: PerformanceEquityPoint[];
  payoff_data: PerformancePayoffBar[];
  total_pl: number;
}

export interface TradeHistoryRecord {
  /** Legacy integer id retained for compatibility; identity is (source, key). */
  history_id: number;
  history_source?: OrderSource | null;
  /** Stable string identity within its source; sameness across sources is not identity. */
  history_key?: string;
  portfolio_id: number;
  portfolio_name: string;
  type: string;
  asset: string;
  amount: number | null;
  entry_price?: number | null;
  exit_price: number | null;
  realized_pl: number | null;
  executed_by: string;
  decision_note: string | null;
  entry_date: string | null;
  exit_date: string | null;
  order_id?: string | null;
  close_order_id?: string | null;
  flow: string | null;
  remark: unknown;
  order_remark?: string | null;
}

export interface TransactionRecord {
  transaction_id: number;
  portfolio_id?: number | null;
  portfolio_name?: string | null;
  transaction_type: string;
  asset?: string | null;
  amount?: number | null;
  source_portfolio_id?: number | null;
  destination_portfolio_id?: number | null;
  executed_by: string;
  status: string;
  reference_id?: string | null;
  audit_labels?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
  flow?: string | null;
  balance_delta?: number | null;
}

export interface TransactionPayload {
  transaction_type: string;
  asset: string;
  amount: number;
  source_portfolio_id?: number | null;
  destination_portfolio_id?: number | null;
  executed_by: string;
  status?: string;
  reference_id?: string;
  audit_labels?: Record<string, unknown>;
}

export interface TransferPayload {
  source_portfolio_id: number;
  destination_portfolio_id: number;
  amount: number;
  asset?: string;
  executed_by?: string;
  reference_id?: string;
  audit_labels?: Record<string, unknown>;
  // Present on some call sites; the backend ignores unknown fields.
  confirmed_by?: string;
}

export interface TransferRecord {
  transaction_id: number;
  source_portfolio_id: number;
  destination_portfolio_id: number;
  amount: number;
  asset: string;
  status: string;
  executed_by: string;
  reference_id: string | null;
  source_balance_before: number | null;
  source_balance_after: number | null;
  destination_balance_before: number | null;
  destination_balance_after: number | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface ZoneGroupRecord extends GroupOption {
  portfolio_id: number;
  range: number | null;
}

export interface OrderPayload {
  order_id?: string;
  /** Foreign broker order number; only sent on the mapped write path. */
  order_ref?: string;
  plan_id?: number;
  portfolio_id: number;
  asset_type?: string;
  side?: string;
  qty?: number | null;
  entry_price?: number | null;
  current_price?: number | null;
  tp_price?: number | null;
  sl_price?: number | null;
  leverage?: number | null;
  margin_rate?: number | null;
  group_id?: number | null;
  order_status?: string;
  linked_order_id?: string | null;
  contract_type?: string;
  direction?: string;
  option_type?: string;
  expiry_date?: string;
  strike_price?: number;
  cost?: number;
  /** Foreign fee; only sent on the mapped write path. */
  fee?: number | null;
  remark?: string | null;
}

export interface OrderUpdatePayload extends Partial<SpreadOrder> {
  // Sent by the zone editor; the active-orders router currently has no `zone`
  // column, so this field is accepted by the caller but not persisted.
  zone?: string;
  /** Foreign fee; only sent on the mapped write path. */
  fee?: number | null;
}

export interface CancelOrderResult {
  order_id: string;
  order_status: string;
  history_id?: number;
}

export interface CloseOrderPayload {
  close_order_id?: string;
  exit_price?: number | null;
  realized_pl?: number | null;
  decision_note?: string;
  cost?: number;
}

export interface CloseOrderResult {
  order_id: string;
  order_status: string;
  history_id: number;
  auto_closed?: { order_id: string; history_id: number }[];
  paired_order_id?: string;
}

export interface LinkOrderResult {
  order_id: string;
  linked_order_id: string | null;
}

export interface UnlinkOrderResult {
  order_id: string;
  linked_order_id: null;
  unlinked_partner: string | null;
}

export interface MFAlertsResult {
  alerts: MFAlert[];
}

export interface MFHoldingUpdatePayload {
  // Accepted by MFEditPortfolioModal; the backend MFOrderUpdate schema does
  // not declare profit_threshold, so it is currently dropped by FastAPI.
  profit_threshold?: number;
  qty?: number;
  price?: number;
  notes?: string;
}

export interface MFSellPayload {
  qty: number;
  price?: number | null;
}

// === Transport ===

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = init
    ? await fetch(`/api/v1${path}`, { ...init, headers })
    : await fetch(`/api/v1${path}`);
  const text = await response.text();

  if (!response.ok) {
    const error = new Error(
      `API ${response.status} ${response.statusText}${text ? `: ${text}` : ''}`,
    ) as ApiError;
    error.status = response.status;
    error.body = text;
    throw error;
  }

  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Query string for a single-order call. Mapped portfolios require
 * `order_source`; non-mapped callers omit it and keep today's URL.
 */
const orderQuery = (portfolioId?: number, orderSource?: OrderSource): string => {
  const query = new URLSearchParams();
  if (portfolioId != null) query.set('portfolio_id', String(portfolioId));
  if (orderSource) query.set('order_source', orderSource);
  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
};

// === API client ===

export const api = {
  // Overview
  getOverview: () => request<OverviewResponse>('/overview'),

  // Portfolios
  getPortfolios: () => request<PortfolioSummary[]>('/portfolios'),
  getPortfolio: (portfolioId: number) => request<PortfolioRecord>(`/portfolios/${portfolioId}`),
  createPortfolio: (payload: PortfolioPayload) =>
    request<PortfolioRecord>('/portfolios', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePortfolio: (portfolioId: number, payload: PortfolioUpdatePayload) =>
    request<PortfolioRecord>(`/portfolios/${portfolioId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deletePortfolio: (portfolioId: number) =>
    request<{ detail: string }>(`/portfolios/${portfolioId}`, { method: 'DELETE' }),
  testConnection: (payload: ConnectionTestPayload) =>
    request<ConnectionTestResult>('/portfolios/test-connection', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  /** Test a portfolio's stored (encrypted) credentials; never re-sends secrets. */
  testStoredConnection: (
    portfolioId: number,
    payload?: { mapping_config?: unknown },
  ) =>
    request<ConnectionTestResult>(`/portfolios/${portfolioId}/test-connection`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),
  getMappingTemplates: () => request<MappingTemplate[]>('/portfolios/mapping-templates'),
  getConnection: (portfolioId: number) =>
    request<PortfolioConnection>(`/portfolios/${portfolioId}/connection`),
  updateConnection: (portfolioId: number, payload: ConnectionUpdatePayload) =>
    request<unknown>(`/portfolios/${portfolioId}/connection`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Brokers
  getBrokers: () => request<BrokerRecord[]>('/brokers'),
  createBroker: (payload: {
    code: string;
    name: string;
    default_margin_rate?: number;
    currency?: string;
  }) =>
    request<BrokerRecord>('/brokers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Analytics
  getPortfolioAnalytics: (portfolioId: number | string) =>
    request<PortfolioData>(`/analytics/portfolio/${encodeURIComponent(String(portfolioId))}`),
  getPerformance: (portfolioId: number) =>
    request<PerformanceResult>(`/analytics/performance/${portfolioId}`),

  // Trade history
  getTradeHistory: (portfolioId: number, offset?: number, limit?: number) => {
    const query = new URLSearchParams({ portfolio_id: String(portfolioId) });
    if (offset != null) query.set('offset', String(offset));
    if (limit != null) query.set('limit', String(limit));
    return request<TradeHistoryRecord[]>(`/trade-history?${query.toString()}`);
  },

  // Transactions
  getTransactions: (portfolioId?: number, offset?: number, limit?: number) => {
    const query = new URLSearchParams();
    if (portfolioId != null) query.set('portfolio_id', String(portfolioId));
    if (offset != null) query.set('offset', String(offset));
    if (limit != null) query.set('limit', String(limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<TransactionRecord[]>(`/transactions${suffix}`);
  },
  createTransaction: (payload: TransactionPayload) =>
    request<TransactionRecord>('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Transfers
  createTransfer: (payload: TransferPayload) =>
    request<TransferRecord>('/transfers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  confirmTransfer: (transactionId: number, confirmationToken = 'auto-confirm', confirmedBy = 'Manual') =>
    request<TransferRecord>(`/transfers/${transactionId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        confirmation_token: confirmationToken,
        confirmed_by: confirmedBy,
      }),
    }),

  // Asset registry: products
  getProducts: (params: AssetProductQuery = {}) => {
    const query = new URLSearchParams();
    if (params.broker_id != null) query.set('broker_id', String(params.broker_id));
    if (params.asset_type) query.set('asset_type', params.asset_type);
    if (params.group_id != null) query.set('group_id', String(params.group_id));
    if (params.source) query.set('source', params.source);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<AssetProduct[]>(`/assets/products${suffix}`);
  },
  getProduct: (productId: number) =>
    request<AssetProductDetail>(`/assets/products/${productId}`),
  createProduct: (payload: AssetProductPayload) =>
    request<AssetProduct>('/assets/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProduct: (productId: number, payload: AssetProductUpdatePayload) =>
    request<AssetProduct>(`/assets/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteProduct: (productId: number) =>
    request<void>(`/assets/products/${productId}`, { method: 'DELETE' }),

  // Asset registry: symbols + quotes
  getSymbols: (params: AssetSymbolQuery = {}) => {
    const query = new URLSearchParams();
    if (params.product_id != null) query.set('product_id', String(params.product_id));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<AssetSymbol[]>(`/assets/symbols${suffix}`);
  },
  createSymbol: (productId: number, payload: AssetSymbolPayload) =>
    request<AssetSymbol>(`/assets/products/${productId}/symbols`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSymbol: (symbolId: number, payload: AssetSymbolUpdatePayload) =>
    request<AssetSymbol>(`/assets/symbols/${symbolId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteSymbol: (symbolId: number) =>
    request<void>(`/assets/symbols/${symbolId}`, { method: 'DELETE' }),
  updateSymbolQuote: (symbolId: number, payload: AssetQuotePayload) =>
    request<AssetSymbol>(`/assets/symbols/${symbolId}/quote`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateSymbolPrice: (symbolId: number) =>
    request<AssetSymbol>(`/assets/symbols/${symbolId}/update-price`, { method: 'POST' }),
  batchUpdatePrices: () =>
    request<BatchUpdatePricesResult>('/assets/symbols/batch-update-prices', { method: 'POST' }),

  // Asset registry: explicit sync proposal / apply
  getAssetProposal: () => request<AssetSyncProposal>('/assets/proposal'),
  applyAssetProposal: (choices: AssetSyncChoice[]) =>
    request<AssetSyncApplyResult>('/assets/apply', {
      method: 'POST',
      body: JSON.stringify({ choices }),
    }),

  // Order groups ("zones")
  getZoneGroups: (portfolioId: number) =>
    request<ZoneGroupRecord[]>(`/orders-groups?portfolio_id=${portfolioId}`),
  createZoneGroup: (portfolioId: number, payload: Record<string, unknown>) =>
    request<ZoneGroupRecord>(`/orders-groups?portfolio_id=${portfolioId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateZoneGroup: (groupId: number, payload: Record<string, unknown>, portfolioId?: number) => {
    const suffix = portfolioId != null ? `?portfolio_id=${portfolioId}` : '';
    return request<ZoneGroupRecord>(`/orders-groups/${groupId}${suffix}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  deleteZoneGroup: (groupId: number, portfolioId?: number) => {
    const suffix = portfolioId != null ? `?portfolio_id=${portfolioId}` : '';
    return request<void>(`/orders-groups/${groupId}${suffix}`, { method: 'DELETE' });
  },

  // Active orders
  createOrder: (payload: OrderPayload) =>
    request<SpreadOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getOrder: (orderId: string, portfolioId?: number, orderSource?: OrderSource) =>
    request<SpreadOrder>(
      `/orders/${encodeURIComponent(orderId)}${orderQuery(portfolioId, orderSource)}`,
    ),
  updateOrder: (
    orderId: string,
    payload: OrderUpdatePayload,
    portfolioId?: number,
    orderSource?: OrderSource,
  ) =>
    request<SpreadOrder>(
      `/orders/${encodeURIComponent(orderId)}${orderQuery(portfolioId, orderSource)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),
  cancelOrder: (orderId: string, portfolioId?: number, orderSource?: OrderSource) =>
    request<CancelOrderResult>(
      `/orders/${encodeURIComponent(orderId)}/status${orderQuery(portfolioId, orderSource)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ new_status: 'CANCELED' }),
      },
    ),
  closeOrder: (
    orderId: string,
    payload: CloseOrderPayload,
    portfolioId?: number,
    orderSource?: OrderSource,
  ) =>
    request<CloseOrderResult>(
      `/orders/${encodeURIComponent(orderId)}/close${orderQuery(portfolioId, orderSource)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
  linkOrder: (orderId: string, targetOrderId: string, portfolioId?: number) => {
    const suffix = portfolioId != null ? `?portfolio_id=${portfolioId}` : '';
    return request<LinkOrderResult>(
      `/orders/${encodeURIComponent(orderId)}/link${suffix}`,
      {
        method: 'POST',
        body: JSON.stringify({ target_order_id: targetOrderId }),
      },
    );
  },
  unlinkOrder: (orderId: string, portfolioId?: number) => {
    const suffix = portfolioId != null ? `?portfolio_id=${portfolioId}` : '';
    return request<UnlinkOrderResult>(
      `/orders/${encodeURIComponent(orderId)}/unlink${suffix}`,
      { method: 'POST' },
    );
  },

  // Managed funds
  mfSettings: (portfolioId: number) =>
    request<MFSetting>(`/managed-funds/${portfolioId}/settings`),
  mfUpdateSettings: (
    portfolioId: number,
    payload: { target_ratio?: Record<string, number> | null; global_profit_threshold?: number },
  ) =>
    request<MFSetting>(`/managed-funds/${portfolioId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  mfHoldings: (portfolioId: number) =>
    request<MFHolding[]>(`/managed-funds/${portfolioId}/holdings`),
  mfUpdateHolding: (portfolioId: number, holdingId: number, payload: MFHoldingUpdatePayload) =>
    request<MFHolding>(`/managed-funds/${portfolioId}/holdings/${holdingId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  mfSellHolding: (portfolioId: number, holdingId: number, payload: MFSellPayload) =>
    request<MFOrder>(`/managed-funds/${portfolioId}/holdings/${holdingId}/sell`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  mfOrders: (portfolioId: number) =>
    request<MFOrder[]>(`/managed-funds/${portfolioId}/orders`),
  mfCreateOrder: (portfolioId: number, payload: MFOrderCreate) =>
    request<MFOrder>(`/managed-funds/${portfolioId}/orders`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  mfUpdateOrder: (portfolioId: number, orderId: number, payload: MFOrderUpdate) =>
    request<MFOrder>(`/managed-funds/${portfolioId}/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  mfConfirmOrder: (portfolioId: number, orderId: number) =>
    request<MFOrder>(`/managed-funds/${portfolioId}/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'done' }),
    }),
  mfCancelOrder: (portfolioId: number, orderId: number) =>
    request<MFOrder>(`/managed-funds/${portfolioId}/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    }),
  mfHistory: (portfolioId: number) =>
    request<MFHistory[]>(`/managed-funds/${portfolioId}/history`),
  mfCalculateRebalance: (portfolioId: number) =>
    request<MFRebalanceResponse>(`/managed-funds/${portfolioId}/rebalance/calculate`, {
      method: 'POST',
    }),
  mfAlerts: (portfolioId: number) =>
    request<MFAlertsResult>(`/managed-funds/${portfolioId}/alerts`),
  mfSyncPrices: (portfolioId: number) =>
    request<MFSyncPricesResult>(`/managed-funds/${portfolioId}/sync-prices`, {
      method: 'POST',
    }),
};
