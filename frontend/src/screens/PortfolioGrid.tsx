import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { EditOrderModal } from "./EditOrderModal";
import { AddOrderModal } from "./AddOrderModal";
import { ZoneEditModal } from "./ZoneEditModal";
import { ZoneGroupModal } from "./ZoneGroupModal";
import { CloseOrderModal } from "./CloseOrderModal";
import EditPortfolioModal from "./EditPortfolioModal";
import { useOrderEdit } from "../hooks/useOrderEdit";
import { useAddOrder } from "../hooks/useAddOrder";
import { usePortfolioManager } from "../hooks/usePortfolioManager";
import { useZoneEditor } from "../hooks/useZoneEditor";
import { useMarkdownRenderer } from "../hooks/useMarkdownRenderer";
import { SpreadOrder, AllocationItem, GroupOption } from "../types";
import { api } from "../lib/api";
import { allocationColors } from "../constants/colors";

import PortfolioHeader from "./components/PortfolioHeader";
import SummaryCard from "./components/SummaryCard";
import StrategyNotes from "./components/StrategyNotes";
import PerformanceSection from "./components/PerformanceSection";
import OrderManagement from "./components/OrderManagement";
import ToastAlert from "./components/ToastAlert";

interface PortfolioGridProps {
  portfolioId?: number | string;
}

const PortfolioGrid: React.FC<PortfolioGridProps> = ({ portfolioId }) => {
  const {
    portfolios,
    selectedPortfolio,
    setSelectedPortfolio,
    loading,
    error,
    lastUpdated,
    fetchAnalyticsData,
  } = usePortfolioManager(portfolioId);

  const [groupByZone, setGroupByZone] = useState(true);
  const [showZoneGroupModal, setShowZoneGroupModal] = useState(false);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [closingOrder, setClosingOrder] = useState<SpreadOrder | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEditPortfolioModal, setShowEditPortfolioModal] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const [contractFilter, setContractFilter] = useState<'spot' | 'future' | 'option'>('spot');
  const [viewMode, setViewMode] = useState<"equity" | "payoff">("equity");
  const [performanceData, setPerformanceData] = useState<any>(null);

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
  } = useOrderEdit();

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

  const {
    editingZoneOrders,
    editingZone,
    handleEditZone,
    handleCloseZoneModal,
    handleSaveZone,
  } = useZoneEditor(fetchAnalyticsData);

  React.useEffect(() => {
    if (selectedPortfolio) {
      api.getTradeHistory(selectedPortfolio.portfolio_id).then(setTradeHistory).catch(() => {});
    }
  }, [selectedPortfolio?.portfolio_id]);

  const activeOrders = useMemo(
    () => (selectedPortfolio?.active_orders || []).filter((o) => o.order_status !== "closed"),
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
    allOrders.forEach((o: any) => { if (o.asset_type) types.add(o.asset_type); });
    return Array.from(types).sort();
  }, [selectedPortfolio?.active_orders]);

  const handleCloseOrder = useCallback((order: SpreadOrder) => {
    const status = (order.order_status || "").toUpperCase();
    if (status === "PENDING") {
      api.cancelOrder(order.order_id).then(() => {
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

  const handleAssignGroup = useCallback(async (orderId: string, groupId: number | null) => {
    if (!selectedPortfolio) return;
    const currentOrder = activeOrders.find(o => o.order_id === orderId);
    if (currentOrder && currentOrder.group_id === groupId) return;
    const warnings: string[] = [];
    if (groupId != null && currentOrder) {
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
    if (warnings.length > 0) {
      setAlertMsg(warnings.join(" "));
    }
    try {
      await api.updateOrder(orderId, { group_id: groupId });
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
      await api.linkOrder(sourceOrderId, targetOrderId);
      fetchAnalyticsData();
    } catch (err) {
      console.error("Failed to link order:", err);
    }
  }, [fetchAnalyticsData]);

  const handleConfirmClose = useCallback(
    async (orderId: string, closeOrderId: string, exitPrice: number | null, realizedPl: number | null, cost?: number) => {
      try {
        const resp = await api.closeOrder(orderId, { close_order_id: closeOrderId, exit_price: exitPrice, realized_pl: realizedPl, cost });
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

  const zoneGroups = useMemo(() => {
    const sorted = [...activeOrders].sort((a, b) => (b.entry_price ?? 0) - (a.entry_price ?? 0));
    const groupMap: Record<number, { group_id: number; group_name: string; mainOrders: SpreadOrder[]; pendingCloseOrders: SpreadOrder[] }> = {};
    const ungrouped: SpreadOrder[] = [];
    sorted.forEach((order) => {
      if (order.group_id != null && order.group_name) {
        if (!groupMap[order.group_id]) groupMap[order.group_id] = { group_id: order.group_id, group_name: order.group_name, mainOrders: [], pendingCloseOrders: [] };
        groupMap[order.group_id].mainOrders.push(order);
      } else {
        ungrouped.push(order);
      }
    });
    const sortedGroups = Object.values(groupMap).sort((a, b) => {
      const ga = groups.find(g => g.id === a.group_id);
      const gb = groups.find(g => g.id === b.group_id);
      const aMin = ga?.min_price ?? Number.NEGATIVE_INFINITY;
      const bMin = gb?.min_price ?? Number.NEGATIVE_INFINITY;
      if (bMin !== aMin) return bMin - aMin;
      const aMax = ga?.max_price ?? Number.NEGATIVE_INFINITY;
      const bMax = gb?.max_price ?? Number.NEGATIVE_INFINITY;
      if (bMax !== aMax) return bMax - aMax;
      return (a.group_name || '').localeCompare(b.group_name || '');
    });
    return [...sortedGroups, { group_id: null as any, group_name: 'Ungrouped Orders', mainOrders: ungrouped, pendingCloseOrders: [] as SpreadOrder[] }];
  }, [activeOrders, groups]);

  const { renderMarkdown, isGridType } = useMarkdownRenderer();

  const assetAllocation: AllocationItem[] = useMemo(() => {
    const groups: Record<string, number> = {};
    const orders = selectedPortfolio?.active_orders || [];
    (orders.filter((o) => o.order_status !== "closed")).forEach((o: any) => {
      const asset = o.asset_type || "Other";
      const notional = (o.entry_price || 0) * Number(o.qty || 0);
      groups[asset] = (groups[asset] || 0) + notional;
    });
    const total = Object.values(groups).reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label,
        percentage: (value / total) * 100,
        color: allocationColors[i % allocationColors.length],
      }));
  }, [selectedPortfolio?.active_orders]);

  const totalNotional = useMemo(() =>
    activeOrders.reduce((sum, o) => sum + (o.entry_price || 0) * Number(o.qty || 0), 0),
  [activeOrders]);

  const totalCash = (selectedPortfolio?.available_cash || 0) + (selectedPortfolio?.money_market || 0);
  const cumulativePl = performanceData?.total_pl || 0;
  const totalValue = totalCash + cumulativePl;
  const plPercent = totalCash > 0 ? (cumulativePl / totalCash) * 100 : 0;
  const marginLocked = selectedPortfolio?.margin_locked || 0;
  const cashBufferLimit = selectedPortfolio?.cash_buffer_limit || 0;
  const availableCash = totalCash + cumulativePl - (selectedPortfolio?.money_market || 0) - marginLocked - cashBufferLimit;

  const riskPercent = selectedPortfolio?.risk_score ?? 0;
  const riskStatusText = riskPercent >= 100 ? "Safe" : riskPercent >= 50 ? "Warning" : "Danger";

  if (loading) return <div className="p-6"><p className="text-gray-500">Loading portfolio analytics...</p></div>;
  if (error) return <div className="p-6"><p className="text-red-500">Error: {error}</p></div>;
  if (!selectedPortfolio) return <div className="p-6"><p className="text-gray-500">No portfolio data available.</p></div>;

  const handleRefresh = () => {
    fetchAnalyticsData();
    if (selectedPortfolio) {
      api.getPerformance(selectedPortfolio.portfolio_id).then(setPerformanceData).catch(() => {});
    }
  };

  return (
    <>
      {alertMsg && <ToastAlert message={alertMsg} type="warning" onClose={() => setAlertMsg(null)} key={alertMsg} />}
      <div className="px-10 py-6 min-h-screen max-w-[1800px] mx-auto">
      <PortfolioHeader
        portfolioName={selectedPortfolio.portfolio_name}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
      />

      <section className="grid grid-cols-12 gap-6 mb-6">
        <SummaryCard
          totalValue={totalValue}
          totalCash={totalCash}
          totalNotional={totalNotional}
          cumulativePl={cumulativePl}
          plPercent={plPercent}
          availableCash={availableCash}
          marginLocked={marginLocked}
          cashBufferLimit={cashBufferLimit}
          moneyMarket={selectedPortfolio.money_market || 0}
          riskStatus={riskStatusText}
          riskPercent={riskPercent}
          tags={selectedPortfolio.tags}
          assetAllocation={assetAllocation}
          onEditPortfolio={() => setShowEditPortfolioModal(true)}
        />

        <StrategyNotes
          tradePlanMd={selectedPortfolio.trade_plan_md}
          portfolioId={selectedPortfolio.portfolio_id}
          renderMarkdown={renderMarkdown}
          internalNotes={selectedPortfolio.internal_notes}
          onSaved={fetchAnalyticsData}
        />
      </section>

      <PerformanceSection
        performanceData={performanceData}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <OrderManagement
        activeOrders={activeOrders}
        zoneGroups={zoneGroups}
        groups={groups}
        groupByZone={groupByZone}
        onGroupByZoneToggle={() => setGroupByZone(!groupByZone)}
        isGridType={isGridType(selectedPortfolio)}
        tradeHistory={tradeHistory}
        onEditOrder={startEdit}
        onEditZone={handleEditZone}
        onCloseOrder={handleCloseOrder}
        onAddOrder={openModal}
        onShowZoneGroupModal={() => setShowZoneGroupModal(true)}
        showHistory={showHistory}
        onToggleHistory={() => setShowHistory(!showHistory)}
        onAssignGroup={handleAssignGroup}
        onDropOnTradeHistory={handleDropOnTradeHistory}
        onLinkOrder={handleLinkOrder}
        contractFilter={contractFilter}
        onContractFilterChange={setContractFilter}
      />

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
      />
      <ZoneEditModal
        orders={editingZoneOrders}
        currentZone={editingZone}
        showModal={editingZoneOrders.length > 0}
        onClose={handleCloseZoneModal}
        onSave={handleSaveZone}
      />
      <ZoneGroupModal
        showModal={showZoneGroupModal}
        onClose={() => {
          setShowZoneGroupModal(false);
          if (selectedPortfolio) {
            api.getZoneGroups(selectedPortfolio.portfolio_id).then(setGroups).catch(() => {});
          }
        }}
        portfolioId={selectedPortfolio.portfolio_id}
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
        onSave={async () => { await handleCreateOrder(selectedPortfolio.portfolio_id); fetchAnalyticsData(); }}
        onChange={handleAddFormChange}
        groups={groups}
        groupOrderCounts={groupOrderCounts}
        assetTypeOptions={assetTypeOptions}
      />
      <EditPortfolioModal
        portfolioId={selectedPortfolio.portfolio_id}
        portfolioName={selectedPortfolio.portfolio_name}
        currentNav={totalCash}
        marginLocked={marginLocked}
        cashBufferLimit={cashBufferLimit}
        availableCash={selectedPortfolio.available_cash || 0}
        moneyMarket={selectedPortfolio.money_market || 0}
        tags={selectedPortfolio.tags}
        showModal={showEditPortfolioModal}
        onClose={() => setShowEditPortfolioModal(false)}
        onSaved={fetchAnalyticsData}
        activeOrderCount={activeOrders.length}
        onDeleted={() => navigate("/")}
      />
    </div>
    </>
  );
};

export default PortfolioGrid;
