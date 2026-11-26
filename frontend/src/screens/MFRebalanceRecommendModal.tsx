import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { MFHolding, MFRebalanceGroup, MFRebalanceRecommendation } from "../types";
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
  /** One aggregate row per allocation group, including groups that need no trade. */
  groups: MFRebalanceGroup[];
  /** The page's loaded holdings; supplies holding market values to the group rows. */
  holdings: MFHolding[];
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
/** Ledger column head: micro, 500 slate, sentence case. */
const headCell = { fontWeight: 500, color: "var(--color-slate)", whiteSpace: "nowrap" } as const;
const cell: CSSProperties = { color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" };
const groupCell: CSSProperties = { ...cell, fontWeight: 600 };
const sideChip = {
  padding: "2px 6px",
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

/** Every table cell (heads included) renders at the 10px micro token. */
const MICRO = "text-[length:var(--fs-micro)]";

export default function MFRebalanceRecommendModal({
  show, loading, recommendations, groups, holdings, allocationBase, error, onRecalculate, onClose, onCreateOrders,
}: MFRebalanceRecommendModalProps) {
  // Transient calculation-only amount; never persisted or credited.
  const [topUp, setTopUp] = useState("");
  // Last amount the current results were calculated with, so the debounce does
  // not re-request unchanged values and a reset to 0 still recomputes.
  const lastApplied = useRef(0);

  useEffect(() => {
    if (show) {
      setTopUp("");
      lastApplied.current = 0;
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    // Blank means zero; a non-numeric or negative entry stays invalid.
    const parsed = topUp.trim() === "" ? 0 : parseTopUpAmount(topUp);
    if (parsed === null || parsed === lastApplied.current) return;
    const timer = window.setTimeout(() => {
      lastApplied.current = parsed;
      onRecalculate(parsed);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [show, topUp, onRecalculate]);

  if (!show) return null;

  const invalidTopUp = topUp.trim() !== "" && parseTopUpAmount(topUp) === null;

  // One drift per group row (the backend's group list already deduped the
  // per-holding drift), so the panel total matches the visible group rows.
  const totalDrift = groups.reduce((sum, group) => sum + group.drift, 0);

  const holdingsByGroup = new Map<string, MFHolding[]>();
  for (const holding of holdings) {
    const label = holding.underlying?.trim() || "Unassigned";
    const rows = holdingsByGroup.get(label);
    if (rows) rows.push(holding);
    else holdingsByGroup.set(label, [holding]);
  }
  const recommendationBySymbol = new Map(
    recommendations.map(rec => [rec.symbol, rec] as const),
  );

  const hasRows = groups.length > 0;

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
              placeholder="0"
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
        ) : !hasRows && recommendations.length === 0 ? (
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
            <div style={{ overflowX: "auto" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={`text-left py-1.5 ${MICRO}`} style={headCell}>Asset</th>
                    <th className={`text-right py-1.5 ${MICRO}`} style={headCell}>Current</th>
                    <th className={`text-right py-1.5 ${MICRO}`} style={headCell}>Target</th>
                    <th className={`text-right py-1.5 ${MICRO}`} style={headCell}>Allocation</th>
                    <th className={`text-right py-1.5 ${MICRO}`} style={headCell}>Drift</th>
                    <th className={`text-right py-1.5 ${MICRO}`} style={headCell}>Qty</th>
                    <th className={`text-right py-1.5 ${MICRO}`} style={headCell}>Price</th>
                    <th className={`text-right py-1.5 ${MICRO}`} style={headCell}>Order value</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(group => {
                    const groupHoldings = holdingsByGroup.get(group.label) ?? [];
                    return (
                      <Fragment key={group.label}>
                        <tr
                          data-testid={`rebalance-group-${group.label}`}
                          className="border-b border-hairline"
                          style={{ background: "var(--color-surface-soft)" }}
                        >
                          <td className={`py-1.5 ${MICRO}`} style={groupCell}>{group.label}</td>
                          <td className={`py-1.5 text-right ${MICRO}`} style={groupCell}>{formatMoney(group.current_value)}</td>
                          <td className={`py-1.5 text-right ${MICRO}`} style={groupCell}>{formatMoney(group.target_value)}</td>
                          <td className={`py-1.5 text-right ${MICRO}`} style={groupCell}>
                            {group.current_pct.toFixed(1)}% → {group.target_pct.toFixed(1)}%
                          </td>
                          <td className={`py-1.5 text-right ${MICRO}`} style={groupCell}>
                            <span className={group.drift > 15 ? "text-brand-coral" : group.drift > 5 ? "text-brand-yellow" : "text-success"}>
                              {group.drift.toFixed(1)}%
                            </span>
                          </td>
                          <td className={`py-1.5 ${MICRO}`} />
                          <td className={`py-1.5 ${MICRO}`} />
                          <td className={`py-1.5 text-right ${MICRO}`} style={groupCell}>
                            <span className={group.order_value < 0 ? "text-brand-coral" : group.order_value > 0 ? "text-brand-teal" : "text-ink"}>
                              {formatMoney(group.order_value)}
                            </span>
                          </td>
                        </tr>
                        {groupHoldings.map(holding => {
                          const rec = recommendationBySymbol.get(holding.asset);
                          const signedOrderValue = rec == null
                            ? null
                            : rec.side === "Sell" ? -rec.estimated_value : rec.estimated_value;
                          return (
                            <tr
                              key={`${group.label}-${holding.holding_id}`}
                              data-testid={`rebalance-holding-${holding.holding_id}`}
                              className="border-b border-hairline"
                            >
                              <td className={`py-1.5 ${MICRO}`} style={{ ...cell, paddingLeft: 14 }}>{holding.asset}</td>
                              <td className={`py-1.5 text-right ${MICRO}`} style={cell}>{formatMoney(holding.market_value)}</td>
                              <td className={`py-1.5 ${MICRO}`} />
                              <td className={`py-1.5 ${MICRO}`} />
                              <td className={`py-1.5 ${MICRO}`} />
                              <td className={`py-1.5 text-right ${MICRO}`} style={cell}>
                                {rec && (
                                  <span className="inline-flex items-center justify-end" style={{ gap: 4 }}>
                                    <span
                                      className={`${MICRO} ${
                                        rec.side === "Buy" ? "bg-teal-light text-brand-teal" : "bg-coral-light text-brand-coral"
                                      }`}
                                      style={sideChip}
                                    >
                                      {rec.side}
                                    </span>
                                    <span>{rec.qty.toFixed(4)}</span>
                                  </span>
                                )}
                              </td>
                              <td className={`py-1.5 text-right ${MICRO}`} style={cell}>
                                {rec ? formatMoney(rec.estimated_price) : ""}
                              </td>
                              <td className={`py-1.5 text-right ${MICRO}`} style={cell}>
                                {signedOrderValue == null
                                  ? ""
                                  : (
                                    <span className={signedOrderValue < 0 ? "text-brand-coral" : signedOrderValue > 0 ? "text-brand-teal" : "text-ink"}>
                                      {formatMoney(signedOrderValue)}
                                    </span>
                                  )}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
