import React from 'react';
import { ZoneGroup, SpreadOrder } from '../../types';

interface ZoneGroupRowProps {
  zoneGroup: ZoneGroup;
  onEdit: (order: SpreadOrder) => void;
  onEditZone?: (orders: SpreadOrder[], zone: string) => void;
  onClose?: (order: SpreadOrder) => void;
}

const IconEdit: React.FC<{className?: string}> = ({className = "w-4 h-4"}) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 11.5 8 16l4.5-7.5z" />
  </svg>
);

const IconClose: React.FC<{className?: string}> = ({className = "w-4 h-4"}) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return dateStr.slice(0, 10);
};

export const ZoneGroupRow: React.FC<ZoneGroupRowProps> = ({ zoneGroup, onEdit, onEditZone, onClose }) => {
  const zonePriceRange = (orders: SpreadOrder[]): string => {
    const prices = orders.map(o => o.entry_price).filter(p => p !== null) as number[];
    if (prices.length === 0) return '';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `$${min.toLocaleString()}-$${max.toLocaleString()}`;
  };

  const zoneBase = (orders: SpreadOrder[]): string => {
    if (orders.length === 0) return '';
    const avgPrice = orders.reduce((sum, o) => sum + (o.entry_price || 0), 0) / orders.length;
    return `Grid Base: $${avgPrice.toFixed(2)}`;
  };

  const getSideBadgeClass = (side: string): string => {
    return (side === 'BUY' || side === 'Buy' || side === 'buy')
      ? 'bg-tealLight text-brandTeal border border-brandTeal/20 uppercase'
      : 'bg-coralLight text-brandCoral border border-brandCoral/20 uppercase';
  };

  const allOrders = [...zoneGroup.mainOrders, ...zoneGroup.pendingCloseOrders];
  const priceRange = zonePriceRange(allOrders);
  const basePrice = zoneBase(allOrders);

  return (
    <>
      {/* Zone header row */}
      <tr className="bg-surface border-b border-hairline">
        <td className="pl-8 py-3" colSpan={12}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEditZone?.(allOrders, zoneGroup.zone)}
                className="p-1.5 hover:bg-white rounded-full transition-colors text-slate border border-hairline"
                title="Edit Zone"
              >
                <IconEdit className="w-4 h-4" />
              </button>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-tealLight text-brandTeal border border-brandTeal/20 uppercase tracking-wide">
                {zoneGroup.zone}: {priceRange}
              </span>
              <span className="text-[10px] font-bold text-slate uppercase tracking-widest">{basePrice}</span>
            </div>
          </div>
        </td>
      </tr>

      {/* Main orders in this zone */}
      {zoneGroup.mainOrders.map((order) => {
        const pl = order.current_price && order.entry_price
          ? (order.current_price - order.entry_price) * Number(order.qty)
          : 0;

        return (
          <tr key={order.order_id} className="border-b border-hairline hover:bg-surface/50 transition-colors trade-group-border">
            <td className="pl-8 py-4 font-bold text-xs">#{order.order_id}</td>
            <td className="py-4 text-xs text-slate font-medium">{zoneGroup.zone}</td>
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
            <td className="py-4 text-[10px] text-slate font-bold uppercase tracking-wider">{order.order_status}</td>
            <td className="pr-6 text-right py-4">
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => onEdit(order)}
                  className="p-1.5 hover:bg-white rounded-full transition-colors text-slate border border-hairline"
                  title="Edit"
                >
                  <IconEdit className="w-4 h-4" />
                </button>
                {onClose && (
                  <button
                    onClick={() => onClose(order)}
                    className="p-1.5 hover:bg-red-50 rounded-full transition-colors text-red-300 hover:text-red-500 border border-hairline"
                    title="Close Order"
                  >
                    <IconClose className="w-4 h-4" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        );
      })}

      {/* Pending close orders */}
      {zoneGroup.pendingCloseOrders.map((order) => (
        <tr key={order.order_id} className="border-b border-hairline hover:bg-surface transition-colors"
            style={{borderLeft: '3px solid #ffd02f'}}>
          <td className="pl-12 py-2 font-bold text-[10px] text-slate">{order.order_id}-S</td>
          <td className="py-2 text-[10px] text-slate/60 font-medium">Pending Sync</td>
          <td className="py-2 font-bold text-[10px] uppercase text-slate/60">{order.asset_type}</td>
          <td className="py-2">
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${getSideBadgeClass(order.side)}`}>
              {order.side}
            </span>
          </td>
          <td className="py-2 text-[10px] text-slate/60">{formatDate(order.created_at)}</td>
          <td className="py-2 text-[10px] font-medium text-slate/60">${order.entry_price ? order.entry_price.toLocaleString() : '-'}</td>
          <td className="py-2 text-[10px] font-medium text-slate/60">{order.qty}</td>
          <td className="py-2 text-[10px] font-medium text-slate/60">-</td>
          <td className="py-2 text-[10px] font-medium text-slate/60">-</td>
          <td className="py-2 text-slate/40 font-bold text-[10px]">-</td>
          <td className="py-2 text-[9px] text-slate font-bold uppercase tracking-wider">Pending</td>
          <td className="pr-6 text-right py-2">
            {onClose && (
              <button
                onClick={() => onClose(order)}
                className="p-1 hover:bg-red-50 rounded-full transition-colors text-red-300 hover:text-red-500 border border-hairline"
                title="Close Order"
              >
                <IconClose className="w-3.5 h-3.5" />
              </button>
            )}
          </td>
        </tr>
      ))}
    </>
  );
};
