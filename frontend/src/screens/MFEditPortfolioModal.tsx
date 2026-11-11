import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { MFSetting, MFHolding } from "../types";
import ModalShell from "./components/ModalShell";

const CARD: CSSProperties = {
  background: "var(--color-canvas)", borderRadius: 16, padding: 24,
};
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
const ADD_LINK: CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--color-brand-teal)",
  background: "transparent", border: 0, padding: 0, cursor: "pointer",
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
const BTN_DANGER: CSSProperties = {
  ...BTN, background: "transparent", color: "var(--color-danger-text)", borderColor: "var(--color-hairline)",
};
const SEPARATOR: CSSProperties = {
  border: 0, borderTop: "1px solid var(--color-hairline)", margin: "24px 0",
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
  const [marginLocked, setMarginLocked] = useState(String(portfolio.margin_locked || 0));
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
      setMarginLocked(String(portfolio.margin_locked || 0));
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
    const m = parseFloat(marginLocked) || 0;
    const b = parseFloat(cashBuffer) || 0;
    if (m > cash) { setSaveErr(`Margin Locked max $${cash.toLocaleString()}`); return; }
    if (b > cash) { setSaveErr(`Cash Buffer max $${cash.toLocaleString()}`); return; }

    setSaving(true);
    try {
      const tagsObj: Record<string, boolean> = {};
      tagsStr.split(",").map(t => t.trim()).filter(Boolean).forEach(t => { tagsObj[t] = true; });

      const totalDiff = (m - (portfolio.margin_locked || 0))
        + (b - (portfolio.cash_buffer_limit || 0));
      const newAvailable = Math.max(0, cash - totalDiff);

      await api.updatePortfolio(portfolioId, {
        portfolio_name: name || undefined,
        margin_locked: m,
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
    } catch (err: any) {
      setSaveErr(err.message || "Save failed");
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
    } catch (e: any) { setDwError(e.message || "Deposit failed"); }
    finally { setDwProcessing(false); }
  };

  const handleWithdraw = async () => {
    const num = parseFloat(dwAmount);
    if (isNaN(num) || num <= 0) { setDwError("Enter a valid amount"); return; }
    if (num > cash) { setDwError(`Max withdraw $${cash.toLocaleString()}`); return; }
    setDwProcessing(true); setDwError("");
    try {
      await api.createTransaction({
        transaction_type: "Withdraw", asset: "USD", amount: num,
        source_portfolio_id: portfolioId, executed_by: "Manual",
      });
      await api.updatePortfolio(portfolioId, { available_cash: cash - num });
      setDwAmount(""); onSaved();
    } catch (e: any) { setDwError(e.message || "Withdraw failed"); }
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
    } catch (err: any) {
      setDeleteErr(err.message || "Delete failed");
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const availableDisplay = cash + (portfolio.margin_locked || 0) + (portfolio.cash_buffer_limit || 0);

  return (
    <ModalShell open={showModal} onClose={onClose} title="Edit managed fund" zIndex={50}>
      <div className="w-full max-w-xl mx-4 relative max-h-[90vh] overflow-y-auto" style={CARD}>
        <div className="flex justify-between items-center" style={{ marginBottom: 24 }}>
          <h3 style={TITLE}>Edit managed fund</h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-soft rounded-full transition-colors">
            <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Basic Info */}
        <div className="flex flex-col" style={{ gap: 16 }}>
          <div>
            <label style={LABEL}>Portfolio name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="border border-hairline focus:border-brand-teal" style={INPUT} />
          </div>
          <div>
            <label style={LABEL}>Available cash</label>
            <div style={{ ...INPUT, background: "var(--color-surface)", fontWeight: 600, borderColor: "transparent" }}>
              ${availableDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={LABEL}>Margin locked</label>
              <input type="number" value={marginLocked} onChange={e => setMarginLocked(e.target.value)}
                className="border border-hairline focus:border-brand-teal" style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Cash buffer limit</label>
              <input type="number" value={cashBuffer} onChange={e => setCashBuffer(e.target.value)}
                className="border border-hairline focus:border-brand-teal" style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Tags (comma separated)</label>
              <input value={tagsStr} onChange={e => setTagsStr(e.target.value)}
                className="border border-hairline focus:border-brand-teal" style={INPUT} placeholder="crypto, fund, long-term" />
            </div>
          </div>
        </div>

        <hr style={SEPARATOR} />

        {/* Target Ratios */}
        <div>
          <p style={{ ...LABEL, marginBottom: 12 }}>Target allocation ratios</p>
          <div className="flex flex-col" style={{ gap: 8 }}>
            {ratioEntries.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={e.asset} onChange={v => {
                  const copy = [...ratioEntries]; copy[i] = { ...copy[i], asset: v.target.value.toUpperCase() }; setRatioEntries(copy);
                }} placeholder="Asset" className="w-24 border border-hairline focus:border-brand-teal" style={{ ...INPUT, padding: "6px 8px" }} />
                <input type="number" step="0.1" value={e.pct} onChange={v => {
                  const copy = [...ratioEntries]; copy[i] = { ...copy[i], pct: v.target.value }; setRatioEntries(copy);
                }} placeholder="%" className="w-20 border border-hairline focus:border-brand-teal" style={{ ...INPUT, padding: "6px 8px" }} />
                <span style={{ fontSize: 12, color: "var(--color-slate)" }}>%</span>
                {ratioEntries.length > 1 && (
                  <button onClick={() => setRatioEntries(ratioEntries.filter((_, idx) => idx !== i))}
                    className="px-1 opacity-70 hover:opacity-100 transition-opacity"
                    style={{ fontSize: 15, fontWeight: 600, color: "var(--color-danger-text)", background: "transparent", border: 0, cursor: "pointer" }}>×</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setRatioEntries([...ratioEntries, { asset: "", pct: "0" }])}
            className="hover:underline" style={{ ...ADD_LINK, marginTop: 8 }}>+ Add asset</button>
        </div>

        <hr style={SEPARATOR} />

        {/* Profit Thresholds */}
        <div>
          <p style={{ ...LABEL, marginBottom: 12 }}>Profit thresholds</p>
          <div style={{ marginBottom: 12 }}>
            <label style={LABEL}>Global threshold (%)</label>
            <input type="number" step="0.1" value={globalThreshold} onChange={e => setGlobalThreshold(e.target.value)}
              className="border border-hairline focus:border-brand-teal" style={INPUT} />
          </div>
          {holdings.length > 0 && (
            <div>
              <label style={{ ...LABEL, marginBottom: 8 }}>Per-asset (%)</label>
              <div className="flex flex-col max-h-32 overflow-y-auto" style={{ gap: 6 }}>
                {holdings.map(h => (
                  <div key={h.holding_id} className="flex items-center gap-2">
                    <span className="w-16" style={{ fontSize: 15, fontWeight: 500, color: "var(--color-ink)" }}>{h.asset}</span>
                    <input type="number" step="0.1" value={perAssetThreshold[h.holding_id] || "0"}
                      onChange={e => setPerAssetThreshold({ ...perAssetThreshold, [h.holding_id]: e.target.value })}
                      className="w-20 border border-hairline focus:border-brand-teal" style={{ ...INPUT, padding: "6px 8px" }} />
                    <span style={{ fontSize: 12, color: "var(--color-slate)" }}>%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <hr style={SEPARATOR} />

        {/* Deposit/Withdraw */}
        <div>
          <p style={{ ...LABEL, marginBottom: 12 }}>Adjust cash balance</p>
          <div className="flex gap-2" style={{ marginBottom: 8 }}>
            <input type="number" step={100} placeholder="0" value={dwAmount} onChange={e => setDwAmount(e.target.value)}
              className="flex-1 border border-hairline focus:border-brand-teal" style={INPUT} />
            <button onClick={handleDeposit} disabled={dwProcessing}
              className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={BTN_PRIMARY}>
              Deposit
            </button>
            <button onClick={handleWithdraw} disabled={dwProcessing}
              className="transition-colors hover:bg-surface-soft disabled:opacity-50 disabled:cursor-not-allowed"
              style={BTN_DANGER}>
              Withdraw
            </button>
          </div>
          {dwError && <p style={{ ...HELPER, color: "var(--color-danger-text)" }}>{dwError}</p>}
        </div>

        <hr style={SEPARATOR} />

        {/* Save Error */}
        {saveErr && <p style={{ ...HELPER, color: "var(--color-danger-text)", marginBottom: 16 }}>{saveErr}</p>}

        {/* Danger Zone */}
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>Danger zone</p>
            <p style={{ ...HELPER, marginTop: 4 }}>Permanently delete this portfolio and all related data</p>
          </div>
          <button onClick={() => setShowConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 transition-colors hover:bg-surface-soft"
            style={BTN_DANGER}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Delete
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3" style={{ marginTop: 24 }}>
          <button onClick={onClose} style={BTN_SECONDARY} className="transition-colors hover:bg-surface-soft">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={BTN_PRIMARY}>
            Save changes
          </button>
        </div>

        {/* Delete confirmation overlay */}
        {showConfirmDelete && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-8"
            style={{ borderRadius: 16, background: "color-mix(in srgb, var(--color-canvas) 92%, transparent)", backdropFilter: "blur(4px)" }}>
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
                  <h4 style={{ ...TITLE, fontSize: 16, letterSpacing: 0 }}>Delete "{portfolio.portfolio_name}"?</h4>
                  <p style={{ fontSize: 15, color: "var(--color-slate)", margin: "8px 0 0" }}>
                    This permanently deletes all Managed Fund data including holdings, orders, history, settings,
                    and the portfolio itself. Cannot be undone.
                  </p>
                  {deleteErr && <p style={{ ...HELPER, color: "var(--color-danger-text)", marginTop: 8 }}>{deleteErr}</p>}
                  <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
                    <button onClick={() => setShowConfirmDelete(false)} style={BTN_SECONDARY} className="transition-colors hover:bg-surface-soft">Cancel</button>
                    <button onClick={handleConfirmDelete} disabled={deleting}
                      className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={BTN_DANGER}>
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
