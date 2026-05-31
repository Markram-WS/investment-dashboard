import React, { useState, useMemo, useCallback } from "react";
import { EditOrderModal } from "./EditOrderModal";
import { AddOrderModal } from "./AddOrderModal";
import { ZoneEditModal } from "./ZoneEditModal";
import { ZoneGroupModal } from "./ZoneGroupModal";
import { CloseOrderModal } from "./CloseOrderModal";
import { useOrderEdit } from "../hooks/useOrderEdit";
import { useAddOrder } from "../hooks/useAddOrder";
import { usePortfolioManager } from "../hooks/usePortfolioManager";
import { useZoneEditor } from "../hooks/useZoneEditor";
import { useMarkdownRenderer } from "../hooks/useMarkdownRenderer";
import { SpreadOrder } from "../types";
import { api } from "../lib/api";

import PortfolioHeader from "./components/PortfolioHeader";
import SummaryCard from "./components/SummaryCard";
import StrategyNotes from "./components/StrategyNotes";
import PerformanceSection from "./components/PerformanceSection";
import OrderManagement from "./components/OrderManagement";

const PortfolioGrid: React.FC = () => {
  const {
    portfolios,
    selectedPortfolio,
    setSelectedPortfolio,
    loading,
    error,
    lastUpdated,
    fetchAnalyticsData,
  } = usePortfolioManager();

  const [groupByZone, setGroupByZone] = useState(true);
  const [showZoneGroupModal, setShowZoneGroupModal] = useState(false);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [closingOrder, setClosingOrder] = useState<SpreadOrder | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const [viewMode, setViewMode] = useState<"equity" | "payoff">("equity");
  const [performanceData, setPerformanceData] = useState<any>(null);

  React.useEffect(() => {
    if (selectedPortfolio) {
      api.getPerformance(selectedPortfolio.portfolio_id).then(setPerformanceData).catch(() => {});
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

  const handleCloseOrder = useCallback((order: SpreadOrder) => {
    setClosingOrder(order);
    setShowCloseModal(true);
  }, []);

  const handleConfirmClose = useCallback(
    async (orderId: string, closeOrderId: string, exitPrice: number | null, realizedPl: number | null) => {
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
        console.error("Failed to close order:", err);
      }
    },
    [fetchAnalyticsData, selectedPortfolio],
  );

  const activeOrders = useMemo(
    () => (selectedPortfolio?.active_orders || []).filter((o) => o.order_status !== "closed"),
    [selectedPortfolio?.active_orders],
  );

  const zoneGroups = useMemo(() => {
    const groups: Record<string, any> = {};
    const sorted = [...activeOrders].sort((a, b) => (b.entry_price ?? 0) - (a.entry_price ?? 0));
    sorted.forEach((order) => {
      const zone = order.zone || "ZONE A";
      if (!groups[zone]) groups[zone] = { zone, mainOrders: [], pendingCloseOrders: [] };
      if (order.order_status === "filled") groups[zone].mainOrders.push(order);
      else if (order.order_status === "pending_sync") groups[zone].pendingCloseOrders.push(order);
    });
    return Object.values(groups);
  }, [activeOrders]);

  const { renderMarkdown, isGridType } = useMarkdownRenderer();

  if (loading) return <div className="p-6"><p className="text-gray-500">Loading portfolio analytics...</p></div>;
  if (error) return <div className="p-6"><p className="text-red-500">Error: {error}</p></div>;
  if (!selectedPortfolio) return <div className="p-6"><p className="text-gray-500">No portfolio data available.</p></div>;

  const totalCash = (selectedPortfolio.available_cash || 0) + (selectedPortfolio.money_market || 0);
  const cumulativePl = performanceData?.total_pl || 0;
  const totalValue = totalCash + cumulativePl;
  const plPercent = totalCash > 0 ? (cumulativePl / totalCash) * 100 : 0;
  const marginLocked = selectedPortfolio.margin_locked || 0;
  const cashBufferLimit = selectedPortfolio.cash_buffer_limit || 0;
  const availableCash = totalCash + cumulativePl - (selectedPortfolio.money_market || 0) - marginLocked - cashBufferLimit;

  const handleRefresh = () => {
    fetchAnalyticsData();
    if (selectedPortfolio) {
      api.getPerformance(selectedPortfolio.portfolio_id).then(setPerformanceData).catch(() => {});
    }
  };

  return (
    <div className="px-10 py-6 min-h-screen max-w-[1800px] mx-auto">
      <PortfolioHeader
        portfolioName={selectedPortfolio.portfolio_name}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        onAddOrder={openModal}
      />

      <section className="grid grid-cols-12 gap-6 mb-6">
        <SummaryCard
          totalValue={totalValue}
          totalCash={totalCash}
          cumulativePl={cumulativePl}
          plPercent={plPercent}
          availableCash={availableCash}
          marginLocked={marginLocked}
          cashBufferLimit={cashBufferLimit}
          moneyMarket={selectedPortfolio.money_market || 0}
          riskStatus={selectedPortfolio.risk_status}
          tags={selectedPortfolio.tags}
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
      />

      <EditOrderModal
        order={editingOrder}
        formData={formData}
        showModal={showEditModal}
        onClose={closeModal}
        onSave={async () => { await handleSaveOrder(); fetchAnalyticsData(); }}
        onChange={handleFormChange}
        zones={zoneGroups.map((g) => g.zone)}
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
        onClose={() => setShowZoneGroupModal(false)}
        portfolioId={selectedPortfolio.portfolio_id}
      />
      <CloseOrderModal
        order={closingOrder}
        showModal={showCloseModal}
        onClose={() => { setShowCloseModal(false); setClosingOrder(null); }}
        onConfirm={handleConfirmClose}
      />
      <AddOrderModal
        formData={addFormData}
        showModal={showAddModal}
        onClose={closeAddModal}
        onSave={async () => { await handleCreateOrder(selectedPortfolio.portfolio_id); fetchAnalyticsData(); }}
        onChange={handleAddFormChange}
        zones={zoneGroups.map((g) => g.zone)}
      />
    </div>
  );
};

export default PortfolioGrid;
