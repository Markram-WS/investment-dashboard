import React, { useState, useEffect } from 'react';

// Design tokens from UI-LAYOUT-PORTFOLIO-ANALYTICS-SPREAD.md
const colors = {
  primary: '#1c1c1e',
  onPrimary: '#ffffff',
  brandYellow: '#ffd02f',
  brandTeal: '#0fbcb0',
  tealLight: '#e0f7f6',
  brandCoral: '#ff9999',
  coralLight: '#fdeced',
  brandBlue: '#4262ff',
  canvas: '#ffffff',
  surface: '#f7f8fa',
  hairline: '#e0e2e8',
  ink: '#1c1c1e',
  slate: '#555a6a',
  success: '#00b473',
  warning: '#f4d03f',
  error: '#e74c3c',
};

// Types based on API response
interface AILogEntry {
  log_id: number;
  agent_id: number;
  action_type: string;
  reasoning: string;
  risk_assessment: Record<string, any> | null;
  confidence_score: number | null;
  created_at: string;
}

interface SpreadOrder {
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
  spread_pair_id: string | null;
}

interface SpreadPair {
  pair_id: string;
  leg_a: SpreadOrder;
  leg_b: SpreadOrder;
  net_pl: number | null;
  spread_diff: number | null;
  zone: string | null;
}

interface PortfolioData {
  portfolio_id: number;
  portfolio_name: string;
  port_type: string;
  risk_status: string;
  trade_plan_md: string | null;
  ai_reasoning: string | null;
  ai_risk_insight: string | null;
  spread_pairs: SpreadPair[];
  active_orders: SpreadOrder[];
}

const PortfolioAnalytics: React.FC = () => {
  const [portfolios, setPortfolios] = useState<PortfolioData[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioData | null>(null);
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [completedCycles, setCompletedCycles] = useState<Array<{pair_id: string, zone: string, net_pl: number | null}>>([]);
  const [showPayoffChart, setShowPayoffChart] = useState<{show: boolean, pairId: string | null}>({show: false, pairId: null});

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const response = await fetch('/api/v1/analytics/portfolio-grid');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPortfolios(data);
      if (data.length > 0 && !selectedPortfolio) {
        setSelectedPortfolio(data[0]);
        // Populate completedCycles from spread_pairs with zones (completed cycles)
        const completed = data[0].spread_pairs
          ?.filter((pair: any) => pair.zone)
          .map((pair: any) => ({
            pair_id: pair.pair_id,
            zone: pair.zone,
            net_pl: pair.net_pl
          })) || [];
        setCompletedCycles(completed);
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAILogs = async (portfolioId: number) => {
    try {
      const response = await fetch(`/api/v1/ai/logs/${portfolioId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAiLogs(data);
    } catch (err) {
      console.error('Failed to fetch AI logs:', err);
    }
  };

  useEffect(() => {
    if (selectedPortfolio?.port_type?.toLowerCase().includes('ai')) {
      fetchAILogs(selectedPortfolio.portfolio_id);
    }
    // Update completedCycles when portfolio selection changes
    if (selectedPortfolio) {
      const completed = selectedPortfolio.spread_pairs
        ?.filter((pair) => pair.zone)
        .map((pair) => ({
          pair_id: pair.pair_id,
          zone: pair.zone as string,
          net_pl: pair.net_pl
        })) || [];
      setCompletedCycles(completed);
    }
  }, [selectedPortfolio]);

  // Group spread pairs by zone (COMPLETED CYCLE)
  const getSpreadPairsByZone = (spreadPairs: SpreadPair[]) => {
    return spreadPairs.reduce((acc, pair) => {
      const zone = pair.zone || 'Unassigned';
      if (!acc[zone]) acc[zone] = [];
      acc[zone].push(pair);
      return acc;
    }, {} as Record<string, SpreadPair[]>);
  };

  // Quick View - Payoff chart handler
  const handleQuickView = (pairId: string) => {
    setShowPayoffChart({ show: true, pairId });
  };

  const renderRiskStatus = (status: string) => {
    const colors = {
      Safe: 'bg-teal-100 text-teal-800',
      Warning: 'bg-yellow-100 text-yellow-800',
      Danger: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const renderMarkdown = (content: string) => {
    // Simple markdown to HTML conversion for trade plan display
    return content
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`(.*)`/gim, '<code>$1</code>')
      .replace(/\n$/gim, '<br />');
  };

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

  if (!selectedPortfolio) {
    return (
      <div className="p-6">
        <p className="text-gray-500">No portfolio data available.</p>
      </div>
    );
  }

  const spreadPairsByZone = getSpreadPairsByZone(selectedPortfolio.spread_pairs || []);
  const zones = Object.keys(spreadPairsByZone).sort();

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Risk Status Header */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold">Portfolio Analytics</h2>
          <select
            value={selectedPortfolio?.portfolio_id || ''}
            onChange={(e) => {
              const portfolio = portfolios.find(p => p.portfolio_id === parseInt(e.target.value));
              setSelectedPortfolio(portfolio || null);
            }}
            className="border rounded px-3 py-1 text-sm"
          >
            {portfolios.map(p => (
              <option key={p.portfolio_id} value={p.portfolio_id}>
                {p.portfolio_name}
              </option>
            ))}
          </select>
          {selectedPortfolio && (
            <>
              <span className="text-sm text-gray-500">Risk Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${renderRiskStatus(selectedPortfolio.risk_status)}`}>
                {selectedPortfolio.risk_status}
              </span>
              <div className="relative group">
                <span className="cursor-help text-gray-400">ⓘ</span>
                <div className="absolute hidden group-hover:block bg-gray-800 text-white p-2 rounded text-xs w-64 -ml-32 z-10">
                  Calculation: Net P/L = Leg A P/L + Leg B P/L + Fees<br/>
                  Zone grouping based on spread price ranges
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchAnalyticsData}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Refresh Data
          </button>
          <div className="text-xs text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
          <button
            className="px-4 py-2 bg-black text-white text-xs font-medium rounded-full hover:bg-gray-800 transition-colors"
          >
            ADD ORDER
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Panel: Spread Visual Pairing & Order Pairs */}
        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <h3 className="font-semibold p-3 border-b">Spread Visual Pairing</h3>
            
            {selectedPortfolio.spread_pairs && selectedPortfolio.spread_pairs.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Asset</th>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Strategy</th>
                    <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">P/L</th>
                    <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map(zone => (
                    <React.Fragment key={zone}>
                      {/* Zone Header - teal-light style per spec */}
                      <tr className="bg-[#e0f7f6] border-t-2 border-b-2 border-[#e0e2e8]">
                        <td colSpan={4} className="px-4 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-[#0fbcb0] uppercase tracking-wide">
                              {zone} | COMPLETED CYCLE
                            </span>
                          </div>
                        </td>
                      </tr>

                      {spreadPairsByZone[zone].map((pair) => (
                        <React.Fragment key={pair.pair_id}>
                          {/* Consolidated Performance Row */}
                          <tr className="border-b border-dashed border-[#e0e2e8] bg-white hover:bg-gray-50">
                            <td colSpan={2} className="px-3 py-2">
                              <div className="flex items-center">
                                <span className="text-[#0fbcb0] mr-2 font-mono">⎡⎤</span>
                                <span className="font-medium text-sm">
                                  {pair.leg_a.asset_type}/{pair.leg_b.asset_type} SPREAD
                                </span>
                              </div>
                            </td>
                            <td className={`px-3 py-2 text-right font-bold text-base ${
                              (pair.net_pl || 0) >= 0 ? 'text-[#0fbcb0]' : 'text-[#ff9999]'
                            }`}>
                              ${(pair.net_pl || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-gray-500">
                              {pair.leg_a.qty + (pair.leg_b?.qty || 0)}
                            </td>
                          </tr>

                          {/* Leg A - indented row (32px = pl-8) */}
                          <tr className="border-b border-[#e0e2e8] bg-white hover:bg-gray-50">
                            <td className="px-8 py-2">
                              <span className="font-medium text-sm text-gray-800">{pair.leg_a.asset_type}</span>
                            </td>
                            <td className="px-2 py-2">
                              <span className={`text-xs px-1 rounded ${
                                pair.leg_a.side === 'BUY' ? 'bg-[#e0f7f6] text-[#0fbcb0]' : 'bg-[#fdeced] text-[#ff9999]'
                              }`}>
                                {pair.leg_a.side === 'BUY' ? 'Long Leg A' : 'Short Leg A'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-gray-600">
                              {pair.leg_a.entry_price ? `$${pair.leg_a.entry_price}` : '–'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className="text-xs text-gray-400 cursor-pointer hover:text-gray-600"
                                onClick={() => handleQuickView(pair.pair_id)}
                                title="Quick View Payoff Chart"
                              >
                                👁
                              </span>
                            </td>
                          </tr>

                          {/* Leg B - indented row */}
                          <tr className="border-b border-[#e0e2e8] bg-white hover:bg-gray-50">
                            <td className="px-8 py-2">
                              <span className="font-medium text-sm text-gray-800">{pair.leg_b.asset_type}</span>
                            </td>
                            <td className="px-2 py-2">
                              <span className={`text-xs px-1 rounded ${
                                pair.leg_b.side === 'BUY' ? 'bg-[#e0f7f6] text-[#0fbcb0]' : 'bg-[#fdeced] text-[#ff9999]'
                              }`}>
                                {pair.leg_b.side === 'BUY' ? 'Long Leg B' : 'Short Leg B'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-gray-600">
                              {pair.leg_b.entry_price ? `$${pair.leg_b.entry_price}` : '–'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className="text-xs text-gray-400 cursor-pointer hover:text-gray-600"
                                onClick={() => handleQuickView(pair.pair_id)}
                                title="Quick View Payoff Chart"
                              >
                                👁
                              </span>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500">
                No spread pairs found. Spread orders will appear here when available.
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Strategy & Notes (Sticky Note Style - Canary Yellow #FFFCE0) */}
        <div className="w-[350px] bg-yellow-50 border-l-4 border-yellow-200 flex flex-col" style={{backgroundColor: '#FFFCE0'}}>
          <div className="flex-1 p-4 overflow-auto">
            {/* AI Reasoning & Risk Insight */}
            {selectedPortfolio.port_type?.toLowerCase().includes('ai') ? (
              <>
                <h3 className="font-semibold mb-2 text-gray-700">AI Reasoning</h3>
                <div className="bg-yellow-100 p-3 rounded shadow transform rotate-1 mb-4">
                  {aiLogs.length > 0 ? (
                    <div className="space-y-2">
                      {aiLogs.slice(0, 3).map(log => (
                        <div key={log.log_id} className="text-xs">
                          <span className="font-medium text-gray-600">
                            [{new Date(log.created_at).toLocaleTimeString()}]
                          </span>
                          <p className="text-gray-700 mt-1">{log.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">
                      {selectedPortfolio.ai_reasoning || 'No AI reasoning available'}
                    </p>
                  )}
                </div>

                <h3 className="font-semibold mb-2 text-gray-700">Risk Insight</h3>
                <div className="bg-yellow-100 p-3 rounded shadow mb-4">
                  <p className="text-sm text-gray-700">
                    {aiLogs.length > 0 
                      ? aiLogs[0]?.risk_assessment 
                      : selectedPortfolio.ai_risk_insight || 'No risk insight available'}
                  </p>
                </div>
              </>
            ) : null}

            {/* Trade Plan View (ArgoCD Style Markdown) */}
            <h3 className="font-semibold mb-2 text-gray-700">Trade Plan</h3>
            <div className="bg-yellow-100 p-3 rounded shadow">
              {selectedPortfolio.trade_plan_md ? (
                <div 
                  className="text-sm text-gray-700 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedPortfolio.trade_plan_md) }}
                />
              ) : (
                <p className="text-sm text-gray-500">No trade plan available</p>
              )}
            </div>

            {/* Quick Stats */}
            <h3 className="font-semibold mb-2 text-gray-700 mt-4">Quick Stats</h3>
            <div className="bg-yellow-100 p-3 rounded shadow">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Active Pairs:</span>
                  <span className="font-medium ml-1">{selectedPortfolio.spread_pairs?.length || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Unpaired:</span>
                  <span className="font-medium ml-1">{selectedPortfolio.active_orders?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Decision Journal (Historical Spread Cycles) */}
          <div className="p-4 border-t border-yellow-200">
            <h3 className="font-semibold mb-2 text-gray-700">Decision Journal</h3>
            <div className="space-y-2 max-h-48 overflow-auto">
              {completedCycles.length > 0 ? (
                completedCycles.map((cycle) => (
                  <div key={cycle.pair_id} className="bg-yellow-100 p-2 rounded border border-yellow-200">
                    <p className="text-xs text-gray-700">
                      {cycle.zone}: Spread pair closed - Net ${(cycle.net_pl || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">{new Date().toLocaleDateString()}</p>
                  </div>
                ))
              ) : (
                <div className="bg-yellow-100 p-2 rounded border border-yellow-200">
                  <p className="text-xs text-gray-600">
                    Completed spread cycles will appear here
                  </p>
                  <p className="text-xs text-gray-400">No cycles closed yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payoff Chart Modal */}
      {showPayoffChart.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[600px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Payoff Chart</h3>
              <button
                onClick={() => setShowPayoffChart({ show: false, pairId: null })}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="h-64 bg-gray-50 rounded flex items-center justify-center">
              <p className="text-gray-500">Payoff chart visualization for spread pair: {showPayoffChart.pairId}</p>
            </div>
          </div>
        </div>
      )}

      {/* Unpaired Orders Section */}
      {selectedPortfolio.active_orders && selectedPortfolio.active_orders.length > 0 && (
        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3">Unpaired Orders (Available for Pairing)</h3>
          <div className="grid grid-cols-2 gap-2">
            {selectedPortfolio.active_orders.map((order) => (
              <div key={order.order_id} className="border rounded p-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{order.asset_type}</span>
                  <span className={`text-xs px-1 rounded ${
                    order.side === 'BUY' ? 'bg-[#e0f7f6] text-[#0fbcb0]' : 'bg-[#fdeced] text-[#ff9999]'
                  }`}>
                    {order.side}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Qty: {order.qty} | ID: {order.spread_pair_id || 'unpaired'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioAnalytics;