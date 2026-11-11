import type {
  GroupOption,
  MFHistory,
  MFHolding,
  MFOrder,
  MFOrderCreate,
  MFOrderUpdate,
  MFRebalanceResponse,
  MFSetting,
  MFAlert,
  OverviewResponse,
  PortfolioData,
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
  margin_locked: number;
  available_cash: number;
  cash_buffer_limit: number;
  risk_status: string | null;
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
  margin_locked?: number;
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
}

export interface PortfolioUpdatePayload {
  portfolio_name?: string;
  port_type?: string;
  target_ratio?: Record<string, unknown> | null;
  current_nav?: number;
  margin_locked?: number;
  cash_buffer_limit?: number;
  available_cash?: number;
  trade_plan_md?: string;
  internal_notes?: string;
  risk_status?: string;
  tags?: Record<string, boolean>;
}

export interface ConnectionTestPayload {
  db_host: string;
  db_port: number;
  db_name: string;
  db_user: string;
  db_password: string;
}

export interface ConnectionTestResult {
  status: string;
  message: string;
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

// Backend `/api/v1/risk/analytics` emits snake_case keys, while the
// RiskAnalytics screen reads camelCase names; getRiskAnalytics adapts between
// the two so both authorities are honoured.
export interface RiskAnalyticsResult {
  sharpeRatio: number;
  maxDrawdown: number;
  var95: number;
  beta: number;
  volatility: number;
  correlation: number;
}

interface RiskAnalyticsResponse {
  sharpe_ratio: number;
  max_drawdown: number;
  var_95: number;
  beta: number;
  volatility: number;
  correlation: number;
}

export interface TradeHistoryRecord {
  history_id: number;
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
  comments: unknown;
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

export interface AssetRecord {
  asset_id: number;
  ticker: string;
  asset_type: string;
  name: string | null;
  source: string;
  group_id: number | null;
  price: number | null;
  change_24h: number | null;
  updated_at: string | null;
}

export interface AssetQuery {
  group_id?: number;
  asset_type?: string;
  source?: string;
}

export interface AssetPayload {
  ticker: string;
  asset_type?: string;
  name?: string;
  source?: string;
  group_id?: number;
}

export interface AssetUpdatePayload {
  name?: string;
  asset_type?: string;
  source?: string;
  group_id?: number | null;
  price?: number;
  change_24h?: number;
}

export interface BatchUpdatePricesResult {
  updated: number;
  tickers: string[];
}

export interface AssetGroupRecord {
  id: number;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface AssetGroupPayload {
  name: string;
}

export interface ZoneGroupRecord extends GroupOption {
  portfolio_id: number;
  range: number | null;
}

export interface OrderPayload {
  order_id?: string;
  plan_id?: number;
  portfolio_id: number;
  asset_type: string;
  side: string;
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
}

export interface OrderUpdatePayload extends Partial<SpreadOrder> {
  // Sent by the zone editor; the active-orders router currently has no `zone`
  // column, so this field is accepted by the caller but not persisted.
  zone?: string;
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

// === API client ===

export const api = {
  // Overview
  getOverview: () => request<OverviewResponse>('/overview/'),

  // Portfolios
  getPortfolios: () => request<PortfolioSummary[]>('/portfolios'),
  getPortfolio: (portfolioId: number) => request<PortfolioRecord>(`/portfolios/${portfolioId}`),
  createPortfolio: (payload: PortfolioPayload) =>
    request<PortfolioRecord>('/portfolios/', {
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

  // Analytics
  getPortfolioAnalytics: (portfolioId: number | string) =>
    request<PortfolioData>(`/analytics/portfolio/${encodeURIComponent(String(portfolioId))}`),
  getPerformance: (portfolioId: number) =>
    request<PerformanceResult>(`/analytics/performance/${portfolioId}`),
  getRiskAnalytics: async () => {
    const raw = await request<RiskAnalyticsResponse>('/risk/analytics');
    return {
      sharpeRatio: raw.sharpe_ratio,
      maxDrawdown: raw.max_drawdown,
      var95: raw.var_95,
      beta: raw.beta,
      volatility: raw.volatility,
      correlation: raw.correlation,
    };
  },

  // Trade history
  getTradeHistory: (portfolioId: number, offset?: number, limit?: number) => {
    const query = new URLSearchParams({ portfolio_id: String(portfolioId) });
    if (offset != null) query.set('offset', String(offset));
    if (limit != null) query.set('limit', String(limit));
    return request<TradeHistoryRecord[]>(`/trade-history/?${query.toString()}`);
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

  // Assets
  getAssets: (params: AssetQuery = {}) => {
    const query = new URLSearchParams();
    if (params.group_id != null) query.set('group_id', String(params.group_id));
    if (params.asset_type) query.set('asset_type', params.asset_type);
    if (params.source) query.set('source', params.source);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<AssetRecord[]>(`/assets${suffix}`);
  },
  createAsset: (payload: AssetPayload) =>
    request<AssetRecord>('/assets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAsset: (assetId: number, payload: AssetUpdatePayload) =>
    request<AssetRecord>(`/assets/${assetId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteAsset: (assetId: number) =>
    request<void>(`/assets/${assetId}`, { method: 'DELETE' }),
  updateAssetPrice: (assetId: number) =>
    request<AssetRecord>(`/assets/${assetId}/update-price`, { method: 'POST' }),
  batchUpdatePrices: () =>
    request<BatchUpdatePricesResult>('/assets/batch-update-prices', { method: 'POST' }),
  syncAllAssets: () =>
    request<AssetRecord[]>('/assets/sync-from-all', { method: 'POST' }),

  // Asset groups
  getAssetGroups: () => request<AssetGroupRecord[]>('/asset-groups'),
  createAssetGroup: (payload: AssetGroupPayload) =>
    request<AssetGroupRecord>('/asset-groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAssetGroup: (groupId: number, payload: AssetGroupPayload) =>
    request<AssetGroupRecord>(`/asset-groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteAssetGroup: (groupId: number) =>
    request<void>(`/asset-groups/${groupId}`, { method: 'DELETE' }),

  // Order groups ("zones")
  getZoneGroups: (portfolioId: number) =>
    request<ZoneGroupRecord[]>(`/orders-groups/?portfolio_id=${portfolioId}`),
  createZoneGroup: (portfolioId: number, payload: Record<string, unknown>) =>
    request<ZoneGroupRecord>(`/orders-groups/?portfolio_id=${portfolioId}`, {
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
    request<SpreadOrder>('/orders/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateOrder: (orderId: string, payload: OrderUpdatePayload, portfolioId?: number) => {
    const suffix = portfolioId != null ? `?portfolio_id=${portfolioId}` : '';
    return request<SpreadOrder>(`/orders/${encodeURIComponent(orderId)}${suffix}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  cancelOrder: (orderId: string, portfolioId?: number) => {
    const suffix = portfolioId != null ? `?portfolio_id=${portfolioId}` : '';
    return request<CancelOrderResult>(
      `/orders/${encodeURIComponent(orderId)}/status${suffix}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ new_status: 'CANCELED' }),
      },
    );
  },
  closeOrder: (orderId: string, payload: CloseOrderPayload, portfolioId?: number) => {
    const suffix = portfolioId != null ? `?portfolio_id=${portfolioId}` : '';
    return request<CloseOrderResult>(
      `/orders/${encodeURIComponent(orderId)}/close${suffix}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
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
};
