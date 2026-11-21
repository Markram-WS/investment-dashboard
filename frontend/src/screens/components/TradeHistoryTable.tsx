import React, { useState, useCallback, useMemo } from "react";
import { formatMoney } from "../../utils/format";

interface TradeHistoryTableProps {
  tradeHistory: any[];
  showHistory: boolean;
  onToggleHistory: () => void;
  onDropOnTradeHistory?: (orderId: string) => void;
}

/** Ledger column head: 11px/500 slate, sentence case. */
const headCell = { fontWeight: 500, color: "var(--color-slate)" } as const;

/** Badge: 11px/500 slate on surface-soft, pill radius. */
const badgeStyle = {
  fontWeight: 500,
  color: "var(--color-slate)",
  background: "var(--color-surface-soft)",
  borderRadius: "var(--rounded-full)",
  padding: "2px var(--control-btn-pad-x)",
  whiteSpace: "nowrap",
} as const;

const dragSurface = "color-mix(in srgb, var(--color-brand-teal) 8%, var(--color-canvas))";

const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({
  tradeHistory, showHistory, onToggleHistory, onDropOnTradeHistory,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback(() => {
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const target = e.currentTarget;
    const related = e.relatedTarget as Node;
    if (!target.contains(related)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const orderId = e.dataTransfer.getData('text/plain');
    if (orderId && onDropOnTradeHistory) {
      onDropOnTradeHistory(orderId);
    }
  }, [onDropOnTradeHistory]);

  const groupedByAsset = useMemo(() => {
    const sorted = [...tradeHistory].sort((a, b) => {
      const da = a.exit_date || '';
      const db = b.exit_date || '';
      return da.localeCompare(db);
    });
    const groups: Record<string, any[]> = {};
    for (const h of sorted) {
      const asset = h.asset || 'Unknown';
      if (!groups[asset]) groups[asset] = [];
      groups[asset].push(h);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [tradeHistory]);

  const fmt = (d: string) => (d ? d.slice(0, 10) : "-");

  return (
    <div
      className="bg-surface rounded-b-xl border border-hairline transition-colors"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={isDragOver
        ? { background: dragSurface, borderLeft: '2px solid var(--color-brand-teal)', borderRight: '2px solid var(--color-brand-teal)' }
        : undefined}
    >
      <button
        onClick={onToggleHistory}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors text-ink hover:bg-surface-soft"
        style={isDragOver ? { background: dragSurface } : undefined}
      >
        <span className="flex items-center gap-2">
          <span className="text-[length:var(--fs-label)]" style={badgeStyle}>
            Trade history ({tradeHistory.length})
          </span>
          {isDragOver && <span className="text-[length:var(--fs-label)]" style={{ fontWeight: 600, color: 'var(--color-brand-teal)' }}>Drop to close/cancel</span>}
        </span>
        <svg className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {showHistory && (
        <div className="max-h-72 overflow-auto">
          {tradeHistory.length === 0 ? (
            <p className="px-4 py-3 text-slate text-center text-[length:var(--fs-content)]">No closed orders yet.</p>
          ) : (
            groupedByAsset.map(([asset, rows]) => (
              <div key={asset}>
                <div className="px-3 py-2 bg-surface-soft border-b border-hairline sticky top-0">
                  <span className="text-ink text-[length:var(--fs-label)]" style={{ fontWeight: 600 }}>{asset} ({rows.length})</span>
                </div>
                <table className="w-full">
                  <thead className="bg-surface text-[length:var(--fs-label)]">
                    <tr>
                      <th className="px-3 py-1.5 text-left" style={headCell}>Open ID</th>
                      <th className="hidden md:table-cell px-3 py-1.5 text-left" style={headCell}>Close ID</th>
                      <th className="px-3 py-1.5 text-left" style={headCell}>Side</th>
                      <th className="px-3 py-1.5 text-right" style={{ ...headCell, textAlign: 'right' }}>Qty</th>
                      <th className="px-3 py-1.5 text-right" style={{ ...headCell, textAlign: 'right' }}>Entry</th>
                      <th className="hidden md:table-cell px-3 py-1.5 text-right" style={{ ...headCell, textAlign: 'right' }}>Exit</th>
                      <th className="px-3 py-1.5 text-right" style={{ ...headCell, textAlign: 'right' }}>P/L</th>
                      <th className="px-3 py-1.5 text-left" style={headCell}>Status</th>
                      <th className="hidden lg:table-cell px-3 py-1.5 text-right" style={{ ...headCell, textAlign: 'right' }}>Open date</th>
                      <th className="hidden lg:table-cell px-3 py-1.5 text-right" style={{ ...headCell, textAlign: 'right' }}>Close date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((h: any) => (
                      <tr key={h.history_id} className="border-b border-hairline-soft">
                        <td className="px-3 py-1.5 text-slate text-[length:var(--fs-content)]">{h.order_id ?? "-"}</td>
                        <td className="hidden md:table-cell px-3 py-1.5 text-slate text-[length:var(--fs-content)]">{h.close_order_id ?? "-"}</td>
                        <td className="px-3 py-1.5">
                          <span className="text-[length:var(--fs-label)]" style={badgeStyle}>
                            {h.type ? `${String(h.type).charAt(0).toUpperCase()}${String(h.type).slice(1).toLowerCase()}` : h.type}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right text-ink text-[length:var(--fs-content)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{h.amount ?? "-"}</td>
                        <td className="px-3 py-1.5 text-right text-ink text-[length:var(--fs-content)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{h.entry_price != null ? formatMoney(Number(h.entry_price)) : "-"}</td>
                        <td className="hidden md:table-cell px-3 py-1.5 text-right text-ink text-[length:var(--fs-content)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{h.exit_price != null ? formatMoney(Number(h.exit_price)) : "-"}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-[length:var(--fs-content)]" style={{
                          fontVariantNumeric: 'tabular-nums',
                          color: (h.realized_pl ?? 0) >= 0 ? 'var(--color-positive-text)' : 'var(--color-danger-text)',
                        }}>
                          {h.realized_pl != null ? formatMoney(Number(h.realized_pl)) : "-"}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="text-[length:var(--fs-label)]" style={badgeStyle}>{h.remark?.note === "Canceled" ? "Canceled" : "Close"}</span>
                        </td>
                        <td className="hidden lg:table-cell px-3 py-1.5 text-right text-slate text-[length:var(--fs-content)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(h.entry_date)}</td>
                        <td className="hidden lg:table-cell px-3 py-1.5 text-right text-slate text-[length:var(--fs-content)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(h.exit_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TradeHistoryTable;
