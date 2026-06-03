import React, { useState, useCallback, useMemo } from "react";

interface TradeHistoryTableProps {
  tradeHistory: any[];
  showHistory: boolean;
  onToggleHistory: () => void;
  onDropOnTradeHistory?: (orderId: string) => void;
}

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
      className={`bg-gray-50 rounded-b-xl border border-hairline transition-colors ${isDragOver ? 'bg-blue-50 border-blue-300' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={isDragOver ? { borderLeft: '3px solid #3b82f6', borderRight: '3px solid #3b82f6' } : undefined}
    >
      <button
        onClick={onToggleHistory}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isDragOver ? 'text-blue-700 bg-blue-50' : 'text-gray-500 hover:bg-gray-100'}`}
      >
        <span className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200 uppercase tracking-wide">
            Trade History ({tradeHistory.length})
          </span>
          {isDragOver && <span className="text-[10px] text-blue-600 font-semibold">Drop to close/cancel</span>}
        </span>
        <svg className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {showHistory && (
        <div className="max-h-72 overflow-auto">
          {tradeHistory.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400 text-center">No closed orders yet.</p>
          ) : (
            groupedByAsset.map(([asset, rows]) => (
              <div key={asset}>
                <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 sticky top-0">
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">{asset} ({rows.length})</span>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider">Open ID</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider">Close ID</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider">Side</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">Qty</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">Entry</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">Exit</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">P/L</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider">Status</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">Open Date</th>
                      <th className="px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider">Close Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((h: any) => (
                      <tr key={h.history_id} className="border-b border-gray-100">
                        <td className="px-3 py-1.5 text-gray-500">{h.order_id ?? "-"}</td>
                        <td className="px-3 py-1.5 text-gray-500">{h.close_order_id ?? "-"}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1 rounded text-[9px] font-bold ${h.type === "BUY" || h.type === "Buy" ? "bg-teal-light text-brand-teal" : "bg-coral-light text-brand-coral"}`}>
                            {h.type}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">{h.amount ?? "-"}</td>
                        <td className="px-3 py-1.5 text-right">{h.entry_price != null ? `$${Number(h.entry_price).toLocaleString()}` : "-"}</td>
                        <td className="px-3 py-1.5 text-right">{h.exit_price != null ? `$${Number(h.exit_price).toLocaleString()}` : "-"}</td>
                        <td className={`px-3 py-1.5 text-right font-medium ${(h.realized_pl ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {h.realized_pl != null ? `$${Number(h.realized_pl).toLocaleString()}` : "-"}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            h.comments?.note === "Canceled"
                              ? "bg-gray-100 text-gray-500"
                              : "bg-red-100 text-red-700"
                          }`}>{h.comments?.note === "Canceled" ? "CANCELED" : "CLOSE"}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{fmt(h.entry_date)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{fmt(h.exit_date)}</td>
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
