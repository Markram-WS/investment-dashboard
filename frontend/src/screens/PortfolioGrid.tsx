import React, { useState, useEffect, useMemo } from 'react';
import { EditOrderModal } from './EditOrderModal';
import { useOrderEdit } from '../hooks/useOrderEdit';
import { ZoneGroupRow } from './components/ZoneGroupRow';
import { PortfolioData, ZoneGroup } from './types';
import { IconAdd } from '../components/icons/IconAdd';
import { IconLayers } from '../components/icons/IconLayers';

// Design tokens from UI-LAYOUT-PORTFOLIO-ANALYTICS-SPREAD.md
const colors = {
  brandTeal: '#0fbcb0',
  tealLight: '#e0f7f6',
  brandCoral: '#ff9999',
  coralLight: '#fdeced',
  slate: '#555a6a',
  hairline: '#e0e2e8',
  surface: '#f7f8fa',
  brandYellow: '#ffd02f',
  success: '#00b473',
  warning: '#f4d03f',
  error: '#e74c3c',
};

const PortfolioGrid: React.FC = () => {
  const [portfolios, setPortfolios] = useState<PortfolioData[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showHistorical, setShowHistorical] = useState(false);
  const [groupByZone, setGroupByZone] = useState(true);

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
      // อัปเดต selectedPortfolio จาก portfolios ใหม่
      if (selectedPortfolio) {
        const updatedSelected = data.find((p: PortfolioData) => p.portfolio_id === selectedPortfolio.portfolio_id);
        setSelectedPortfolio(updatedSelected || (data.length > 0 ? data[0] : null));
      } else if (data.length > 0) {
        setSelectedPortfolio(data[0]);
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  // Order edit hook (SRP - separated state management)
  const {
    editingOrder,
    formData,
    showModal,
    startEdit,
    closeModal,
    handleFormChange,
    handleSaveOrder,
    setOnRefresh,
  } = useOrderEdit();

  // Register refresh callback once on mount
  useEffect(() => {
    setOnRefresh(() => fetchAnalyticsData);
  }, [setOnRefresh]);

  // Group orders by Zone - using useMemo to prevent stale closure issues
  const zoneGroups = useMemo(() => {
    const orders = selectedPortfolio?.active_orders || [];
    const groups: Record<string, ZoneGroup> = {};

    // Sort orders by entry_price first (DESC - จากมากไปน้อย)
    const sortedOrders = [...orders].sort((a, b) => {
      const priceA = a.entry_price ?? 0;
      const priceB = b.entry_price ?? 0;
      return priceB - priceA; // DESC
    });

    sortedOrders.forEach(order => {
      const zone = order.zone || 'ZONE A';
      if (!groups[zone]) {
        groups[zone] = {
          zone,
          mainOrders: [],
          pendingCloseOrders: [],
        };
      }

      if (order.order_status === 'filled') {
        groups[zone].mainOrders.push(order);
      } else if (order.order_status === 'pending_sync') {
        groups[zone].pendingCloseOrders.push(order);
      }
    });

    return Object.values(groups);
  }, [selectedPortfolio?.active_orders]);

  const renderRiskStatus = (status: string) => {
    const statusColors = {
      Safe: 'bg-teal-100 text-teal-800',
      Warning: 'bg-yellow-100 text-yellow-800',
      Danger: 'bg-red-100 text-red-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const renderMarkdown = (content: string) => {
    return content
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`(.*)`/gim, '<code>$1</code>')
      .replace(/\n$/gim, '<br />');
  };

  const isGridType = (portfolio: PortfolioData | null) => {
    return portfolio?.port_type?.toLowerCase().includes('grid') ||
           portfolio?.port_type?.toLowerCase().includes('margin');
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

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Risk Status Header */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold">Portfolio Grid</h2>
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
              <span className="text-xs text-gray-400">Type: {selectedPortfolio.port_type}</span>
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
          <button className="px-4 py-2 bg-black text-white text-xs font-medium rounded-full hover:bg-gray-800 transition-colors">
            ADD ORDER
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Panel: Active Orders - Zone Grouped View */}
        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto p-3">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">Order Management</h3>
              {isGridType(selectedPortfolio) && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Group by Zone</span>
                  <button
                    onClick={() => setGroupByZone(!groupByZone)}
                    className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                      groupByZone ? 'bg-brandTeal' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      groupByZone ? 'translate-x-4' : 'translate-x-0'
                    }`}></span>
                  </button>
                </div>
              )}
            </div>

            {isGridType(selectedPortfolio) && zoneGroups.length > 0 && groupByZone ? (
              // Grid type - show Zone-grouped view
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface border-y border-hairline">
                      <th className="p-4 pl-8 text-[10px] font-bold text-slate uppercase tracking-widest">ID</th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Zone</th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Asset</th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Side</th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Entry</th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Qty</th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">TP Target</th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">SL</th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">P/L</th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Status</th>
                      <th className="p-4 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-ink">
                    {zoneGroups.map((zoneGroup) => (
                      <ZoneGroupRow key={zoneGroup.zone} zoneGroup={zoneGroup} onEdit={startEdit} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : selectedPortfolio.active_orders && selectedPortfolio.active_orders.length > 0 ? (
              // Default table view for non-Grid types or when Group by Zone is off
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Asset</th>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Side</th>
                    <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Entry</th>
                    <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Current</th>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPortfolio.active_orders.map((order) => (
                    <tr key={order.order_id} className="border-b border-[#e0e2e8] bg-white hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-sm">{order.asset_type}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1 rounded ${
                          order.side === 'BUY' || order.side === 'Buy' ? 'bg-[#e0f7f6] text-[#0fbcb0]' : 'bg-[#fdeced] text-[#ff9999]'
                        }`}>
                          {order.side}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-xs">{order.qty}</td>
                      <td className="px-3 py-2 text-right text-xs">${order.entry_price || '-'}</td>
                      <td className="px-3 py-2 text-right text-xs">${order.current_price || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs ${
                          order.order_status === 'filled' ? 'text-green-600' : 'text-gray-500'
                        }`}>
                          {order.order_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500">
                No active orders found.
              </div>
            )}
          </div>

          {/* Add Order footer button */}
          <div className="h-12 w-full flex items-center justify-center border-t border-hairline bg-surface/50">
            <div className="relative flex -mt-10 z-10">
              <button className="h-10 px-4 gap-2 rounded-full bg-black text-white shadow-lg hover:scale-105 transition-all flex items-center justify-center border-4 border-white">
                <IconAdd className="w-4.5 h-4.5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Add Order</span>
              </button>
              <button className="ml-2 h-10 w-10 rounded-full bg-white text-ink shadow-lg hover:scale-105 transition-all flex items-center justify-center border-4 border-white">
                <IconLayers className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Sticky Note Style - Canary Yellow #FFFCE0 */}
        <div className="w-[350px] flex flex-col bg-yellow-100/30">
          <div className="flex-1 p-3 overflow-auto">
            {/* Trade Plan View */}
            <h3 className="font-semibold mb-2 text-gray-700">Trade Plan</h3>
            <div className="bg-yellow-100 p-3 rounded shadow mb-4">
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
            <h3 className="font-semibold mb-2 text-gray-700">Quick Stats</h3>
            <div className="bg-yellow-100 p-3 rounded shadow mb-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Active Pairs:</span>
                  <span className="font-medium ml-1">{selectedPortfolio.spread_pairs?.length || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Positions:</span>
                  <span className="font-medium ml-1">{selectedPortfolio.active_orders?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Historical Grid System (Collapsible) */}
          <div className="p-3 border-t border-yellow-200">
            <button
              onClick={() => setShowHistorical(!showHistorical)}
              className="w-full flex justify-between items-center font-semibold mb-2 text-gray-700"
            >
              <span>Historical Grid System</span>
              <span className="text-xs">{showHistorical ? '▼' : '▶'}</span>
            </button>

            {showHistorical && (
              <div className="space-y-2 max-h-64 overflow-auto mt-2">
                {selectedPortfolio.recent_trades && selectedPortfolio.recent_trades.length > 0 ? (
                  selectedPortfolio.recent_trades.map((trade) => (
                    <div key={trade.history_id} className="bg-yellow-100 p-2 rounded border border-yellow-200 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium">{trade.asset} {trade.type}</span>
                        <span className={trade.realized_pl && trade.realized_pl > 0 ? 'text-green-600' : 'text-red-600'}>
                          {trade.realized_pl ? `$${trade.realized_pl} P/L` : '-'}
                        </span>
                      </div>
                      <div className="text-gray-500 mt-1">
                        {trade.entry_date} → {trade.exit_date}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-yellow-100 p-2 rounded border border-yellow-200">
                    <p className="text-xs text-gray-600">No historical trades</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Order Modal */}
      <EditOrderModal
        order={editingOrder}
        formData={formData}
        showModal={showModal}
        onClose={closeModal}
        onSave={handleSaveOrder}
        onChange={handleFormChange}
        zones={zoneGroups.map(g => g.zone)}
      />
    </div>
  );
};

export default PortfolioGrid;