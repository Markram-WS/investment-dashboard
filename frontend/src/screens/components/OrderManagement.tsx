import React from "react";
import { SpreadOrder, GroupOption } from "../../types";
import { OrderGroupRow } from "./ZoneGroupRow";
import { IconAdd } from "../../components/icons/IconAdd";
import { IconLayers } from "../../components/icons/IconLayers";
import TradeHistoryTable from "./TradeHistoryTable";

interface OrderManagementProps {
  activeOrders: SpreadOrder[];
  zoneGroups: { group_id: number | null; group_name: string; mainOrders: SpreadOrder[]; pendingCloseOrders: SpreadOrder[] }[];
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
  onAssignGroup?: (orderId: string, groupId: number | null) => void;
  onDropOnTradeHistory?: (orderId: string) => void;
}

const OrderManagement: React.FC<OrderManagementProps> = ({
  activeOrders, zoneGroups, groups, groupByZone, onGroupByZoneToggle, isGridType,
  tradeHistory, onEditOrder, onEditZone, onCloseOrder,
  onAddOrder, onShowZoneGroupModal, showHistory, onToggleHistory,
  onAssignGroup, onDropOnTradeHistory,
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
    const ghost = createDragGhost(order);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 30, 20);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  return (
  <section className="bg-white rounded-xl border border-hairline overflow-hidden mb-6">
    {/* Header */}
    <div className="px-8 pt-8 pb-4 flex justify-between">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest">Order Management</h3>
          <span className="px-2 py-0.5 bg-ink text-[10px] text-white font-bold rounded-full uppercase tracking-tighter">
            {activeOrders.length} ACTIVE
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onShowZoneGroupModal} className="h-8 w-8 rounded-full bg-white text-slate border border-hairline hover:bg-surface transition-all flex items-center justify-center" title="Order Groups">
            <IconLayers className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Group</span>
            <button
              onClick={onGroupByZoneToggle}
              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${groupByZone ? "bg-brand-teal" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${groupByZone ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center">
        <button onClick={onAddOrder} className="h-9 px-4 rounded-full bg-brand-teal text-white text-xs font-bold shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5" title="Add Order">
          <IconAdd className="w-4 h-4" />
          Add Order
        </button>
      </div>
    </div>

    {/* Table */}
    <div className="overflow-x-auto">
      {zoneGroups.length > 0 && groupByZone ? (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface border-y border-hairline">
              <th className="p-4 w-8" />
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">ID</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Group</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Asset</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Side</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Entry Date</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Entry Price</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Qty</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">TP Target</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">SL</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">P/L</th>
              <th className="p-4 text-[10px] font-bold text-slate uppercase tracking-widest">Status</th>
              <th className="p-4 w-12" />
            </tr>
          </thead>
          <tbody className="text-sm text-ink">
              {zoneGroups.map((groupInfo) => (
              <OrderGroupRow
                key={groupInfo.group_id ?? '__ungrouped__'}
                groupInfo={groupInfo}
                groups={groups}
                onEdit={onEditOrder}
                onClose={onCloseOrder}
                onAssignGroup={onAssignGroup}
              />
            ))}
          </tbody>
        </table>
      ) : activeOrders.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 w-8" />
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
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {activeOrders.map((order) => {
              const openDate = order.created_at ? order.created_at.slice(0, 10) : "-";
              return (
                <tr key={order.order_id} className="border-b border-hairline-soft bg-white hover:bg-surface/50 group">
                  <td className="pl-3 py-2 w-8">
                    <span
                      draggable
                      onDragStart={(e) => handleDragStart(e, order)}
                      className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing inline-flex items-center justify-center text-gray-300 hover:text-gray-500 transition-opacity"
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
                  <td className="px-3 py-2 text-xs text-gray-500 font-mono">#{order.order_id}</td>
                  <td className="px-3 py-2 font-medium text-sm">{order.asset_type}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1 rounded ${order.side === "BUY" || order.side === "Buy" ? "bg-teal-light text-brand-teal" : "bg-coral-light text-brand-coral"}`}>{order.side}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{openDate}</td>
                  <td className="px-3 py-2 text-right text-xs">{order.qty}</td>
                  <td className="px-3 py-2 text-right text-xs">${order.entry_price || "-"}</td>
                  <td className="px-3 py-2 text-right text-xs">${order.current_price || "-"}</td>
                  <td className="px-3 py-2 text-right text-xs">${order.tp_price || "-"}</td>
                  <td className="px-3 py-2 text-right text-xs">${order.sl_price || "-"}</td>
                  <td className="px-3 py-2">
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
