import React, { useState, useMemo, useCallback } from 'react';
import { EditOrderModal } from './EditOrderModal';
import { AddOrderModal } from './AddOrderModal';
import { ZoneEditModal } from './ZoneEditModal';
import { ZoneGroupModal } from './ZoneGroupModal';
import { CloseOrderModal } from './CloseOrderModal';
import { useOrderEdit } from '../hooks/useOrderEdit';
import { useAddOrder } from '../hooks/useAddOrder';
import { usePortfolioManager } from '../hooks/usePortfolioManager';
import { useZoneEditor } from '../hooks/useZoneEditor';
import { ZoneGroupRow } from './components/ZoneGroupRow';
import { TradePlanView } from './components/TradePlanView';
import { PortfolioData, ZoneGroup, SpreadOrder } from '../types';
import { IconAdd } from '../components/icons/IconAdd';
import { IconLayers } from '../components/icons/IconLayers';
import { useMarkdownRenderer } from '../hooks/useMarkdownRenderer';
import { colors } from '../constants/colors';
import { api } from '../lib/api';

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
  const [showZoneGroupModal, setShowZoneGroupModal] = useState(false);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [closingOrder, setClosingOrder] = useState<SpreadOrder | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Performance data state
  const [viewMode, setViewMode] = useState<'equity' | 'payoff'>('equity');
  const [performanceData, setPerformanceData] = useState<any>(null);

  React.useEffect(() => {
    if (selectedPortfolio) {
      api.getPerformance(selectedPortfolio.portfolio_id).then(setPerformanceData).catch(() => {});
    }
  }, [selectedPortfolio?.portfolio_id]);

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

  // Add Order hook
  const {
    showModal: showAddModal,
    formData: addFormData,
    openModal,
    closeModal: closeAddModal,
    handleFormChange: handleAddFormChange,
    handleCreateOrder,
  } = useAddOrder();

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

  // Fetch trade history when portfolio changes
  React.useEffect(() => {
    if (selectedPortfolio) {
      api.getTradeHistory(selectedPortfolio.portfolio_id).then(setTradeHistory).catch(() => {});
    }
  }, [selectedPortfolio?.portfolio_id]);

  // Close order handler - show modal if no price data, else close directly
  const handleCloseOrder = useCallback((order: SpreadOrder) => {
    setClosingOrder(order);
    setShowCloseModal(true);
  }, []);

  // Confirm close with user-provided exit price and P/L
  const handleConfirmClose = useCallback(async (orderId: string, closeOrderId: string, exitPrice: number | null, realizedPl: number | null) => {
    try {
      await api.closeOrder(orderId, { close_order_id: closeOrderId, exit_price: exitPrice, realized_pl: realizedPl });
      setShowCloseModal(false);
      setClosingOrder(null);
      fetchAnalyticsData();
      if (selectedPortfolio) {
        const data = await api.getTradeHistory(selectedPortfolio.portfolio_id);
        setTradeHistory(data);
        api.getPerformance(selectedPortfolio.portfolio_id).then(setPerformanceData).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to close order:', err);
    }
  }, [fetchAnalyticsData, selectedPortfolio]);

  // Filter out closed orders so they disappear from Order Management
  const activeOrders = useMemo(() => {
    return (selectedPortfolio?.active_orders || []).filter(
      (o) => o.order_status !== 'closed',
    );
  }, [selectedPortfolio?.active_orders]);

  // Group orders by Zone - using useMemo to prevent stale closure issues
  const zoneGroups = useMemo(() => {
    const orders = activeOrders;
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
  }, [activeOrders]);

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

  const totalValue = selectedPortfolio?.active_orders?.reduce(
    (sum: number, o: any) => sum + (Number(o.entry_price || 0) * Number(o.qty || 0)), 0
  ) || 0;
  const totalPl = selectedPortfolio?.active_orders?.reduce(
    (sum: number, o: any) => sum + ((Number(o.current_price || 0) - Number(o.entry_price || 0)) * Number(o.qty || 0)), 0
  ) || 0;

  return (
    <div className="px-10 py-6 min-h-screen max-w-[1800px] mx-auto">
      {/* Breadcrumb / Secondary Header */}
      <header className="flex justify-between items-center w-full mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
            <span>Portfolios</span>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            <span className="text-ink">{selectedPortfolio?.portfolio_name}</span>
          </div>
          <h2 className="text-3xl font-bold tight-headline">{selectedPortfolio?.portfolio_name} Overview</h2>
          <p className="text-slate text-xs mt-1">Updated {lastUpdated.toLocaleTimeString()}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalyticsData}
            className="px-4 py-2 text-xs font-bold border border-hairline rounded-full hover:bg-surface transition-colors uppercase tracking-wider"
          >
            Refresh Data
          </button>
          <button
            onClick={openModal}
            className="h-10 px-4 gap-2 rounded-full bg-ink text-white shadow-lg hover:scale-105 transition-all flex items-center justify-center border-2 border-white"
          >
            <svg className="w-4 h-4 font-bold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest">Add Order</span>
          </button>
        </div>
      </header>

      {/* Top Section: Summary & Strategy */}
      <section className="grid grid-cols-12 gap-6 mb-6">
        {/* Portfolio Summary Card */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-hairline p-8 flex flex-col">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-6">Portfolio Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-hairline">
            <div className="flex flex-col">
              <p className="text-xs font-medium text-gray-500 mb-2">Total Value</p>
              <p className="text-3xl font-bold leading-none">${totalValue.toLocaleString()}</p>
              <p className="text-brand-teal text-sm font-semibold mt-2 flex items-center gap-1">
                +{totalValue > 0 ? ((totalPl / totalValue) * 100).toFixed(1) : '0'}%
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-xs font-medium text-gray-500 mb-2">Total P/L</p>
              <p className={`text-3xl font-bold leading-none ${totalPl >= 0 ? 'text-brand-teal' : 'text-brand-coral'}`}>
                {totalPl >= 0 ? '+' : ''}${totalPl.toLocaleString()}
              </p>
              <p className="text-slate text-xs mt-2">All time performance</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            <div className="flex border-r border-hairline pr-8">
              <div className="flex flex-col w-full">
                <p className="text-[11px] font-bold text-gray-500 mb-6 uppercase tracking-widest">Risk Level</p>
                <div className="flex items-center gap-8 md:gap-12">
                  <div className="relative flex items-center justify-center w-40 h-40 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" fill="transparent" r="16" stroke="#f0f0f0" strokeWidth="3" />
                      <circle cx="18" cy="18" fill="transparent" r="16" stroke="#1c1c1e" strokeDasharray="66 34" strokeDashoffset="0" strokeWidth="4" />
                    </svg>
                    <div className="absolute text-center">
                      <p className="text-[14px] font-bold text-ink">66%</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 items-start">
                    <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-full border border-hairline">
                      <span className="h-2 w-2 rounded-full bg-ink"></span>
                      <span className="text-[11px] font-bold uppercase tracking-wider">{selectedPortfolio?.risk_status || 'Moderate'}</span>
                    </div>
                    <p className="text-[11px] text-slate font-medium max-w-[120px]">Score based on portfolio volatility</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex pl-8">
              <div className="flex flex-col w-full">
                <p className="text-[11px] font-bold text-gray-500 mb-6 uppercase tracking-widest">Asset Allocation</p>
                <div className="flex items-center gap-8 md:gap-12">
                  <div className="relative flex items-center justify-center w-40 h-40 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" fill="transparent" r="16" stroke="#f0f0f0" strokeWidth="3" />
                      <circle cx="18" cy="18" fill="transparent" r="16" stroke="#ff9999" strokeDasharray="45 55" strokeDashoffset="0" strokeWidth="4" />
                      <circle cx="18" cy="18" fill="transparent" r="16" stroke="#0fbcb0" strokeDasharray="30 70" strokeDashoffset="-45" strokeWidth="4" />
                      <circle cx="18" cy="18" fill="transparent" r="16" stroke="#ffd02f" strokeDasharray="15 85" strokeDashoffset="-75" strokeWidth="4" />
                      <circle cx="18" cy="18" fill="transparent" r="16" stroke="#4262ff" strokeDasharray="10 90" strokeDashoffset="-90" strokeWidth="4" />
                    </svg>
                    <div className="absolute text-center">
                      <p className="text-[14px] font-bold text-ink">100%</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 justify-center">
                    <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-coral"></span><span className="text-[11px] font-bold">Eq 45%</span></div>
                    <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-teal"></span><span className="text-[11px] font-bold">FI 30%</span></div>
                    <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-yellow"></span><span className="text-[11px] font-bold">Alt 15%</span></div>
                    <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-blue"></span><span className="text-[11px] font-bold">Cash 10%</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {selectedPortfolio?.tags && Object.keys(selectedPortfolio.tags).length > 0 && (
            <div className="mt-6 pt-6 border-t border-hairline">
              <p className="text-[11px] font-bold text-gray-500 mb-3 uppercase tracking-widest">Metadata Tags</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(selectedPortfolio.tags).map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-surface text-slate rounded-full border border-hairline"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Strategy & Notes */}
        <div className="col-span-12 lg:col-span-4 rounded-2xl bg-yellow-100 p-8 flex flex-col border border-hairline-soft">
          <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest mb-6">Strategy & Notes</h3>
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Primary Strategy</span>
              <div className="mt-2">
                <TradePlanView
                  tradePlanMd={selectedPortfolio.trade_plan_md}
                  renderMarkdown={renderMarkdown}
                  portfolioId={selectedPortfolio.portfolio_id}
                  onSaved={fetchAnalyticsData}
                />
              </div>
            </div>
            <div className="pt-6 border-t border-ink/10">
              <label className="text-[10px] font-bold text-gray-500 block mb-2 uppercase tracking-wider">Internal Notes</label>
              {editingNotes ? (
                <div>
                  <textarea
                    value={notesContent}
                    onChange={(e) => setNotesContent(e.target.value)}
                    className="w-full h-32 bg-yellow-100 rounded-lg p-4 text-sm focus:ring-2 focus:ring-brand-yellow outline-none resize-none"
                    placeholder="Type your observation..."
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => setEditingNotes(false)}
                      className="px-3 py-1 text-xs border rounded hover:bg-white/50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedPortfolio) return;
                        setSavingNotes(true);
                        try {
                          await api.updatePortfolio(selectedPortfolio.portfolio_id, { internal_notes: notesContent });
                          setEditingNotes(false);
                          fetchAnalyticsData();
                        } catch (err) {
                          console.error('Failed to save notes:', err);
                        } finally {
                          setSavingNotes(false);
                        }
                      }}
                      disabled={savingNotes}
                      className="px-3 py-1 text-xs bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
                    >
                      {savingNotes ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full min-h-[80px] bg-yellow-100 rounded-lg p-4 text-sm cursor-pointer hover:bg-yellow-200/80 transition-colors"
                  onClick={() => { setNotesContent(selectedPortfolio?.internal_notes || ''); setEditingNotes(true); }}
                >
                  {selectedPortfolio?.internal_notes ? (
                    <p className="whitespace-pre-wrap text-sm text-gray-700">{selectedPortfolio.internal_notes}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Click to add notes...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Performance Section */}
      <section className="mb-6">
        <div className="rounded-2xl bg-purple-50 p-8 flex flex-col border border-hairline-soft">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest">Performance</h3>
            <div className="flex items-center gap-4">
              {performanceData && (
                <span className="text-xs text-slate font-medium">
                  Total P/L: ${performanceData.total_pl?.toLocaleString()}
                </span>
              )}
              <div className="flex p-1 bg-white rounded-full border border-hairline shadow-sm">
                <button
                  onClick={() => setViewMode('equity')}
                  className={`px-4 py-1.5 text-[10px] font-bold rounded-full shadow-sm transition-all ${viewMode === 'equity' ? 'bg-ink text-white' : 'bg-gray-200 text-ink hover:bg-gray-300'}`}
                >
                  Equity
                </button>
                <button
                  onClick={() => setViewMode('payoff')}
                  className={`px-4 py-1.5 text-[10px] font-bold rounded-full transition-all ${viewMode === 'payoff' ? 'bg-ink text-white' : 'bg-gray-200 text-ink hover:bg-gray-300'}`}
                >
                  Payoff
                </button>
              </div>
            </div>
          </div>
          {performanceData ? (
            <PerformanceChart
              data={performanceData}
              viewMode={viewMode}
            />
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-slate">
              Loading performance data...
            </div>
          )}
        </div>
      </section>

      {/* Order Management Section */}
      <section className="bg-white rounded-xl border border-hairline overflow-hidden mb-6">
        <div className="p-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest">Order Management</h3>
            <span className="px-2 py-0.5 bg-ink text-[10px] text-white font-bold rounded-full uppercase tracking-tighter">{activeOrders.length} ACTIVE</span>
          </div>
          <div className="flex items-center gap-6">
            {isGridType(selectedPortfolio) && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Group by Zone</span>
                <button
                  onClick={() => setGroupByZone(!groupByZone)}
                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${groupByZone ? 'bg-brand-teal' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${groupByZone ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          {isGridType(selectedPortfolio) && zoneGroups.length > 0 && groupByZone ? (
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
                  <ZoneGroupRow
                    key={zoneGroup.zone}
                    zoneGroup={zoneGroup}
                    onEdit={startEdit}
                    onEditZone={handleEditZone}
                    onClose={handleCloseOrder}
                  />
                ))}
              </tbody>
            </table>
          ) : activeOrders.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">ID</th>
                  <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Asset</th>
                  <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Side</th>
                  <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Open Date</th>
                  <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Entry</th>
                  <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Current</th>
                  <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">TP</th>
                  <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">SL</th>
                  <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((order) => {
                  const openDate = order.created_at ? order.created_at.slice(0, 10) : '-';
                  return (
                  <tr key={order.order_id} className="border-b border-hairline-soft bg-white hover:bg-surface/50">
                    <td className="px-3 py-2 text-xs text-gray-500 font-mono">#{order.order_id}</td>
                    <td className="px-3 py-2 font-medium text-sm">{order.asset_type}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-1 rounded ${order.side === 'BUY' || order.side === 'Buy' ? 'bg-teal-light text-brand-teal' : 'bg-coral-light text-brand-coral'}`}>
                        {order.side}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{openDate}</td>
                    <td className="px-3 py-2 text-right text-xs">{order.qty}</td>
                    <td className="px-3 py-2 text-right text-xs">${order.entry_price || '-'}</td>
                    <td className="px-3 py-2 text-right text-xs">${order.current_price || '-'}</td>
                    <td className="px-3 py-2 text-right text-xs">${order.tp_price || '-'}</td>
                    <td className="px-3 py-2 text-right text-xs">${order.sl_price || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs ${order.order_status === 'filled' ? 'text-green-600' : 'text-gray-500'}`}>{order.order_status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(order)} className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-gray-600" title="Edit">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 11.5 8 16l4.5-7.5z" />
                          </svg>
                        </button>
                        <button onClick={() => handleCloseOrder(order)} className="p-1 hover:bg-red-50 rounded transition-colors text-red-300 hover:text-red-500" title="Close">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">No active orders found.</div>
          )}
        </div>

        {/* Add Order footer button */}
        <div className="h-12 w-full flex items-center justify-center border-t border-hairline bg-surface/50">
          <div className="relative flex -mt-10 z-10">
            <button
              onClick={openModal}
              className="h-10 px-4 gap-2 rounded-full bg-ink text-white shadow-lg hover:scale-105 transition-all flex items-center justify-center border-4 border-white"
            >
              <IconAdd className="w-4.5 h-4.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Add Order</span>
            </button>
            <button
              onClick={() => setShowZoneGroupModal(true)}
              className="ml-2 h-10 w-10 rounded-full bg-white text-ink shadow-lg hover:scale-105 transition-all flex items-center justify-center border-4 border-white"
            >
              <IconLayers className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Trade History */}
        <div className="border-t border-hairline">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-widest hover:bg-gray-50"
          >
            <span>Trade History ({tradeHistory.length})</span>
            <svg className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showHistory && (
            <div className="max-h-48 overflow-auto">
              {tradeHistory.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-400 text-center">No closed orders yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider">Open ID</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider">Close ID</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider">Asset</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider">Side</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">Qty</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">Entry</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">Exit</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">P/L</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">Open Date</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">Close Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradeHistory.map((h: any) => {
                      const fmt = (d: string) => d ? d.slice(0, 10) : '-';
                      return (
                      <tr key={h.history_id} className="border-b border-gray-100">
                        <td className="px-3 py-1.5 text-gray-500">{h.order_id ?? '-'}</td>
                        <td className="px-3 py-1.5 text-gray-500">{h.close_order_id ?? '-'}</td>
                        <td className="px-3 py-1.5 font-medium">{h.asset}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1 rounded text-[9px] font-bold ${h.type === 'BUY' || h.type === 'Buy' ? 'bg-teal-light text-brand-teal' : 'bg-coral-light text-brand-coral'}`}>{h.type}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right">{h.amount ?? '-'}</td>
                        <td className="px-3 py-1.5 text-right">{h.entry_price != null ? `$${Number(h.entry_price).toLocaleString()}` : '-'}</td>
                        <td className="px-3 py-1.5 text-right">{h.exit_price != null ? `$${Number(h.exit_price).toLocaleString()}` : '-'}</td>
                        <td className={`px-3 py-1.5 text-right font-medium ${(h.realized_pl ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{h.realized_pl != null ? `$${Number(h.realized_pl).toLocaleString()}` : '-'}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{fmt(h.entry_date)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{fmt(h.exit_date)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </section>
      {/* Edit Order Modal */}
      <EditOrderModal
        order={editingOrder}
        formData={formData}
        showModal={showModal}
        onClose={closeModal}
        onSave={async () => {
          await handleSaveOrder();
          fetchAnalyticsData();
        }}
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
      {/* Zone Group Modal */}
      <ZoneGroupModal
        showModal={showZoneGroupModal}
        onClose={() => setShowZoneGroupModal(false)}
        portfolioId={selectedPortfolio.portfolio_id}
      />
      {/* Close Order Modal */}
      <CloseOrderModal
        order={closingOrder}
        showModal={showCloseModal}
        onClose={() => { setShowCloseModal(false); setClosingOrder(null); }}
        onConfirm={handleConfirmClose}
      />
      {/* Add Order Modal */}
      <AddOrderModal
        formData={addFormData}
        showModal={showAddModal}
        onClose={closeAddModal}
        onSave={async () => {
          await handleCreateOrder(selectedPortfolio.portfolio_id);
          fetchAnalyticsData();
        }}
        onChange={handleAddFormChange}
        zones={zoneGroups.map((g) => g.zone)}
      />
    </div>
  );
};

/* ── Performance Chart Component ── */
const PerformanceChart: React.FC<{ data: any; viewMode: 'equity' | 'payoff' }> = ({ data, viewMode }) => {
  const W = 800, H = 200, PAD = 40;
  const points = viewMode === 'equity' ? data.equity_curve : data.payoff_data;

  if (!points || points.length === 0) {
    return <div className="h-40 flex items-center justify-center text-xs text-slate">No trade data yet</div>;
  }

  if (viewMode === 'equity') {
    const vals = points.map((p: any) => p.cumulative_pl);
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals, 0);
    const range = max - min || 1;
    const toY = (v: number) => PAD + (H - 2 * PAD) * (1 - (v - min) / range);
    const toX = (i: number) => PAD + (W - 2 * PAD) * (i / (points.length - 1 || 1));

    const pathD = points.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(p.cumulative_pl)}`).join(' ');
    const areaD = `${pathD} L${toX(points.length - 1)},${H - PAD} L${toX(0)},${H - PAD} Z`;

    const yTicks = [min, (min + max) / 2, max];
    const xLabels = points
      .filter((_: any, i: number) => i % Math.max(1, Math.floor(points.length / 5)) === 0)
      .map((p: any) => ({ label: p.date?.slice(0, 7) || '', x: toX(points.indexOf(p)) }));

    return (
      <div className="h-40 relative">
        <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="perfGrad" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#4262ff" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#4262ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((v) => (
            <line key={v} x1={PAD} x2={W - PAD} y1={toY(v)} y2={toY(v)} stroke="#e0e2e8" strokeWidth="1" />
          ))}
          <path d={areaD} fill="url(#perfGrad)" />
          <path d={pathD} fill="none" stroke="#4262ff" strokeWidth="2" />
          {points.map((p: any, i: number) => (
            <circle key={i} cx={toX(i)} cy={toY(p.cumulative_pl)} fill="#4262ff" r="2.5" stroke="#fff" strokeWidth="1.5" />
          ))}
        </svg>
        <div className="flex justify-between mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">
          {xLabels.map((xl: any, i: number) => (
            <span key={i}>{xl.label}</span>
          ))}
        </div>
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[9px] text-slate font-medium py-[2px]">
          <span>${max.toLocaleString()}</span>
          <span>${min.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  /* ── Payoff bars ── */
  const pls = points.map((p: any) => p.realized_pl);
  const maxAbs = Math.max(...pls.map(Math.abs), 1);
  const barW = Math.max(4, Math.min(20, (W - 2 * PAD) / points.length - 2));

  return (
    <div className="h-40 relative">
      <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="#e0e2e8" strokeWidth="1" />
        <line x1={PAD} x2={PAD} y1={PAD} y2={H - PAD} stroke="#e0e2e8" strokeWidth="1" />
        {points.map((p: any, i: number) => {
          const barH = (Math.abs(p.realized_pl) / maxAbs) * (H / 2 - PAD);
          const x = PAD + (W - 2 * PAD) * (i / (points.length - 1 || 1));
          const y = p.realized_pl >= 0 ? H / 2 - barH : H / 2;
          return (
            <rect
              key={i}
              x={x - barW / 2}
              y={y}
              width={barW}
              height={barH || 1}
              fill={p.realized_pl >= 0 ? '#00b473' : '#e74c3c'}
              rx="1"
            />
          );
        })}
      </svg>
      <div className="flex justify-between mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">
        {points
          .filter((_: any, i: number) => i % Math.max(1, Math.floor(points.length / 5)) === 0)
          .map((p: any, i: number) => (
            <span key={i}>{p.date?.slice(0, 7) || ''}</span>
          ))}
      </div>
    </div>
  );
};

export default PortfolioGrid;