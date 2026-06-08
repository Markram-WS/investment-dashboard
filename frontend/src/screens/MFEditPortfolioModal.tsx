import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { MFSetting, MFHolding } from "../types";
import Button from "./components/Button";

interface MFEditPortfolioModalProps {
  portfolioId: number;
  portfolio: {
    portfolio_name: string;
    available_cash: number;
    margin_locked: number;
    cash_buffer_limit: number;
    money_market: number;
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
  const [moneyMarket, setMoneyMarket] = useState(String(portfolio.money_market || 0));
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
      setMoneyMarket(String(portfolio.money_market || 0));
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
    const mm = parseFloat(moneyMarket) || 0;
    if (m > cash) { setSaveErr(`Margin Locked max $${cash.toLocaleString()}`); return; }
    if (b > cash) { setSaveErr(`Cash Buffer max $${cash.toLocaleString()}`); return; }
    if (mm > cash) { setSaveErr(`Money Market max $${cash.toLocaleString()}`); return; }

    setSaving(true);
    try {
      const tagsObj: Record<string, boolean> = {};
      tagsStr.split(",").map(t => t.trim()).filter(Boolean).forEach(t => { tagsObj[t] = true; });

      const totalDiff = (m - (portfolio.margin_locked || 0))
        + (b - (portfolio.cash_buffer_limit || 0))
        + (mm - (portfolio.money_market || 0));
      const newAvailable = Math.max(0, cash - totalDiff);

      await api.updatePortfolio(portfolioId, {
        portfolio_name: name || undefined,
        margin_locked: m,
        cash_buffer_limit: b,
        money_market: mm,
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

  const availableDisplay = cash + (portfolio.margin_locked || 0) + (portfolio.cash_buffer_limit || 0) + (portfolio.money_market || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-canvas rounded-2xl shadow-2xl border border-hairline w-full max-w-xl mx-4 p-8 relative max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-ink">Edit Managed Fund</h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-soft rounded-full transition-colors">
            <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Portfolio Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Available Cash</label>
            <div className="w-full px-3 py-2 text-sm border border-hairline rounded-lg bg-surface text-ink font-semibold">
              ${availableDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Margin Locked</label>
              <input type="number" value={marginLocked} onChange={e => setMarginLocked(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Cash Buffer Limit</label>
              <input type="number" value={cashBuffer} onChange={e => setCashBuffer(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Money Market</label>
              <input type="number" value={moneyMarket} onChange={e => setMoneyMarket(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Tags (comma separated)</label>
              <input value={tagsStr} onChange={e => setTagsStr(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" placeholder="crypto, fund, long-term" />
            </div>
          </div>
        </div>

        <hr className="my-6 border-hairline" />

        {/* Target Ratios */}
        <div>
          <p className="text-xs font-bold text-slate uppercase tracking-wider mb-3">Target Allocation Ratios</p>
          <div className="space-y-2">
            {ratioEntries.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={e.asset} onChange={v => {
                  const copy = [...ratioEntries]; copy[i] = { ...copy[i], asset: v.target.value.toUpperCase() }; setRatioEntries(copy);
                }} placeholder="Asset" className="w-24 border border-hairline rounded px-2 py-1.5 text-sm" />
                <input type="number" step="0.1" value={e.pct} onChange={v => {
                  const copy = [...ratioEntries]; copy[i] = { ...copy[i], pct: v.target.value }; setRatioEntries(copy);
                }} placeholder="%" className="w-20 border border-hairline rounded px-2 py-1.5 text-sm" />
                <span className="text-xs text-slate">%</span>
                {ratioEntries.length > 1 && (
                  <button onClick={() => setRatioEntries(ratioEntries.filter((_, idx) => idx !== i))}
                    className="text-red-500 hover:text-red-700 text-sm font-bold px-1">×</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setRatioEntries([...ratioEntries, { asset: "", pct: "0" }])}
            className="text-xs text-brand-teal hover:underline mt-2">+ Add asset</button>
        </div>

        <hr className="my-6 border-hairline" />

        {/* Profit Thresholds */}
        <div>
          <p className="text-xs font-bold text-slate uppercase tracking-wider mb-3">Profit Thresholds</p>
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Global Threshold (%)</label>
            <input type="number" step="0.1" value={globalThreshold} onChange={e => setGlobalThreshold(e.target.value)}
              className="w-full border border-hairline rounded px-3 py-2 text-sm" />
          </div>
          {holdings.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-slate uppercase tracking-wider mb-1">Per-Asset (%)</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {holdings.map(h => (
                  <div key={h.holding_id} className="flex items-center gap-2">
                    <span className="w-16 text-sm font-medium text-ink">{h.asset}</span>
                    <input type="number" step="0.1" value={perAssetThreshold[h.holding_id] || "0"}
                      onChange={e => setPerAssetThreshold({ ...perAssetThreshold, [h.holding_id]: e.target.value })}
                      className="w-20 border border-hairline rounded px-2 py-1.5 text-sm" />
                    <span className="text-xs text-slate">%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <hr className="my-6 border-hairline" />

        {/* Deposit/Withdraw */}
        <div>
          <p className="text-xs font-bold text-slate uppercase tracking-wider mb-3">Adjust Cash Balance</p>
          <div className="flex gap-2 mb-2">
            <input type="number" step={100} placeholder="0" value={dwAmount} onChange={e => setDwAmount(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal" />
            <Button variant="primary" size="sm" onClick={handleDeposit} loading={dwProcessing}>Deposit</Button>
            <Button variant="danger" size="sm" onClick={handleWithdraw} loading={dwProcessing}>Withdraw</Button>
          </div>
          {dwError && <p className="text-xs text-red-600 mt-1">{dwError}</p>}
        </div>

        <hr className="my-6 border-hairline" />

        {/* Save Error */}
        {saveErr && <p className="text-xs text-red-600 mb-4">{saveErr}</p>}

        {/* Danger Zone */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-700">Danger Zone</p>
            <p className="text-xs text-slate">Permanently delete this portfolio and all related data</p>
          </div>
          <Button variant="ghost" onClick={() => setShowConfirmDelete(true)}
            className="border-red-300 text-red-600 hover:bg-red-50">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Delete
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>

        {/* Delete confirmation overlay */}
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
                  <h4 className="text-base font-bold text-ink">Delete "{portfolio.portfolio_name}"?</h4>
                  <p className="text-sm text-ink mt-2">
                    This permanently deletes all Managed Fund data including holdings, orders, history, settings,
                    and the portfolio itself. Cannot be undone.
                  </p>
                  {deleteErr && <p className="text-xs text-red-600 mt-2">{deleteErr}</p>}
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
    </div>
  );
}
