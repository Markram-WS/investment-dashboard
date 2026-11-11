import React, { useState, useMemo, useEffect, useRef } from "react";
import { SpreadOrder, GroupOption, OrderLinkGroup } from "../../types";
import { OrderGroupRow } from "./ZoneGroupRow";
import { IconPlus, IconLayers, IconContract } from "../../components/icons";
import OptionsStrategyTable from "./OptionsStrategyTable";
import type { OptionRow } from "./OptionsStrategyTable";
import TradeHistoryTable from "./TradeHistoryTable";

interface OrderManagementProps {
  activeOrders: SpreadOrder[];
  zoneGroups: { group_id: number | null; group_name: string; mainOrders: SpreadOrder[]; pendingCloseOrders: SpreadOrder[]; linkGroups: OrderLinkGroup[] }[];
  groups: GroupOption[];
  groupByZone: boolean;
  onGroupByZoneToggle: () => void;
  isGridType: boolean;
  tradeHistory: any[];
  onEditOrder: (order: SpreadOrder) => void;
  onEditZone: (orders: SpreadOrder[], zone: string) => void;
  onCloseOrder: (order: SpreadOrder) => void;
  onAddOrder: () => void;
  onShowZoneGroupModal: () => void;
  showHistory: boolean;
  onToggleHistory: () => void;
  onAssignGroup?: (orderIds: string[], groupId: number | null) => void;
  onDropOnTradeHistory?: (orderId: string) => void;
  onLinkOrder?: (sourceOrderId: string, targetOrderId: string) => void;
  contractFilter: 'all' | 'spot' | 'future' | 'option';
  onContractFilterChange: (v: 'all' | 'spot' | 'future' | 'option') => void;
  // Payoff controls
  strategyRows?: OptionRow[];
  onStrategyRowsChange?: (rows: OptionRow[]) => void;
  ivMode?: boolean;
  onIvModeChange?: (v: boolean) => void;
  payoffMinPrice?: number;
  payoffMaxPrice?: number;
  onPayoffMinMaxChange?: (min: number, max: number) => void;
  activeIVs?: Record<string, number>;
  onActiveIVChange?: (orderId: string, iv: number) => void;
}

const CONTRACT_TABS = [
  { value: 'all' as const, label: 'All' },
  { value: 'spot' as const, label: 'Spot' },
  { value: 'future' as const, label: 'Futures' },
  { value: 'option' as const, label: 'Options' },
];

/** Column head / label: 12px/500 slate, sentence case. */
const headCell: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--color-slate)', margin: 0 };

/** Badge: 12px/500 slate on surface-soft, pill radius. */
const BADGE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-slate)',
  background: 'var(--color-surface-soft)',
  borderRadius: 999,
  padding: '2px 10px',
  whiteSpace: 'nowrap',
};

/** Tab pill: ink when active, hairline outline when idle. */
const tabStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 500,
  padding: '4px 12px',
  borderRadius: 999,
  border: active ? '1px solid var(--color-ink)' : '1px solid var(--color-hairline)',
  background: active ? 'var(--color-ink)' : 'var(--color-canvas)',
  color: active ? 'var(--color-canvas)' : 'var(--color-slate)',
  cursor: 'pointer',
});

/** Body value: 15px, tabular figures. */
const VALUE: React.CSSProperties = { fontSize: 15, fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink)' };

/** Status pill text colour — semantic tokens, never raw palette. */
const statusColor = (status?: string | null): string => {
  const s = (status || '').toUpperCase();
  if (s === 'FILLED') return 'var(--color-positive-text)';
  if (s === 'PENDING') return 'var(--color-status-warning)';
  if (s === 'CLOSE') return 'var(--color-danger-text)';
  return 'var(--color-slate)';
};

const OrderManagement: React.FC<OrderManagementProps> = ({
  activeOrders, zoneGroups, groups, groupByZone, onGroupByZoneToggle, isGridType,
  tradeHistory, onEditOrder, onEditZone, onCloseOrder,
  onAddOrder, onShowZoneGroupModal, showHistory, onToggleHistory,
  onAssignGroup, onDropOnTradeHistory, onLinkOrder,
  contractFilter, onContractFilterChange,
  strategyRows, onStrategyRowsChange, ivMode, onIvModeChange,
  payoffMinPrice, payoffMaxPrice, onPayoffMinMaxChange,
  activeIVs, onActiveIVChange,
}) => {
  const createDragGhost = (order: SpreadOrder): HTMLElement => {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;top:-1000px;left:-1000px;padding:8px 16px;background:var(--color-ink);color:var(--color-canvas);border-radius:9999px;font-size:12px;font-weight:600;white-space:nowrap;display:flex;align-items:center;gap:12px;box-shadow:0 4px 16px rgba(0,0,0,0.25);pointer-events:none;font-family:inherit;letter-spacing:0';
    el.innerHTML = `
      <span style="opacity:0.6">#${order.order_id?.slice(0, 8) || ''}</span>
      <span style="opacity:0.3">|</span>
      <span>${order.asset_type || ''}</span>
      <span style="opacity:0.3">|</span>
      <span style="color:${(order.side || '').toUpperCase() === 'BUY' ? 'var(--color-brand-teal)' : 'var(--color-brand-coral)'}">${(order.side || '').charAt(0).toUpperCase()}${(order.side || '').slice(1).toLowerCase()}</span>
      <span style="opacity:0.3">|</span>
      <span>$${order.entry_price?.toLocaleString() || '-'}</span>
    `;
    return el;
  };

  const handleDragStart = (e: React.DragEvent, order: SpreadOrder) => {
    e.dataTransfer.setData('text/plain', order.order_id);
    e.dataTransfer.effectAllowed = 'move';
    // Carry linked children in flat view
    const linkedIds: string[] = [];
    for (const o of activeOrders) {
      if (o.linked_order_id === order.order_id && o.link_type === 'pending_close') {
        linkedIds.push(o.order_id);
      }
    }
    if (linkedIds.length > 0) {
      e.dataTransfer.setData('text/x-linked-ids', linkedIds.join(','));
    }
    const ghost = createDragGhost(order);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 30, 20);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleLinkDragStart = (e: React.DragEvent, order: SpreadOrder) => {
    e.dataTransfer.effectAllowed = 'link';
    e.dataTransfer.setData('text/plain', order.order_id);
    e.dataTransfer.setData('text/x-link', '1');
    const ghost = document.createElement('div');
    ghost.innerHTML = `
      <span style="display:inline-flex;color:var(--color-brand-teal);filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35))">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </span>
      <span style="font-size:12px;font-weight:500;color:var(--color-slate)">#${order.order_id?.slice(0, 8) || ''}</span>
    `;
    ghost.style.cssText = 'position:absolute;top:-1000px;left:-1000px;display:flex;align-items:center;gap:6px;white-space:nowrap;font-family:inherit';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 6, 6);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleLinkDrop = (e: React.DragEvent, targetOrder: SpreadOrder) => {
    e.preventDefault();
    const isLink = e.dataTransfer.getData('text/x-link');
    if (isLink) {
      const sourceOrderId = e.dataTransfer.getData('text/plain');
      if (sourceOrderId && onLinkOrder && sourceOrderId !== targetOrder.order_id) {
        onLinkOrder(sourceOrderId, targetOrder.order_id);
      }
    }
  };

  const handleRowDragOver = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types);
    if (types.indexOf('text/x-link') !== -1) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'link';
      (e.currentTarget as HTMLElement).style.outline = '2px solid var(--color-brand-teal)';
      (e.currentTarget as HTMLElement).style.outlineOffset = '-2px';
    }
  };

  const handleRowDragLeave = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.outline = '';
    (e.currentTarget as HTMLElement).style.outlineOffset = '';
  };

  const [showOptionsStrategy, setShowOptionsStrategy] = useState(false);

  // Local string state for Price Range inputs (allows clearing to empty)
  const [priceMinStr, setPriceMinStr] = useState("");
  const [priceMaxStr, setPriceMaxStr] = useState("");

  useEffect(() => {
    const pMin = payoffMinPrice ?? 0;
    const pMax = payoffMaxPrice ?? 0;
    setPriceMinStr(pMin > 0 || pMax > 0 ? String(pMin) : "");
    setPriceMaxStr(pMax > 0 ? String(pMax) : "");
  }, [payoffMinPrice, payoffMaxPrice]);

  // Local string state for Active IV inputs (allows clearing to empty)
  const [ivRawValues, setIvRawValues] = useState<Record<string, string>>({});
  const [masterIvStr, setMasterIvStr] = useState("");

  useEffect(() => {
    if (!activeIVs) return;
    const next: Record<string, string> = {};
    for (const [id, iv] of Object.entries(activeIVs)) {
      next[id] = String(iv);
    }
    setIvRawValues(prev => {
      const merged = { ...next };
      for (const id of Object.keys(prev)) {
        if (id in next) merged[id] = prev[id];
      }
      return merged;
    });
  }, [activeIVs]);

  // Stable ref for callback (avoids re-firing on every parent render)
  const onPayoffMinMaxChangeRef = useRef(onPayoffMinMaxChange);
  onPayoffMinMaxChangeRef.current = onPayoffMinMaxChange;

  // Auto-compute price range from strategy rows + active orders
  useEffect(() => {
    const prices: number[] = [];
    for (const r of (strategyRows || [])) {
      const s = parseFloat(r.strike);
      if (!isNaN(s) && s > 0) prices.push(s);
    }
    for (const o of activeOrders) {
      if (o.contract_type === 'option') {
        const s = o.strike_price != null ? Number(o.strike_price) : 0;
        if (s > 0) prices.push(s);
      } else {
        const e = o.entry_price != null ? Number(o.entry_price) : 0;
        if (e > 0) prices.push(e);
      }
    }
    if (prices.length === 0) return;
    const maxVal = Math.max(...prices) * 1.25;
    const minVal = Math.max(0, Math.min(...prices) * 0.75);
    onPayoffMinMaxChangeRef.current?.(minVal, maxVal);
  }, [strategyRows, activeOrders]);

  const hasFutureOrders = activeOrders.some(o => o.contract_type === 'future' || (o.leverage != null && o.leverage > 0));
  const hasOptionOrders = activeOrders.some(o => o.contract_type === 'option' || o.strike_price != null || o.option_type != null);

  const showLev = contractFilter === 'all'
    ? hasFutureOrders || hasOptionOrders
    : contractFilter !== 'spot';
  const showExp = contractFilter === 'all'
    ? hasFutureOrders || hasOptionOrders
    : contractFilter !== 'spot';
  const showStrikePrice = contractFilter === 'all'
    ? hasOptionOrders
    : contractFilter === 'option';

  // Filter orders by contract type when a specific tab is selected
  const filteredActiveOrders = useMemo(() => {
    if (contractFilter === 'all') return activeOrders;
    return activeOrders.filter(o => (o.contract_type || 'spot') === contractFilter);
  }, [activeOrders, contractFilter]);

  const filteredZoneGroups = useMemo(() => {
    if (contractFilter === 'all') return zoneGroups;
    return zoneGroups.reduce<{ group_id: number | null; group_name: string; mainOrders: SpreadOrder[]; pendingCloseOrders: SpreadOrder[]; linkGroups: OrderLinkGroup[] }[]>((acc, g) => {
      const mainOrders = g.mainOrders.filter(o => (o.contract_type || 'spot') === contractFilter);
      const pendingCloseOrders = g.pendingCloseOrders.filter(o => (o.contract_type || 'spot') === contractFilter);
      const linkGroups = g.linkGroups.reduce<OrderLinkGroup[]>((links, lg) => {
        const subs = lg.subs.filter(o => (o.contract_type || 'spot') === contractFilter);
        const spreadPartner = lg.spreadPartner && (lg.spreadPartner.contract_type || 'spot') === contractFilter ? lg.spreadPartner : undefined;
        const partnerSubs = lg.partnerSubs?.filter(o => (o.contract_type || 'spot') === contractFilter) || [];
        if ((lg.primary?.contract_type || 'spot') !== contractFilter && subs.length === 0 && !spreadPartner) return links;
        links.push({
          primary: lg.primary && (lg.primary.contract_type || 'spot') === contractFilter ? lg.primary : subs[0] || spreadPartner!,
          subs,
          spreadPartner,
          partnerSubs,
        });
        return links;
      }, []);
      if (mainOrders.length === 0 && linkGroups.length === 0) return acc;
      acc.push({ ...g, mainOrders, pendingCloseOrders, linkGroups });
      return acc;
    }, []);
  }, [zoneGroups, contractFilter]);

  // Flat view link group computation (uses filtered orders)
  const { flatSortedOrders, flatLinkInfoMap } = useMemo(() => {
    const orderMap: Record<string, SpreadOrder> = {};
    filteredActiveOrders.forEach(o => orderMap[o.order_id] = o);
    const infoMap: Record<string, { isSub: boolean; showLine: boolean; linkType: string; isFirstInGroup: boolean; isLastInGroup: boolean }> = {};
    const used = new Set<string>();
    const groups: Record<string, { primary: SpreadOrder; subs: SpreadOrder[]; spreadPartner?: SpreadOrder; partnerSubs?: SpreadOrder[] }> = {};

    for (const a of filteredActiveOrders) {
      if (used.has(a.order_id)) continue;
      if (a.link_type === 'pending_close') continue;

      if (a.link_type === 'spread' && a.linked_order_id && orderMap[a.linked_order_id]) {
        const b = orderMap[a.linked_order_id];
        if (b.link_type === 'spread' && b.linked_order_id === a.order_id) {
          used.add(a.order_id); used.add(b.order_id);
          const aSubs = filteredActiveOrders.filter(o => o.link_type === 'pending_close' && o.linked_order_id === a.order_id && !used.has(o.order_id));
          const bSubs = filteredActiveOrders.filter(o => o.link_type === 'pending_close' && o.linked_order_id === b.order_id && !used.has(o.order_id));
          const all = [a, ...aSubs, b, ...bSubs];
          all.forEach((m, idx) => {
            const isSub = aSubs.includes(m) || bSubs.includes(m);
            infoMap[m.order_id] = {
              isSub,
              showLine: true,
              linkType: m.link_type || '',
              isFirstInGroup: idx === 0,
              isLastInGroup: idx === all.length - 1,
            };
            used.add(m.order_id);
          });
          groups[[a.order_id, b.order_id].sort().join('|')] = { primary: a, subs: aSubs, spreadPartner: b, partnerSubs: bSubs };
          continue;
        }
      }

      const aSubs = filteredActiveOrders.filter(o => o.link_type === 'pending_close' && o.linked_order_id === a.order_id && !used.has(o.order_id));
      const all = [a, ...aSubs];
      all.forEach((m, idx) => {
        const isSub = aSubs.includes(m);
        infoMap[m.order_id] = {
          isSub,
          showLine: isSub,
          linkType: m.link_type || '',
          isFirstInGroup: idx === 0,
          isLastInGroup: idx === all.length - 1,
        };
        used.add(m.order_id);
      });
    }

    const reordered: SpreadOrder[] = [];
    for (const g of Object.values(groups)) {
      reordered.push(g.primary);
      for (const s of g.subs) reordered.push(s);
      if (g.spreadPartner) {
        reordered.push(g.spreadPartner);
        for (const s of g.partnerSubs || []) reordered.push(s);
      }
    }
    for (const o of filteredActiveOrders) {
      if (!reordered.find(r => r.order_id === o.order_id)) reordered.push(o);
    }
    return { flatSortedOrders: reordered, flatLinkInfoMap: infoMap };
  }, [filteredActiveOrders]);

  return (
    <>
    {showOptionsStrategy && (
      <section className="bg-canvas rounded-xl border border-hairline overflow-hidden mb-6">
        <div className="flex">
          <div className="w-4/6 border-r border-hairline">
            <OptionsStrategyTable
              visible={true}
              onClose={() => setShowOptionsStrategy(false)}
              onRowsChange={onStrategyRowsChange}
            />
          </div>
          <div className="w-2/6 p-4 space-y-5">
            <div style={headCell}>Config</div>

            {/* IV Mode toggle */}
            <div>
              <div className="mb-1" style={headCell}>BS IV mode</div>
              <button
                onClick={() => onIvModeChange?.(!ivMode)}
                className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
                style={{ background: ivMode ? 'var(--color-ink)' : 'var(--color-hairline)' }}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-canvas transition-transform ${ivMode ? "translate-x-3.5" : "translate-x-0.5"}`} />
              </button>
            </div>



            {/* Active IV inputs */}
            {activeOrders.filter(o => o.contract_type === 'option').length > 0 && (
              <div>
                <div className="mb-1" style={headCell}>Active order IV</div>
                {/* Apply All row */}
                <div className="flex items-center gap-1 mb-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="IV"
                    value={masterIvStr}
                    onChange={(e) => setMasterIvStr(e.target.value)}
                    className="w-12 border border-hairline rounded px-1 py-0.5 text-right text-ink"
                    style={{ fontSize: 12 }}
                  />
                  <span style={headCell}>%</span>
                  <button
                    onClick={() => {
                      const val = parseFloat(masterIvStr);
                      if (!isNaN(val)) {
                        const optionOrders = activeOrders.filter(o => o.contract_type === 'option');
                        optionOrders.forEach(o => onActiveIVChange?.(o.order_id, val));
                        const updated: Record<string, string> = {};
                        optionOrders.forEach(o => { updated[o.order_id] = masterIvStr; });
                        setIvRawValues(prev => ({ ...prev, ...updated }));
                        setMasterIvStr("");
                      }
                    }}
                    className="ml-auto rounded-full bg-ink text-canvas"
                    style={{ fontSize: 12, fontWeight: 500, padding: '2px 10px' }}
                  >
                    Apply all
                  </button>
                </div>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {activeOrders.filter(o => o.contract_type === 'option').map(order => (
                    <div key={order.order_id} className="flex items-center justify-between gap-1">
                      <span className="text-ink truncate max-w-[80px]" style={{ fontSize: 12 }}>
                        {order.asset_type} {order.option_type} {order.strike_price}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={ivRawValues[order.order_id] ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setIvRawValues(prev => ({ ...prev, [order.order_id]: raw }));
                          if (raw === "" || raw === "-") return;
                          const val = parseFloat(raw);
                          if (!isNaN(val)) {
                            onActiveIVChange?.(order.order_id, val);
                          }
                        }}
                        onBlur={() => {
                          const raw = ivRawValues[order.order_id] ?? "";
                          if (raw === "" || raw === "-") {
                            onActiveIVChange?.(order.order_id, 0);
                            setIvRawValues(prev => {
                              const next = { ...prev };
                              delete next[order.order_id];
                              return next;
                            });
                          }
                        }}
                        className="w-14 border border-hairline rounded px-1 py-0.5 text-right text-ink"
                        style={{ fontSize: 12 }}
                      />
                      <span style={headCell}>%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Price Range inputs */}
            <div>
              <div className="mb-1" style={headCell}>Price range</div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={priceMinStr}
                    onChange={(e) => setPriceMinStr(e.target.value)}
                    onBlur={() => {
                      const raw = priceMinStr.trim();
                      if (raw === "" || raw === "-") {
                        setPriceMinStr(payoffMinPrice != null ? String(payoffMinPrice) : "0");
                        return;
                      }
                      const newMin = parseFloat(raw);
                      if (!isNaN(newMin)) {
                        let newMax = (payoffMaxPrice || 0) > 0 ? payoffMaxPrice : 100;
                        if (newMax <= newMin) newMax = newMin * 1.5;
                        onPayoffMinMaxChange?.(newMin, newMax);
                      } else {
                        setPriceMinStr(payoffMinPrice != null ? String(payoffMinPrice) : "0");
                      }
                    }}
                    className="w-full border border-hairline rounded px-1.5 py-1 text-right text-ink"
                    style={{ fontSize: 12 }}
                    placeholder="Min"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={priceMaxStr}
                    onChange={(e) => setPriceMaxStr(e.target.value)}
                    onBlur={() => {
                      const raw = priceMaxStr.trim();
                      if (raw === "" || raw === "-") {
                        setPriceMaxStr(payoffMaxPrice != null ? String(payoffMaxPrice) : "100");
                        return;
                      }
                      const newMax = parseFloat(raw);
                      if (!isNaN(newMax)) {
                        let newMin = (payoffMinPrice || 0) > 0 ? payoffMinPrice : 0;
                        if (newMin >= newMax) newMin = newMax * 0.5;
                        onPayoffMinMaxChange?.(newMin, newMax);
                      } else {
                        setPriceMaxStr(payoffMaxPrice != null ? String(payoffMaxPrice) : "100");
                      }
                    }}
                    className="w-full border border-hairline rounded px-1.5 py-1 text-right text-ink"
                    style={{ fontSize: 12 }}
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )}
    <section className="bg-canvas rounded-xl border border-hairline overflow-hidden mb-6">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 flex justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <h3 className="text-ink" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>Order management</h3>
            <span style={BADGE}>
              {filteredActiveOrders.length} active
            </span>
          </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={onGroupByZoneToggle}
                  className="relative inline-flex h-4 w-8 items-center rounded-full transition-colors"
                  style={{ background: groupByZone ? 'var(--color-brand-teal)' : 'var(--color-hairline)' }}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-canvas transition-transform ${groupByZone ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
              <button onClick={onShowZoneGroupModal} className="h-8 w-8 rounded-full bg-canvas text-slate border border-hairline hover:bg-surface transition-all flex items-center justify-center" title="Order Groups">
                <IconLayers className="w-4 h-4" />
              </button>
              {/* Contract type toggle */}
              <div className="inline-flex gap-x-1">
                {CONTRACT_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => onContractFilterChange(tab.value)}
                    className="transition-all"
                    style={tabStyle(contractFilter === tab.value)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOptionsStrategy(!showOptionsStrategy)}
            className="h-8 w-8 rounded-full border border-hairline transition-all flex items-center justify-center"
            style={{
              background: showOptionsStrategy ? 'var(--color-surface-soft)' : 'var(--color-canvas)',
              color: showOptionsStrategy ? 'var(--color-ink)' : 'var(--color-slate)',
            }}
            title="Options Strategy"
          >
            <IconContract className="w-4 h-4" />
          </button>
          <button
            onClick={onAddOrder}
            className="h-9 px-4 rounded-full bg-ink text-canvas hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500 }}
            title="Add Order"
          >
            <IconPlus className="w-4 h-4" />
            Add order
          </button>
        </div>
      </div>

    {/* Table */}
    <div className="overflow-x-auto">
      {filteredZoneGroups.length > 0 && groupByZone ? (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface border-y border-hairline">
              <th className="p-4 w-8" />
              <th className="p-4 w-8" />
              <th className="p-4" style={headCell}>ID</th>
              <th className="p-4" style={headCell}>Asset</th>
              <th className="p-4" style={headCell}>Side</th>
              <th className="p-4" style={headCell}>Entry date</th>
              <th className="p-4" style={headCell}>Entry price</th>
              <th className="p-4" style={headCell}>Qty</th>
              <th className="p-4" style={headCell}>Current</th>
              {showLev && <th className="p-4" style={headCell}>Leverage</th>}
              {showLev && <th className="p-4" style={headCell}>Margin</th>}
              {showExp && <th className="p-4" style={headCell}>Expiry</th>}
              {showStrikePrice && <th className="p-4" style={headCell}>Strike price</th>}
              <th className="p-4" style={headCell}>TP target</th>
              <th className="p-4" style={headCell}>SL</th>
              <th className="p-4" style={headCell}>P/L</th>
              <th className="p-4" style={headCell}>Status</th>
              <th className="p-4 w-12" />
            </tr>
          </thead>
          <tbody className="text-sm text-ink">
              {filteredZoneGroups.map((groupInfo) => (
              <OrderGroupRow
                key={groupInfo.group_id ?? '__ungrouped__'}
                groupInfo={groupInfo}
                groups={groups}
                onEdit={onEditOrder}
                onClose={onCloseOrder}
                onAssignGroup={onAssignGroup}
                onLinkOrder={onLinkOrder}
                contractFilter={contractFilter}
                showLev={showLev}
                showExp={showExp}
                showStrikePrice={showStrikePrice}
              />
            ))}
          </tbody>
        </table>
      ) : filteredActiveOrders.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr>
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-left" style={headCell}>ID</th>
              <th className="hidden md:table-cell px-3 py-2 text-left" style={headCell}>Asset</th>
              <th className="px-3 py-2 text-left" style={headCell}>Side</th>
              <th className="hidden md:table-cell px-3 py-2 text-left" style={headCell}>Open date</th>
              <th className="px-3 py-2 text-right" style={headCell}>Qty</th>
              <th className="px-3 py-2 text-right" style={headCell}>Entry</th>
              <th className="hidden md:table-cell px-3 py-2 text-right" style={headCell}>Current</th>
              {showLev && <th className="hidden lg:table-cell px-3 py-2 text-right" style={headCell}>Leverage</th>}
              {showLev && <th className="hidden lg:table-cell px-3 py-2 text-right" style={headCell}>Margin</th>}
              {showExp && <th className="hidden md:table-cell px-3 py-2 text-left" style={headCell}>Expiry</th>}
              {showStrikePrice && <th className="hidden md:table-cell px-3 py-2 text-right" style={headCell}>Strike price</th>}
              <th className="hidden md:table-cell px-3 py-2 text-right" style={headCell}>TP</th>
              <th className="hidden md:table-cell px-3 py-2 text-right" style={headCell}>SL</th>
              <th className="px-3 py-2 text-right" style={headCell}>P/L</th>
              <th className="px-3 py-2 text-left" style={headCell}>Status</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {flatSortedOrders.map((order) => {
              const openDate = order.created_at ? order.created_at.slice(0, 10) : "-";
              const isSpot = (order.contract_type || 'spot') === 'spot';
              const showGray = isSpot && contractFilter !== 'spot' && contractFilter !== 'all';
              const linkInfo = flatLinkInfoMap[order.order_id];
              const isLinked = order.link_type && order.link_type !== 'none';
              const isBuy = order.side === 'BUY' || order.side === 'Buy' || order.side === 'LONG';
              return (
                <tr
                  key={order.order_id}
                  className={`border-b border-hairline-soft group ${showGray ? 'bg-surface' : 'bg-canvas hover:bg-surface/50'}`}
                  onDragOver={handleRowDragOver}
                  onDragLeave={handleRowDragLeave}
                  onDrop={(e) => handleLinkDrop(e, order)}
                >
                  <td className="pl-3 py-2 w-8 text-center">
                    <span
                      draggable={!linkInfo?.isSub && !(linkInfo?.linkType === 'spread' && !linkInfo?.isFirstInGroup)}
                      onDragStart={(e) => handleDragStart(e, order)}
                      className={`${linkInfo?.isSub || (linkInfo?.linkType === 'spread' && !linkInfo?.isFirstInGroup) ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} cursor-grab active:cursor-grabbing inline-flex items-center justify-center text-slate transition-opacity`}
                      title="Drag to assign group or close"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="6" r="1.5" />
                        <circle cx="15" cy="6" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" />
                        <circle cx="15" cy="12" r="1.5" />
                        <circle cx="9" cy="18" r="1.5" />
                        <circle cx="15" cy="18" r="1.5" />
                      </svg>
                    </span>
                  </td>
                  <td className={`py-2 w-8 relative ${linkInfo?.showLine ? '' : ''}`}>
                    {linkInfo?.showLine && (
                      <>
                        <span
                          draggable="true"
                          onDragStart={(e) => handleLinkDragStart(e, order)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing inline-flex items-center justify-center"
                          title="Drag to link order"
                        >
                          <span className={`bg-canvas rounded-full p-0.5 inline-flex items-center justify-center ${linkInfo?.linkType === 'spread' ? 'text-brand-teal' : 'text-brand-yellow'}`}>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" draggable="false">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                          </span>
                        </span>
                        <svg
                          className="absolute left-2.5 top-0 h-full w-3 pointer-events-none"
                          preserveAspectRatio="none"
                        >
                          <line
                            x1="6"
                            y1={linkInfo?.linkType === 'spread' && linkInfo?.isFirstInGroup ? '50%' : '0'}
                            x2="6"
                            y2={linkInfo?.linkType === 'spread' && linkInfo?.isLastInGroup ? '50%' : linkInfo?.linkType === 'pending_close' ? '50%' : '100%'}
                            strokeWidth="2"
                            style={{ stroke: linkInfo?.linkType === 'spread' ? 'var(--color-brand-blue)' : 'var(--color-brand-accent)', animation: 'linkLineGlow 1.2s ease-out forwards' }}
                          />
                        </svg>
                      </>
                    )}
                    {!linkInfo?.showLine && (
                      <span
                        draggable="true"
                        onDragStart={(e) => handleLinkDragStart(e, order)}
                        className={`${isLinked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} cursor-grab active:cursor-grabbing inline-flex items-center justify-center transition-opacity`}
                        title="Drag to link order"
                      >
                        <span className={`bg-canvas rounded-full p-0.5 inline-flex items-center justify-center ${linkInfo?.linkType === 'spread' ? 'text-brand-teal' : linkInfo?.linkType === 'pending_close' ? 'text-brand-yellow' : 'text-slate'}`}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" draggable="false">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                        </span>
                      </span>
                    )}
                  </td>
                  <td draggable={false} className="px-3 py-2 font-mono text-slate" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>#{order.order_id}</td>
                  <td draggable={false} className="hidden md:table-cell px-3 py-2" style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>{order.asset_type}</td>
                  <td draggable={false} className="px-3 py-2">
                    <span style={{ ...BADGE, color: isBuy ? 'var(--color-positive-text)' : 'var(--color-danger-text)' }}>
                      {order.side ? order.side.charAt(0).toUpperCase() + order.side.slice(1).toLowerCase() : ''}
                    </span>
                  </td>
                  <td draggable={false} className="hidden md:table-cell px-3 py-2 text-slate" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{openDate}</td>
                  <td draggable={false} className="px-3 py-2 text-right" style={VALUE}>{order.qty}</td>
                  <td draggable={false} className="px-3 py-2 text-right" style={VALUE}>${order.entry_price || "-"}</td>
                  <td draggable={false} className="hidden md:table-cell px-3 py-2 text-right" style={VALUE}>${order.current_price || "-"}</td>
                  {showLev && (
                    <td className="hidden lg:table-cell px-3 py-2 text-right" style={VALUE}>{order.leverage != null ? `${order.leverage}x` : '-'}</td>
                  )}
                  {showLev && (
                    <td className="hidden lg:table-cell px-3 py-2 text-right" style={VALUE}>${order.margin_rate != null ? order.margin_rate : '-'}</td>
                  )}
                  {showExp && (
                    <td className="hidden md:table-cell px-3 py-2 text-slate" style={{ fontSize: 12 }}>{order.expiry_date ? order.expiry_date.slice(0, 10) : '-'}</td>
                  )}
                  {showStrikePrice && (
                    <td className="hidden md:table-cell px-3 py-2 text-right" style={VALUE}>${order.strike_price != null ? order.strike_price : '-'}</td>
                  )}
                  <td draggable={false} className="hidden md:table-cell px-3 py-2 text-right" style={VALUE}>${order.tp_price || "-"}</td>
                  <td draggable={false} className="hidden md:table-cell px-3 py-2 text-right" style={VALUE}>${order.sl_price || "-"}</td>
                  <td draggable={false} className="px-3 py-2 text-right" style={{ ...VALUE, fontWeight: 600, color: (() => {
                    const pl = order.current_price && order.entry_price ? (order.current_price - order.entry_price) * Number(order.qty) : 0;
                    return pl >= 0 ? 'var(--color-positive-text)' : 'var(--color-danger-text)';
                  })() }}>
                    {(() => {
                      const pl = order.current_price && order.entry_price ? (order.current_price - order.entry_price) * Number(order.qty) : 0;
                      return pl >= 0 ? '+' : '';
                    })()}${(() => {
                      const pl = order.current_price && order.entry_price ? (order.current_price - order.entry_price) * Number(order.qty) : 0;
                      return pl.toFixed(2);
                    })()}
                  </td>
                  <td draggable={false} className="px-3 py-2">
                    <span style={{ ...BADGE, color: statusColor(order.order_status) }}>
                      {order.order_status ? order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1).toLowerCase() : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => onEditOrder(order)} className="p-1 hover:bg-surface-soft rounded transition-colors text-slate hover:text-ink" title="Edit">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 11.5 8 16l4.5-7.5z" />
                        </svg>
                      </button>
                      <button onClick={() => onCloseOrder(order)} className="p-1 hover:bg-surface-soft rounded transition-colors text-brand-coral" title="Close">
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
        <div className="p-8 text-center text-slate">No active orders found.</div>
      )}
    </div>

    <div className="mb-6" />
    <TradeHistoryTable tradeHistory={tradeHistory} showHistory={showHistory} onToggleHistory={onToggleHistory} onDropOnTradeHistory={onDropOnTradeHistory} />
  </section>
  </>
  );
};

export default OrderManagement;