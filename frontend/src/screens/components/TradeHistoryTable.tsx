import React from "react";

interface TradeHistoryTableProps {
  tradeHistory: any[];
  showHistory: boolean;
  onToggleHistory: () => void;
}

const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({
  tradeHistory, showHistory, onToggleHistory,
}) => (
  <div className="border-t border-hairline">
    <button
      onClick={onToggleHistory}
      className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-widest hover:bg-gray-50"
    >
      <span>Trade History ({tradeHistory.length})</span>
      <svg className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    {showHistory && (
      <div className="max-h-48 overflow-auto">
        {tradeHistory.length === 0 ? (
          <p className="px-4 py-3 text-xs text-gray-400 text-center">No closed orders yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider">Open ID</th>
                <th className="px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider">Close ID</th>
                <th className="px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider">Asset</th>
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
              {tradeHistory.map((h: any) => {
                const fmt = (d: string) => (d ? d.slice(0, 10) : "-");
                return (
                  <tr key={h.history_id} className="border-b border-gray-100">
                    <td className="px-3 py-1.5 text-gray-500">{h.order_id ?? "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">{h.close_order_id ?? "-"}</td>
                    <td className="px-3 py-1.5 font-medium">{h.asset}</td>
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    )}
  </div>
);

export default TradeHistoryTable;
