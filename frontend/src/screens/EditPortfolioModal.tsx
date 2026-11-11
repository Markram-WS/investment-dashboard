import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import ModalShell from "./components/ModalShell";

const CARD: React.CSSProperties = {
  background: "var(--color-canvas)", borderRadius: 16, padding: 24,
};
const TITLE: React.CSSProperties = {
  fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-ink)", margin: 0,
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-slate)", margin: "0 0 6px",
};
const INPUT: React.CSSProperties = {
  width: "100%", padding: "8px 12px", fontSize: 15, fontWeight: 500,
  fontVariantNumeric: "tabular-nums", color: "var(--color-ink)", background: "transparent",
  borderRadius: 8,
};
const HELPER: React.CSSProperties = {
  fontSize: 12, fontWeight: 400, color: "var(--color-slate)", margin: "4px 0 0",
};
const BTN: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, borderRadius: 999, padding: "6px 14px",
  border: "1px solid transparent", cursor: "pointer",
};
const BTN_PRIMARY: React.CSSProperties = {
  ...BTN, background: "var(--color-ink)", color: "var(--color-canvas)",
};
const BTN_SECONDARY: React.CSSProperties = {
  ...BTN, background: "transparent", color: "var(--color-ink)", borderColor: "var(--color-hairline)",
};
const BTN_DANGER: React.CSSProperties = {
  ...BTN, background: "transparent", color: "var(--color-danger-text)", borderColor: "var(--color-hairline)",
};
const SEPARATOR: React.CSSProperties = {
  border: 0, borderTop: "1px solid var(--color-hairline)", margin: "24px 0",
};

interface EditPortfolioModalProps {
  portfolioId: number;
  portfolioName: string;
  marginLocked: number;
  cashBufferLimit: number;
  rawAvailableCash: number;
  cumulativePl: number;
  tags: Record<string, boolean> | null;
  showModal: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDepositWithdraw: (msg: string) => void;
  activeOrderCount: number;
  onDeleted: () => void;
}

const EditPortfolioModal: React.FC<EditPortfolioModalProps> = ({
  portfolioId, portfolioName, marginLocked, cashBufferLimit,
  rawAvailableCash, cumulativePl, tags, showModal, onClose, onSaved,
  onDepositWithdraw, activeOrderCount, onDeleted,
}) => {
  const [form, setForm] = useState({
    portfolio_name: portfolioName,
    margin_locked: marginLocked,
    cash_buffer_limit: cashBufferLimit,
    tags: tags ? Object.keys(tags).join(", ") : "",
  });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [dwAmount, setDwAmount] = useState("");
  const [dwProcessing, setDwProcessing] = useState(false);
  const [dwError, setDwError] = useState("");

  useEffect(() => {
    if (showModal) {
      setShowConfirmDelete(false);
      setShowWarning(false);
      setDeleting(false);
      setDwAmount("");
      setDwError("");
      setSaveErr("");
    }
  }, [showModal]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaveErr("");
    const newMargin = parseFloat(form.margin_locked as any) || 0;
    const newBuffer = parseFloat(form.cash_buffer_limit as any) || 0;

    if (newMargin > rawAvailableCash) { setSaveErr(`Margin Locked max is $${rawAvailableCash.toLocaleString()}`); return; }
    if (newBuffer > rawAvailableCash) { setSaveErr(`Cash Buffer Limit max is $${rawAvailableCash.toLocaleString()}`); return; }

    setSaving(true);
    try {
      const tagsObj: Record<string, boolean> = {};
      form.tags.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => { tagsObj[t] = true; });

      const totalDiff = (newMargin - marginLocked) + (newBuffer - cashBufferLimit);
      const newAvailable = Math.max(0, rawAvailableCash - totalDiff);

      await api.updatePortfolio(portfolioId, {
        portfolio_name: form.portfolio_name || undefined,
        margin_locked: newMargin,
        cash_buffer_limit: newBuffer,
        available_cash: newAvailable,
        tags: Object.keys(tagsObj).length > 0 ? tagsObj : undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save portfolio:", err);
      setSaveErr(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeposit = async () => {
    const num = parseFloat(dwAmount);
    if (isNaN(num) || num <= 0) { setDwError("Enter a valid amount"); return; }
    setDwProcessing(true);
    setDwError("");
    try {
      await api.createTransaction({
        transaction_type: "Deposit",
        asset: "USD",
        amount: num,
        destination_portfolio_id: portfolioId,
        executed_by: "Manual",
      });
      await api.updatePortfolio(portfolioId, { available_cash: rawAvailableCash + num });
      onDepositWithdraw(`Deposited $${num.toLocaleString()} to ${portfolioName}`);
      setDwAmount("");
      onSaved();
    } catch (e: any) {
      setDwError(e.message || "Deposit failed");
    } finally {
      setDwProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    const num = parseFloat(dwAmount);
    if (isNaN(num) || num <= 0) { setDwError("Enter a valid amount"); return; }
    if (num > rawAvailableCash) { setDwError(`Maximum withdraw is $${rawAvailableCash.toLocaleString()}`); return; }
    setDwProcessing(true);
    setDwError("");
    try {
      await api.createTransaction({
        transaction_type: "Withdraw",
        asset: "USD",
        amount: num,
        source_portfolio_id: portfolioId,
        executed_by: "Manual",
      });
      await api.updatePortfolio(portfolioId, { available_cash: rawAvailableCash - num });
      onDepositWithdraw(`Withdrew $${num.toLocaleString()} from ${portfolioName}`);
      setDwAmount("");
      onSaved();
    } catch (e: any) {
      setDwError(e.message || "Withdraw failed");
    } finally {
      setDwProcessing(false);
    }
  };

  const handleDeleteClick = () => {
    if (activeOrderCount > 0) {
      setShowWarning(true);
      setShowConfirmDelete(false);
    } else {
      setShowConfirmDelete(true);
      setShowWarning(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await api.deletePortfolio(portfolioId);
      onDeleted();
    } catch (err) {
      console.error("Failed to delete portfolio:", err);
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  if (!showModal) return null;

  const projectedMargin = parseFloat(form.margin_locked as any) || 0;
  const projectedBuffer = parseFloat(form.cash_buffer_limit as any) || 0;
  const projectedDiff = (projectedMargin - marginLocked) + (projectedBuffer - cashBufferLimit);
  const projectedAvailableCash = Math.max(0, rawAvailableCash - projectedDiff);
  const displayEquity = projectedAvailableCash + cumulativePl;

  return (
    <ModalShell open={showModal} onClose={onClose} title="Edit portfolio" zIndex={50}>
      <div className="w-full max-w-lg mx-4 relative" style={CARD}>
          <div className="flex justify-between items-center" style={{ marginBottom: 24 }}>
            <h3 style={TITLE}>Edit portfolio</h3>
            <button onClick={onClose} className="p-1 hover:bg-surface-soft rounded-full transition-colors">
              <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col" style={{ gap: 16 }}>
            <div>
              <label style={LABEL}>Portfolio name</label>
              <input value={form.portfolio_name} onChange={(e) => handleChange("portfolio_name", e.target.value)}
                className="border border-hairline focus:border-brand-teal" style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Available cash</label>
              <div style={{ ...INPUT, background: "var(--color-surface)", fontWeight: 600, borderColor: "transparent" }}>
                ${displayEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={LABEL}>Margin locked</label>
                <input type="number" value={form.margin_locked} onChange={(e) => handleChange("margin_locked", e.target.value)}
                  className="border border-hairline focus:border-brand-teal" style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>Cash buffer limit</label>
                <input type="number" value={form.cash_buffer_limit} onChange={(e) => handleChange("cash_buffer_limit", e.target.value)}
                  className="border border-hairline focus:border-brand-teal" style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>Tags (comma separated)</label>
                <input value={form.tags} onChange={(e) => handleChange("tags", e.target.value)}
                  className="border border-hairline focus:border-brand-teal" style={INPUT} placeholder="crypto, bot, binance" />
              </div>
            </div>

          </div>

          <hr style={SEPARATOR} />

          <div>
            <p style={{ ...LABEL, marginBottom: 12 }}>Adjust cash balance</p>
            <div className="flex gap-2" style={{ marginBottom: 8 }}>
              <input type="number" step={100} placeholder="0"
                value={dwAmount} onChange={e => setDwAmount(e.target.value)}
                className="flex-1 border border-hairline"
                style={INPUT}
                onFocus={e => e.target.style.borderColor = 'var(--color-brand-teal)'}
                onBlur={e => e.target.style.borderColor = 'var(--color-hairline)'} />
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
            {dwError && (
              <p style={{ ...HELPER, color: "var(--color-danger-text)" }}>{dwError}</p>
            )}
          </div>

          <hr style={SEPARATOR} />

          {saveErr && (
            <p style={{ ...HELPER, color: "var(--color-danger-text)", marginBottom: 16 }}>{saveErr}</p>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>Danger zone</p>
              <p style={{ ...HELPER, marginTop: 4 }}>Permanently delete this portfolio and all related data</p>
            </div>
            <button onClick={handleDeleteClick}
              className="inline-flex items-center gap-1.5 transition-colors hover:bg-surface-soft"
              style={BTN_DANGER}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              Delete portfolio
            </button>
          </div>

          {showWarning && (
            <div className="flex items-start gap-2"
              style={{ marginTop: 12, padding: 12, background: "var(--color-coral-light)", borderRadius: 8 }}>
              <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-danger-text)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p style={{ fontSize: 12, color: "var(--color-danger-text)", margin: 0 }}>
                You must close all {activeOrderCount} active order{activeOrderCount > 1 ? "s" : ""} before deleting this portfolio.
                <button onClick={() => setShowWarning(false)} className="ml-2 underline" style={{ fontWeight: 600, color: "inherit" }}>Dismiss</button>
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3" style={{ marginTop: 24 }}>
            <button onClick={onClose} style={BTN_SECONDARY} className="transition-colors hover:bg-surface-soft">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={BTN_PRIMARY}>
              Save changes
            </button>
          </div>

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
                    <h4 style={{ ...TITLE, fontSize: 16, letterSpacing: 0 }}>Delete "{portfolioName}"?</h4>
                    <p style={{ fontSize: 15, color: "var(--color-slate)", margin: "8px 0 0" }}>
                      This will permanently delete this portfolio and all related data including trade history, trade plans, zone groups, and transactions. This action cannot be undone.
                    </p>
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

export default EditPortfolioModal;