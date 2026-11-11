import React, { useState, useEffect, useRef } from "react";
import { IconPlus, IconX } from "../../components/icons";

/** Section caption: 12px/500 slate, sentence case. */
const CAPTION: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--color-slate)", margin: 0 };

/** Column head: 12px/500 slate, sentence case. */
const headCell: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--color-slate)", whiteSpace: "nowrap" };

/** Segment toggle — ink pill when selected, quiet slate when not. */
const toggleStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 500,
  padding: "2px 10px",
  border: "none",
  cursor: "pointer",
  background: active ? "var(--color-ink)" : "transparent",
  color: active ? "var(--color-canvas)" : "var(--color-slate)",
});

/** Table input: 12px ink, hairline border. */
const inputStyle: React.CSSProperties = { fontSize: 12, color: "var(--color-ink)" };

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
        <span style={CAPTION}>Options strategy</span>
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
            <th className="px-2 py-1.5 text-center" style={headCell}>Side</th>
            <th className="px-2 py-1.5 text-center" style={headCell}>Type</th>
            <th className="px-2 py-1.5 text-center" style={headCell}>Strike</th>
            <th className="px-2 py-1.5 text-center" style={headCell}>Premium</th>
            <th className="px-2 py-1.5 text-center" style={headCell}>Qty</th>
            <th className="px-2 py-1.5 text-center" style={headCell}>Expiry</th>
            <th className="px-2 py-1.5 text-center" style={headCell}>IV%</th>
            <th className="px-2 py-1.5 w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-4 text-center text-slate" style={{ fontSize: 12 }}>
                No rows yet. Click [+] to add a strategy leg.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t border-hairline-soft">
                <td className="px-1 py-1">
                  <div className="flex rounded-full overflow-hidden bg-surface-soft">
                    <button
                      onClick={() => updateRow(row.id, "side", "LONG")}
                      style={toggleStyle(row.side === "LONG")}
                    >
                      Long
                    </button>
                    <button
                      onClick={() => updateRow(row.id, "side", "SHORT")}
                      style={toggleStyle(row.side === "SHORT")}
                    >
                      Short
                    </button>
                  </div>
                </td>
                <td className="px-1 py-1">
                  <div className="flex rounded-full overflow-hidden bg-surface-soft">
                    <button
                      onClick={() => updateRow(row.id, "type", "Call")}
                      style={toggleStyle(row.type === "Call")}
                    >
                      Call
                    </button>
                    <button
                      onClick={() => updateRow(row.id, "type", "Put")}
                      style={toggleStyle(row.type === "Put")}
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
                    className="border border-hairline rounded px-1 py-0.5 bg-canvas w-full text-right"
                    style={inputStyle}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={row.price}
                    onChange={(e) => updateRow(row.id, "price", e.target.value)}
                    className="border border-hairline rounded px-1 py-0.5 bg-canvas w-full text-right"
                    style={inputStyle}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={row.qty}
                    onChange={(e) => updateRow(row.id, "qty", e.target.value)}
                    className="border border-hairline rounded px-1 py-0.5 bg-canvas w-full text-right"
                    style={inputStyle}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="date"
                    value={row.expiry}
                    onChange={(e) => updateRow(row.id, "expiry", e.target.value)}
                    className="border border-hairline rounded px-1 py-0.5 bg-canvas w-full"
                    style={inputStyle}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={row.iv}
                    onChange={(e) => updateRow(row.id, "iv", e.target.value)}
                    className="border border-hairline rounded px-1 py-0.5 bg-canvas w-full text-right"
                    style={inputStyle}
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="text-slate hover:bg-surface-soft rounded-full transition-colors"
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
          className="flex items-center gap-1 rounded-full border border-hairline text-ink hover:bg-surface-soft transition-colors"
          style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px" }}
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
