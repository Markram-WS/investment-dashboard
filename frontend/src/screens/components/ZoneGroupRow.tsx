import React from 'react';
import { SpreadOrder, GroupOption } from '../../types';

interface OrderGroupRowProps {
  groupInfo: {
    group_id: number | null;
    group_name: string;
    mainOrders: SpreadOrder[];
    pendingCloseOrders: SpreadOrder[];
  };
  groups: GroupOption[];
  onEdit: (order: SpreadOrder) => void;
  onClose?: (order: SpreadOrder) => void;
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return dateStr.slice(0, 10);
};

const getSideBadgeClass = (side: string): string => {
  return (side === 'BUY' || side === 'Buy' || side === 'buy')
    ? 'bg-tealLight text-brandTeal border border-brandTeal/20 uppercase'
    : 'bg-coralLight text-brandCoral border border-brandCoral/20 uppercase';
};

export const OrderGroupRow: React.FC<OrderGroupRowProps> = ({ groupInfo, groups, onEdit, onClose }) => {
  const isUngrouped = groupInfo.group_id === null;
  const groupDef = groups.find(g => g.id === groupInfo.group_id);
  const groupLabel = groupDef
    ? `${groupDef.name}${groupDef.min_price != null && groupDef.max_price != null ? ` ($${groupDef.min_price.toLocaleString()}-$${groupDef.max_price.toLocaleString()})` : ''}`
    : groupInfo.group_name;
  const maxOrders = groupDef?.max_orders;
  const count = groupInfo.mainOrders.length;

  return (
    <>
      {/* Group header row */}
      <tr className={`${isUngrouped ? 'bg-gray-50' : 'bg-surface'} border-b border-hairline`}>
        <td className="pl-8 py-3" colSpan={12}>
          <div className="flex items-center gap-2">
            {isUngrouped && (
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">──</span>
            )}
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${isUngrouped ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-tealLight text-brandTeal border border-brandTeal/20'} uppercase tracking-wide`}>
              {groupLabel}
            </span>
            {maxOrders != null && (
              <span className="text-[10px] text-slate font-medium">{count}/{maxOrders}</span>
            )}
          </div>
        </td>
      </tr>

      {/* Main orders in this group */}
      {groupInfo.mainOrders.map((order) => {
        const pl = order.current_price && order.entry_price
          ? (order.current_price - order.entry_price) * Number(order.qty)
          : 0;

        return (
          <tr key={order.order_id} className="border-b border-hairline hover:bg-surface/50 transition-colors trade-group-border">
            <td className="pl-8 py-4 font-bold text-xs">#{order.order_id}</td>
            <td className="py-4 text-xs text-slate font-medium">{groupInfo.group_name}</td>
            <td className="py-4 font-bold text-xs uppercase">{order.asset_type}</td>
            <td className="py-4">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getSideBadgeClass(order.side)}`}>
                {order.side}
              </span>
            </td>
            <td className="py-4 text-[10px] text-slate">{formatDate(order.created_at)}</td>
            <td className="py-4 text-xs font-medium">${order.entry_price ? order.entry_price.toLocaleString() : '-'}</td>
            <td className="py-4 text-xs font-medium">{order.qty}</td>
            <td className="py-4 text-xs font-medium">${order.tp_price ? order.tp_price.toLocaleString() : '-'}</td>
            <td className="py-4 text-xs font-medium">${order.sl_price ? order.sl_price.toLocaleString() : '-'}</td>
            <td className={`py-4 text-xs font-bold ${pl >= 0 ? 'text-brandTeal' : 'text-brandCoral'}`}>
              {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
            </td>
            <td className="py-4">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                (order.order_status || "").toUpperCase() === "FILLED" ? "bg-green-100 text-green-700" :
                (order.order_status || "").toUpperCase() === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                (order.order_status || "").toUpperCase() === "CLOSE" ? "bg-red-100 text-red-700" :
                (order.order_status || "").toUpperCase() === "CANCELED" ? "bg-gray-100 text-gray-500" :
                "text-slate"
              }`}>{order.order_status}</span>
            </td>
            <td className="pr-6 text-right py-4">
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => onEdit(order)}
                  className="p-1.5 hover:bg-white rounded-full transition-colors text-slate border border-hairline"
                  title="Edit"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                {onClose && (
                  <button
                    onClick={() => onClose(order)}
                    className="p-1.5 hover:bg-red-50 rounded-full transition-colors text-red-300 hover:text-red-500 border border-hairline"
                    title="Close Order"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
};