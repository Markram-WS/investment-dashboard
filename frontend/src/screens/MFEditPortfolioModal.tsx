import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { MFSetting, MFHolding } from "../types";
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
const ADD_LINK: CSSProperties = {
  color: "var(--color-brand-teal)",
  background: "transparent", border: 0, padding: 0, cursor: "pointer",
};
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
const SECTION_HEAD: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6,
};
const SECTION_LABEL: CSSProperties = { ...CONTROL_LABEL, margin: 0 };
const ADD_ASSET_BUTTON: CSSProperties = {
  ...ADD_LINK, fontSize: "var(--fs-label)", whiteSpace: "nowrap",
};
const GROW_INPUT: CSSProperties = { flex: "1 1 auto", width: "auto", minWidth: 0 };
const PERCENT_INPUT: CSSProperties = { width: 56 };
const ASSET_NAME: CSSProperties = {
  width: 40, flex: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  fontSize: "var(--fs-label)",
  fontWeight: 500, color: "var(--color-ink)",
};
const DANGER_RULE: CSSProperties = {
  borderTop: "1px solid var(--color-hairline)", marginTop: 12, paddingTop: 12,
};

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

  // Target ratio
  const [ratioEntries, setRatioEntries] = useState<{ asset: string; pct: string }[]>(() =>
    settings?.target_ratio
      ? Object.entries(settings.target_ratio).map(([a, p]) => ({ asset: a, pct: String(p) }))
      : []
  );

  // Profit thresholds
  const [globalThreshold, setGlobalThreshold] = useState(
    String(settings?.global_profit_threshold ?? 0)
  );
  const [perAssetThreshold, setPerAssetThreshold] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const h of holdings) m[h.holding_id] = String(h.profit_threshold || 0);
    return m;
  });

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
      setGlobalThreshold(String(settings?.global_profit_threshold ?? 0));
      setDwAmount("");
      setDwError("");
      setSaveErr("");
      setShowConfirmDelete(false);
      setDeleting(false);
      setDeleteErr("");
    }
  }, [showModal, portfolio, settings]);

  if (!showModal) return null;

  const cash = portfolio.available_cash || 0;

  const handleSave = async () => {
    setSaveErr("");
    const b = parseFloat(cashBuffer) || 0;
    if (b > cash) { setSaveErr(`Cash buffer limit cannot exceed ${formatMoney(cash)}`); return; }

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

      const ratio: Record<string, number> = {};
      for (const e of ratioEntries) {
        if (e.asset.trim()) ratio[e.asset.trim()] = parseFloat(e.pct) || 0;
      }
      await api.mfUpdateSettings(portfolioId, {
        target_ratio: Object.keys(ratio).length > 0 ? ratio : null,
        global_profit_threshold: parseFloat(globalThreshold) || 0,
      });

      for (const [hid, val] of Object.entries(perAssetThreshold)) {
        await api.mfUpdateHolding(portfolioId, parseInt(hid), {
          profit_threshold: parseFloat(val) || 0,
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error("Failed to save portfolio:", err);
      setSaveErr("Couldn't save the portfolio.");
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

            {/* Right: allocation + thresholds */}
            <div style={GROUP_STACK}>
              {/* Target Ratios */}
              <div>
                <div style={SECTION_HEAD}>
                  <p style={SECTION_LABEL}>Target allocation ratios</p>
                  <button onClick={() => setRatioEntries([...ratioEntries, { asset: "", pct: "0" }])}
                    className="hover:underline" style={ADD_ASSET_BUTTON}>+ Add asset</button>
                </div>
                <div className="flex flex-col" style={{ gap: 6 }}>
                  {ratioEntries.map((e, i) => (
                    <div key={i} className="flex items-center" style={ROW}>
                      <TextInput type="text" value={e.asset} onChange={v => {
                        const copy = [...ratioEntries]; copy[i] = { ...copy[i], asset: v.target.value.toUpperCase() }; setRatioEntries(copy);
                      }} placeholder="Asset" style={GROW_INPUT} />
                      <NumberInput step="0.1" value={e.pct} onChange={v => {
                        const copy = [...ratioEntries]; copy[i] = { ...copy[i], pct: v.target.value }; setRatioEntries(copy);
                      }} placeholder="%" style={PERCENT_INPUT} />
                      <span className="text-[length:var(--fs-label)]" style={percentSuffix}>%</span>
                      {ratioEntries.length > 1 && (
                        <button onClick={() => setRatioEntries(ratioEntries.filter((_, idx) => idx !== i))}
                          className="px-1 opacity-70 hover:opacity-100 transition-opacity text-[length:var(--fs-content)]"
                          style={{ fontWeight: 600, color: "var(--color-danger-text)", background: "transparent", border: 0, cursor: "pointer" }}>×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Profit Thresholds */}
              <div>
                <p style={{ ...SECTION_LABEL, marginBottom: 6 }}>Profit thresholds</p>
                <Field label="Global threshold (%)" htmlFor="mf-global-threshold">
                  <NumberInput id="mf-global-threshold" step="0.1" value={globalThreshold} onChange={e => setGlobalThreshold(e.target.value)} />
                </Field>
                {holdings.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ ...SECTION_LABEL, marginBottom: 6 }}>Per-asset (%)</label>
                    <div className="flex flex-col" style={{ gap: 6 }}>
                      {holdings.map(h => (
                        <div key={h.holding_id} className="flex items-center" style={ROW}>
                          <span style={ASSET_NAME}>{h.asset}</span>
                          <NumberInput step="0.1" value={perAssetThreshold[h.holding_id] || "0"}
                            onChange={e => setPerAssetThreshold({ ...perAssetThreshold, [h.holding_id]: e.target.value })}
                            style={PERCENT_INPUT} />
                          <span className="text-[length:var(--fs-label)]" style={percentSuffix}>%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
