import React, { useState, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EditOrderModal } from "./EditOrderModal";
import { AddOrderModal } from "./AddOrderModal";
import { ZoneGroupModal } from "./ZoneGroupModal";
import { CloseOrderModal } from "./CloseOrderModal";
import EditPortfolioModal from "./EditPortfolioModal";
import MappingModal from "./MappingModal";
import { useOrderEdit } from "../hooks/useOrderEdit";
import { useAddOrder } from "../hooks/useAddOrder";
import type { AddOrderDestination } from "../hooks/useAddOrder";
import { usePortfolioManager } from "../hooks/usePortfolioManager";
import { SpreadOrder } from "../types";
import type { AssetProduct, MappedOrderFields, OrderSource, OrderWrites } from "../types";
import { api } from "../lib/api";
import type { ZoneGroupRecord, TradeHistoryRecord, PerformanceResult } from "../lib/api";

import PortfolioHeader from "./components/PortfolioHeader";
import PageLayout from "../components/PageLayout";
import PoolRail from "./components/PoolRail";
import OrderDetailLadder from "./components/OrderDetailLadder";
import type { LadderView } from "./components/OrderDetailLadder";
import OrderHistoryCard from "./components/OrderHistoryCard";
import StrategyNotes from "./components/StrategyNotes";
import PerformanceSection from "./components/PerformanceSection";
import OptionsStrategyTable from "./components/OptionsStrategyTable";
import TradeHistoryTable from "./components/TradeHistoryTable";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD } from "./components/modalLayout";
import type { OptionRow } from "./components/OptionsStrategyTable";
import { useNotification } from "../contexts/NotificationContext";
import Button from "./components/Button";
import { formatMoney } from "../utils/format";

interface PortfolioGridProps {
  portfolioId?: number | string;
}

const LADDER_VIEW_VALUES: readonly LadderView[] = ["all", "eq", "option"];

export interface OrderRowWrites {
  edit: boolean;
  close: boolean;
  remark: boolean;
}

/** Merge order: dashboard rows before connected rows. */
const sourceRank = (source?: OrderSource | null) =>
  source === "dashboard" ? 0 : source === "mapped" ? 1 : 2;

/**
 * Per-row capabilities for a mapped portfolio. A row is actionable only when
 * the store that owns it advertises the action; a dashboard row is never gated
 * by the connected database's capabilities (and vice versa). Non-mapped
 * portfolios keep the existing always-writable behaviour.
 */
export const orderRowWrites = (
  order: Pick<SpreadOrder, "order_source">,
  writes: OrderWrites | null | undefined,
  mappedPortfolio: boolean,
): OrderRowWrites => {
  if (!mappedPortfolio) return { edit: true, close: true, remark: true };
  if (order.order_source === "mapped") {
    return {
      edit: Boolean(writes?.mapped?.update),
      close: Boolean(writes?.mapped?.delete),
      remark: Boolean(writes?.mapped?.update),
    };
  }
  if (order.order_source === "dashboard") {
    const local = writes?.dashboard_options;
    return {
      edit: Boolean(local?.update),
      close: Boolean(local?.delete),
      remark: Boolean(local?.update),
    };
  }
  // No source means no safe store to target; never guess.
  return { edit: false, close: false, remark: false };
};

/** One ladder tab per portfolio, so an unmount or reload reopens the last view. */
const ladderStorageKey = (portfolioId: number) => `at-ladder-view:${portfolioId}`;

const readLadderView = (portfolioId: number | null): LadderView | null => {
  if (portfolioId == null || !Number.isFinite(portfolioId) || portfolioId < 0 || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ladderStorageKey(portfolioId));
    return (LADDER_VIEW_VALUES as readonly string[]).includes(raw ?? "") ? (raw as LadderView) : null;
  } catch {
    return null;
  }
};

const writeLadderView = (portfolioId: number, view: LadderView) => {
  if (!Number.isFinite(portfolioId) || portfolioId < 0 || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ladderStorageKey(portfolioId), view);
  } catch {
    // Storage unavailable: the in-memory selection still applies for this mount.
  }
};

/** The API already prefixes the message; the banner shows that prefix once. */
const stripLoadErrorPrefix = (message?: string | null) => {
  const raw = message?.trim();
  if (!raw) return null;
  const detail = raw.replace(/^mapped\s+database\s+unreachable\s*[:—-]?\s*/i, '').trim();
  return detail || null;
};

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
  const [closingOrder, setClosingOrder] = useState<SpreadOrder | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEditPortfolioModal, setShowEditPortfolioModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<"equity" | "payoff">("payoff");
  const [performanceData, setPerformanceData] = useState<PerformanceResult | null>(null);

  /** Ladder tab per portfolio: a refetch remounts the ladder, so the parent keeps the selection. */
  const [ladderViews, setLadderViews] = useState<Record<number, LadderView>>(() => {
    const mountKey = portfolioId != null ? Number(portfolioId) : NaN;
    const stored = Number.isFinite(mountKey) ? readLadderView(mountKey) : null;
    return stored == null ? {} : { [mountKey]: stored };
  });

  /** Mapped portfolios are read-only at the portfolio level, but their
   * `order_writes` block may open per-entity capabilities. */
  const isMapped = Boolean(selectedPortfolio?.read_only);
  const [portfolioProducts, setPortfolioProducts] = useState<AssetProduct[]>([]);
  const [addOrderAssetType, setAddOrderAssetType] = useState('');
  const portfolioTickers = useMemo(() => (
    selectedPortfolio?.product_tickers?.length
      ? selectedPortfolio.product_tickers
      : selectedPortfolio?.product_ticker ? [selectedPortfolio.product_ticker] : []
  ), [selectedPortfolio?.product_tickers, selectedPortfolio?.product_ticker]);

  const ladderKey = selectedPortfolio?.portfolio_id
    ?? (portfolioId != null ? Number(portfolioId) : -1);
  const ladderView = ladderViews[ladderKey] ?? "all";
  const handleLadderViewChange = useCallback((next: LadderView) => {
    writeLadderView(ladderKey, next);
    setLadderViews((prev) => (prev[ladderKey] === next ? prev : { ...prev, [ladderKey]: next }));
  }, [ladderKey]);

  /** The route's portfolio is only known after analytics load, so hydrate its stored tab too. */
  React.useEffect(() => {
    const stored = readLadderView(ladderKey);
    if (stored == null) return;
    setLadderViews((prev) => (prev[ladderKey] === undefined ? { ...prev, [ladderKey]: stored } : prev));
  }, [ladderKey]);

  React.useEffect(() => {
    if (!selectedPortfolio) {
      setPortfolioProducts([]);
      return;
    }
    let cancelled = false;
    const brokerId = selectedPortfolio.broker_id ?? null;
    api.getProducts(brokerId == null ? {} : { broker_id: brokerId })
      .then((rows) => {
        if (cancelled) return;
        setPortfolioProducts(rows.filter((product) => product.broker_id === brokerId));
      })
      .catch((err) => {
        console.error('Failed to load portfolio products:', err);
        if (!cancelled) setPortfolioProducts([]);
      });
    return () => { cancelled = true; };
  }, [selectedPortfolio?.portfolio_id, selectedPortfolio?.broker_id]);

  const firstPortfolioTicker = portfolioTickers[0]?.trim() ?? '';

  React.useEffect(() => {
    if (!selectedPortfolio || !firstPortfolioTicker) {
      setAddOrderAssetType('');
      return;
    }
    const matches = portfolioProducts.filter(
      (product) => (product.ticker ?? '').toUpperCase() === firstPortfolioTicker.toUpperCase(),
    );
    if (matches.length !== 1) {
      setAddOrderAssetType('');
      return;
    }
    let cancelled = false;
    api.getProduct(matches[0].product_id)
      .then((detail) => {
        if (cancelled) return;
        const symbols = detail.symbols ?? [];
        setAddOrderAssetType(symbols.length === 1 ? (symbols[0].price_symbol ?? '') : '');
      })
      .catch(() => { if (!cancelled) setAddOrderAssetType(''); });
    return () => { cancelled = true; };
  }, [selectedPortfolio?.portfolio_id, firstPortfolioTicker, portfolioProducts]);

  const mappedOrderFields = useMemo<MappedOrderFields | undefined>(() => {
    const writes = selectedPortfolio?.order_writes?.mapped;
    return writes ? { fields: writes.fields, keyGenerated: writes.key_generated } : undefined;
  }, [selectedPortfolio?.order_writes]);

  // Payoff state with per-portfolio localStorage
  const pid = selectedPortfolio?.portfolio_id ?? null;
  const pidRef = useRef<typeof pid>(pid);
  pidRef.current = pid;

  const payoffKey = useCallback((key: string) => pid ? `payoff_${key}_${pid}` : '', [pid]);

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
  }, [pid, payoffKey]);

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
    if (pid != null) {
      api.getPerformance(pid).then(setPerformanceData).catch(() => {});
      api.getZoneGroups(pid).then(setGroups).catch(() => {});
    }
  }, [pid]);

  React.useEffect(() => {
    if (pid == null) {
      setIsCustom(false);
      return;
    }
    let cancelled = false;
    api.getPortfolio(pid)
      .then((record) => { if (!cancelled) setIsCustom(Boolean(record.is_custom)); })
      .catch((err) => {
        console.error('Failed to load portfolio connection flags:', err);
        if (!cancelled) setIsCustom(false);
      });
    return () => { cancelled = true; };
  }, [pid]);

  const {
    editingOrder,
    formData,
    showModal: showEditModal,
    startEdit,
    closeModal,
    handleFormChange,
    handleSaveOrder,
    setOnRefresh,
  } = useOrderEdit(selectedPortfolio?.portfolio_id, mappedOrderFields, isMapped);

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
    if (pid != null) {
      api.getTradeHistory(pid).then(setTradeHistory).catch(() => {});
    }
  }, [pid]);

  const activeOrders = useMemo(
    () => (selectedPortfolio?.active_orders || []).filter((o) => o.order_status !== "closed").sort((a, b) => {
      const cmp = (a.asset_type || '').localeCompare(b.asset_type || '');
      if (cmp !== 0) return cmp;
      const aTime = a.created_at ? new Date(a.created_at).getTime() : NaN;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : NaN;
      const aMissing = Number.isNaN(aTime);
      const bMissing = Number.isNaN(bTime);
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (!aMissing && aTime !== bTime) return bTime - aTime;
      const sourceCmp = sourceRank(a.order_source) - sourceRank(b.order_source);
      if (sourceCmp !== 0) return sourceCmp;
      return a.order_id.localeCompare(b.order_id);
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

  const handleCloseOrder = useCallback((order: SpreadOrder) => {
    const status = (order.order_status || "").toUpperCase();
    // A mapped-source close always writes foreign history then removes the open
    // row; a dashboard row on the same portfolio keeps the local cancel path.
    const orderSource = isMapped ? order.order_source ?? undefined : undefined;
    if (order.order_source !== "mapped" && status === "PENDING") {
      api.cancelOrder(order.order_id, selectedPortfolio?.portfolio_id, orderSource).then(() => {
        fetchAnalyticsData();
        if (selectedPortfolio) {
          api.getTradeHistory(selectedPortfolio.portfolio_id).then(setTradeHistory).catch(() => {});
        }
      }).catch((err) => console.error("Failed to cancel order:", err));
    } else {
      setClosingOrder(order);
      setShowCloseModal(true);
    }
  }, [fetchAnalyticsData, selectedPortfolio, isMapped]);

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
          warnings.push(`Entry price (${formatMoney(currentOrder.entry_price)}) is below the group minimum price (${formatMoney(groupDef.min_price)}).`);
        }
        if (groupDef.max_price != null && currentOrder.entry_price != null && currentOrder.entry_price > groupDef.max_price) {
          warnings.push(`Entry price (${formatMoney(currentOrder.entry_price)}) exceeds the group maximum price (${formatMoney(groupDef.max_price)}).`);
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
  }, [selectedPortfolio, activeOrders, groups, groupOrderCounts, fetchAnalyticsData, notify]);

  /** Inline remark edits save one field and refresh the ladder. */
  const handleUpdateRemark = useCallback(async (order: SpreadOrder, remark: string | null) => {
    try {
      const foreignRow = order.order_source === "mapped";
      // Mapped updates skip nulls; an empty string is how a column is cleared.
      await api.updateOrder(
        order.order_id,
        { remark: foreignRow ? remark ?? '' : remark },
        selectedPortfolio?.portfolio_id,
        isMapped ? order.order_source ?? undefined : undefined,
      );
      await fetchAnalyticsData();
    } catch {
      notify('Remark not saved', 'warning');
    }
  }, [selectedPortfolio?.portfolio_id, fetchAnalyticsData, notify, isMapped]);

  const handleDropOnTradeHistory = useCallback((orderId: string) => {
    const order = activeOrders.find(o => o.order_id === orderId);
    if (order) {
      handleCloseOrder(order);
    }
  }, [activeOrders, handleCloseOrder]);

  /** Header pill opens a blank form; a ladder row presets its zone and mark.
   * The product symbol is prefilled only when its product has exactly one
   * contract symbol, so the order can resolve a spec without picking. */
  const handleAddOrder = useCallback((preset?: { groupId: number | null; entryPrice: number | null }) => {
    const assetType = addOrderAssetType.trim();
    // Mapped portfolios start on the connected path when it is writable;
    // otherwise the modal opens on the only remaining path (Dashboard option).
    const destination: AddOrderDestination | undefined = isMapped
      ? (selectedPortfolio?.order_writes?.mapped?.insert ? 'mapped' : 'dashboard')
      : undefined;
    openModal({
      ...(destination ? { destination } : {}),
      group_id: isMapped ? null : preset?.groupId ?? null,
      entry_price: preset?.entryPrice ?? '',
      ...(isMapped ? { side: 'LONG', contract_type: 'option' } : {}),
      ...(assetType ? { asset_type: assetType } : {}),
    });
  }, [openModal, isMapped, addOrderAssetType, selectedPortfolio?.order_writes]);

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
        // The clicked row owns the store; a dashboard row on a mapped portfolio
        // closes locally, a mapped row closes in the connected database.
        const foreignRow = closingOrder?.order_source === 'mapped';
        const orderSource = isMapped ? closingOrder?.order_source ?? undefined : undefined;
        const resp = foreignRow
          ? await api.closeOrder(
              orderId,
              { exit_price: exitPrice, realized_pl: realizedPl },
              selectedPortfolio?.portfolio_id,
              orderSource,
            )
          : await api.closeOrder(
              orderId,
              { close_order_id: closeOrderId, exit_price: exitPrice, realized_pl: realizedPl, cost },
              selectedPortfolio?.portfolio_id,
              orderSource,
            );
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
    [fetchAnalyticsData, selectedPortfolio, activeOrders, isMapped, closingOrder],
  );

  if (loading) return (
    <PageLayout>
      <div className="at-page animate-pulse" aria-busy="true" aria-label="Loading portfolio analytics">
        <div className="at-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h-3 bg-surface rounded w-28" />
            <div className="h-5 bg-surface rounded w-64" style={{ marginTop: 8 }} />
          </div>
          <div className="at-head-meta">
            <div className="h-5 bg-surface rounded-full w-16" />
            <div className="h-5 bg-surface rounded w-20" />
            <div className="h-7 bg-surface rounded-full w-20" />
          </div>
        </div>

        <section className="at-card at-rail">
          <div>
            <div className="h-3 bg-surface rounded w-20" />
            <div className="h-6 bg-surface rounded w-32" style={{ marginTop: 8 }} />
          </div>
          <div className="at-vline" />
          <div>
            <div className="h-3 bg-surface rounded w-full" />
            <div className="h-4 bg-surface rounded w-full" style={{ marginTop: 10 }} />
          </div>
          <div className="at-vline" />
          <div className="at-rail-side">
            <div className="h-3 bg-surface rounded w-24" />
            <div className="h-3 bg-surface rounded w-full" style={{ marginTop: 12 }} />
            <div className="h-3 bg-surface rounded w-20" style={{ marginTop: 12 }} />
          </div>
        </section>

        <div className="at-workspace">
          <div className="at-col">
            <section className="at-card at-detail">
              <div className="flex items-center gap-6" style={{ padding: "0 8px 8px" }}>
                <div className="h-3 bg-surface rounded w-24" />
                <div className="h-3 bg-surface rounded w-12" />
                <div className="h-3 bg-surface rounded w-16" />
                <div className="ml-auto h-3 bg-surface rounded w-16" />
                <div className="h-3 bg-surface rounded w-12" />
              </div>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
                <div key={row} className="flex items-center gap-6 border-t border-hairline" style={{ height: 31, padding: "0 8px" }}>
                  <div className="h-3 bg-surface rounded w-40" />
                  <div className="h-3 bg-surface rounded w-16" />
                  <div className="h-3 bg-surface rounded w-20" />
                  <div className="ml-auto h-3 bg-surface rounded w-16" />
                  <div className="h-3 bg-surface rounded w-12" />
                </div>
              ))}
            </section>
            <section className="at-card" style={{ height: 116 }} />
          </div>
          <div className="at-col at-right">
            <section className="at-card at-payoff" />
          </div>
        </div>
      </div>
    </PageLayout>
  );
  if (error) return (
    <PageLayout>
      <div
        className="card"
        style={{ maxWidth: 440, margin: "12vh auto 0", textAlign: "center" }}
        role="alert"
      >
        <h1 style={{ margin: 0, fontSize: "var(--fs-section)", fontWeight: 600, color: "var(--color-ink)" }}>
          Order grid didn't load
        </h1>
        <p style={{ margin: "8px 0 20px", fontSize: "var(--fs-body)", color: "var(--color-slate)" }}>
          The server could not return this portfolio's orders.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="primary" onClick={() => { fetchAnalyticsData(); }}>Retry</Button>
          <Link
            to="/"
            style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--color-brand-teal)" }}
            className="no-underline hover:underline"
          >
            Back to Overview
          </Link>
        </div>
      </div>
    </PageLayout>
  );
  if (!selectedPortfolio) return <PageLayout><p className="text-slate">No portfolio data available.</p></PageLayout>;

  const readOnly = isMapped;
  const loadErrorDetail = stripLoadErrorPrefix(selectedPortfolio.load_error);
  const orderWrites = selectedPortfolio.order_writes ?? null;
  const mappedWrites = orderWrites?.mapped ?? null;
  const dashboardWrites = orderWrites?.dashboard_options ?? null;
  // Store-scoped: either store may be writable on a mapped portfolio.
  const canInsertMapped = !readOnly || Boolean(mappedWrites?.insert);
  const canInsertDashboard = !readOnly || Boolean(dashboardWrites?.insert);
  const canInsert = canInsertMapped || canInsertDashboard;
  const canUpdate = !readOnly || Boolean(mappedWrites?.update) || Boolean(dashboardWrites?.update);
  const canDelete = !readOnly || Boolean(mappedWrites?.delete) || Boolean(dashboardWrites?.delete);
  // Grouping, linking and zones are local-only concepts.
  const canGroup = !readOnly;
  const cumulativePl = performanceData?.total_pl || 0;
  const marginLocked = selectedPortfolio.margin_locked || 0;
  const cashBufferLimit = selectedPortfolio.cash_buffer_limit || 0;
  const cash = selectedPortfolio.available_cash || 0;
  const cashAvailable = cash + cumulativePl;
  const pool = marginLocked + cashBufferLimit + cash;
  const totalValue = cash + marginLocked + (selectedPortfolio.risk?.pl_total ?? 0);
  const plPercent = pool > 0 ? (cumulativePl / pool) * 100 : 0;
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
          showConnection={isCustom}
          onOpenConnection={() => setShowMappingModal(true)}
        />

        <PoolRail
          totalValue={totalValue}
          plPercent={plPercent}
          totalPl={cumulativePl}
          cash={cash}
          marginLocked={marginLocked}
          cashBufferLimit={cashBufferLimit}
          availableCash={cashAvailable}
          marginUsed={marginUsed}
          initialCapital={selectedPortfolio.initial_capital || 0}
          risk={selectedPortfolio.risk}
        />

        {selectedPortfolio.load_error && (
          <div
            className="at-load-error"
            role="status"
            style={{
              background: 'color-mix(in srgb, var(--color-warning) 12%, var(--color-canvas))',
              border: '1px solid color-mix(in srgb, var(--color-warning) 40%, var(--color-hairline))',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: '4px 10px',
              padding: '9px 14px',
            }}
          >
            <span
              style={{
                fontSize: 'var(--fs-label)',
                fontWeight: 600,
                color: 'var(--color-warning-text)',
                whiteSpace: 'nowrap',
              }}
            >
              Mapped database unreachable
            </span>
            {loadErrorDetail && (
              <span
                style={{
                  minWidth: 0,
                  fontSize: 'var(--fs-micro)',
                  color: 'var(--color-slate)',
                  overflowWrap: 'anywhere',
                }}
              >
                {loadErrorDetail}
              </span>
            )}
          </div>
        )}

        <div className="at-workspace">
          <div className="at-col">
            <OrderDetailLadder
              activeOrders={activeOrders}
              zones={groups}
              onShowZoneGroupModal={() => setShowZoneGroupModal(true)}
              onAddOrder={handleAddOrder}
              onEditOrder={startEdit}
              onCloseOrder={handleCloseOrder}
              onAssignGroup={handleAssignGroup}
              onLinkOrder={handleLinkOrder}
              onUpdateRemark={canUpdate ? handleUpdateRemark : undefined}
              view={ladderView}
              onViewChange={handleLadderViewChange}
              mapped={isMapped}
              canAdd={canInsert}
              canEdit={canUpdate}
              canClose={canDelete}
              canGroup={canGroup}
              canLink={canGroup}
              canZone={canGroup}
              canRemark={canUpdate}
              canEditOrder={(order) => orderRowWrites(order, orderWrites, readOnly).edit}
              canCloseOrder={(order) => orderRowWrites(order, orderWrites, readOnly).close}
              canRemarkOrder={(order) => orderRowWrites(order, orderWrites, readOnly).remark}
            />
            <OrderHistoryCard
              tradeHistory={tradeHistory}
              onViewAll={() => setShowHistoryModal(true)}
              onDropOrder={canGroup ? handleDropOnTradeHistory : undefined}
            />
          </div>

          <div className="at-col at-right">
            <section className="at-card at-payoff" aria-label="Performance">
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
                actions={
                  <button
                    type="button"
                    className="at-notes-edit"
                    style={{ lineHeight: "28px" }}
                    onClick={() => setShowStrategyModal(true)}
                  >
                    Option legs
                  </button>
                }
              />
            </section>
            <StrategyNotes
              internalNotes={selectedPortfolio.internal_notes}
              tradePlanMd={selectedPortfolio.trade_plan_md}
              portfolioId={selectedPortfolio.portfolio_id}
              onSaved={fetchAnalyticsData}
            />
          </div>
        </div>
        <div className="at-notes-mobile">
          <StrategyNotes
            internalNotes={selectedPortfolio.internal_notes}
            tradePlanMd={selectedPortfolio.trade_plan_md}
            portfolioId={selectedPortfolio.portfolio_id}
            onSaved={fetchAnalyticsData}
          />
        </div>
      </div>

      {canUpdate && (
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
          onRefresh={fetchAnalyticsData}
          portfolioId={selectedPortfolio?.portfolio_id}
          mapped={editingOrder?.order_source === 'mapped' ? mappedOrderFields : undefined}
        />
      )}
      {canGroup && (
        <ZoneGroupModal
          showModal={showZoneGroupModal}
          onClose={() => {
            setShowZoneGroupModal(false);
            refreshGroups();
          }}
          portfolioId={selectedPortfolio.portfolio_id}
          onSaved={refreshGroups}
        />
      )}
      {canDelete && (
        <CloseOrderModal
          order={closingOrder}
          showModal={showCloseModal}
          onClose={() => { setShowCloseModal(false); setClosingOrder(null); }}
          onConfirm={handleConfirmClose}
          activeOrders={activeOrders}
          mapped={closingOrder?.order_source === 'mapped'}
        />
      )}
      {canInsert && (
        <AddOrderModal
          formData={addFormData}
          showModal={showAddModal}
          onClose={closeAddModal}
          onSave={async () => {
            const destination: AddOrderDestination = isMapped
              ? (canInsertMapped && (!canInsertDashboard || addFormData.destination === 'mapped') ? 'mapped' : 'dashboard')
              : 'dashboard';
            const id = String(addFormData.order_id ?? '').trim();
            if (id) {
              // Duplicate ids only collide inside one store.
              const collides = activeOrders.some((o) => {
                if (o.order_id !== id) return false;
                if (!isMapped) return true;
                return o.order_source === (destination === 'mapped' ? 'mapped' : 'dashboard');
              });
              const generatedKey = destination === 'mapped' && mappedOrderFields?.keyGenerated;
              if (collides && !generatedKey) {
                notify('Order ID already exists', 'warning');
                return;
              }
            }
            const result = await handleCreateOrder(
              selectedPortfolio.portfolio_id,
              destination === 'mapped' ? mappedOrderFields : undefined,
              isMapped ? destination : undefined,
            );
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
          mapped={canInsertMapped ? mappedOrderFields : undefined}
          mappedPortfolio={isMapped}
          dashboardOption={canInsertDashboard}
        />
      )}

      <ModalShell open={showStrategyModal} onClose={() => setShowStrategyModal(false)} title="Option legs">
        <div className={`${MODAL_CARD} bg-canvas border border-hairline w-full max-w-[620px] mx-4 rounded-xl overflow-hidden`}>
          <OptionsStrategyTable
            visible
            modal
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

      <EditPortfolioModal
        portfolioId={selectedPortfolio.portfolio_id}
        portfolioName={selectedPortfolio.portfolio_name}
        marginLocked={marginLocked}
        cashBufferLimit={cashBufferLimit}
        brokerId={selectedPortfolio.broker_id ?? null}
        productTicker={selectedPortfolio.product_ticker ?? null}
        productTickers={
          selectedPortfolio.product_tickers
          ?? (selectedPortfolio.product_ticker ? [selectedPortfolio.product_ticker] : null)
        }
        productType={selectedPortfolio.product_type ?? null}
        products={portfolioProducts}
        xAmount={selectedPortfolio.x_amount ?? 0}
        initialCapital={selectedPortfolio.initial_capital ?? 0}
        rawAvailableCash={selectedPortfolio.available_cash || 0}
        cumulativePl={cumulativePl}
        tags={selectedPortfolio.tags}
        showModal={showEditPortfolioModal}
        onClose={() => setShowEditPortfolioModal(false)}
        onSaved={() => { fetchAnalyticsData(); }}
        onDepositWithdraw={(msg) => notify(msg, 'success')}
        activeOrderCount={activeOrders.length}
        readOnly={readOnly}
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

      {isCustom && (
        <MappingModal
          portfolioId={selectedPortfolio.portfolio_id}
          portfolioName={selectedPortfolio.portfolio_name}
          currentTemplate={selectedPortfolio.mapping_template}
          showModal={showMappingModal}
          onClose={() => setShowMappingModal(false)}
          onSaved={() => {
            fetchAnalyticsData();
            notify('Connection saved', 'success');
          }}
        />
      )}
    </PageLayout>
  );
};

export default PortfolioGrid;
