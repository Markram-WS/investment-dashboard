import { useState } from "react";
import type { CSSProperties } from "react";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from "./components/modalLayout";
import { NumberInput, TextInput } from "./components/Field";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_TITLE,
} from "./components/controlStyles";

interface MFEditRatioModalProps {
  show: boolean;
  targetRatio: Record<string, number>;
  onClose: () => void;
  onSave: (ratio: Record<string, number>) => void;
}

const modalPanelStyle: CSSProperties = {
  padding: "var(--space-md)", borderRadius: "var(--rounded-xl)",
};
const ASSET_WIDTH: CSSProperties = { width: 96 };
const PCT_WIDTH: CSSProperties = { width: 80 };
const percentSuffix: CSSProperties = { color: "var(--color-slate)" };
const removeButton: CSSProperties = {
  padding: "0 4px", fontWeight: 600, color: "var(--color-danger-text)",
  background: "transparent", border: 0, cursor: "pointer",
};
const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;

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
    <ModalShell open={show} onClose={onClose} title="Edit Target Ratios" closeOnBackdrop={false}>
      <div className={`${MODAL_CARD} bg-canvas border border-hairline w-full max-w-md mx-4`} style={modalPanelStyle}>
        <h3 className={MODAL_HEADER} style={{ ...CONTROL_TITLE, marginBottom: 12 }}>Edit Target Ratios</h3>
        <div className={`${MODAL_BODY} space-y-2`}>
          {entries.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <TextInput
                type="text"
                aria-label="Asset"
                value={e.asset}
                onChange={(v) => updateEntry(i, "asset", v.target.value)}
                placeholder="Asset"
                style={ASSET_WIDTH}
              />
              <NumberInput
                step="0.1"
                aria-label="Target percent"
                value={e.pct}
                onChange={(v) => updateEntry(i, "pct", v.target.value)}
                placeholder="%"
                style={PCT_WIDTH}
              />
              <span className="text-[length:var(--fs-label)]" style={percentSuffix}>%</span>
              {entries.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove ${e.asset || "row"}`}
                  onClick={() => removeEntry(i)}
                  className="text-[length:var(--fs-content)] opacity-70 hover:opacity-100 transition-opacity"
                  style={removeButton}
                >×</button>
              )}
            </div>
          ))}
        </div>
        <div className={`${MODAL_FOOTER} flex items-center gap-2`} style={{ marginTop: 12 }}>
          <button type="button" onClick={addEntry} style={secondaryButton}>+ Add asset</button>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} style={secondaryButton}>Cancel</button>
            <button type="button" onClick={handleSave} style={primaryButton}>Save Ratios</button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
