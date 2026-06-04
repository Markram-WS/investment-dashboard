import React, { useState, useCallback, useRef, useMemo } from 'react';
import { SpreadOrder, GroupOption, OrderLinkGroup } from '../../types';

interface OrderGroupRowProps {
  groupInfo: {
    group_id: number | null;
    group_name: string;
    mainOrders: SpreadOrder[];
    pendingCloseOrders: SpreadOrder[];
    linkGroups: OrderLinkGroup[];
  };
  groups: GroupOption[];
  onEdit: (order: SpreadOrder) => void;
  onClose?: (order: SpreadOrder) => void;
  onAssignGroup?: (orderIds: string[], groupId: number | null) => void;
  onLinkOrder?: (sourceOrderId: string, targetOrderId: string) => void;
  contractFilter: 'all' | 'spot' | 'future' | 'option';
  showLev: boolean;
  showExp: boolean;
  showStrikePrice: boolean;
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return dateStr.slice(0, 10);
};

const getSideBadgeClass = (side: string): string => {
  return (side === 'BUY' || side === 'Buy' || side === 'buy' || side === 'LONG' || side === 'Long')
    ? 'bg-tealLight text-brandTeal border border-brandTeal/20 uppercase'
    : 'bg-coralLight text-brandCoral border border-brandCoral/20 uppercase';
};

export const OrderGroupRow: React.FC<OrderGroupRowProps> = ({ groupInfo, groups, onEdit, onClose, onAssignGroup, onLinkOrder, contractFilter, showLev, showExp, showStrikePrice }) => {
  const isUngrouped = groupInfo.group_id === null;
  const groupDef = groups.find(g => g.id === groupInfo.group_id);
  const groupLabel = groupDef
    ? `${groupDef.name}${groupDef.min_price != null && groupDef.max_price != null ? ` ($${groupDef.min_price.toLocaleString()}-$${groupDef.max_price.toLocaleString()})` : ''}`
    : groupInfo.group_name;
  const maxOrders = groupDef?.max_orders;
  const count = groupInfo.mainOrders.length;

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const extraCols = (showLev ? 2 : 0) + (showExp ? 1 : 0) + (showStrikePrice ? 1 : 0);
  const baseCols = 14;
  const totalCols = baseCols + extraCols;

  const linkInfoMap = useMemo(() => {
    const map: Record<string, { isSub: boolean; isSpreadPartner: boolean; primaryOrderId?: string; showLine: boolean; linkType: string; isFirstInGroup: boolean; isLastInGroup: boolean }> = {};
    for (const lg of groupInfo.linkGroups) {
      const isSpread = !!lg.spreadPartner;
      const all: SpreadOrder[] = [lg.primary, ...lg.subs];
      if (lg.spreadPartner) all.push(lg.spreadPartner, ...(lg.partnerSubs || []));
      all.forEach((m, idx) => {
        const isSub = lg.subs.includes(m) || (lg.partnerSubs || []).includes(m);
        map[m.order_id] = {
          isSub,
          isSpreadPartner: m === lg.spreadPartner,
          primaryOrderId: lg.primary?.order_id,
          showLine: isSpread || isSub,
          linkType: m.link_type || '',
          isFirstInGroup: idx === 0,
          isLastInGroup: idx === all.length - 1,
        };
      });
    }
    return map;
  }, [groupInfo.linkGroups]);

  const createDragGhost = useCallback((order: SpreadOrder): HTMLElement => {
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
  }, []);

  const handleGroupDragEnter = useCallback(() => {
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragOver(true);
  }, []);

  const handleGroupDragLeave = useCallback((e: React.DragEvent) => {
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleGroupDrop = useCallback((e: React.DragEvent, targetOrderId?: string) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const isLink = e.dataTransfer.getData('text/x-link');
    if (isLink) {
      const linkOrderId = e.dataTransfer.getData('text/plain');
      if (linkOrderId && onLinkOrder && linkOrderId !== targetOrderId) {
        const target = targetOrderId || (groupInfo.mainOrders.length > 0 ? groupInfo.mainOrders[0].order_id : undefined);
        if (target && linkOrderId !== target) onLinkOrder(linkOrderId, target);
      }
      return;
    }
    const orderId = e.dataTransfer.getData('text/plain');
    const linkedIdsStr = e.dataTransfer.getData('text/x-linked-ids');
    const ids: string[] = [];
    if (orderId) ids.push(orderId);
    if (linkedIdsStr) {
      const parsed = linkedIdsStr.split(',').filter(Boolean);
      for (const id of parsed) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
    if (ids.length > 0 && onAssignGroup) {
      onAssignGroup(ids, groupInfo.group_id);
    }
  }, [onAssignGroup, onLinkOrder, groupInfo.group_id, groupInfo.mainOrders]);

  const handleLinkDragStart = useCallback((e: React.DragEvent, order: SpreadOrder) => {
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
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, order: SpreadOrder) => {
    e.dataTransfer.setData('text/plain', order.order_id);
    e.dataTransfer.effectAllowed = 'move';
    // Carry linked children when dragging a primary
    const linkedIds: string[] = [];
    for (const lg of groupInfo.linkGroups) {
      if (lg.primary?.order_id === order.order_id) {
        linkedIds.push(...lg.subs.map(s => s.order_id));
        if (lg.spreadPartner) linkedIds.push(lg.spreadPartner.order_id, ...(lg.partnerSubs || []).map(s => s.order_id));
      }
    }
    if (linkedIds.length > 0) {
      e.dataTransfer.setData('text/x-linked-ids', linkedIds.join(','));
    }
    const ghost = createDragGhost(order);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 30, 20);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, [createDragGhost, groupInfo.linkGroups]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const types = Array.from(e.dataTransfer.types);
    e.dataTransfer.dropEffect = types.indexOf('text/x-link') !== -1 ? 'link' : 'move';
  }, []);

  return (
    <>
      <tr
        className={`${isUngrouped ? 'bg-gray-50' : 'bg-surface'} border-b border-hairline transition-colors ${isDragOver ? 'bg-blue-50' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleGroupDragEnter}
        onDragLeave={handleGroupDragLeave}
        onDrop={handleGroupDrop}
        style={isDragOver ? { borderLeft: '3px solid #3b82f6' } : undefined}
      >
        <td className="pl-8 py-3" colSpan={totalCols}>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${isUngrouped ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-tealLight text-brandTeal border border-brandTeal/20'} uppercase tracking-wide`}>
              {groupLabel}
            </span>
            {maxOrders != null && (
              <span className="text-[10px] text-slate font-medium">{count}/{maxOrders}</span>
            )}
            {isDragOver && (
              <span className="text-[10px] text-blue-600 font-semibold ml-2">Drop to assign</span>
            )}
          </div>
        </td>
      </tr>

      {groupInfo.mainOrders.map((order) => {
        const pl = order.current_price && order.entry_price
          ? (order.current_price - order.entry_price) * Number(order.qty)
          : 0;

        const isSpot = (order.contract_type || 'spot') === 'spot';
        const showGray = isSpot && contractFilter !== 'spot' && contractFilter !== 'all';
        const linkInfo = linkInfoMap[order.order_id];
        const isLinked = order.link_type && order.link_type !== 'none';

        return (
          <tr
            key={order.order_id}
            className={`border-b border-hairline transition-colors trade-group-border group ${showGray ? 'bg-gray-50' : 'hover:bg-surface/50'} ${isDragOver ? 'bg-blue-50/30' : ''}`}
            onDragOver={handleDragOver}
            onDragEnter={handleGroupDragEnter}
            onDragLeave={handleGroupDragLeave}
            onDrop={(e) => handleGroupDrop(e, order.order_id)}
            style={isDragOver ? { borderLeft: '3px solid #3b82f6' } : undefined}
          >
            <td className="py-4 w-8 text-center">
              <span
                draggable={!linkInfo?.isSub && !linkInfo?.isSpreadPartner}
                onDragStart={(e) => handleDragStart(e, order)}
                className={`${linkInfo?.isSub || linkInfo?.isSpreadPartner ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} cursor-grab active:cursor-grabbing inline-flex items-center justify-center text-gray-300 hover:text-gray-500 transition-opacity`}
                title="Drag to assign group or close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5" />
                  <circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" />
                  <circle cx="15" cy="18" r="1.5" />
                </svg>
              </span>
            </td>
            <td className={`py-4 w-8 relative ${linkInfo?.showLine ? '' : ''}`}>
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
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" draggable="false">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </span>
                </span>
              )}
            </td>
            <td draggable={false} className="py-4 font-bold text-xs">#{order.order_id}</td>
            <td draggable={false} className="py-4 font-bold text-xs uppercase">{order.asset_type}</td>
            <td draggable={false} className="py-4">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getSideBadgeClass(order.side)}`}>
                {order.side}
              </span>
            </td>
            <td draggable={false} className="py-4 text-[10px] text-slate">{formatDate(order.created_at)}</td>
            <td draggable={false} className="py-4 text-xs font-medium">${order.entry_price ? order.entry_price.toLocaleString() : '-'}</td>
            <td draggable={false} className="py-4 text-xs font-medium">{order.qty}</td>
            <td draggable={false} className="py-4 text-xs font-medium">${order.current_price ? order.current_price.toLocaleString() : '-'}</td>
            {showLev && (
              <td className="py-4 text-xs font-medium">{order.leverage != null ? `${order.leverage}x` : '-'}</td>
            )}
            {showLev && (
              <td className="py-4 text-xs font-medium">${order.margin_rate != null ? order.margin_rate : '-'}</td>
            )}
            {showExp && (
              <td className="py-4 text-[10px] text-slate">{order.expiry_date ? formatDate(order.expiry_date) : '-'}</td>
            )}
            {showStrikePrice && (
              <td className="py-4 text-xs font-medium">${order.strike_price != null ? order.strike_price.toLocaleString() : '-'}</td>
            )}
            <td draggable={false} className="py-4 text-xs font-medium">${order.tp_price ? order.tp_price.toLocaleString() : '-'}</td>
            <td draggable={false} className="py-4 text-xs font-medium">${order.sl_price ? order.sl_price.toLocaleString() : '-'}</td>
            <td draggable={false} className={`py-4 text-xs font-bold ${pl >= 0 ? 'text-brandTeal' : 'text-brandCoral'}`}>
              {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
            </td>
            <td draggable={false} className="py-4">
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
                  className="p-1.5 hover:bg-white rounded-full transition-colors text-slate"
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
                    className="p-1.5 hover:bg-red-50 rounded-full transition-colors text-red-300 hover:text-red-500"
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