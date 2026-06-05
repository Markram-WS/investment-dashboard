import React, { useState, useMemo, useRef, useEffect } from "react";
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
  payoffCurrentPrice?: number;
  onPayoffCurrentPriceChange?: (v: number) => void;
}

const CONTRACT_TABS = [
  { value: 'all' as const, label: 'All' },
  { value: 'spot' as const, label: 'Spot' },
  { value: 'future' as const, label: 'Futures' },
  { value: 'option' as const, label: 'Options' },
];

const OrderManagement: React.FC<OrderManagementProps> = ({
  activeOrders, zoneGroups, groups, groupByZone, onGroupByZoneToggle, isGridType,
  tradeHistory, onEditOrder, onEditZone, onCloseOrder,
  onAddOrder, onShowZoneGroupModal, showHistory, onToggleHistory,
  onAssignGroup, onDropOnTradeHistory, onLinkOrder,
  contractFilter, onContractFilterChange,
  strategyRows, onStrategyRowsChange, ivMode, onIvModeChange,
  payoffMinPrice, payoffMaxPrice, onPayoffMinMaxChange,
  activeIVs, onActiveIVChange,
  payoffCurrentPrice, onPayoffCurrentPriceChange,
}) => {
  const createDragGhost = (order: SpreadOrder): HTMLElement => {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;top:-1000px;left:-1000px;padding:8px 16px;background:#1c1c1e;color:#fff;border-radius:9999px;font-size:12px;font-weight:600;white-space:nowrap;display:flex;align-items:center;gap:12px;box-shadow:0 4px 16px rgba(0,0,0,0.25);pointer-events:none;font-family:inherit;letter-spacing:0';
    el.innerHTML = `
      <span style="opacity:0.6">#${order.order_id?.slice(0, 8) || ''}</span>
      <span style="opacity:0.3">|</span>
      <span>${order.asset_type || ''}</span>
      <span style="opacity:0.3">|</span>
      <span style="color:${(order.side || '').toUpperCase() === 'BUY' ? '#0fbcb0' : '#ff9999'}">${(order.side || '').toUpperCase()}</span>
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
      <span style="display:inline-flex;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35))">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </span>
      <span style="font-size:10px;font-weight:600;color:#374151">#${order.order_id?.slice(0, 8) || ''}</span>
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
      (e.currentTarget as HTMLElement).style.outline = '2px solid #4262ff';
      (e.currentTarget as HTMLElement).style.outlineOffset = '-2px';
    }
  };

  const handleRowDragLeave = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.outline = '';
    (e.currentTarget as HTMLElement).style.outlineOffset = '';
  };

  const [showOptionsStrategy, setShowOptionsStrategy] = useState(false);

  // Local string state for min/max inputs (fixes controlled number input issue)
  const [minStr, setMinStr] = useState(() => payoffMinPrice != null ? String(payoffMinPrice) : "");
  const [maxStr, setMaxStr] = useState(() => payoffMaxPrice != null ? String(payoffMaxPrice) : "");
  const prevMinRef = useRef(payoffMinPrice);
  const prevMaxRef = useRef(payoffMaxPrice);
  useEffect(() => {
    if (prevMinRef.current !== payoffMinPrice) {
      setMinStr(payoffMinPrice != null ? String(payoffMinPrice) : "");
      prevMinRef.current = payoffMinPrice;
    }
  }, [payoffMinPrice]);
  useEffect(() => {
    if (prevMaxRef.current !== payoffMaxPrice) {
      setMaxStr(payoffMaxPrice != null ? String(payoffMaxPrice) : "");
      prevMaxRef.current = payoffMaxPrice;
    }
  }, [payoffMaxPrice]);

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
  <section className="bg-white rounded-xl border border-hairline overflow-hidden mb-6">
    {/* Header */}
    <div className="px-8 pt-8 pb-4 flex justify-between">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest">Order Management</h3>
          <span className="px-2 py-0.5 bg-ink text-[10px] text-white font-bold rounded-full uppercase tracking-tighter">
            {filteredActiveOrders.length} ACTIVE
          </span>
        </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={onGroupByZoneToggle}
                className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${groupByZone ? "bg-brand-teal" : "bg-gray-300"}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${groupByZone ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>
            <button onClick={onShowZoneGroupModal} className="h-8 w-8 rounded-full bg-white text-slate border border-hairline hover:bg-surface transition-all flex items-center justify-center" title="Order Groups">
              <IconLayers className="w-4 h-4" />
            </button>
            {/* Contract type toggle */}
            <div className="inline-flex gap-x-1">
              {CONTRACT_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => onContractFilterChange(tab.value)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-all ${
                    contractFilter === tab.value
                      ? tab.value === 'all'
                        ? 'bg-ink text-white border-ink'
                        : tab.value === 'spot'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : tab.value === 'future'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-purple-600 text-white border-purple-600'
                      : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-500'
                  }`}
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
          className={`h-8 w-8 rounded-full border transition-all flex items-center justify-center ${
            showOptionsStrategy
              ? "bg-purple-100 text-purple-700 border-purple-200"
              : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
          }`}
          title="Options Strategy"
        >
          <IconContract className="w-4 h-4" />
        </button>
        <button onClick={onAddOrder} className="h-9 px-4 rounded-full bg-brand-teal text-white text-xs font-bold shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5" title="Add Order">
          <IconPlus className="w-4 h-4" />
          Add Order
        </button>
      </div>
    </div>

    {showOptionsStrategy && (
      <div className="flex gap-4 mb-4">
        <div className="w-4/6">
          <OptionsStrategyTable
            visible={true}
            onClose={() => setShowOptionsStrategy(false)}
            onRowsChange={onStrategyRowsChange}
          />
        </div>
        <div className="w-2/6 border border-gray-200 rounded-xl p-3 bg-white">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Controls</div>

          {/* IV Mode toggle */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-gray-600 font-medium">BS IV Mode</span>
            <button
              onClick={() => onIvModeChange?.(!ivMode)}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${ivMode ? "bg-purple-600" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${ivMode ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Min/Max Price — same row */}
          <div className="mb-3">
            <label className="text-[9px] text-gray-500 font-medium block mb-1">Price Range</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                step={100}
                placeholder="Min"
                value={minStr}
                onChange={(e) => {
                  const raw = e.target.value;
                  setMinStr(raw);
                  if (raw === "") return;
                  const num = parseFloat(raw);
                  if (!isNaN(num)) onPayoffMinMaxChange?.(num, parseFloat(maxStr) || 0);
                }}
                className="flex-1 text-[10px] border border-gray-200 rounded px-2 py-1 text-gray-700 text-center"
              />
              <span className="text-[10px] text-gray-400">—</span>
              <input
                type="number"
                step={100}
                placeholder="Max"
                value={maxStr}
                onChange={(e) => {
                  const raw = e.target.value;
                  setMaxStr(raw);
                  if (raw === "") return;
                  const num = parseFloat(raw);
                  if (!isNaN(num)) onPayoffMinMaxChange?.(parseFloat(minStr) || 0, num);
                }}
                className="flex-1 text-[10px] border border-gray-200 rounded px-2 py-1 text-gray-700 text-center"
              />
            </div>
            <p className="text-[8px] text-gray-400 mt-0.5">Arrow keys: ±100</p>
          </div>

          {/* Current Price slider */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[9px] text-gray-500 font-medium">Current Price</label>
              <span className="text-[10px] text-gray-700 font-bold">{payoffCurrentPrice ?? 0}</span>
            </div>
            <input
              type="range"
              min={Math.min(payoffMinPrice ?? 0, payoffMaxPrice ?? 1)}
              max={Math.max(payoffMinPrice ?? 0, payoffMaxPrice ?? 1)}
              step={1}
              value={payoffCurrentPrice ?? 0}
              onChange={(e) => onPayoffCurrentPriceChange?.(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-[8px] text-gray-400">
              <span>{Math.min(payoffMinPrice ?? 0, payoffMaxPrice ?? 1)}</span>
              <span>{Math.max(payoffMinPrice ?? 0, payoffMaxPrice ?? 1)}</span>
            </div>
          </div>

          {/* Active IV inputs */}
          {activeOrders.filter(o => o.contract_type === 'option').length > 0 && (
            <div>
              <div className="text-[9px] text-gray-500 font-medium mb-1">Active Order IV</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {activeOrders.filter(o => o.contract_type === 'option').map(order => (
                  <div key={order.order_id} className="flex items-center justify-between gap-1">
                    <span className="text-[9px] text-gray-600 truncate flex-1">
                      {order.asset_type} {order.option_type} {order.strike_price}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="0"
                      value={activeIVs?.[order.order_id] ?? ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onActiveIVChange?.(order.order_id, isNaN(val) ? 0 : val);
                      }}
                      className="w-14 text-[10px] border border-gray-200 rounded px-1 py-0.5 text-right text-gray-700"
                    />
                    <span className="text-[9px] text-gray-400">%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Table */}
    <div className="overflow-x-auto">
      {filteredZoneGroups.length > 0 && groupByZone ? (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface border-y border-hairline">
              <th className="p-4 w-8" />
              <th className="p-4 w-8" />
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">ID</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Asset</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Side</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Entry Date</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Entry Price</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Qty</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Current</th>
              {showLev && <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Leverage</th>}
              {showLev && <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Margin</th>}
              {showExp && <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Expiry</th>}
              {showStrikePrice && <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Strike Price</th>}
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">TP Target</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">SL</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">P/L</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Status</th>
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
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">ID</th>
              <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Asset</th>
              <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Side</th>
              <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Open Date</th>
              <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Qty</th>
              <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Entry</th>
              <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Current</th>
              {showLev && <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Leverage</th>}
              {showLev && <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Margin</th>}
              {showExp && <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Expiry</th>}
              {showStrikePrice && <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">Strike Price</th>}
              <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">TP</th>
              <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">SL</th>
              <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wider">P/L</th>
              <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Status</th>
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
              return (
                <tr
                  key={order.order_id}
                  className={`border-b border-hairline-soft group ${showGray ? 'bg-gray-50' : 'bg-white hover:bg-surface/50'}`}
                  onDragOver={handleRowDragOver}
                  onDragLeave={handleRowDragLeave}
                  onDrop={(e) => handleLinkDrop(e, order)}
                >
                  <td className="pl-3 py-2 w-8 text-center">
                    <span
                      draggable={!linkInfo?.isSub && !(linkInfo?.linkType === 'spread' && !linkInfo?.isFirstInGroup)}
                      onDragStart={(e) => handleDragStart(e, order)}
                      className={`${linkInfo?.isSub || (linkInfo?.linkType === 'spread' && !linkInfo?.isFirstInGroup) ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} cursor-grab active:cursor-grabbing inline-flex items-center justify-center text-gray-300 hover:text-gray-500 transition-opacity`}
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
                          className="absolute z-10 cursor-grab active:cursor-grabbing inline-flex items-center justify-center"
                          style={{ left: '8px', top: '50%', transform: 'translateY(-50%)' }}
                          title="Drag to link order"
                        >
                          <span className={`bg-white rounded-full p-0.5 inline-flex items-center justify-center shadow-sm ${linkInfo?.linkType === 'spread' ? 'text-blue-600' : 'text-yellow-500'}`}>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" draggable="false">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                          </span>
                        </span>
                        <svg
                          className="absolute pointer-events-none"
                          style={{ left: '10px', top: '0', height: '100%', width: '12px' }}
                          preserveAspectRatio="none"
                        >
                          <line
                            x1="6"
                            y1={linkInfo?.linkType === 'spread' && linkInfo?.isFirstInGroup ? '50%' : '0'}
                            x2="6"
                            y2={linkInfo?.linkType === 'spread' && linkInfo?.isLastInGroup ? '50%' : linkInfo?.linkType === 'pending_close' ? '50%' : '100%'}
                            stroke={linkInfo?.linkType === 'spread' ? '#93c5fd' : '#fde047'}
                            strokeWidth="2"
                            style={{ animation: 'linkLineGlow 1.2s ease-out forwards' }}
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
                        <span className={`bg-white rounded-full p-0.5 inline-flex items-center justify-center ${linkInfo?.linkType === 'spread' ? 'text-blue-600' : linkInfo?.linkType === 'pending_close' ? 'text-yellow-500' : 'text-gray-300'}`}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" draggable="false">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                        </span>
                      </span>
                    )}
                  </td>
                  <td draggable={false} className="px-3 py-2 text-xs text-gray-500 font-mono">#{order.order_id}</td>
                  <td draggable={false} className="px-3 py-2 font-medium text-sm">{order.asset_type}</td>
                  <td draggable={false} className="px-3 py-2">
                    <span className={`text-xs px-1 rounded ${order.side === "BUY" || order.side === "Buy" || order.side === "LONG" ? "bg-teal-light text-brand-teal" : "bg-coral-light text-brand-coral"}`}>{order.side}</span>
                  </td>
                  <td draggable={false} className="px-3 py-2 text-xs text-gray-500">{openDate}</td>
                  <td draggable={false} className="px-3 py-2 text-right text-xs">{order.qty}</td>
                  <td draggable={false} className="px-3 py-2 text-right text-xs">${order.entry_price || "-"}</td>
                  <td draggable={false} className="px-3 py-2 text-right text-xs">${order.current_price || "-"}</td>
                  {showLev && (
                    <td className="px-3 py-2 text-right text-xs">{order.leverage != null ? `${order.leverage}x` : '-'}</td>
                  )}
                  {showLev && (
                    <td className="px-3 py-2 text-right text-xs">${order.margin_rate != null ? order.margin_rate : '-'}</td>
                  )}
                  {showExp && (
                    <td className="px-3 py-2 text-xs">{order.expiry_date ? order.expiry_date.slice(0, 10) : '-'}</td>
                  )}
                  {showStrikePrice && (
                    <td className="px-3 py-2 text-right text-xs">${order.strike_price != null ? order.strike_price : '-'}</td>
                  )}
                  <td draggable={false} className="px-3 py-2 text-right text-xs">${order.tp_price || "-"}</td>
                  <td draggable={false} className="px-3 py-2 text-right text-xs">${order.sl_price || "-"}</td>
                  <td draggable={false} className={`px-3 py-2 text-right text-xs font-bold ${(() => {
                    const pl = order.current_price && order.entry_price ? (order.current_price - order.entry_price) * Number(order.qty) : 0;
                    return pl >= 0 ? 'text-emerald-600' : 'text-red-500';
                  })()}`}>
                    {(() => {
                      const pl = order.current_price && order.entry_price ? (order.current_price - order.entry_price) * Number(order.qty) : 0;
                      return pl >= 0 ? '+' : '';
                    })()}${(() => {
                      const pl = order.current_price && order.entry_price ? (order.current_price - order.entry_price) * Number(order.qty) : 0;
                      return pl.toFixed(2);
                    })()}
                  </td>
                  <td draggable={false} className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                      (order.order_status || "").toUpperCase() === "FILLED" ? "bg-green-100 text-green-700" :
                      (order.order_status || "").toUpperCase() === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                      (order.order_status || "").toUpperCase() === "CLOSE" ? "bg-red-100 text-red-700" :
                      (order.order_status || "").toUpperCase() === "CANCELED" ? "bg-gray-100 text-gray-500" :
                      "text-gray-500"
                    }`}>{order.order_status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => onEditOrder(order)} className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-gray-600" title="Edit">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 11.5 8 16l4.5-7.5z" />
                        </svg>
                      </button>
                      <button onClick={() => onCloseOrder(order)} className="p-1 hover:bg-red-50 rounded transition-colors text-red-300 hover:text-red-500" title="Close">
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

    <div className="mb-6" />
    <TradeHistoryTable tradeHistory={tradeHistory} showHistory={showHistory} onToggleHistory={onToggleHistory} onDropOnTradeHistory={onDropOnTradeHistory} />
  </section>
  );
};

export default OrderManagement;