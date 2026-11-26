import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ApiError } from "../lib/api";
import { MFAllocationMode, MFSetting, MFHolding } from "../types";
import Chevron from "../components/Chevron";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from "./components/modalLayout";
import { Field, NumberInput, TextInput } from "./components/Field";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_HELPER,
  CONTROL_INPUT,
  CONTROL_LABEL,
  CONTROL_TITLE,
} from "./components/controlStyles";
import { formatMoney } from "../utils/format";

const modalPanelStyle: CSSProperties = {
  padding: "var(--space-md)", borderRadius: "var(--rounded-xl)",
};
const readonlyValue: CSSProperties = {
  ...CONTROL_INPUT, background: "var(--color-surface)", fontWeight: 600, borderColor: "transparent",
};
const confirmTitle: CSSProperties = {
  fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-ink)", margin: 0,
};
const percentSuffix: CSSProperties = { color: "var(--color-slate)" };
const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;
const dangerButton = {
  ...CONTROL_BUTTON_SECONDARY, color: "var(--color-danger-text)",
} as const;

/**
 * Two-column canvas: identity + cash on the left, allocation + thresholds on
 * the right. `auto-fit` collapses to one column below ~656px of card width, so
 * the same DOM stays in visual order at every size.
 */
const COLUMNS: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 24,
  alignItems: "start",
};
/** Between groups inside a column. */
const GROUP_STACK: CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };
/** Between fields inside a group. */
const FIELD_STACK: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
/** Two fields side by side, stacking on very narrow cards. */
const FIELD_PAIR: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 8,
  alignItems: "start",
};
const ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 6 };
/** Group header toggle: ROW plus the button-chrome resets. */
const GROUP_TOGGLE: CSSProperties = {
  ...ROW, padding: 0, border: 0, background: "transparent", cursor: "pointer",
  textAlign: "left", color: "inherit", fontFamily: "inherit", minWidth: 0,
};
const SECTION_LABEL: CSSProperties = { ...CONTROL_LABEL, margin: 0 };
const GROW_INPUT: CSSProperties = { flex: "1 1 auto", width: "auto", minWidth: 0 };
const PERCENT_INPUT: CSSProperties = { width: 56 };
const ASSET_NAME: CSSProperties = {
  flex: "1 1 auto", minWidth: 0, maxWidth: 140,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  fontSize: "var(--fs-label)",
  fontWeight: 500, color: "var(--color-ink)",
};
const DANGER_RULE: CSSProperties = {
  borderTop: "1px solid var(--color-hairline)", marginTop: 12, paddingTop: 12,
};

/** Distinct allocation-group labels held by the fund, "Unassigned" last. */
function groupLabelsOf(holdings: MFHolding[]): string[] {
  const labels: string[] = [];
  for (const holding of holdings) {
    const label = holding.underlying?.trim() || "Unassigned";
    if (!labels.includes(label)) labels.push(label);
  }
  return labels.filter(label => label !== "Unassigned")
    .concat(labels.includes("Unassigned") ? ["Unassigned"] : []);
}

/**
 * Initial value for a holding's intra-group weight input. A stored weight is
 * shown as-is. Null weights are prefilled with the group's equal split (100/n,
 * two decimals) ONLY when the whole group is unconfigured; the rounding
 * remainder goes to the last holding so the visible values sum to 100. If any
 * holding in the group already has a stored weight, the other nulls stay blank
 * so the stored weight keeps its share of the group instead of being diluted.
 * Blanking the field still saves null.
 */
function initialAssetWeights(holdings: MFHolding[]): Record<number, string> {
  const byGroup = new Map<string, MFHolding[]>();
  for (const holding of holdings) {
    const label = holding.underlying?.trim() || "Unassigned";
    const rows = byGroup.get(label);
    if (rows) rows.push(holding);
    else byGroup.set(label, [holding]);
  }
  const weights: Record<number, string> = {};
  for (const rows of byGroup.values()) {
    const hasStoredWeight = rows.some(holding => holding.rebalance_weight != null);
    if (hasStoredWeight) {
      for (const holding of rows) {
        weights[holding.holding_id] = holding.rebalance_weight != null
          ? String(holding.rebalance_weight)
          : "";
      }
      continue;
    }
    const base = Math.round((100 / rows.length) * 100) / 100;
    rows.forEach((holding, index) => {
      const value = index === rows.length - 1
        ? Math.round((100 - base * (rows.length - 1)) * 100) / 100
        : base;
      weights[holding.holding_id] = String(value);
    });
  }
  return weights;
}

/** Server `detail` from an ApiError body, or the fallback message. */
function saveErrorMessage(err: unknown, fallback: string): string {
  const apiError = err as Partial<ApiError> | null;
  if (typeof apiError?.body === "string" && apiError.body !== "") {
    try {
      const parsed: unknown = JSON.parse(apiError.body);
      if (parsed !== null && typeof parsed === "object" && "detail" in parsed) {
        const detail = parsed.detail;
        if (typeof detail === "string" && detail.trim() !== "") return detail;
      }
    } catch {
      // Non-JSON error bodies keep the fallback message.
    }
  }
  return fallback;
}

interface MFEditPortfolioModalProps {
  portfolioId: number;
  portfolio: {
    portfolio_name: string;
    available_cash: number;
    margin_locked: number;
    cash_buffer_limit: number;
    tags: Record<string, boolean> | null;
  };
  settings: MFSetting | null;
  holdings: MFHolding[];
  showModal: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function MFEditPortfolioModal({
  portfolioId, portfolio, settings, holdings,
  showModal, onClose, onSaved,
}: MFEditPortfolioModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Portfolio base fields
  const [name, setName] = useState(portfolio.portfolio_name);
  const [cashBuffer, setCashBuffer] = useState(String(portfolio.cash_buffer_limit || 0));
  const [tagsStr, setTagsStr] = useState(
    portfolio.tags ? Object.keys(portfolio.tags).join(", ") : ""
  );

  // Blank means "unset" (null); an explicit "0" is stored as zero.
  const [perAssetWeight, setPerAssetWeight] = useState<Record<number, string>>(
    () => initialAssetWeights(holdings),
  );
  // Weight mode only: target percent per allocation-group label.
  const [perGroupTarget, setPerGroupTarget] = useState<Record<string, string>>({});
  // Group labels whose holding weight rows are folded away; empty means open.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  // Owned here (not by the page header); saved together with the weights.
  const [activeMode, setActiveMode] = useState<MFAllocationMode>(
    () => (settings?.allocation_mode === "weight" ? "weight" : "neutral"),
  );

  // Deposit/Withdraw
  const [dwAmount, setDwAmount] = useState("");
  const [dwProcessing, setDwProcessing] = useState(false);
  const [dwError, setDwError] = useState("");

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // Delete state
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  useEffect(() => {
    if (showModal) {
      setName(portfolio.portfolio_name);
      setCashBuffer(String(portfolio.cash_buffer_limit || 0));
      setTagsStr(portfolio.tags ? Object.keys(portfolio.tags).join(", ") : "");
      setPerAssetWeight(initialAssetWeights(holdings));
      setActiveMode(settings?.allocation_mode === "weight" ? "weight" : "neutral");
      const targetMap: Record<string, string> = {};
      for (const label of groupLabelsOf(holdings)) {
        const stored = settings?.target_ratio?.[label];
        targetMap[label] = stored == null ? "" : String(stored);
      }
      setPerGroupTarget(targetMap);
      setCollapsedGroups(new Set());
      setDwAmount("");
      setDwError("");
      setSaveErr("");
      setShowConfirmDelete(false);
      setDeleting(false);
      setDeleteErr("");
    }
  }, [showModal, portfolio, settings, holdings]);

  if (!showModal) return null;

  const cash = portfolio.available_cash || 0;

  const orderedGroups = groupLabelsOf(holdings);
  const targetSum = orderedGroups.reduce((total, label) => {
    const raw = (perGroupTarget[label] ?? "").trim();
    if (raw === "") return total;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? total + parsed : total;
  }, 0);

  const handleSave = async () => {
    setSaveErr("");
    const b = parseFloat(cashBuffer) || 0;
    if (b > cash) { setSaveErr(`Cash buffer limit cannot exceed ${formatMoney(cash)}`); return; }

    const weights = new Map<number, number | null>();
    for (const h of holdings) {
      const raw = (perAssetWeight[h.holding_id] ?? "").trim();
      if (raw === "") { weights.set(h.holding_id, null); continue; }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        setSaveErr(`Rebalance weight for ${h.asset} must be between 0 and 100.`);
        return;
      }
      weights.set(h.holding_id, parsed);
    }

    // Accepted in both modes: neutral saves partial targets so a later switch
    // to weight mode has values to start from.
    const targetWeights: Record<string, number> = {};
    let targetSum = 0;
    for (const label of orderedGroups) {
      const raw = (perGroupTarget[label] ?? "").trim();
      if (raw === "") {
        if (activeMode === "weight") {
          setSaveErr(`Target weight for ${label} is required.`);
          return;
        }
        continue;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        setSaveErr(`Target weight for ${label} must be between 0 and 100.`);
        return;
      }
      targetWeights[label] = parsed;
      targetSum += parsed;
    }
    if (activeMode === "weight" && Math.abs(targetSum - 100) > 1e-6) {
      setSaveErr("Target weights must sum to 100.");
      return;
    }

    setSaving(true);
    try {
      const tagsObj: Record<string, boolean> = {};
      tagsStr.split(",").map(t => t.trim()).filter(Boolean).forEach(t => { tagsObj[t] = true; });

      const totalDiff = b - (portfolio.cash_buffer_limit || 0);
      const newAvailable = Math.max(0, cash - totalDiff);

      await api.updatePortfolio(portfolioId, {
        portfolio_name: name || undefined,
        cash_buffer_limit: b,
        available_cash: newAvailable,
        tags: Object.keys(tagsObj).length > 0 ? tagsObj : undefined,
      });

      await api.mfUpdateSettings(portfolioId, {
        allocation_mode: activeMode,
        target_ratio: Object.keys(targetWeights).length > 0 ? targetWeights : null,
      });

      for (const h of holdings) {
        await api.mfUpdateHolding(portfolioId, h.holding_id, {
          rebalance_weight: weights.get(h.holding_id) ?? null,
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error("Failed to save portfolio:", err);
      setSaveErr(saveErrorMessage(err, "Couldn't save the portfolio."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeposit = async () => {
    const num = parseFloat(dwAmount);
    if (isNaN(num) || num <= 0) { setDwError("Enter a valid amount"); return; }
    setDwProcessing(true); setDwError("");
    try {
      await api.createTransaction({
        transaction_type: "Deposit", asset: "USD", amount: num,
        destination_portfolio_id: portfolioId, executed_by: "Manual",
      });
      await api.updatePortfolio(portfolioId, { available_cash: cash + num });
      setDwAmount(""); onSaved();
    } catch (e: unknown) {
      console.error("Failed to deposit cash:", e);
      setDwError("Couldn't deposit cash.");
    }
    finally { setDwProcessing(false); }
  };

  const handleWithdraw = async () => {
    const num = parseFloat(dwAmount);
    if (isNaN(num) || num <= 0) { setDwError("Enter a valid amount"); return; }
    if (num > cash) { setDwError(`Maximum withdraw is ${formatMoney(cash)}`); return; }
    setDwProcessing(true); setDwError("");
    try {
      await api.createTransaction({
        transaction_type: "Withdraw", asset: "USD", amount: num,
        source_portfolio_id: portfolioId, executed_by: "Manual",
      });
      await api.updatePortfolio(portfolioId, { available_cash: cash - num });
      setDwAmount(""); onSaved();
    } catch (e: unknown) {
      console.error("Failed to withdraw cash:", e);
      setDwError("Couldn't withdraw cash.");
    }
    finally { setDwProcessing(false); }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setDeleteErr("");
    try {
      await api.deletePortfolio(portfolioId);
      queryClient.invalidateQueries({ queryKey: ["nav-portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["nav-overview"] });
      onClose();
      navigate("/");
    } catch (err: unknown) {
      console.error("Failed to delete portfolio:", err);
      setDeleteErr("Couldn't delete the portfolio.");
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const availableDisplay = cash + (portfolio.margin_locked || 0) + (portfolio.cash_buffer_limit || 0);

  return (
    <ModalShell open={showModal} onClose={onClose} title="Edit managed fund">
      <div className={`${MODAL_CARD} bg-canvas border border-hairline w-full max-w-3xl mx-4 relative`} style={modalPanelStyle}>
        <div className={`${MODAL_HEADER} flex justify-between items-center`} style={{ marginBottom: 12 }}>
          <h3 style={CONTROL_TITLE}>Edit managed fund</h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-soft rounded-full transition-colors">
            <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={MODAL_BODY}>
          <div style={COLUMNS}>
            {/* Left: identity + cash */}
            <div style={GROUP_STACK}>
              <div style={FIELD_STACK}>
                <Field label="Portfolio name" htmlFor="mf-portfolio-name">
                  <TextInput id="mf-portfolio-name" value={name} onChange={e => setName(e.target.value)} />
                </Field>
                <Field label="Type">
                  <div style={readonlyValue}>Mutual Fund</div>
                </Field>
                <div style={FIELD_PAIR}>
                  <Field label="Available cash">
                    <div style={readonlyValue}>{formatMoney(availableDisplay)}</div>
                  </Field>
                  <Field label="Cash buffer limit" htmlFor="mf-portfolio-cash-buffer">
                    <NumberInput id="mf-portfolio-cash-buffer" value={cashBuffer} onChange={e => setCashBuffer(e.target.value)} />
                  </Field>
                </div>
                <div style={FIELD_PAIR}>
                  <Field label="Margin locked (computed)" hint="Computed as Σ mark × multiplier × qty × margin rate">
                    <div style={readonlyValue}>{formatMoney(portfolio.margin_locked || 0)}</div>
                  </Field>
                  <Field label="Tags (comma separated)" htmlFor="mf-portfolio-tags">
                    <TextInput id="mf-portfolio-tags" value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="crypto, fund, long-term" />
                  </Field>
                </div>
              </div>

              {/* Deposit/Withdraw */}
              <Field label="Adjust cash balance" error={dwError}>
                <div className="flex" style={{ gap: 8 }}>
                  <NumberInput step={100} placeholder="0" value={dwAmount} onChange={e => setDwAmount(e.target.value)} style={GROW_INPUT} />
                  <button onClick={handleDeposit} disabled={dwProcessing}
                    className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={primaryButton}>
                    Deposit
                  </button>
                  <button onClick={handleWithdraw} disabled={dwProcessing}
                    className="transition-colors hover:bg-surface-soft disabled:opacity-50 disabled:cursor-not-allowed"
                    style={dangerButton}>
                    Withdraw
                  </button>
                </div>
              </Field>
            </div>

            {/* Right: allocation — mode toggle + per-group targets + grouped weights. */}
            <div style={GROUP_STACK}>
              <div>
                <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 6 }}>
                  <p style={SECTION_LABEL}>Allocation</p>
                  <div role="group" aria-label="Allocation mode" style={{ display: "inline-flex", gap: 6 }}>
                    {([
                      { mode: "neutral", label: "Neutral" },
                      { mode: "weight", label: "Weight (%)" },
                    ] as const).map(({ mode, label }) => (
                      <button
                        key={mode}
                        type="button"
                        className="tg-pill"
                        data-active={activeMode === mode}
                        aria-pressed={activeMode === mode}
                        onClick={() => setActiveMode(mode)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {orderedGroups.length > 0 ? (
                  <div className="flex flex-col" style={{ gap: 12 }}>
                    {orderedGroups.map(label => {
                      const groupHoldings = holdings.filter(
                        h => (h.underlying?.trim() || "Unassigned") === label,
                      );
                      const collapsed = collapsedGroups.has(label);
                      return (
                        <div key={label} className="flex flex-col" style={{ gap: 6 }}>
                          <div className="flex items-center justify-between" style={{ gap: 8 }}>
                            <button
                              type="button"
                              aria-expanded={!collapsed}
                              aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
                              onClick={() => setCollapsedGroups((prev) => {
                                const next = new Set(prev);
                                if (next.has(label)) next.delete(label);
                                else next.add(label);
                                return next;
                              })}
                              style={GROUP_TOGGLE}
                            >
                              <Chevron open={!collapsed} size={12} />
                              <span style={{
                                color: "var(--color-ink)", fontWeight: 500,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>{label}</span>
                            </button>
                            {activeMode === "weight" ? (
                              <div className="flex items-center" style={ROW}>
                                <NumberInput
                                  aria-label={`${label} target weight`}
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  placeholder="—"
                                  value={perGroupTarget[label] ?? ""}
                                  onChange={e => setPerGroupTarget({ ...perGroupTarget, [label]: e.target.value })}
                                  style={PERCENT_INPUT}
                                />
                                <span className="text-[length:var(--fs-label)]" style={percentSuffix}>%</span>
                              </div>
                            ) : (
                              <span style={{ ...CONTROL_HELPER, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                                {(orderedGroups.length > 0 ? 100 / orderedGroups.length : 0).toFixed(1)}% share
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col" style={{ gap: 6, paddingLeft: 16 }}>
                            {!collapsed && groupHoldings.map(h => (
                              <div key={h.holding_id} className="flex items-center" style={ROW}>
                                <span style={ASSET_NAME}>{h.asset}</span>
                                <NumberInput
                                  aria-label={`${h.asset} rebalance weight`}
                                  title="Relative weight within this underlying; blank splits by market value"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  placeholder="—"
                                  value={perAssetWeight[h.holding_id] ?? ""}
                                  onChange={e => setPerAssetWeight({ ...perAssetWeight, [h.holding_id]: e.target.value })}
                                  style={PERCENT_INPUT}
                                />
                                <span className="text-[length:var(--fs-label)]" style={percentSuffix}>%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ ...CONTROL_HELPER, marginTop: 4 }}>No holdings yet.</p>
                )}

                <p style={{ ...CONTROL_HELPER, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  sum {Number(targetSum.toFixed(2))} / 100
                  {activeMode === "neutral"
                    ? " — partial targets are saved for a later switch to weight mode"
                    : ""}
                </p>

                <p style={{ ...CONTROL_HELPER, marginTop: 8 }}>
                  Group targets must sum to 100% in weight mode. Weights are relative within their
                  underlying group and divide that group's drift; leave a weight blank to split by
                  current market value.
                </p>
              </div>
            </div>
          </div>

          {/* Save Error */}
          {saveErr && <p style={{ ...CONTROL_HELPER, color: "var(--color-danger-text)", marginTop: 12 }}>{saveErr}</p>}

          {/* Danger Zone */}
          <div style={DANGER_RULE}>
            <div className="flex items-center justify-between">
              <div>
                <p style={CONTROL_TITLE}>Danger zone</p>
                <p style={{ ...CONTROL_HELPER, marginTop: 4 }}>Permanently delete this portfolio and all related data</p>
              </div>
              <button onClick={() => setShowConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 transition-colors hover:bg-surface-soft"
                style={dangerButton}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className={`${MODAL_FOOTER} flex justify-end gap-3`} style={{ marginTop: 12 }}>
          <button onClick={onClose} style={secondaryButton} className="transition-colors hover:bg-surface-soft">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={primaryButton}>
            Save changes
          </button>
        </div>

        {/* Delete confirmation overlay */}
        {showConfirmDelete && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-8"
            style={{ borderRadius: "var(--rounded-xl)", background: "color-mix(in srgb, var(--color-canvas) 92%, transparent)", backdropFilter: "blur(4px)" }}>
            <div className="w-full max-w-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "var(--color-coral-light)" }}>
                  <svg className="w-5 h-5" style={{ color: "var(--color-danger-text)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-[length:var(--fs-section)]" style={confirmTitle}>Delete "{portfolio.portfolio_name}"?</h4>
                  <p className="text-[length:var(--fs-content)]" style={{ color: "var(--color-slate)", margin: "8px 0 0" }}>
                    This permanently deletes all Managed Fund data including holdings, orders, history, settings,
                    and the portfolio itself. Cannot be undone.
                  </p>
                  {deleteErr && <p style={{ ...CONTROL_HELPER, color: "var(--color-danger-text)", marginTop: 8 }}>{deleteErr}</p>}
                  <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
                    <button onClick={() => setShowConfirmDelete(false)} style={secondaryButton} className="transition-colors hover:bg-surface-soft">Cancel</button>
                    <button onClick={handleConfirmDelete} disabled={deleting}
                      className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={dangerButton}>
                      Confirm delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
