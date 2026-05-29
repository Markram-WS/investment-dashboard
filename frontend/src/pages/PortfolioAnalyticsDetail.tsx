import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

interface SpreadPair {
  leg_a: {
    order_id: number;
    asset_type: string;
    side: string;
    qty: number;
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
    qty: number;
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
}

interface ActiveOrder {
  order_id: number;
  plan_id: number;
  asset_type: string;
  side: string;
  qty: number;
  entry_price: number;
  current_price: number;
  tp_price: number;
  leverage: number;
  margin_rate: number;
  order_status: string;
  executed_by: string;
  grid_group_id: string;
  spread_pair_id: string;
  created_at: string;
}

interface RecentTrade {
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

interface PortfolioDetail {
  portfolio_id: number;
  portfolio_name: string;
  port_type: string;
  risk_status: string;
  trade_plan_md: string | null;
  ai_reasoning: string | null;
  ai_risk_insight: string | null;
  spread_pairs: SpreadPair[];
  active_orders: ActiveOrder[];
  recent_trades: RecentTrade[];
}

export default function PortfolioAnalyticsDetail() {
  const { portfolio_id } = useParams<{ portfolio_id: string }>();
  const [data, setData] = useState<PortfolioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!portfolio_id) return;
    
    const fetchPortfolioDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/analytics/portfolio/${portfolio_id}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioDetail();
  }, [portfolio_id]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Loading portfolio analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/analytics" className="text-accent hover:underline text-sm">
          ← Back to Analytics Dashboard
        </Link>
      </div>

      <h2 className="text-2xl font-bold mb-2">{data.portfolio_name}</h2>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-gray-600">{data.port_type}</span>
        <span className={`px-2 py-1 rounded text-sm ${
          data.risk_status === 'Safe' ? 'bg-green-100 text-green-800' :
          data.risk_status === 'Warning' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {data.risk_status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Reasoning & Risk Insight - Left Column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-3 text-primary">AI Reasoning</h3>
            {data.ai_reasoning ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.ai_reasoning}</p>
            ) : (
              <p className="text-sm text-gray-500">No AI reasoning available</p>
            )}
          </div>

          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-3 text-primary">Risk Insight</h3>
            {data.ai_risk_insight ? (
              <p className="text-sm text-gray-700">{data.ai_risk_insight}</p>
            ) : (
              <p className="text-sm text-gray-500">No risk insight available</p>
            )}
          </div>
        </div>

        {/* Trade Plan View - Right Columns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-3 text-primary">Trade Plan</h3>
            {data.trade_plan_md ? (
              <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded overflow-x-auto">
                {data.trade_plan_md}
              </pre>
            ) : (
              <p className="text-sm text-gray-500">No trade plan available</p>
            )}
          </div>

          {/* Spread Visual Pairing */}
          {data.spread_pairs.length > 0 && (
            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-3 text-primary">Spread Pairs</h3>
              <div className="space-y-4">
                {data.spread_pairs.map((sp, idx) => (
                  <div key={idx} className="border border-gray-200 rounded p-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Leg A</p>
                        <p className="text-sm"><span className="font-medium">Side:</span> {sp.leg_a.side}</p>
                        <p className="text-sm"><span className="font-medium">Entry:</span> {sp.leg_a.entry_price}</p>
                        <p className="text-sm"><span className="font-medium">Current:</span> {sp.leg_a.current_price}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Leg B</p>
                        <p className="text-sm"><span className="font-medium">Side:</span> {sp.leg_b.side}</p>
                        <p className="text-sm"><span className="font-medium">Entry:</span> {sp.leg_b.entry_price}</p>
                        <p className="text-sm"><span className="font-medium">Current:</span> {sp.leg_b.current_price}</p>
                      </div>
                    </div>
                    {sp.net_pl !== null && (
                      <p className="text-sm mt-2"><span className="font-medium">Net P/L:</span> ${sp.net_pl.toFixed(2)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Orders */}
          {data.active_orders.length > 0 && (
            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-3 text-primary">Active Orders</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Asset</th>
                      <th className="text-left p-2">Side</th>
                      <th className="text-right p-2">Qty</th>
                      <th className="text-right p-2">Entry</th>
                      <th className="text-right p-2">Current</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.active_orders.map(order => (
                      <tr key={order.order_id} className="border-b">
                        <td className="p-2">{order.asset_type}</td>
                        <td className="p-2">{order.side}</td>
                        <td className="text-right p-2">{order.qty}</td>
                        <td className="text-right p-2">{order.entry_price}</td>
                        <td className="text-right p-2">{order.current_price}</td>
                        <td className="p-2">{order.order_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Trades */}
          {data.recent_trades.length > 0 && (
            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-3 text-primary">Recent Trades</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Asset</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-right p-2">P/L</th>
                      <th className="text-left p-2">By</th>
                      <th className="text-left p-2">Exit Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_trades.map(trade => (
                      <tr key={trade.history_id} className="border-b">
                        <td className="p-2">{trade.asset}</td>
                        <td className="p-2">{trade.type}</td>
                        <td className={`text-right p-2 ${trade.realized_pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.realized_pl >= 0 ? '+' : ''}{trade.realized_pl.toFixed(2)}
                        </td>
                        <td className="p-2">{trade.executed_by}</td>
                        <td className="p-2">{trade.exit_date ? new Date(trade.exit_date).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}