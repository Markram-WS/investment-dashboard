// Types for Portfolio Grid components

export interface SpreadOrder {
  order_id: number;
  asset_type: string;
  side: string;
  qty: number | string;
  entry_price: number | null;
  current_price: number | null;
  tp_price: number | null;
  leverage: number | null;
  margin_rate: number | null;
  order_status: string;
  executed_by: string;
  created_at: string | null;
  spread_pair_id: string | null;
  zone: string | null;
}

export interface SpreadPair {
  pair_id: string;
  leg_a: {
    order_id: number;
    asset_type: string;
    side: string;
    qty: number | string;
    entry_price: number | null;
    current_price: number | null;
    tp_price: number | null;
    leverage: number | null;
    margin_rate: number | null;
    order_status: string;
    executed_by: string;
    created_at: string | null;
  };
  leg_b: {
    order_id: number;
    asset_type: string;
    side: string;
    qty: number | string;
    entry_price: number | null;
    current_price: number | null;
    tp_price: number | null;
    leverage: number | null;
    margin_rate: number | null;
    order_status: string;
    executed_by: string;
    created_at: string | null;
  };
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
  trade_plan_md: string | null;
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