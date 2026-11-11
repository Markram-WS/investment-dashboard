import { useState } from "react";
import type { CSSProperties } from "react";
import { MFHolding, MFSetting } from "../types";
import ModalShell from "./components/ModalShell";

interface MFProfitThresholdModalProps {
  show: boolean;
  settings: MFSetting | null;
  holdings: MFHolding[];
  onClose: () => void;
  onSave: (globalThreshold: number, perAsset: Record<number, number>) => void;
}

const CARD: CSSProperties = { background: "var(--color-canvas)", borderRadius: 16, padding: 24 };
const TITLE: CSSProperties = {
  fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-ink)", margin: 0,
};
const LABEL: CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-slate)", margin: "0 0 6px",
};
const INPUT: CSSProperties = {
  width: "100%", padding: "8px 12px", fontSize: 15, fontWeight: 500,
  fontVariantNumeric: "tabular-nums", color: "var(--color-ink)", background: "transparent",
  borderRadius: 8,
};
const HELPER: CSSProperties = {
  fontSize: 12, fontWeight: 400, color: "var(--color-slate)", margin: "4px 0 0",
};
const BTN: CSSProperties = {
  fontSize: 12, fontWeight: 500, borderRadius: 999, padding: "6px 14px",
  border: "1px solid transparent", cursor: "pointer",
};
const BTN_PRIMARY: CSSProperties = {
  ...BTN, background: "var(--color-ink)", color: "var(--color-canvas)",
};
const BTN_SECONDARY: CSSProperties = {
  ...BTN, background: "transparent", color: "var(--color-ink)", borderColor: "var(--color-hairline)",
};

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
    <ModalShell open={show} onClose={onClose} title="Profit threshold settings" closeOnBackdrop={false}>
      <div className="w-full max-w-md mx-4" style={CARD}>
        <h3 style={{ ...TITLE, marginBottom: 20 }}>Profit threshold settings</h3>

        <div style={{ marginBottom: 20 }}>
          <label style={LABEL}>Global threshold (%)</label>
          <input
            type="number"
            step="0.1"
            value={globalThreshold}
            onChange={(e) => setGlobalThreshold(e.target.value)}
            className="border border-hairline focus:border-brand-teal"
            style={INPUT}
            placeholder="e.g. 10 = alert when P/L exceeds 10%"
          />
          <p style={HELPER}>Alert fires when any holding P/L % exceeds this value</p>
        </div>

        {holdings.length > 0 && (
          <div>
            <label style={{ ...LABEL, marginBottom: 8 }}>Per-asset threshold (%)</label>
            <div className="flex flex-col max-h-48 overflow-y-auto" style={{ gap: 8 }}>
              {holdings.map((h) => (
                <div key={h.holding_id} className="flex items-center gap-2">
                  <span className="w-16" style={{ fontSize: 15, fontWeight: 500, color: "var(--color-ink)" }}>{h.asset}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={perAsset[h.holding_id] || "0"}
                    onChange={(e) =>
                      setPerAsset({ ...perAsset, [h.holding_id]: e.target.value })
                    }
                    className="w-20 border border-hairline focus:border-brand-teal"
                    style={{ ...INPUT, padding: "6px 8px" }}
                  />
                  <span style={{ fontSize: 12, color: "var(--color-slate)" }}>%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2" style={{ marginTop: 24 }}>
          <button onClick={onClose} style={BTN_SECONDARY} className="transition-colors hover:bg-surface-soft">Cancel</button>
          <button onClick={handleSave} style={BTN_PRIMARY} className="transition-opacity hover:opacity-90">Save thresholds</button>
        </div>
      </div>
    </ModalShell>
  );
}
