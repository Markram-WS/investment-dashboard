import React, { useState, useMemo, useCallback } from 'react';
import { EditOrderModal } from './EditOrderModal';
import { ZoneEditModal } from './ZoneEditModal';
import { useOrderEdit } from '../hooks/useOrderEdit';
import { usePortfolioManager } from '../hooks/usePortfolioManager';
import { useZoneEditor } from '../hooks/useZoneEditor';
import { ZoneGroupRow } from './components/ZoneGroupRow';
import { TradePlanView } from './components/TradePlanView';
import { QuickStatsView } from './components/QuickStatsView';
import { HistoricalGridView } from './components/HistoricalGridView';
import { PortfolioData, ZoneGroup, SpreadOrder } from '../types';
import { IconAdd } from '../components/icons/IconAdd';
import { IconLayers } from '../components/icons/IconLayers';
import { useMarkdownRenderer } from '../hooks/useMarkdownRenderer';
import { colors } from '../constants/colors';

const PortfolioGrid: React.FC = () => {
  // usePortfolioManager hook - จัดการ portfolio data + loading/error states
  const {
    portfolios,
    selectedPortfolio,
    setSelectedPortfolio,
    loading,
    error,
    lastUpdated,
    fetchAnalyticsData,
  } = usePortfolioManager();

  // UI state
  const [groupByZone, setGroupByZone] = useState(true);

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
  React.useEffect(() => {
    setOnRefresh(() => fetchAnalyticsData);
  }, [setOnRefresh, fetchAnalyticsData]);

  // Zone editor hook
  const {
    editingZoneOrders,
    editingZone,
    handleEditZone,
    handleCloseZoneModal,
    handleSaveZone,
  } = useZoneEditor(fetchAnalyticsData);

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
    sortedOrders.forEach((order) => {
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

  // Markdown renderer hook
  const { renderMarkdown, renderRiskStatus, isGridType } = useMarkdownRenderer();

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
              const portfolio = portfolios.find(
                (p) => p.portfolio_id === parseInt(e.target.value),
              );
              setSelectedPortfolio(portfolio || null);
            }}
            className="border rounded px-3 py-1 text-sm"
          >
            {portfolios.map((p) => (
              <option key={p.portfolio_id} value={p.portfolio_id}>
                {p.portfolio_name}
              </option>
            ))}
          </select>
          {selectedPortfolio && (
            <>
              <span className="text-sm text-gray-500">Risk Status:</span>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${renderRiskStatus(selectedPortfolio.risk_status)}`}
              >
                {selectedPortfolio.risk_status}
              </span>
              <span className="text-xs text-gray-400">
                Type: {selectedPortfolio.port_type}
              </span>
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
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Group by Zone
                  </span>
                  <button
                    onClick={() => setGroupByZone(!groupByZone)}
                    className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                      groupByZone ? 'bg-brandTeal' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        groupByZone ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    ></span>
                  </button>
                </div>
              )}
            </div>
            {isGridType(selectedPortfolio) &&
            zoneGroups.length > 0 &&
            groupByZone ? (
              // Grid type - show Zone-grouped view
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface border-y border-hairline">
                      <th className="p-4 pl-8 text-[10px] font-bold text-slate uppercase tracking-widest">
                        ID
                      </th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">
                        Zone
                      </th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">
                        Asset
                      </th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">
                        Side
                      </th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">
                        Entry
                      </th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">
                        Qty
                      </th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">
                        TP Target
                      </th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">
                        SL
                      </th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">
                        P/L
                      </th>
                      <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">
                        Status
                      </th>
                      <th className="p-4 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-ink">
                    {zoneGroups.map((zoneGroup) => (
                      <ZoneGroupRow
                        key={zoneGroup.zone}
                        zoneGroup={zoneGroup}
                        onEdit={startEdit}
                        onEditZone={handleEditZone}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : selectedPortfolio.active_orders &&
              selectedPortfolio.active_orders.length > 0 ? (
              // Default table view for non-Grid types or when Group by Zone is off
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">
                      Asset
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">
                      Side
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">
                      Entry
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">
                      Current
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPortfolio.active_orders.map((order) => (
                    <tr
                      key={order.order_id}
                      className="border-b border-[#e0e2e8] bg-white hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 font-medium text-sm">
                        {order.asset_type}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs px-1 rounded ${
                            order.side === 'BUY' || order.side === 'Buy'
                              ? 'bg-[#e0f7f6] text-[#0fbcb0]'
                              : 'bg-[#fdeced] text-[#ff9999]'
                          }`}
                        >
                          {order.side}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {order.qty}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        ${order.entry_price || '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        ${order.current_price || '-'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs ${
                            order.order_status === 'filled'
                              ? 'text-green-600'
                              : 'text-gray-500'
                          }`}
                        >
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
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Add Order
                </span>
              </button>
              <button className="ml-2 h-10 w-10 rounded-full bg-white text-ink shadow-lg hover:scale-105 transition-all flex items-center justify-center border-4 border-white">
                <IconLayers className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        {/* Right Panel: Sticky Note Style - Canary Yellow #FFFCE0 */}
        <div className="w-[350px] flex flex-col bg-yellow-100/30">
          <div className="flex-1 p-3 overflow-auto">
            {/* Trade Plan View - แยกเป็น component */}
            <h3 className="font-semibold mb-2 text-gray-700">Trade Plan</h3>
            <TradePlanView tradePlanMd={selectedPortfolio.trade_plan_md} renderMarkdown={renderMarkdown} />
            
            {/* Quick Stats - แยกเป็น component */}
            <h3 className="font-semibold mb-2 text-gray-700">Quick Stats</h3>
            <QuickStatsView portfolio={selectedPortfolio} />
          </div>
          {/* Historical Grid System - แยกเป็น component */}
          <HistoricalGridView recentTrades={selectedPortfolio.recent_trades} />
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
        zones={zoneGroups.map((g) => g.zone)}
      />
      {/* Zone Edit Modal */}
      <ZoneEditModal
        orders={editingZoneOrders}
        currentZone={editingZone}
        showModal={editingZoneOrders.length > 0}
        onClose={handleCloseZoneModal}
        onSave={handleSaveZone}
      />
    </div>
  );
};

export default PortfolioGrid;