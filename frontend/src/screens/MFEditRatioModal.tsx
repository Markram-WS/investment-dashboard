import { useState } from "react";
import Button from "./components/Button";

interface MFEditRatioModalProps {
  show: boolean;
  targetRatio: Record<string, number>;
  onClose: () => void;
  onSave: (ratio: Record<string, number>) => void;
}

export default function MFEditRatioModal({ show, targetRatio, onClose, onSave }: MFEditRatioModalProps) {
  const [entries, setEntries] = useState<{ asset: string; pct: string }[]>(() =>
    Object.entries(targetRatio).map(([asset, pct]) => ({ asset, pct: String(pct) }))
  );

  if (!show) return null;

  const addEntry = () => setEntries([...entries, { asset: "", pct: "0" }]);
  const removeEntry = (i: number) => {
    if (entries.length > 1) setEntries(entries.filter((_, idx) => idx !== i));
  };
  const updateEntry = (i: number, field: "asset" | "pct", value: string) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], [field]: field === "pct" ? value : value.toUpperCase() };
    setEntries(copy);
  };

  const handleSave = () => {
    const ratio: Record<string, number> = {};
    for (const e of entries) {
      if (e.asset.trim()) ratio[e.asset.trim()] = parseFloat(e.pct) || 0;
    }
    onSave(ratio);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-canvas rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold mb-4">Edit Target Ratios</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {entries.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={e.asset}
                onChange={(v) => updateEntry(i, "asset", v.target.value)}
                placeholder="Asset"
                className="w-24 border border-hairline rounded px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                step="0.1"
                value={e.pct}
                onChange={(v) => updateEntry(i, "pct", v.target.value)}
                placeholder="%"
                className="w-20 border border-hairline rounded px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-slate">%</span>
              {entries.length > 1 && (
                <button onClick={() => removeEntry(i)} className="text-red-500 hover:text-red-700 text-sm font-bold px-1">×</button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addEntry} className="text-xs text-brand-teal hover:underline mt-2">+ Add asset</button>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save Ratios</Button>
        </div>
      </div>
    </div>
  );
}
