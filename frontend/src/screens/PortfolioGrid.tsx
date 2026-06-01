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
import { SpreadOrder, AllocationItem } from "../types";
import { api } from "../lib/api";
import { allocationColors } from "../constants/colors";

import PortfolioHeader from "./components/PortfolioHeader";
import SummaryCard from "./components/SummaryCard";
import StrategyNotes from "./components/StrategyNotes";
import PerformanceSection from "./components/PerformanceSection";
import OrderManagement from "./components/OrderManagement";

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
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [closingOrder, setClosingOrder] = useState<SpreadOrder | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEditPortfolioModal, setShowEditPortfolioModal] = useState(false);
  const navigate = useNavigate();

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
  );
};

export default PortfolioGrid;
