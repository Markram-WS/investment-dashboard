import { useState } from "react";
import type { CSSProperties } from "react";
import { MFHolding, MFSetting } from "../types";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from "./components/modalLayout";
import { Field, NumberInput } from "./components/Field";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_LABEL,
  CONTROL_TITLE,
} from "./components/controlStyles";

interface MFProfitThresholdModalProps {
  show: boolean;
  settings: MFSetting | null;
  holdings: MFHolding[];
  onClose: () => void;
  onSave: (globalThreshold: number, perAsset: Record<number, number>) => void;
}

const modalPanelStyle: CSSProperties = {
  padding: "var(--space-md)", borderRadius: "var(--rounded-xl)",
};
const groupLabel: CSSProperties = { ...CONTROL_LABEL, marginBottom: 8 };
const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;

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
      <div className={`${MODAL_CARD} bg-canvas border border-hairline w-full max-w-md mx-4`} style={modalPanelStyle}>
        <h3 className={MODAL_HEADER} style={{ ...CONTROL_TITLE, marginBottom: 16 }}>Profit threshold settings</h3>
        <div className={MODAL_BODY}>

        <div style={{ marginBottom: 20 }}>
          <Field
            label="Global threshold (%)"
            htmlFor="mf-global-threshold"
            hint="Alert fires when any holding P/L % exceeds this value"
          >
            <NumberInput
              id="mf-global-threshold"
              step="0.1"
              value={globalThreshold}
              onChange={(e) => setGlobalThreshold(e.target.value)}
              placeholder="e.g. 10 = alert when P/L exceeds 10%"
            />
          </Field>
        </div>

        {holdings.length > 0 && (
          <div>
            <p style={groupLabel}>Per-asset threshold (%)</p>
            <div className="flex flex-col" style={{ gap: 8 }}>
              {holdings.map((h) => (
                <div key={h.holding_id} className="flex items-center gap-2">
                  <span className="w-16 text-[length:var(--fs-content)]" style={{ fontWeight: 500, color: "var(--color-ink)" }}>{h.asset}</span>
                  <NumberInput
                    step="0.1"
                    aria-label={`${h.asset} profit threshold percent`}
                    value={perAsset[h.holding_id] || "0"}
                    onChange={(e) =>
                      setPerAsset({ ...perAsset, [h.holding_id]: e.target.value })
                    }
                    style={{ width: 80 }}
                  />
                  <span className="text-[length:var(--fs-label)]" style={{ color: "var(--color-slate)" }}>%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>
        <div className={`${MODAL_FOOTER} flex justify-end gap-2`} style={{ marginTop: 16 }}>
          <button onClick={onClose} style={secondaryButton} className="transition-colors hover:bg-surface-soft">Cancel</button>
          <button onClick={handleSave} style={primaryButton} className="transition-opacity hover:opacity-90">Save thresholds</button>
        </div>
      </div>
    </ModalShell>
  );
}
