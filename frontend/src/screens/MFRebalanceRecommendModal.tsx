import type { CSSProperties } from "react";
import { MFRebalanceRecommendation } from "../types";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from "./components/modalLayout";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_TITLE,
} from "./components/controlStyles";

interface MFRebalanceRecommendModalProps {
  show: boolean;
  loading: boolean;
  recommendations: MFRebalanceRecommendation[];
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
  show, loading, recommendations, onClose, onCreateOrders,
}: MFRebalanceRecommendModalProps) {
  if (!show) return null;

  return (
    <ModalShell open={show} onClose={onClose} title="Rebalance Recommendations" closeOnBackdrop={false}>
      <div className={`${MODAL_CARD} bg-canvas border border-hairline w-full max-w-2xl mx-4`} style={modalPanelStyle}>
        <h3 className={MODAL_HEADER} style={{ ...CONTROL_TITLE, marginBottom: 12 }}>Rebalance Recommendations</h3>

        <div className={MODAL_BODY}>
        {loading ? (
          <div className="text-center py-8 text-slate text-[length:var(--fs-body)]">Calculating rebalance...</div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 text-green-600 text-[length:var(--fs-body)]" style={{ fontWeight: 500 }}>
            Portfolio is already balanced! No adjustments needed.
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="text-left py-2 text-[length:var(--fs-label)]" style={headCell}>Asset</th>
                  <th className="text-left py-2 text-[length:var(--fs-label)]" style={headCell}>Side</th>
                  <th className="text-right py-2 text-[length:var(--fs-label)]" style={headCell}>Qty</th>
                  <th className="text-right py-2 text-[length:var(--fs-label)]" style={headCell}>Est. Price</th>
                  <th className="text-right py-2 text-[length:var(--fs-label)]" style={headCell}>Current</th>
                  <th className="text-right py-2 text-[length:var(--fs-label)]" style={headCell}>Target</th>
                  <th className="text-right py-2 text-[length:var(--fs-label)]" style={headCell}>Drift</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((r, i) => (
                  <tr key={i} className="border-b border-hairline">
                    <td className="py-2 text-[length:var(--fs-content)]" style={{ ...cell, fontWeight: 500 }}>{r.symbol}</td>
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
              <span className="text-[length:var(--fs-label)]" style={{ color: "var(--color-slate)" }}>Total drift: </span>
              <span className="text-[length:var(--fs-content)]" style={{ fontWeight: 600, color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}>
                {recommendations.reduce((s, r) => s + r.drift, 0).toFixed(1)}%
              </span>
            </div>
          </>
        )}
        </div>

        <div className={`${MODAL_FOOTER} flex justify-end gap-2`} style={{ marginTop: 12 }}>
          <button type="button" onClick={onClose} style={secondaryButton}>Close</button>
          {recommendations.length > 0 && (
            <button type="button" onClick={() => onCreateOrders(recommendations)} style={primaryButton}>
              Create {recommendations.length} Orders
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
