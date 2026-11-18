import React, { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { EditOrderModal } from "./EditOrderModal";
import { AddOrderModal } from "./AddOrderModal";
import { ZoneGroupModal } from "./ZoneGroupModal";
import { CloseOrderModal } from "./CloseOrderModal";
import EditPortfolioModal from "./EditPortfolioModal";
import { useOrderEdit } from "../hooks/useOrderEdit";
import { useAddOrder } from "../hooks/useAddOrder";
import { usePortfolioManager } from "../hooks/usePortfolioManager";
import { useMarkdownRenderer } from "../hooks/useMarkdownRenderer";
import { SpreadOrder } from "../types";
import { api } from "../lib/api";
import type { ZoneGroupRecord, TradeHistoryRecord } from "../lib/api";

import PortfolioHeader from "./components/PortfolioHeader";
import PageLayout from "../components/PageLayout";
import PoolRail from "./components/PoolRail";
import OrderDetailLadder from "./components/OrderDetailLadder";
import OrderHistoryCard from "./components/OrderHistoryCard";
import RiskCard from "./components/RiskCard";
import StrategyNotes from "./components/StrategyNotes";
import PerformanceSection from "./components/PerformanceSection";
import OptionsStrategyTable from "./components/OptionsStrategyTable";
import TradeHistoryTable from "./components/TradeHistoryTable";
import ModalShell from "./components/ModalShell";
import type { OptionRow } from "./components/OptionsStrategyTable";
import { useNotification } from "../contexts/NotificationContext";

interface PortfolioGridProps {
  portfolioId?: number | string;
}

const PortfolioGrid: React.FC<PortfolioGridProps> = ({ portfolioId }) => {
  const {
    selectedPortfolio,
    loading,
    error,
    lastUpdated,
    fetchAnalyticsData,
  } = usePortfolioManager(portfolioId);

  const [showZoneGroupModal, setShowZoneGroupModal] = useState(false);
  const [groups, setGroups] = useState<ZoneGroupRecord[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [closingOrder, setClosingOrder] = useState<SpreadOrder | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEditPortfolioModal, setShowEditPortfolioModal] = useState(false);
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<"equity" | "payoff">("payoff");
  const [performanceData, setPerformanceData] = useState<any>(null);

  // Payoff state with per-portfolio localStorage
  const pid = selectedPortfolio?.portfolio_id ?? null;
  const pidRef = useRef<typeof pid>(pid);
  pidRef.current = pid;

  const payoffKey = (key: string) => pid ? `payoff_${key}_${pid}` : '';

  const [strategyRows, setStrategyRows] = useState<OptionRow[]>([]);
  const [ivMode, setIvMode] = useState<boolean>(false);
  const [payoffMinPrice, setPayoffMinPrice] = useState<number>(0);
  const [payoffMaxPrice, setPayoffMaxPrice] = useState<number>(0);
  const [activeIVs, setActiveIVs] = useState<Record<string, number>>({});

  // Load / migrate from localStorage when portfolio changes
  React.useEffect(() => {
    if (!pid) return;
    const load = (key: string, fallback: string) => {
      try { return JSON.parse(localStorage.getItem(payoffKey(key)) || fallback); }
      catch { return JSON.parse(fallback); }
    };
    setStrategyRows(load('strategy_rows', '[]'));
    setIvMode(load('iv_mode', 'false'));
    setPayoffMinPrice(load('min_price', '0'));
    setPayoffMaxPrice(load('max_price', '0'));
    setActiveIVs(load('active_ivs', '{}'));

    // One-time migration from old non-portfolio keys
    const oldKeys = ['payoff_strategy_rows', 'payoff_iv_mode', 'payoff_min_price', 'payoff_max_price', 'payoff_active_ivs'];
    const suffixMap: Record<string, string> = {
      payoff_strategy_rows: 'strategy_rows',
      payoff_iv_mode: 'iv_mode',
      payoff_min_price: 'min_price',
      payoff_max_price: 'max_price',
      payoff_active_ivs: 'active_ivs',
    };
    for (const oldKey of oldKeys) {
      const val = localStorage.getItem(oldKey);
      if (val !== null) {
        const newKey = payoffKey(suffixMap[oldKey]);
        if (localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, val);
        }
        localStorage.removeItem(oldKey);
      }
    }
  }, [pid]);

  // Save to per-portfolio localStorage on change
  React.useEffect(() => {
    const p = pidRef.current;
    if (!p) return;
    localStorage.setItem(`payoff_strategy_rows_${p}`, JSON.stringify(strategyRows));
  }, [strategyRows]);
  React.useEffect(() => {
    const p = pidRef.current;
    if (!p) return;
    localStorage.setItem(`payoff_iv_mode_${p}`, JSON.stringify(ivMode));
  }, [ivMode]);
  React.useEffect(() => {
    const p = pidRef.current;
    if (!p) return;
    localStorage.setItem(`payoff_min_price_${p}`, JSON.stringify(payoffMinPrice));
  }, [payoffMinPrice]);
  React.useEffect(() => {
    const p = pidRef.current;
    if (!p) return;
    localStorage.setItem(`payoff_max_price_${p}`, JSON.stringify(payoffMaxPrice));
  }, [payoffMaxPrice]);
  React.useEffect(() => {
    const p = pidRef.current;
    if (!p) return;
    localStorage.setItem(`payoff_active_ivs_${p}`, JSON.stringify(activeIVs));
  }, [activeIVs]);

  React.useEffect(() => {
    if (selectedPortfolio) {
      api.getPerformance(selectedPortfolio.portfolio_id).then(setPerformanceData).catch(() => {});
      api.getZoneGroups(selectedPortfolio.portfolio_id).then(setGroups).catch(() => {});
    }
  }, [selectedPortfolio?.portfolio_id]);

  const {
    editingOrder,
    formData,
    showModal: showEditModal,
    startEdit,
    closeModal,
    handleFormChange,
    handleSaveOrder,
    setOnRefresh,
  } = useOrderEdit(selectedPortfolio?.portfolio_id);

  const {
    formData: addFormData,
    showModal: showAddModal,
    openModal,
    closeModal: closeAddModal,
    handleFormChange: handleAddFormChange,
    handleCreateOrder,
  } = useAddOrder();

  React.useEffect(() => {
    setOnRefresh(() => fetchAnalyticsData);
  }, [setOnRefresh, fetchAnalyticsData]);

  React.useEffect(() => {
    if (selectedPortfolio) {
      api.getTradeHistory(selectedPortfolio.portfolio_id).then(setTradeHistory).catch(() => {});
    }
  }, [selectedPortfolio?.portfolio_id]);

  const activeOrders = useMemo(
    () => (selectedPortfolio?.active_orders || []).filter((o) => o.order_status !== "closed").sort((a, b) => {
      const cmp = (a.asset_type || '').localeCompare(b.asset_type || '');
      if (cmp !== 0) return cmp;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }),
    [selectedPortfolio?.active_orders],
  );

  const groupOrderCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    activeOrders.forEach((o) => {
      if (o.group_id != null) counts[o.group_id] = (counts[o.group_id] || 0) + 1;
    });
    return counts;
  }, [activeOrders]);

  const assetTypeOptions = useMemo(() => {
    const allOrders = selectedPortfolio?.active_orders || [];
    const types = new Set<string>();
    allOrders.forEach((o: SpreadOrder) => { if (o.asset_type) types.add(o.asset_type); });
    return Array.from(types).sort();
  }, [selectedPortfolio?.active_orders]);

  /** Notional per product class — the risk card exposure bars. */
  const exposure = useMemo(() => {
    const byClass = new Map<string, number>();
    for (const order of activeOrders) {
      const notional = Math.abs((order.entry_price ?? 0) * Number(order.qty ?? 0));
      const contract = order.contract_type ?? "spot";
      const label = contract === "option"
        ? "Options"
        : contract === "future" || (order.leverage ?? 0) > 0
          ? "Futures"
          : order.asset_type || "Spot";
      byClass.set(label, (byClass.get(label) ?? 0) + notional);
    }
    const total = [...byClass.values()].reduce((sum, v) => sum + v, 0);
    if (total === 0) return [];
    return [...byClass.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, value]) => ({ label, percent: Math.round((value / total) * 100) }));
  }, [activeOrders]);

  const handleCloseOrder = useCallback((order: SpreadOrder) => {
    const status = (order.order_status || "").toUpperCase();
    if (status === "PENDING") {
      api.cancelOrder(order.order_id, selectedPortfolio?.portfolio_id).then(() => {
        fetchAnalyticsData();
        if (selectedPortfolio) {
          api.getTradeHistory(selectedPortfolio.portfolio_id).then(setTradeHistory).catch(() => {});
        }
      }).catch((err) => console.error("Failed to cancel order:", err));
    } else {
      setClosingOrder(order);
      setShowCloseModal(true);
    }
  }, [fetchAnalyticsData, selectedPortfolio]);

  const handleAssignGroup = useCallback(async (orderIds: string[], groupId: number | null) => {
    if (!selectedPortfolio || orderIds.length === 0) return;
    const warnings: string[] = [];
    for (const orderId of orderIds) {
      const currentOrder = activeOrders.find(o => o.order_id === orderId);
      if (!currentOrder || currentOrder.group_id === groupId) continue;
      if (groupId != null) {
        const groupDef = groups.find(g => g.id === groupId);
        if (!groupDef) return;
        if (groupDef.max_orders != null) {
          const currentCount = groupOrderCounts[groupId] || 0;
          if (currentCount >= groupDef.max_orders) {
            warnings.push(`Group "${groupDef.name}" is at maximum capacity (${groupDef.max_orders}).`);
          }
        }
        if (groupDef.min_price != null && currentOrder.entry_price != null && currentOrder.entry_price < groupDef.min_price) {
          warnings.push(`Entry price ($${currentOrder.entry_price.toLocaleString()}) is below the group minimum price ($${groupDef.min_price.toLocaleString()}).`);
        }
        if (groupDef.max_price != null && currentOrder.entry_price != null && currentOrder.entry_price > groupDef.max_price) {
          warnings.push(`Entry price ($${currentOrder.entry_price.toLocaleString()}) exceeds the group maximum price ($${groupDef.max_price.toLocaleString()}).`);
        }
      }
    }
    if (warnings.length > 0) {
      notify(warnings.join(" "), 'warning');
    }
    try {
      for (const orderId of orderIds) {
        const currentOrder = activeOrders.find(o => o.order_id === orderId);
        if (!currentOrder || currentOrder.group_id === groupId) continue;
        await api.updateOrder(orderId, { group_id: groupId }, selectedPortfolio?.portfolio_id);
      }
      fetchAnalyticsData();
      api.getTradeHistory(selectedPortfolio.portfolio_id).then(setTradeHistory).catch(() => {});
    } catch (err) {
      console.error("Failed to assign group:", err);
    }
  }, [selectedPortfolio, activeOrders, groups, groupOrderCounts, fetchAnalyticsData]);

  const handleDropOnTradeHistory = useCallback((orderId: string) => {
    const order = activeOrders.find(o => o.order_id === orderId);
    if (order) {
      handleCloseOrder(order);
    }
  }, [activeOrders, handleCloseOrder]);

  const handleLinkOrder = useCallback(async (sourceOrderId: string, targetOrderId: string) => {
    try {
      await api.linkOrder(sourceOrderId, targetOrderId, selectedPortfolio?.portfolio_id);
      fetchAnalyticsData();
    } catch (err) {
      console.error("Failed to link order:", err);
    }
  }, [fetchAnalyticsData, selectedPortfolio]);

  const handleConfirmClose = useCallback(
    async (orderId: string, closeOrderId: string, exitPrice: number | null, realizedPl: number | null, cost?: number) => {
      try {
        const resp = await api.closeOrder(orderId, { close_order_id: closeOrderId, exit_price: exitPrice, realized_pl: realizedPl, cost }, selectedPortfolio?.portfolio_id);
        setShowCloseModal(false);
        setClosingOrder(null);
        fetchAnalyticsData();
        if (selectedPortfolio) {
          const data = await api.getTradeHistory(selectedPortfolio.portfolio_id);
          setTradeHistory(data);
          api.getPerformance(selectedPortfolio.portfolio_id).then(setPerformanceData).catch(() => {});
        }
        // If spread pair (mutual link), auto-open close modal for the paired order
        if (resp.paired_order_id) {
          const pairedOrder = activeOrders.find(o => o.order_id === resp.paired_order_id);
          if (pairedOrder) {
            setClosingOrder(pairedOrder);
            setShowCloseModal(true);
          }
        }
      } catch (err) {
        console.error("Failed to close order:", err);
      }
    },
    [fetchAnalyticsData, selectedPortfolio, activeOrders],
  );

  const { renderMarkdown } = useMarkdownRenderer();

  if (loading) return <PageLayout><p className="text-slate">Loading portfolio analytics...</p></PageLayout>;
  if (error) return <PageLayout><p style={{ color: "var(--color-danger-text)" }}>Error: {error}</p></PageLayout>;
  if (!selectedPortfolio) return <PageLayout><p className="text-slate">No portfolio data available.</p></PageLayout>;

  const cumulativePl = performanceData?.total_pl || 0;
  const marginLocked = selectedPortfolio.margin_locked || 0;
  const cashBufferLimit = selectedPortfolio.cash_buffer_limit || 0;
  const cash = selectedPortfolio.available_cash || 0;
  const cashAvailable = cash + cumulativePl;
  const pool = marginLocked + cashBufferLimit + cash;
  const totalNotional = activeOrders.reduce((sum, o) => sum + (o.entry_price || 0) * Number(o.qty || 0), 0);
  const totalValue = pool + cumulativePl + totalNotional;
  const plPercent = pool > 0 ? (cumulativePl / pool) * 100 : 0;
  const bufferCoverage = cashBufferLimit > 0 ? (cashAvailable / cashBufferLimit) * 100 : (cash > 0 ? 100 : 0);
  const marginUsed = pool > 0 ? (marginLocked / pool) * 100 : 0;

  const handleRefresh = () => {
    fetchAnalyticsData();
    if (selectedPortfolio) {
      api.getPerformance(selectedPortfolio.portfolio_id).then(setPerformanceData).catch(() => {});
    }
  };

  const refreshGroups = () => {
    if (selectedPortfolio) {
      api.getZoneGroups(selectedPortfolio.portfolio_id).then(setGroups).catch(() => {});
    }
    fetchAnalyticsData();
  };

  return (
    <PageLayout>
      <div className="at-page">
        <PortfolioHeader
          portfolioName={selectedPortfolio.portfolio_name}
          portType={selectedPortfolio.port_type}
          tags={selectedPortfolio.tags}
          lastUpdated={lastUpdated}
          onRefresh={handleRefresh}
          onEditPortfolio={() => setShowEditPortfolioModal(true)}
        />

        <PoolRail
          totalValue={totalValue}
          plPercent={plPercent}
          totalPl={cumulativePl}
          cash={cash}
          marginLocked={marginLocked}
          cashBufferLimit={cashBufferLimit}
          availableCash={cashAvailable}
          bufferCoverage={bufferCoverage}
          marginUsed={marginUsed}
        />

        <div className="at-workspace">
          <div className="at-col">
            <OrderDetailLadder
              activeOrders={activeOrders}
              zones={groups}
              onShowZoneGroupModal={() => setShowZoneGroupModal(true)}
              onAddOrder={openModal}
              onEditOrder={startEdit}
              onCloseOrder={handleCloseOrder}
              onAssignGroup={handleAssignGroup}
              onLinkOrder={handleLinkOrder}
            />
            <OrderHistoryCard
              tradeHistory={tradeHistory}
              onViewAll={() => setShowHistoryModal(true)}
              onDropOrder={handleDropOnTradeHistory}
            />
          </div>

          <div className="at-col at-right">
            <section className="at-card at-payoff" aria-label="Payoff">
              <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
                <h2 style={{ margin: 0, fontSize: "var(--fs-section)", fontWeight: 600 }}>Payoff</h2>
                <button type="button" className="at-notes-edit" onClick={() => setShowStrategyModal(true)}>
                  Option legs
                </button>
              </div>
              <PerformanceSection
                embedded
                performanceData={performanceData}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                activeOrders={activeOrders}
                strategyRows={strategyRows}
                ivMode={ivMode}
                payoffMinPrice={payoffMinPrice}
                payoffMaxPrice={payoffMaxPrice}
                activeIVs={activeIVs}
              />
            </section>

            <RiskCard
              exposure={exposure}
              strategySet={Boolean(selectedPortfolio.trade_plan_md?.trim())}
              notesPresent={Boolean(selectedPortfolio.internal_notes?.trim())}
              onEdit={() => setShowNotesModal(true)}
            />
          </div>
        </div>
      </div>

      <EditOrderModal
        order={editingOrder}
        formData={formData}
        showModal={showEditModal}
        onClose={closeModal}
        onSave={async () => { await handleSaveOrder(); fetchAnalyticsData(); }}
        onChange={handleFormChange}
        groups={groups}
        groupOrderCounts={groupOrderCounts}
        assetTypeOptions={assetTypeOptions}
        activeOrders={activeOrders}
        onRefresh={fetchAnalyticsData}
        portfolioId={selectedPortfolio?.portfolio_id}
      />
      <ZoneGroupModal
        showModal={showZoneGroupModal}
        onClose={() => {
          setShowZoneGroupModal(false);
          refreshGroups();
        }}
        portfolioId={selectedPortfolio.portfolio_id}
        onSaved={refreshGroups}
      />
      <CloseOrderModal
        order={closingOrder}
        showModal={showCloseModal}
        onClose={() => { setShowCloseModal(false); setClosingOrder(null); }}
        onConfirm={handleConfirmClose}
        activeOrders={activeOrders}
      />
      <AddOrderModal
        formData={addFormData}
        showModal={showAddModal}
        onClose={closeAddModal}
        onSave={async () => {
          const id = String(addFormData.order_id ?? '').trim();
          if (id && activeOrders.some((o) => o.order_id === id)) {
            notify('Order ID already exists', 'warning');
            return;
          }
          const result = await handleCreateOrder(selectedPortfolio.portfolio_id);
          if (result.ok) {
            fetchAnalyticsData();
          } else {
            notify(result.message ?? 'Create order failed', 'warning');
          }
        }}
        onChange={handleAddFormChange}
        groups={groups}
        groupOrderCounts={groupOrderCounts}
        assetTypeOptions={assetTypeOptions}
      />

      <ModalShell open={showStrategyModal} onClose={() => setShowStrategyModal(false)} title="Option legs">
        <div style={{ width: 620, maxWidth: "92vw" }}>
          <OptionsStrategyTable
            visible
            onClose={() => setShowStrategyModal(false)}
            onRowsChange={setStrategyRows}
          />
        </div>
      </ModalShell>

      <ModalShell open={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="Order history">
        <div className="bg-canvas rounded-xl p-3" style={{ width: 760, maxWidth: "94vw" }}>
          <TradeHistoryTable
            tradeHistory={tradeHistory}
            showHistory={historyOpen}
            onToggleHistory={() => setHistoryOpen((open) => !open)}
            onDropOnTradeHistory={handleDropOnTradeHistory}
          />
        </div>
      </ModalShell>

      <ModalShell open={showNotesModal} onClose={() => setShowNotesModal(false)} title="Strategy & notes">
        <div style={{ width: 520, maxWidth: "92vw" }}>
          <StrategyNotes
            tradePlanMd={selectedPortfolio.trade_plan_md}
            portfolioId={selectedPortfolio.portfolio_id}
            renderMarkdown={renderMarkdown}
            internalNotes={selectedPortfolio.internal_notes}
            onSaved={fetchAnalyticsData}
          />
        </div>
      </ModalShell>

      <EditPortfolioModal
        portfolioId={selectedPortfolio.portfolio_id}
        portfolioName={selectedPortfolio.portfolio_name}
        marginLocked={marginLocked}
        cashBufferLimit={cashBufferLimit}
        rawAvailableCash={selectedPortfolio.available_cash || 0}
        cumulativePl={cumulativePl}
        tags={selectedPortfolio.tags}
        showModal={showEditPortfolioModal}
        onClose={() => setShowEditPortfolioModal(false)}
        onSaved={() => { fetchAnalyticsData(); }}
        onDepositWithdraw={(msg) => notify(msg, 'success')}
        activeOrderCount={activeOrders.length}
        onDeleted={() => {
          const deletedPid = selectedPortfolio?.portfolio_id;
          if (deletedPid) {
            ['strategy_rows', 'iv_mode', 'min_price', 'max_price', 'active_ivs', 'current_price'].forEach(k =>
              localStorage.removeItem(`payoff_${k}_${deletedPid}`)
            );
          }
          navigate("/");
        }}
      />
    </PageLayout>
  );
};

export default PortfolioGrid;
