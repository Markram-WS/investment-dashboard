import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { MFRebalanceRecommendation } from "../types";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from "./components/modalLayout";
import { Field, NumberInput } from "./components/Field";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_TITLE,
} from "./components/controlStyles";
import { formatMoney } from "../utils/format";
import { parseTopUpAmount } from "../utils/mfWeights";

interface MFRebalanceRecommendModalProps {
  show: boolean;
  loading: boolean;
  recommendations: MFRebalanceRecommendation[];
  allocationBase: number | null;
  /** Human-readable calculation failure from the caller; replaces the empty-state copy. */
  error?: string | null;
  /** Called after the top-up input settles (debounced); no separate button. */
  onRecalculate: (cashTopUp: number) => void;
  onClose: () => void;
  onCreateOrders: (recs: MFRebalanceRecommendation[]) => void;
}

const modalPanelStyle: CSSProperties = {
  padding: "var(--space-md)", borderRadius: "var(--rounded-xl)",
};
/** Ledger column head: 11px/500 slate, sentence case. */
const headCell = { fontWeight: 500, color: "var(--color-slate)", whiteSpace: "nowrap" } as const;
const cell: CSSProperties = { color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" };
const sideChip = {
  padding: "2px 8px",
  borderRadius: "var(--rounded-full)",
  fontWeight: 600,
  whiteSpace: "nowrap",
} as const;
const totalPanel: CSSProperties = {
  marginTop: 16, padding: "var(--space-sm)", background: "var(--color-surface)",
  borderRadius: "var(--rounded-md)",
};
const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;

export default function MFRebalanceRecommendModal({
  show, loading, recommendations, allocationBase, error, onRecalculate, onClose, onCreateOrders,
}: MFRebalanceRecommendModalProps) {
  // Transient calculation-only amount; never persisted or credited.
  const [topUp, setTopUp] = useState("0");
  // Last amount the current results were calculated with, so the debounce does
  // not re-request unchanged values and a reset to 0 still recomputes.
  const lastApplied = useRef(0);

  useEffect(() => {
    if (show) {
      setTopUp("0");
      lastApplied.current = 0;
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const parsed = parseTopUpAmount(topUp);
    if (parsed === null || parsed === lastApplied.current) return;
    const timer = window.setTimeout(() => {
      lastApplied.current = parsed;
      onRecalculate(parsed);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [show, topUp, onRecalculate]);

  if (!show) return null;

  const invalidTopUp = parseTopUpAmount(topUp) === null;

  // Every row carries its underlying group's drift, so a group with several
  // holdings would otherwise be counted once per holding. Sum one drift per
  // distinct underlying to match the backend's per-group total.
  const totalDrift = [
    ...new Map(recommendations.map(r => [r.underlying, r.drift] as const)).values(),
  ].reduce((sum, drift) => sum + drift, 0);

  return (
    <ModalShell open={show} onClose={onClose} title="Rebalance Recommendations" closeOnBackdrop={false}>
      <div className={`${MODAL_CARD} bg-canvas border border-hairline w-full max-w-3xl mx-4`} style={modalPanelStyle}>
        <h3 className={MODAL_HEADER} style={{ ...CONTROL_TITLE, marginBottom: 12 }}>Rebalance Recommendations</h3>

        <div className={MODAL_BODY}>
        <div style={{ marginBottom: 16, maxWidth: 260 }}>
          <Field
            label="Top-up cash ($)"
            htmlFor="mf-topup-cash"
            hint="Simulation only — this does not deposit money. Real cash must be added before confirming buys that rely on it."
            error={invalidTopUp ? "Enter a non-negative amount." : undefined}
          >
            <NumberInput
              id="mf-topup-cash"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={topUp}
              onChange={e => setTopUp(e.target.value)}
            />
          </Field>
        </div>

        {loading && recommendations.length === 0 ? (
          <div className="text-center py-8 text-slate text-[length:var(--fs-body)]">Calculating rebalance...</div>
        ) : error ? (
          <div
            role="alert"
            className="text-center py-8 text-[length:var(--fs-body)]"
            style={{
              color: "var(--color-danger-text)",
              background: "var(--color-coral-light)",
              borderRadius: "var(--rounded-md)",
              padding: "var(--space-md)",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 text-green-600 text-[length:var(--fs-body)]" style={{ fontWeight: 500 }}>
            Portfolio is already balanced! No adjustments needed.
          </div>
        ) : (
          <>
            {loading && (
              <p className="text-[length:var(--fs-label)]" style={{ color: "var(--color-slate)", marginBottom: 8 }}>
                Recalculating with the new top-up...
              </p>
            )}
            <table className="w-full">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="text-left py-2 text-[length:var(--fs-label)]" style={headCell}>Asset</th>
                  <th className="text-left py-2 text-[length:var(--fs-label)]" style={headCell}>Underlying</th>
                  <th className="text-left py-2 text-[length:var(--fs-label)]" style={headCell}>Side</th>
                  <th className="text-right py-2 text-[length:var(--fs-label)]" style={headCell}>Qty</th>
                  <th className="text-right py-2 text-[length:var(--fs-label)]" style={headCell}>Est. Price</th>
                  <th className="text-right py-2 text-[length:var(--fs-label)]" style={headCell}>Order Value</th>
                  <th className="text-right py-2 text-[length:var(--fs-label)]" style={headCell}>Current</th>
                  <th className="text-right py-2 text-[length:var(--fs-label)]" style={headCell}>Target</th>
                  <th className="text-right py-2 text-[length:var(--fs-label)]" style={headCell}>Drift</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((r, i) => (
                  <tr key={i} className="border-b border-hairline">
                    <td className="py-2 text-[length:var(--fs-content)]" style={{ ...cell, fontWeight: 500 }}>{r.symbol}</td>
                    <td className="py-2 text-[length:var(--fs-label)]" style={{ color: "var(--color-slate)" }}>{r.underlying}</td>
                    <td className="py-2">
                      <span
                        className={`text-[length:var(--fs-label)] ${
                          r.side === "Buy" ? "bg-teal-light text-brand-teal" : "bg-coral-light text-brand-coral"
                        }`}
                        style={sideChip}
                      >
                        {r.side}
                      </span>
                    </td>
                    <td className="py-2 text-right text-[length:var(--fs-content)]" style={cell}>{r.qty.toFixed(4)}</td>
                    <td className="py-2 text-right text-[length:var(--fs-content)]" style={cell}>${r.estimated_price.toFixed(2) || "—"}</td>
                    <td className="py-2 text-right text-[length:var(--fs-content)]" style={cell}>{formatMoney(r.estimated_value)}</td>
                    <td className="py-2 text-right text-[length:var(--fs-content)]" style={cell}>{r.current_allocation.toFixed(1)}%</td>
                    <td className="py-2 text-right text-[length:var(--fs-content)]" style={cell}>{r.target_allocation.toFixed(1)}%</td>
                    <td className="py-2 text-right">
                      <span className={`text-[length:var(--fs-label)] ${
                        r.drift > 15 ? "text-brand-coral" : r.drift > 5 ? "text-brand-yellow" : "text-success"
                      }`} style={{ fontWeight: 600 }}>
                        {r.drift.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={totalPanel}>
              <div className="flex items-center justify-between" style={{ gap: 8 }}>
                <span className="text-[length:var(--fs-label)]" style={{ color: "var(--color-slate)" }}>Allocation base</span>
                <span className="text-[length:var(--fs-content)]" style={{ fontWeight: 600, color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}>
                  {allocationBase == null ? "—" : formatMoney(allocationBase)}
                </span>
              </div>
              <div className="flex items-center justify-between" style={{ gap: 8, marginTop: 4 }}>
                <span className="text-[length:var(--fs-label)]" style={{ color: "var(--color-slate)" }}>Total drift</span>
                <span className="text-[length:var(--fs-content)]" style={{ fontWeight: 600, color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}>
                  {totalDrift.toFixed(1)}%
                </span>
              </div>
            </div>
          </>
        )}
        </div>

        <div className={`${MODAL_FOOTER} flex justify-end gap-2`} style={{ marginTop: 12 }}>
          <button type="button" onClick={onClose} style={secondaryButton}>Close</button>
          {recommendations.length > 0 && (
            <button
              type="button"
              onClick={() => onCreateOrders(recommendations)}
              disabled={loading}
              className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={primaryButton}
            >
              Create {recommendations.length} Orders
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
