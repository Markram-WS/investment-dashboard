import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { BrokerRecord } from "../lib/api";
import type { AssetProduct } from "../types";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from "./components/modalLayout";
import { Field, NumberInput, SelectInput, TextInput } from "./components/Field";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_HELPER,
  CONTROL_INPUT,
  CONTROL_LABEL,
  CONTROL_TITLE,
  CONTROL_VALUE,
} from "./components/controlStyles";
import { formatMoney } from "../utils/format";

/** Selected products: the list when present, else the legacy single ticker. */
const hydrateProductTickers = (
  tickers?: string[] | null,
  ticker?: string | null,
): string[] => (tickers && tickers.length > 0 ? [...tickers] : ticker ? [ticker] : []);

const modalPanelStyle = {
  padding: 12, borderRadius: "var(--rounded-xl)", background: "var(--color-canvas)",
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
  border: 0, borderTop: "1px solid var(--color-hairline)", margin: 0,
};
/** One-line read-only contract spec: inline label + value pairs. */
const SPEC_ROW: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", alignItems: "baseline",
  columnGap: 14, rowGap: 2,
};
const SPEC_LABEL: React.CSSProperties = {
  ...CONTROL_LABEL, display: "inline", margin: 0, marginRight: 4,
};
const SPEC_VALUE: React.CSSProperties = {
  ...CONTROL_VALUE, fontVariantNumeric: "tabular-nums",
};
const SPEC_HINT: React.CSSProperties = {
  ...CONTROL_HELPER, margin: 0,
};
const CHIP: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "1px 4px 1px 7px", borderRadius: "var(--rounded-full)",
  border: "1px solid var(--color-hairline)", background: "var(--color-surface)",
  fontSize: "var(--fs-label)", fontWeight: 500, color: "var(--color-ink)",
  maxWidth: "100%", overflowWrap: "anywhere",
};
const CHIP_REMOVE: React.CSSProperties = {
  border: 0, background: "none", padding: "0 2px", cursor: "pointer",
  fontSize: "var(--fs-content)", lineHeight: 1, color: "var(--color-slate)",
};

interface EditPortfolioModalProps {
  portfolioId: number;
  portfolioName: string;
  marginLocked: number;
  cashBufferLimit: number;
  brokerId: number | null;
  productTicker: string | null;
  productTickers?: string[] | null;
  /** Broker-scoped products already loaded by the grid. */
  products?: AssetProduct[];
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
  /** Mapped portfolio: cash moves with the external database, so hide transfer. */
  readOnly?: boolean;
}

const EditPortfolioModal: React.FC<EditPortfolioModalProps> = ({
  portfolioId, portfolioName, marginLocked, cashBufferLimit,
  brokerId, productTicker, productTickers, products: initialProducts, xAmount, initialCapital,
  rawAvailableCash, cumulativePl, tags, showModal, onClose, onSaved,
  onDepositWithdraw, activeOrderCount, onDeleted, readOnly = false,
}) => {
  const [form, setForm] = useState({
    portfolio_name: portfolioName,
    cash_buffer_limit: String(cashBufferLimit ?? 0),
    broker_id: brokerId as number | null,
    product_tickers: hydrateProductTickers(productTickers, productTicker),
    x_amount: String(xAmount ?? 0),
    initial_capital: String(initialCapital ?? 0),
    tags: tags ? Object.keys(tags).join(", ") : "",
  });
  const [brokers, setBrokers] = useState<BrokerRecord[]>([]);
  const [products, setProducts] = useState<AssetProduct[]>(initialProducts ?? []);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [tickers, setTickers] = useState<string[]>([]);
  const [tickerInput, setTickerInput] = useState("");
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
        product_tickers: hydrateProductTickers(productTickers, productTicker),
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
      setTickerInput("");
    }
    // Hydrates the draft only when the modal opens. Adding the portfolio props
    // would wipe in-progress edits whenever the parent refetches them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return;
    let cancelled = false;
    api.getBrokers()
      .then((rows) => { if (!cancelled) setBrokers(rows); })
      .catch((err) => console.error("Failed to load brokers:", err));
    return () => { cancelled = true; };
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return;
    let cancelled = false;
    const brokerId = form.broker_id;
    setProductsLoaded(false);
    api.getProducts(brokerId == null ? {} : { broker_id: brokerId })
      .then((rows) => {
        if (cancelled) return;
        const scoped = rows.filter((product) => product.broker_id === (brokerId ?? null));
        const nextTickers = Array.from(new Set(
          scoped
            .map((product) => product.ticker)
            .filter((ticker): ticker is string => Boolean(ticker)),
        ));
        setProducts(scoped);
        setProductsLoaded(true);
        setTickers(nextTickers);
      })
      .catch((err) => console.error("Failed to load product tickers:", err));
    return () => { cancelled = true; };
  }, [showModal, form.broker_id]);

  const handleChange = (field: string, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addTicker = (raw: string) => {
    const ticker = raw.trim().toUpperCase();
    if (!ticker) return;
    setForm((prev) => (
      prev.product_tickers.includes(ticker)
        ? prev
        : { ...prev, product_tickers: [...prev.product_tickers, ticker] }
    ));
    setTickerInput("");
  };

  const removeTicker = (ticker: string) => {
    setForm((prev) => ({
      ...prev,
      product_tickers: prev.product_tickers.filter((t) => t !== ticker),
    }));
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
        product_tickers: form.product_tickers,
        product_ticker: form.product_tickers[0] ?? null,
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
      <div className={`${MODAL_CARD} w-full max-w-xl mx-4 relative`} style={modalPanelStyle}>
          <div className={`${MODAL_HEADER} flex justify-between items-center`} style={{ marginBottom: 12 }}>
            <h3 style={CONTROL_TITLE}>Edit portfolio</h3>
            <button onClick={onClose} className="p-1 hover:bg-surface-soft rounded-full transition-colors">
              <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className={MODAL_BODY}>
          <div className="flex flex-col" style={{ gap: 8 }}>
            {/* Portfolio: name + money */}
            <div>
              <div className="grid gap-3 items-start" style={{ gridTemplateColumns: "1fr 1fr 1.15fr" }}>
                <Field label="Portfolio name" htmlFor="edit-portfolio-name">
                  <TextInput id="edit-portfolio-name" value={form.portfolio_name} onChange={(e) => handleChange("portfolio_name", e.target.value)} />
                </Field>
                <Field label="Available cash">
                  <div style={readonlyValue}>{formatMoney(displayEquity)}</div>
                </Field>
                <div>
                  <label style={CONTROL_LABEL}>
                    {readOnly ? "Margin locked (external)" : "Margin locked (computed)"}
                  </label>
                  <div
                    id="edit-portfolio-margin"
                    aria-describedby="edit-portfolio-money-hint"
                    style={readonlyValue}
                  >
                    {formatMoney(marginLocked)}
                  </div>
                </div>
              </div>
              <p id="edit-portfolio-money-hint" style={{ ...CONTROL_HELPER, margin: "4px 0 0" }}>
                {readOnly
                  ? "read from account_history in the external database"
                  : "Computed as Σ mark × multiplier × qty × margin rate"}
              </p>
              {readOnly && (
                <p style={{ ...CONTROL_HELPER, margin: "2px 0 0" }}>
                  Cash and margin are read from the external database.
                </p>
              )}
            </div>

            <hr style={SEPARATOR} />

            {/* Product: broker + ticker + strike, then the spec All Assets owns */}
            <div className="grid gap-3 items-start" style={{ gridTemplateColumns: "minmax(0,0.9fr) minmax(0,2.4fr) minmax(0,1.4fr)" }}>
              <Field label="Broker" htmlFor="edit-portfolio-broker">
                <SelectInput
                  id="edit-portfolio-broker"
                  value={form.broker_id ?? ""}
                  onChange={(e) => handleChange("broker_id", e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="">—</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>{b.code}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Product ticker" htmlFor="edit-portfolio-ticker">
                <div className="flex flex-col" style={{ gap: 4 }}>
                  <div className="flex flex-wrap items-center" style={{ gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, product_tickers: [] }))}
                      aria-pressed={form.product_tickers.length === 0}
                      className="transition-colors"
                      style={{
                        ...CHIP,
                        cursor: "pointer",
                        background: form.product_tickers.length === 0
                          ? "var(--color-brand-yellow)" : "transparent",
                        color: form.product_tickers.length === 0
                          ? "var(--color-on-brand-yellow)" : "var(--color-slate)",
                      }}
                    >
                      --ALL--
                    </button>
                    {form.product_tickers.map((ticker) => {
                      const matches = products.filter(
                        (product) => (product.ticker ?? "").toUpperCase() === ticker.toUpperCase(),
                      );
                      const unresolved = productsLoaded && matches.length === 0;
                      return (
                        <span
                          key={ticker}
                          style={unresolved
                            ? {
                                ...CHIP,
                                borderColor: "var(--color-warning-text)",
                                color: "var(--color-warning-text)",
                              }
                            : CHIP}
                          title={unresolved ? `No product spec for ${ticker} on this broker` : undefined}
                          aria-label={unresolved
                            ? `${ticker} — no product spec for this broker`
                            : ticker}
                        >
                          {ticker}
                          <button
                            type="button"
                            aria-label={`Remove ${ticker}`}
                            onClick={() => removeTicker(ticker)}
                            style={CHIP_REMOVE}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center" style={{ gap: 4 }}>
                    <TextInput
                      id="edit-portfolio-ticker"
                      list="edit-portfolio-tickers"
                      value={tickerInput}
                      onChange={(e) => setTickerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTicker(tickerInput);
                        }
                      }}
                      placeholder="e.g. S50"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <button
                      type="button"
                      onClick={() => addTicker(tickerInput)}
                      className="transition-colors hover:bg-surface-soft"
                      style={secondaryButton}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </Field>
              <datalist id="edit-portfolio-tickers">
                {tickers.map((t) => <option key={t} value={t} />)}
              </datalist>
              <Field
                label="Adverse move (X)"
                htmlFor="edit-portfolio-multiplier"
                hint="price points used by margin and P&amp;L"
              >
                <NumberInput
                  id="edit-portfolio-multiplier"
                  step="any"
                  value={form.x_amount}
                  onChange={(e) => handleChange("x_amount", e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            {form.product_tickers.length === 0 ? (
              <p style={SPEC_HINT}>
                All products allowed — contract specs resolve per order symbol.
              </p>
            ) : (
              <div className="flex flex-col" style={{ gap: 2 }}>
                {form.product_tickers.map((ticker) => {
                  const matches = products.filter(
                    (product) => (product.ticker ?? "").toUpperCase() === ticker.toUpperCase(),
                  );
                  const contractProduct = matches.length === 1 ? matches[0] : null;
                  return (
                    <div key={ticker} style={SPEC_ROW}>
                      <span style={{ ...SPEC_VALUE, fontWeight: 600 }}>{ticker}</span>{" "}
                      <span>
                        <span style={SPEC_LABEL}>Contract multiplier</span>{" "}
                        <span style={SPEC_VALUE}>
                          {contractProduct?.multiplier == null || Number.isNaN(contractProduct.multiplier)
                            ? "—" : String(contractProduct.multiplier)}
                        </span>
                      </span>{" "}
                      <span>
                        <span style={SPEC_LABEL}>Margin rate</span>{" "}
                        <span style={SPEC_VALUE}>
                          {contractProduct?.margin_rate == null || Number.isNaN(contractProduct.margin_rate)
                            ? "—" : String(contractProduct.margin_rate)}
                        </span>
                      </span>{" "}
                      <span>
                        <span style={SPEC_LABEL}>Margin mode</span>{" "}
                        <span style={SPEC_VALUE}>{contractProduct?.margin_mode ?? "—"}</span>
                      </span>{" "}
                      <span>
                        <span style={SPEC_LABEL}>Symbols</span>{" "}
                        <span style={SPEC_VALUE}>{contractProduct?.symbol_count ?? "—"}</span>
                      </span>
                      {matches.length > 1 && (
                        <span style={SPEC_HINT}>multiple products — specs are ambiguous</span>
                      )}
                      {productsLoaded && matches.length === 0 && (
                        <span style={SPEC_HINT}>no product spec — value kept on save</span>
                      )}
                    </div>
                  );
                })}
                <span style={SPEC_HINT}>maintained in All Assets</span>
              </div>
            )}

            <hr style={SEPARATOR} />

            {/* Capital: initial capital + buffer + tags */}
            <div>
              <div className="grid grid-cols-3 gap-3 items-start">
                <Field label="Initial capital" htmlFor="edit-portfolio-initial-capital">
                  <NumberInput
                    id="edit-portfolio-initial-capital"
                    step="any"
                    value={form.initial_capital}
                    onChange={(e) => handleChange("initial_capital", e.target.value)}
                    placeholder="0.00"
                    aria-describedby="edit-portfolio-initial-hint"
                  />
                </Field>
                <Field label="Cash buffer limit" htmlFor="edit-portfolio-cash-buffer">
                  <NumberInput
                    id="edit-portfolio-cash-buffer"
                    value={form.cash_buffer_limit}
                    onChange={(e) => handleChange("cash_buffer_limit", e.target.value)}
                  />
                </Field>
                <Field label="Tags (comma separated)" htmlFor="edit-portfolio-tags">
                  <TextInput
                    id="edit-portfolio-tags"
                    value={form.tags}
                    onChange={(e) => handleChange("tags", e.target.value)}
                    placeholder="crypto, bot, binance"
                  />
                </Field>
              </div>
              <p id="edit-portfolio-initial-hint" style={{ ...CONTROL_HELPER, margin: "4px 0 0" }}>
                baseline for the profit share, not the cash balance
              </p>
            </div>

            {!readOnly && (
              <div>
                <label style={CONTROL_LABEL} htmlFor="edit-portfolio-adjust-cash">Adjust cash balance</label>
                <div className="flex gap-2">
                  <NumberInput id="edit-portfolio-adjust-cash" step={100} placeholder="0"
                    value={dwAmount} onChange={e => setDwAmount(e.target.value)}
                    aria-describedby={dwError ? "edit-portfolio-adjust-cash-error" : undefined}
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
                {dwError && (
                  <p id="edit-portfolio-adjust-cash-error"
                    style={{ ...CONTROL_HELPER, color: "var(--color-danger-text)" }}>{dwError}</p>
                )}
              </div>
            )}
          </div>

          {saveErr && (
            <p style={{ ...CONTROL_HELPER, color: "var(--color-danger-text)", margin: "8px 0 0" }}>{saveErr}</p>
          )}

          <hr style={{ ...SEPARATOR, marginTop: 8 }} />

          <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
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