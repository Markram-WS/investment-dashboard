import React, { useState, useEffect, useRef } from "react";
import { IconPlus, IconX } from "../../components/icons";
import { buttonTheme } from "../../constants/colors";

export interface OptionRow {
  id: number;
  side: "LONG" | "SHORT";
  expiry: string;
  strike: string;
  type: "Call" | "Put";
  qty: string;
  price: string;
  iv: string;
}

const emptyRow = (id: number): OptionRow => ({
  id,
  side: "LONG",
  expiry: "",
  strike: "",
  type: "Call",
  qty: "",
  price: "",
  iv: "0",
});

const IconTrash2 = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

interface OptionsStrategyTableProps {
  visible: boolean;
  onClose: () => void;
  onRowsChange?: (rows: OptionRow[]) => void;
}

const OptionsStrategyTable: React.FC<OptionsStrategyTableProps> = ({ visible, onClose, onRowsChange }) => {
  const [rows, setRows] = useState<OptionRow[]>(() => {
    try { return JSON.parse(localStorage.getItem('payoff_strategy_rows') || '[]'); }
    catch { return []; }
  });
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      onRowsChange?.(rows);
      return;
    }
    localStorage.setItem('payoff_strategy_rows', JSON.stringify(rows));
    onRowsChange?.(rows);
  }, [rows, onRowsChange]);

  const addRow = () => {
    const maxId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) : 0;
    setRows(prev => [...prev, emptyRow(maxId + 1)]);
  };

  const deleteRow = (id: number) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const updateRow = (id: number, field: keyof OptionRow, value: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  if (!visible) return null;

  return (
    <div className="h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-hairline">
        <span className="text-[10px] font-bold text-slate uppercase tracking-widest">Options Strategy</span>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full bg-canvas text-slate border border-hairline hover:bg-surface transition-all flex items-center justify-center"
          title="Hide Options Strategy"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>
      <div className="table-responsive">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface">
            <th className="px-2 py-1.5 text-center font-semibold text-ink">Side</th>
            <th className="px-2 py-1.5 text-center font-semibold text-ink">Type</th>
            <th className="px-2 py-1.5 text-center font-semibold text-ink">Strike</th>
            <th className="px-2 py-1.5 text-center font-semibold text-ink">Premium</th>
            <th className="px-2 py-1.5 text-center font-semibold text-ink">Qty</th>
            <th className="px-2 py-1.5 text-center font-semibold text-ink">Expiry</th>
            <th className="px-2 py-1.5 text-center font-semibold text-ink">IV%</th>
            <th className="px-2 py-1.5 w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-4 text-center text-slate text-[10px]">
                No rows yet. Click [+] to add a strategy leg.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="px-1 py-1">
                  <div className="flex rounded-md overflow-hidden">
                    <button
                      onClick={() => updateRow(row.id, "side", "LONG")}
                      className={`text-[9px] font-bold px-2 py-0.5 transition-colors ${row.side === "LONG" ? `${buttonTheme.side.LONG.bg} ${buttonTheme.side.LONG.text}` : `${buttonTheme.side.LONG.inactiveBg} ${buttonTheme.side.LONG.inactiveText}`}`}
                    >
                      LONG
                    </button>
                    <button
                      onClick={() => updateRow(row.id, "side", "SHORT")}
                      className={`text-[9px] font-bold px-2 py-0.5 transition-colors ${row.side === "SHORT" ? `${buttonTheme.side.SHORT.bg} ${buttonTheme.side.SHORT.text}` : `${buttonTheme.side.SHORT.inactiveBg} ${buttonTheme.side.SHORT.inactiveText}`}`}
                    >
                      SHORT
                    </button>
                  </div>
                </td>
                <td className="px-1 py-1">
                  <div className="flex rounded-md overflow-hidden">
                    <button
                      onClick={() => updateRow(row.id, "type", "Call")}
                      className={`text-[9px] font-bold px-2 py-0.5 transition-colors ${row.type === "Call" ? `${buttonTheme.optionType.Call.bg} ${buttonTheme.optionType.Call.text}` : `${buttonTheme.optionType.Call.inactiveBg} ${buttonTheme.optionType.Call.inactiveText}`}`}
                    >
                      Call
                    </button>
                    <button
                      onClick={() => updateRow(row.id, "type", "Put")}
                      className={`text-[9px] font-bold px-2 py-0.5 transition-colors ${row.type === "Put" ? `${buttonTheme.optionType.Put.bg} ${buttonTheme.optionType.Put.text}` : `${buttonTheme.optionType.Put.inactiveBg} ${buttonTheme.optionType.Put.inactiveText}`}`}
                    >
                      Put
                    </button>
                  </div>
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={row.strike}
                    onChange={(e) => updateRow(row.id, "strike", e.target.value)}
                    className="text-[10px] border border-hairline rounded px-1 py-0.5 bg-canvas text-gray-700 w-full text-right"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={row.price}
                    onChange={(e) => updateRow(row.id, "price", e.target.value)}
                    className="text-[10px] border border-hairline rounded px-1 py-0.5 bg-canvas text-gray-700 w-full text-right"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={row.qty}
                    onChange={(e) => updateRow(row.id, "qty", e.target.value)}
                    className="text-[10px] border border-hairline rounded px-1 py-0.5 bg-canvas text-gray-700 w-full text-right"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="date"
                    value={row.expiry}
                    onChange={(e) => updateRow(row.id, "expiry", e.target.value)}
                    className="text-[10px] border border-hairline rounded px-1 py-0.5 bg-canvas text-gray-700 w-full"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={row.iv}
                    onChange={(e) => updateRow(row.id, "iv", e.target.value)}
                    className="text-[10px] border border-hairline rounded px-1 py-0.5 bg-canvas text-gray-700 w-full text-right"
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="text-red-300 hover:text-red-500 transition-colors"
                    title="Delete row"
                  >
                    <IconTrash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="flex justify-center px-4 py-1.5 border-t border-hairline bg-surface">
        <button
          onClick={addRow}
          className="flex items-center gap-1 text-[10px] font-bold text-slate hover:text-gray-700 transition-colors"
        >
          <IconPlus className="w-4 h-4" />
          Add leg
        </button>
      </div>
      </div>
    </div>
  );
};

export default OptionsStrategyTable;
