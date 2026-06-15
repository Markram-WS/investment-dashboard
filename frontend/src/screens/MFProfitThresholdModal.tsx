import { useState } from "react";
import { MFHolding, MFSetting } from "../types";
import Button from "./components/Button";
import ModalShell from "./components/ModalShell";

interface MFProfitThresholdModalProps {
  show: boolean;
  settings: MFSetting | null;
  holdings: MFHolding[];
  onClose: () => void;
  onSave: (globalThreshold: number, perAsset: Record<number, number>) => void;
}

export default function MFProfitThresholdModal({ show, settings, holdings, onClose, onSave }: MFProfitThresholdModalProps) {
  const [globalThreshold, setGlobalThreshold] = useState(
    String(settings?.global_profit_threshold ?? 0)
  );
  const [perAsset, setPerAsset] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const h of holdings) {
      map[h.holding_id] = String(h.profit_threshold || 0);
    }
    return map;
  });

  if (!show) return null;

  const handleSave = () => {
    const parsedPerAsset: Record<number, number> = {};
    for (const [id, val] of Object.entries(perAsset)) {
      parsedPerAsset[Number(id)] = parseFloat(val) || 0;
    }
    onSave(parseFloat(globalThreshold) || 0, parsedPerAsset);
  };

  return (
    <ModalShell open={show} onClose={onClose} title="Profit Threshold Settings" closeOnBackdrop={false}>
      <div className="bg-canvas rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold mb-4">Profit Threshold Settings</h3>

        <div className="mb-4">
          <label className="block text-xs font-bold uppercase text-slate mb-1">Global Threshold (%)</label>
          <input
            type="number"
            step="0.1"
            value={globalThreshold}
            onChange={(e) => setGlobalThreshold(e.target.value)}
            className="w-full border border-hairline rounded px-3 py-2 text-sm"
            placeholder="e.g. 10 = alert when P/L exceeds 10%"
          />
          <p className="text-[10px] text-slate mt-1">Alert fires when any holding P/L % exceeds this value</p>
        </div>

        {holdings.length > 0 && (
          <div>
            <label className="block text-xs font-bold uppercase text-slate mb-2">Per-Asset Threshold (%)</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {holdings.map((h) => (
                <div key={h.holding_id} className="flex items-center gap-2">
                  <span className="w-16 text-sm font-medium text-ink">{h.asset}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={perAsset[h.holding_id] || "0"}
                    onChange={(e) =>
                      setPerAsset({ ...perAsset, [h.holding_id]: e.target.value })
                    }
                    className="w-20 border border-hairline rounded px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-slate">%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save Thresholds</Button>
        </div>
      </div>
    </ModalShell>
  );
}
