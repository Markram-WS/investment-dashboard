import React, { useState } from "react";
import { IconPlus, IconX } from "../../components/icons";

interface OptionRow {
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
}

const OptionsStrategyTable: React.FC<OptionsStrategyTableProps> = ({ visible, onClose }) => {
  const [rows, setRows] = useState<OptionRow[]>([]);

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
    <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Options Strategy</span>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full bg-white text-gray-400 border border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center"
          title="Hide Options Strategy"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>
      <table className="w-4/6 text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-2 py-1.5 text-center font-semibold text-gray-600">Side</th>
            <th className="px-2 py-1.5 text-center font-semibold text-gray-600">Type</th>
            <th className="px-2 py-1.5 text-center font-semibold text-gray-600">Strike</th>
            <th className="px-2 py-1.5 text-center font-semibold text-gray-600">Price</th>
            <th className="px-2 py-1.5 text-center font-semibold text-gray-600">Qty</th>
            <th className="px-2 py-1.5 text-center font-semibold text-gray-600">Expiry</th>
            <th className="px-2 py-1.5 text-center font-semibold text-gray-600">IV</th>
            <th className="px-2 py-1.5 w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-4 text-center text-gray-400 text-[10px]">
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
                      className={`text-[9px] font-bold px-2 py-0.5 transition-colors ${row.side === "LONG" ? "bg-emerald-600 text-white" : "bg-white text-gray-400 hover:text-gray-600"}`}
                    >
                      LONG
                    </button>
                    <button
                      onClick={() => updateRow(row.id, "side", "SHORT")}
                      className={`text-[9px] font-bold px-2 py-0.5 transition-colors ${row.side === "SHORT" ? "bg-red-500 text-white" : "bg-white text-gray-400 hover:text-gray-600"}`}
                    >
                      SHORT
                    </button>
                  </div>
                </td>
                <td className="px-1 py-1">
                  <div className="flex rounded-md overflow-hidden">
                    <button
                      onClick={() => updateRow(row.id, "type", "Call")}
                      className={`text-[9px] font-bold px-2 py-0.5 transition-colors ${row.type === "Call" ? "bg-purple-600 text-white" : "bg-white text-gray-400 hover:text-gray-600"}`}
                    >
                      Call
                    </button>
                    <button
                      onClick={() => updateRow(row.id, "type", "Put")}
                      className={`text-[9px] font-bold px-2 py-0.5 transition-colors ${row.type === "Put" ? "bg-purple-600 text-white" : "bg-white text-gray-400 hover:text-gray-600"}`}
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
                    className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 w-full text-right"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={row.price}
                    onChange={(e) => updateRow(row.id, "price", e.target.value)}
                    className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 w-full text-right"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={row.qty}
                    onChange={(e) => updateRow(row.id, "qty", e.target.value)}
                    className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 w-full text-right"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="date"
                    value={row.expiry}
                    onChange={(e) => updateRow(row.id, "expiry", e.target.value)}
                    className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 w-full"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={row.iv}
                    onChange={(e) => updateRow(row.id, "iv", e.target.value)}
                    className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 w-full text-right"
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
      <div className="flex justify-center px-4 py-1.5 border-t border-gray-200 bg-gray-50">
        <button
          onClick={addRow}
          className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-gray-700 transition-colors"
        >
          <IconPlus className="w-4 h-4" />
          Add leg
        </button>
      </div>
    </div>
  );
};

export default OptionsStrategyTable;
