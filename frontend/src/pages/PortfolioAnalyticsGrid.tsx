import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// Types based on backend response
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

interface PortfolioGridData {
  portfolio_id: number;
  portfolio_name: string;
  port_type: string;
  risk_status: string;
  trade_plan_md: string | null;
  ai_reasoning: string | null;
  ai_risk_insight: string | null;
  spread_pairs: SpreadPair[];
  active_orders: any[]; // Simplified for now
  recent_trades: any[]; // Simplified for now
}

const PortfolioAnalyticsGrid: React.FC = () => {
  const [data, setData] = useState<PortfolioGridData[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/v1/analytics/portfolio-grid');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result: PortfolioGridData[] = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-4">Loading portfolio analytics...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!data || data.length === 0) {
    return <div className="p-4">No portfolio data available.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">
        Portfolio Analytics Grid
      </h2>
      <div className="mb-4">
        <Link to="/analytics" className="text-accent hover:underline text-sm">
          ← Back to Analytics Dashboard
        </Link>
      </div>
      {/* Responsive grid: 1 column on small screens, 2 columns on medium and up */}
      <div className="grid gap-6 md:grid-cols-2">
        {data.map((portfolio) => (
          <div key={portfolio.portfolio_id} className="bg-white rounded-lg shadow overflow-hidden h-full">
            {/* Split view: left panel (main command) and right panel (strategy & notes) */}
            <div className="flex flex-col h-full">
              {/* Left panel: Payoff chart (top) and Order management (bottom) */}
              <div className="flex-1 flex flex-col">
                {/* Payoff Chart Placeholder */}
                <div className="flex-1 bg-gray-50 p-4">
                  <h3 className="font-semibold mb-2">Payoff Chart</h3>
                  <div className="h-full bg-gray-200 rounded">
                    {/* Chart would go here */}
                    <p className="text-center text-gray-500 h-full flex items-center justify-center">
                      Chart placeholder
                    </p>
                  </div>
                </div>

                {/* Order Management Table Placeholder */}
                <div className="flex-1 p-4 overflow-auto">
                  <h3 className="font-semibold mb-2">Order Management</h3>
                  <div className="bg-gray-50 rounded p-4">
                    {/* Table would go here */}
                    <p className="text-gray-500">Order management table placeholder</p>
                  </div>
                </div>
              </div>

              {/* Right panel: Strategy & Notes (fixed width 350px) */}
              <div className="w-80 bg-yellow-50 border-l-4 border-yellow-200 flex flex-col p-4">
                {/* Markdown Viewer for Trade Plan and AI Reasoning */}
                <div className="flex-1 mb-4">
                  <h3 className="font-semibold mb-2">Strategy & Notes</h3>
                  <div className="bg-white p-3 rounded border border-gray-200 h-full overflow-auto">
                    {portfolio.trade_plan_md ? (
                      <div className="prose prose-sm max-w-none">
                        {/* Simple markdown rendering - in production use a markdown library */}
                        <p>{portfolio.trade_plan_md}</p>
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No trade plan available</p>
                    )}
                  </div>
                </div>

                {/* AI Reasoning & Risk Insight */}
                {portfolio.port_type.toLowerCase().includes('ai') && (
                  <div className="mb-4">
                    <h3 className="font-semibold mb-2">AI Reasoning</h3>
                    <div className="bg-white p-3 rounded border border-gray-200">
                      {portfolio.ai_reasoning ? (
                        <div className="prose prose-sm max-w-none">
                          <p>{portfolio.ai_reasoning}</p>
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No AI reasoning available</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Decision Journal (Historical Post-its) */}
                <div className="mt-auto">
                  <h3 className="font-semibold mb-2">Decision Journal</h3>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {/* In real implementation, map over decision notes */}
                    <div className="bg-yellow-100 p-2 rounded border border-yellow-200">
                      <p className="text-sm text-gray-600">Sample decision note</p>
                    </div>
                  </div>
                  {/* Link to portfolio detail page */}
                  <div className="mt-2 pt-2 border-t border-yellow-200">
                    <Link
                      to={`/analytics/portfolio/${portfolio.portfolio_id}`}
                      className="text-accent hover:underline text-sm font-medium"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortfolioAnalyticsGrid;