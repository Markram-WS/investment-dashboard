import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { BrokerRecord } from "../lib/api";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from "./components/modalLayout";
import { Field, NumberInput, SelectInput, TextInput } from "./components/Field";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_HELPER,
  CONTROL_INPUT,
  CONTROL_TITLE,
} from "./components/controlStyles";
import { formatMoney } from "../utils/format";

const modalPanelStyle = {
  padding: "var(--space-md)", borderRadius: "var(--rounded-xl)",
} as const;
const readonlyValue = {
  ...CONTROL_INPUT, background: "var(--color-surface)", fontWeight: 600, borderColor: "transparent",
} as const;
const confirmTitle = {
  fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-ink)", margin: 0,
} as const;
const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;
const dangerButton = {
  ...CONTROL_BUTTON_SECONDARY, color: "var(--color-danger-text)",
} as const;
const SEPARATOR: React.CSSProperties = {
  border: 0, borderTop: "1px solid var(--color-hairline)", margin: "24px 0",
};

interface EditPortfolioModalProps {
  portfolioId: number;
  portfolioName: string;
  marginLocked: number;
  cashBufferLimit: number;
  brokerId: number | null;
  productTicker: string | null;
  xAmount: number;
  initialCapital: number;
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
  brokerId, productTicker, xAmount, initialCapital,
  rawAvailableCash, cumulativePl, tags, showModal, onClose, onSaved,
  onDepositWithdraw, activeOrderCount, onDeleted,
}) => {
  const [form, setForm] = useState({
    portfolio_name: portfolioName,
    cash_buffer_limit: String(cashBufferLimit ?? 0),
    broker_id: brokerId as number | null,
    product_ticker: productTicker ?? "",
    x_amount: String(xAmount ?? 0),
    initial_capital: String(initialCapital ?? 0),
    tags: tags ? Object.keys(tags).join(", ") : "",
  });
  const [brokers, setBrokers] = useState<BrokerRecord[]>([]);
  const [tickers, setTickers] = useState<string[]>([]);
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
      setForm({
        portfolio_name: portfolioName,
        cash_buffer_limit: String(cashBufferLimit ?? 0),
        broker_id: brokerId,
        product_ticker: productTicker ?? "",
        x_amount: String(xAmount ?? 0),
        initial_capital: String(initialCapital ?? 0),
        tags: tags ? Object.keys(tags).join(", ") : "",
      });
      setShowConfirmDelete(false);
      setShowWarning(false);
      setDeleting(false);
      setDwAmount("");
      setDwError("");
      setSaveErr("");
    }
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return;
    let cancelled = false;
    api.getBrokers()
      .then((rows) => { if (!cancelled) setBrokers(rows); })
      .catch((err) => console.error("Failed to load brokers:", err));
    api.getAssets()
      .then((rows) => {
        if (cancelled) return;
        setTickers(Array.from(new Set(rows.map((a) => a.ticker).filter(Boolean))));
      })
      .catch((err) => console.error("Failed to load asset tickers:", err));
    return () => { cancelled = true; };
  }, [showModal]);

  const handleChange = (field: string, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaveErr("");
    const newBuffer = parseFloat(form.cash_buffer_limit) || 0;

    if (newBuffer > rawAvailableCash) { setSaveErr(`Cash buffer limit cannot exceed ${formatMoney(rawAvailableCash)}`); return; }

    setSaving(true);
    try {
      const tagsObj: Record<string, boolean> = {};
      form.tags.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => { tagsObj[t] = true; });

      const totalDiff = newBuffer - cashBufferLimit;
      const newAvailable = Math.max(0, rawAvailableCash - totalDiff);

      await api.updatePortfolio(portfolioId, {
        portfolio_name: form.portfolio_name || undefined,
        broker_id: form.broker_id,
        product_ticker: form.product_ticker.trim() || null,
        x_amount: parseFloat(form.x_amount) || 0,
        initial_capital: parseFloat(form.initial_capital) || 0,
        cash_buffer_limit: newBuffer,
        available_cash: newAvailable,
        tags: Object.keys(tagsObj).length > 0 ? tagsObj : undefined,
      });
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
      onDepositWithdraw(`Deposited ${formatMoney(num)} to ${portfolioName}`);
      setDwAmount("");
      onSaved();
    } catch (e: unknown) {
      console.error("Failed to deposit cash:", e);
      setDwError("Couldn't deposit cash.");
    } finally {
      setDwProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    const num = parseFloat(dwAmount);
    if (isNaN(num) || num <= 0) { setDwError("Enter a valid amount"); return; }
    if (num > rawAvailableCash) { setDwError(`Maximum withdraw is ${formatMoney(rawAvailableCash)}`); return; }
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
      onDepositWithdraw(`Withdrew ${formatMoney(num)} from ${portfolioName}`);
      setDwAmount("");
      onSaved();
    } catch (e: unknown) {
      console.error("Failed to withdraw cash:", e);
      setDwError("Couldn't withdraw cash.");
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

  const projectedBuffer = parseFloat(form.cash_buffer_limit) || 0;
  const projectedDiff = projectedBuffer - cashBufferLimit;
  const projectedAvailableCash = Math.max(0, rawAvailableCash - projectedDiff);
  const displayEquity = projectedAvailableCash + cumulativePl;

  return (
    <ModalShell open={showModal} onClose={onClose} title="Edit portfolio">
      <div className={`${MODAL_CARD} w-full max-w-lg mx-4 relative`} style={modalPanelStyle}>
          <div className={`${MODAL_HEADER} flex justify-between items-center`} style={{ marginBottom: 16 }}>
            <h3 style={CONTROL_TITLE}>Edit portfolio</h3>
            <button onClick={onClose} className="p-1 hover:bg-surface-soft rounded-full transition-colors">
              <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className={MODAL_BODY}>
          <div className="flex flex-col" style={{ gap: 16 }}>
            <Field label="Portfolio name" htmlFor="edit-portfolio-name">
              <TextInput id="edit-portfolio-name" value={form.portfolio_name} onChange={(e) => handleChange("portfolio_name", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4 items-start">
              <Field label="Available cash">
                <div style={readonlyValue}>{formatMoney(displayEquity)}</div>
              </Field>
              <Field
                label="Margin locked (computed)"
                hint="Computed as Σ mark × multiplier × qty × margin rate"
              >
                <div style={readonlyValue}>{formatMoney(marginLocked)}</div>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Broker" htmlFor="edit-portfolio-broker">
                <SelectInput
                  id="edit-portfolio-broker"
                  value={form.broker_id ?? ""}
                  onChange={(e) => handleChange("broker_id", e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="">—</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Product ticker" htmlFor="edit-portfolio-ticker">
                <TextInput
                  id="edit-portfolio-ticker"
                  list="edit-portfolio-tickers"
                  value={form.product_ticker}
                  onChange={(e) => handleChange("product_ticker", e.target.value)}
                  placeholder="e.g. S50"
                />
              </Field>
              <datalist id="edit-portfolio-tickers">
                {tickers.map((t) => <option key={t} value={t} />)}
              </datalist>
              <Field label="Multiplier" htmlFor="edit-portfolio-multiplier">
                <div style={{ position: "relative" }}>
                  <NumberInput
                    id="edit-portfolio-multiplier"
                    step="any"
                    value={form.x_amount}
                    onChange={(e) => handleChange("x_amount", e.target.value)}
                    style={{ paddingRight: "calc(var(--control-pad-x) + 24px)" }}
                    placeholder="0"
                  />
                  <span
                    aria-hidden="true"
                    className="text-[length:var(--fs-body)]"
                    style={{
                      position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)",
                      color: "var(--color-slate)", pointerEvents: "none",
                    }}
                  >×</span>
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4 items-start">
              <Field
                label="Initial capital"
                htmlFor="edit-portfolio-initial-capital"
                hint="baseline for the profit share, not the cash balance"
              >
                <NumberInput
                  id="edit-portfolio-initial-capital"
                  step="any"
                  value={form.initial_capital}
                  onChange={(e) => handleChange("initial_capital", e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Cash buffer limit" htmlFor="edit-portfolio-cash-buffer">
                <NumberInput
                  id="edit-portfolio-cash-buffer"
                  value={form.cash_buffer_limit}
                  onChange={(e) => handleChange("cash_buffer_limit", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Tags (comma separated)" htmlFor="edit-portfolio-tags">
              <TextInput
                id="edit-portfolio-tags"
                value={form.tags}
                onChange={(e) => handleChange("tags", e.target.value)}
                placeholder="crypto, bot, binance"
              />
            </Field>

          </div>

          <hr style={SEPARATOR} />

          <Field label="Adjust cash balance" error={dwError}>
            <div className="flex gap-2">
              <NumberInput step={100} placeholder="0"
                value={dwAmount} onChange={e => setDwAmount(e.target.value)}
                className="flex-1" />
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

          <hr style={SEPARATOR} />

          {saveErr && (
            <p style={{ ...CONTROL_HELPER, color: "var(--color-danger-text)", marginBottom: 16 }}>{saveErr}</p>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p style={CONTROL_TITLE}>Danger zone</p>
              <p style={{ ...CONTROL_HELPER, marginTop: 4 }}>Permanently delete this portfolio and all related data</p>
            </div>
            <button onClick={handleDeleteClick}
              className="inline-flex items-center gap-1.5 transition-colors hover:bg-surface-soft"
              style={dangerButton}>
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
              style={{ marginTop: 12, padding: 12, background: "var(--color-coral-light)", borderRadius: "var(--rounded-md)" }}>
              <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-danger-text)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p style={{ ...CONTROL_HELPER, color: "var(--color-danger-text)", margin: 0 }}>
                You must close all {activeOrderCount} active order{activeOrderCount > 1 ? "s" : ""} before deleting this portfolio.
                <button onClick={() => setShowWarning(false)} className="ml-2 underline" style={{ fontWeight: 600, color: "inherit" }}>Dismiss</button>
              </p>
            </div>
          )}
          </div>

          <div className={`${MODAL_FOOTER} flex justify-end gap-3`} style={{ marginTop: 12 }}>
            <button onClick={onClose} style={secondaryButton} className="transition-colors hover:bg-surface-soft">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={primaryButton}>
              Save changes
            </button>
          </div>

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
                    <h4 className="text-[length:var(--fs-section)]" style={confirmTitle}>Delete "{portfolioName}"?</h4>
                    <p className="text-[length:var(--fs-content)]" style={{ color: "var(--color-slate)", margin: "8px 0 0" }}>
                      This will permanently delete this portfolio and all related data including trade history, trade plans, zone groups, and transactions. This action cannot be undone.
                    </p>
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

export default EditPortfolioModal;