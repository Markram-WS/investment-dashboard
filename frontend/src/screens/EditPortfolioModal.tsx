import React, { useState } from "react";
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
}

const EditPortfolioModal: React.FC<EditPortfolioModalProps> = ({
  portfolioId, portfolioName, currentNav, marginLocked, cashBufferLimit,
  availableCash, moneyMarket, tags, showModal, onClose, onSaved,
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

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-hairline w-full max-w-lg mx-4 p-8">
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

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold border border-hairline rounded-full hover:bg-surface transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-xs font-bold bg-ink text-white rounded-full hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPortfolioModal;