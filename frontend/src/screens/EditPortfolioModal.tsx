import React, { useState, useEffect } from "react";
import { api } from "../lib/api";

interface EditPortfolioModalProps {
  portfolioId: number;
  portfolioName: string;
  currentNav: number;
  marginLocked: number;
  cashBufferLimit: number;
  availableCash: number;
  moneyMarket: number;
  tags: Record<string, boolean> | null;
  showModal: boolean;
  onClose: () => void;
  onSaved: () => void;
  activeOrderCount: number;
  onDeleted: () => void;
}

const EditPortfolioModal: React.FC<EditPortfolioModalProps> = ({
  portfolioId, portfolioName, currentNav, marginLocked, cashBufferLimit,
  availableCash, moneyMarket, tags, showModal, onClose, onSaved,
  activeOrderCount, onDeleted,
}) => {
  const [form, setForm] = useState({
    portfolio_name: portfolioName,
    current_nav: currentNav,
    margin_locked: marginLocked,
    cash_buffer_limit: cashBufferLimit,
    available_cash: availableCash,
    money_market: moneyMarket,
    tags: tags ? Object.keys(tags).join(", ") : "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (showModal) {
      setShowConfirmDelete(false);
      setShowWarning(false);
      setDeleting(false);
    }
  }, [showModal]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tagsObj: Record<string, boolean> = {};
      form.tags.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => { tagsObj[t] = true; });
      await api.updatePortfolio(portfolioId, {
        portfolio_name: form.portfolio_name || undefined,
        current_nav: form.current_nav ? parseFloat(form.current_nav as any) : undefined,
        margin_locked: form.margin_locked ? parseFloat(form.margin_locked as any) : undefined,
        cash_buffer_limit: form.cash_buffer_limit ? parseFloat(form.cash_buffer_limit as any) : undefined,
        available_cash: form.available_cash ? parseFloat(form.available_cash as any) : undefined,
        money_market: form.money_market ? parseFloat(form.money_market as any) : undefined,
        tags: Object.keys(tagsObj).length > 0 ? tagsObj : undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save portfolio:", err);
    } finally {
      setSaving(false);
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

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl border border-hairline w-full max-w-lg mx-4 p-8 relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-ink">Edit Portfolio</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
              <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Portfolio Name</label>
              <input value={form.portfolio_name} onChange={(e) => handleChange("portfolio_name", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Current NAV</label>
                <input type="number" value={form.current_nav} onChange={(e) => handleChange("current_nav", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Margin Locked</label>
                <input type="number" value={form.margin_locked} onChange={(e) => handleChange("margin_locked", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cash Buffer Limit</label>
                <input type="number" value={form.cash_buffer_limit} onChange={(e) => handleChange("cash_buffer_limit", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Available Cash</label>
                <input type="number" value={form.available_cash} onChange={(e) => handleChange("available_cash", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Money Market</label>
                <input type="number" value={form.money_market} onChange={(e) => handleChange("money_market", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tags (comma separated)</label>
                <input value={form.tags} onChange={(e) => handleChange("tags", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" placeholder="crypto, bot, binance" />
              </div>
            </div>
          </div>

          <hr className="my-6 border-hairline" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700">Danger Zone</p>
              <p className="text-xs text-gray-500">Permanently delete this portfolio and all related data</p>
            </div>
            <button
              onClick={handleDeleteClick}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-red-300 text-red-600 rounded-full hover:bg-red-50 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              Delete Portfolio
            </button>
          </div>

          {showWarning && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs text-red-700">
                You must close all {activeOrderCount} active order{activeOrderCount > 1 ? "s" : ""} before deleting this portfolio.
                <button onClick={() => setShowWarning(false)} className="ml-2 font-bold underline">Dismiss</button>
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="px-4 py-2 text-xs font-bold border border-hairline rounded-full hover:bg-surface transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-xs font-bold bg-ink text-white rounded-full hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>

          {showConfirmDelete && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-white/90 backdrop-blur-sm flex items-center justify-center p-8">
              <div className="w-full max-w-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-ink">Delete "{portfolioName}"?</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      This will permanently delete this portfolio and all related data including trade history, trade plans, zone groups, and transactions. This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2 mt-5">
                      <button onClick={() => setShowConfirmDelete(false)}
                        className="px-4 py-2 text-xs font-bold border border-hairline rounded-full hover:bg-surface transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleConfirmDelete} disabled={deleting}
                        className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50 transition-colors">
                        {deleting ? "Deleting..." : "Confirm Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default EditPortfolioModal;