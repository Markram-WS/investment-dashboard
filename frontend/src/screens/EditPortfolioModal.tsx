import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import Button from "./components/Button";
import ModalShell from "./components/ModalShell";

interface EditPortfolioModalProps {
  portfolioId: number;
  portfolioName: string;
  marginLocked: number;
  cashBufferLimit: number;
  rawAvailableCash: number;
  cumulativePl: number;
  moneyMarket: number;
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
  rawAvailableCash, cumulativePl, moneyMarket, tags, showModal, onClose, onSaved,
  onDepositWithdraw, activeOrderCount, onDeleted,
}) => {
  const [form, setForm] = useState({
    portfolio_name: portfolioName,
    margin_locked: marginLocked,
    cash_buffer_limit: cashBufferLimit,
    money_market: moneyMarket,
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
    const newMM = parseFloat(form.money_market as any) || 0;

    if (newMargin > rawAvailableCash) { setSaveErr(`Margin Locked max is $${rawAvailableCash.toLocaleString()}`); return; }
    if (newBuffer > rawAvailableCash) { setSaveErr(`Cash Buffer Limit max is $${rawAvailableCash.toLocaleString()}`); return; }
    if (newMM > rawAvailableCash) { setSaveErr(`Money Market max is $${rawAvailableCash.toLocaleString()}`); return; }

    setSaving(true);
    try {
      const tagsObj: Record<string, boolean> = {};
      form.tags.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => { tagsObj[t] = true; });

      const totalDiff = (newMargin - marginLocked) + (newBuffer - cashBufferLimit) + (newMM - moneyMarket);
      const newAvailable = Math.max(0, rawAvailableCash - totalDiff);

      await api.updatePortfolio(portfolioId, {
        portfolio_name: form.portfolio_name || undefined,
        margin_locked: newMargin,
        cash_buffer_limit: newBuffer,
        money_market: newMM,
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
  const projectedMM = parseFloat(form.money_market as any) || 0;
  const projectedDiff = (projectedMargin - marginLocked) + (projectedBuffer - cashBufferLimit) + (projectedMM - moneyMarket);
  const projectedAvailableCash = Math.max(0, rawAvailableCash - projectedDiff);
  const displayEquity = projectedAvailableCash + cumulativePl;

  return (
    <ModalShell open={showModal} onClose={onClose} title="Edit Portfolio" backdropClassName="bg-black/30 backdrop-blur-sm" zIndex={50}>
      <div className="bg-canvas rounded-2xl shadow-2xl border border-hairline w-full max-w-lg mx-4 p-8 relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-ink">Edit Portfolio</h3>
            <button onClick={onClose} className="p-1 hover:bg-surface-soft rounded-full transition-colors">
              <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Portfolio Name</label>
              <input value={form.portfolio_name} onChange={(e) => handleChange("portfolio_name", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Available Cash</label>
              <div className="w-full px-3 py-2 text-sm border border-hairline rounded-lg bg-surface text-ink font-semibold">
                ${displayEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Margin Locked</label>
                <input type="number" value={form.margin_locked} onChange={(e) => handleChange("margin_locked", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Cash Buffer Limit</label>
                <input type="number" value={form.cash_buffer_limit} onChange={(e) => handleChange("cash_buffer_limit", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Money Market</label>
                <input type="number" value={form.money_market} onChange={(e) => handleChange("money_market", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Tags (comma separated)</label>
                <input value={form.tags} onChange={(e) => handleChange("tags", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" placeholder="crypto, bot, binance" />
              </div>
            </div>

          </div>

          <hr className="my-6 border-hairline" />

          <div>
            <p className="text-xs font-bold text-slate uppercase tracking-wider mb-3">Adjust Cash Balance</p>
            <div className="flex gap-2 mb-2">
              <input type="number" step={100} placeholder="0"
                value={dwAmount} onChange={e => setDwAmount(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal"
                onFocus={e => e.target.style.borderColor = '#0fbcb0'}
                onBlur={e => e.target.style.borderColor = '#e0e2e8'} />
              <Button variant="primary" size="sm" onClick={handleDeposit} loading={dwProcessing}>Deposit</Button>
              <Button variant="danger" size="sm" onClick={handleWithdraw} loading={dwProcessing}>Withdraw</Button>
            </div>
            {dwError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{dwError}</p>
            )}
          </div>

          <hr className="my-6 border-hairline" />

          {saveErr && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-4">{saveErr}</p>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700">Danger Zone</p>
              <p className="text-xs text-slate">Permanently delete this portfolio and all related data</p>
            </div>
            <Button variant="ghost" onClick={handleDeleteClick} className="border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              Delete Portfolio
            </Button>
          </div>

          {showWarning && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs text-red-700">
                You must close all {activeOrderCount} active order{activeOrderCount > 1 ? "s" : ""} before deleting this portfolio.
                <button onClick={() => setShowWarning(false)} className="ml-2 font-bold underline">Dismiss</button>
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>Save Changes</Button>
          </div>

          {showConfirmDelete && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-white/90 backdrop-blur-sm flex items-center justify-center p-8">
              <div className="w-full max-w-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-ink">Delete "{portfolioName}"?</h4>
                    <p className="text-sm text-ink mt-2">
                      This will permanently delete this portfolio and all related data including trade history, trade plans, zone groups, and transactions. This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2 mt-5">
                      <Button variant="secondary" onClick={() => setShowConfirmDelete(false)}>Cancel</Button>
                      <Button variant="danger" onClick={handleConfirmDelete} loading={deleting}>Confirm Delete</Button>
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