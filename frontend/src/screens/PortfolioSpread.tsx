import React, { useState, useEffect } from 'react';

// Types based on backend response
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
  zone: string;
}

interface PortfolioSpreadsData {
  portfolio_id: number;
  portfolio_name: string;
  port_type: string;
  risk_status: string;
  spread_pairs: SpreadPair[];
  unpaired_orders: SpreadOrder[];
}

// Props interface for receiving portfolioId from PortfolioAnalyticsDetail
interface SpreadPairingProps {
  portfolioId?: string;
}

const SpreadPairing: React.FC<SpreadPairingProps> = ({ portfolioId: propPortfolioId }) => {
  const { portfolio_id } = useParams<{ portfolio_id: string }>();
  const [portfolioData, setPortfolioData] = useState<PortfolioSpreadsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Use portfolioId from params, props, or default to 1
  const activePortfolioId = propPortfolioId || portfolio_id || "1";
  const [showPairWizard, setShowPairWizard] = useState<boolean>(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [targetPairId, setTargetPairId] = useState<string>('');
  const [completedCycles, setCompletedCycles] = useState<Array<{pair_id: string, zone: string, net_pl: number | null}>>([]);
  const [showPayoffChart, setShowPayoffChart] = useState<{show: boolean, pairId: string | null}>({show: false, pairId: null});

  useEffect(() => {
    fetchSpreadData();
  }, [activePortfolioId]);

  const fetchSpreadData = async () => {
    try {
      const response = await fetch(`/api/v1/portfolios/${activePortfolioId}/spreads`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      setPortfolioData(data);
      // Populate completedCycles from spread_pairs with zones
      const completed = data.spread_pairs
        ?.filter((pair: any) => pair.zone)
        .map((pair: any) => ({
          pair_id: pair.pair_id,
          zone: pair.zone,
          net_pl: pair.net_pl
        })) || [];
      setCompletedCycles(completed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Set mock data for development
      setPortfolioData({
        portfolio_id: parseInt(activePortfolioId),
        portfolio_name: "Binance Futures",
        port_type: "spread",
        risk_status: "Safe",
        spread_pairs: [
          {
            pair_id: "shsojvp_1",
            leg_a: {
              order_id: 101,
              asset_type: "BTC",
              side: "BUY",
              qty: 0.5,
              entry_price: 95.0,
              current_price: 100.0,
              tp_price: null,
              leverage: 10,
              margin_rate: 0.02,
              order_status: "CLOSED",
              executed_by: "Manual",
              created_at: "2024-01-10T00:00:00Z",
              spread_pair_id: null,
            },
            leg_b: {
              order_id: 102,
              asset_type: "ETH",
              side: "SELL",
              qty: 2.0,
              entry_price: 195.0,
              current_price: 190.0,
              tp_price: null,
              leverage: 10,
              margin_rate: 0.02,
              order_status: "CLOSED",
              executed_by: "Manual",
              created_at: "2024-01-10T00:00:00Z",
              spread_pair_id: null,
            },
            net_pl: 50.0,
            spread_diff: 1.5,
            zone: "ZONE A",
          },
        ],
        unpaired_orders: [
          {
            order_id: 201,
            asset_type: "SOL",
            side: "BUY",
            qty: 10,
            entry_price: 150.0,
            current_price: 155.0,
            tp_price: null,
            leverage: 5,
            margin_rate: 0.01,
            order_status: "ACTIVE",
            executed_by: "Bot",
            created_at: "2024-01-15T00:00:00Z",
            spread_pair_id: null,
          },
        ],
      });
      setCompletedCycles([{
        pair_id: "shsojvp_1",
        zone: "ZONE A",
        net_pl: 50.0,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePair = async (orderId: number) => {
    setSelectedOrderId(orderId);
    setShowPairWizard(true);
  };

  const handleDeletePair = async (pairId: string) => {
    if (!window.confirm('Delete this spread pair?')) return;

    try {
      const response = await fetch(`/api/v1/spread-pairs/${pairId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchSpreadData();
      }
    } catch (err) {
      console.error('Failed to delete pair:', err);
    }
  };

  const handlePairWithId = async () => {
    if (!selectedOrderId || !targetPairId) return;

    try {
      const response = await fetch('/api/v1/spread-pairs/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrderId,
          pair_id: targetPairId
        })
      });

      if (response.ok) {
        setShowPairWizard(false);
        setTargetPairId('');
        fetchSpreadData();
      }
    } catch (err) {
      console.error('Failed to pair orders:', err);
    }
  };

  // Handle zone re-grouping
  const handleZoneChange = async (pairId: string, newZone: string) => {
    // In a real implementation, this would update the zone on the backend
    console.log(`Re-grouping pair ${pairId} to ${newZone}`);
    // For now, just update locally
    if (portfolioData) {
      const updatedPairs = portfolioData.spread_pairs.map(pair =>
        pair.pair_id === pairId ? { ...pair, zone: newZone } : pair
      );
      setPortfolioData({ ...portfolioData, spread_pairs: updatedPairs });
    }
  };

  // Group spread pairs by zone
  const getSpreadPairsByZone = () => {
    if (!portfolioData) return {};
    return portfolioData.spread_pairs.reduce((acc, pair) => {
      if (!acc[pair.zone]) acc[pair.zone] = [];
      acc[pair.zone].push(pair);
      return acc;
    }, {} as Record<string, SpreadPair[]>);
  };

  // Quick View - Payoff chart handler
  const handleQuickView = (pairId: string) => {
    setShowPayoffChart({ show: true, pairId });
  };

  if (loading) {
    return <div className="p-4">Loading spread pairing data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!portfolioData) {
    return <div className="p-4">No portfolio data available. Please select a portfolio.</div>;
  }

  const spreadPairsByZone = getSpreadPairsByZone();
  const zones = Object.keys(spreadPairsByZone).sort();

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Risk Status Header */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold">Spread Visual Pairing</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Portfolio:</span>
            <span className="font-medium">{portfolioData.portfolio_name}</span>
            <span className="text-sm text-gray-500">Risk Status:</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              portfolioData.port_type?.toLowerCase().includes('spread')
                ? 'bg-[#e0f7f6] text-[#0fbcb0]'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {portfolioData.risk_status || 'Safe'}
            </span>
            <div className="relative group">
              <span className="cursor-help text-gray-400">ⓘ</span>
              <div className="absolute hidden group-hover:block bg-gray-800 text-white p-2 rounded text-xs w-64 -ml-32 z-10">
                Calculation: Net P/L = Leg A P/L + Leg B P/L + Fees<br/>
                Zone grouping based on spread price ranges
              </div>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Panel: Order Pairs Table with Zone Grouping */}
        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <h3 className="font-semibold p-3 border-b">Order Pairs (Spreads)</h3>

            {portfolioData.spread_pairs && portfolioData.spread_pairs.length > 0 ? (
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
                      {/* Zone Header - surface-soft style */}
                      <tr className="bg-[#f7f8fa] border-t-2 border-b-2 border-[#e0e2e8]">
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
                No spread pairs found. Create pairs by linking orders with matching spread_pair_id.
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Strategy & Notes (Sticky Note Style) */}
        <div className="w-80 bg-yellow-50 border-l-4 border-yellow-200 flex flex-col">
          <div className="flex-1 p-4 overflow-auto">
            <h3 className="font-semibold mb-2 text-gray-700">Spread Strategy</h3>
            <div className="bg-yellow-100 p-4 rounded shadow transform rotate-1 mb-4">
              <p className="text-sm text-gray-700">
                {portfolioData.portfolio_name} - 1:1 ID-based Spread Trading
              </p>
              <ul className="mt-2 text-xs text-gray-600 list-disc list-inside">
                <li>1:1 ID-based pairing for spread legs</li>
                <li>Net Spread P/L consolidated tracking</li>
                <li>Zone-based grouping for audit trail</li>
              </ul>
            </div>

            <h3 className="font-semibold mb-2 text-gray-700">Quick Stats</h3>
            <div className="bg-yellow-100 p-3 rounded shadow mb-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Active Pairs:</span>
                  <span className="font-medium ml-1">{portfolioData.spread_pairs?.length || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Unpaired:</span>
                  <span className="font-medium ml-1">{portfolioData.unpaired_orders?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Decision Journal - Historical Spread Cycles */}
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

      {/* Pair Wizard Modal */}
      {showPairWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="font-bold text-lg mb-4">Link Order to Spread Pair</h3>
            <p className="text-sm text-gray-600 mb-3">
              Enter the existing spread_pair_id to link this order:
            </p>
            <input
              type="text"
              value={targetPairId}
              onChange={(e) => setTargetPairId(e.target.value)}
              placeholder="e.g., spread_abc123"
              className="w-full p-2 border rounded mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowPairWizard(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handlePairWithId}
                disabled={!targetPairId}
                className="px-4 py-2 bg-[#0fbcb0] text-white rounded hover:bg-[#0da89a] disabled:opacity-50"
              >
                Link Order
              </button>
            </div>
          </div>
        </div>
      )}

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
      {portfolioData.unpaired_orders && portfolioData.unpaired_orders.length > 0 && (
        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3">Unpaired Orders (Available for Pairing)</h3>
          <div className="grid grid-cols-2 gap-2">
            {portfolioData.unpaired_orders.map((order) => (
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
                <button
                  onClick={() => handleCreatePair(order.order_id)}
                  className="mt-2 text-xs text-[#0fbcb0] hover:text-[#0da89a]"
                >
                  Link to existing pair
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpreadPairing;