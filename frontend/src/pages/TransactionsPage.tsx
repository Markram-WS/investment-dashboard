import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import type { PortfolioSummary, TransactionRecord } from "../lib/api";
import { Transaction } from "../types";
import { formatCurrency, formatDateTime, formatMoney } from "../utils/format";
import { useNotification } from "../contexts/NotificationContext";
import PageLayout from "../components/PageLayout";
import PageHeader from "../components/PageHeader";
import { Field, NumberInput, SelectInput, TextInput } from "../screens/components/Field";
import { CONTROL_BUTTON_PRIMARY, CONTROL_BUTTON_SECONDARY, CONTROL_LABEL } from "../screens/components/controlStyles";

/** Ledger column head: 11px/500 slate, sentence case. */
const headCell = { fontWeight: 500, color: "var(--color-slate)" } as const;
const headCellClass = "text-[length:var(--fs-label)]";
const groupHeading = { ...CONTROL_LABEL, margin: 0 } as const;

function parseFlow(flow: string | null): { from: string; to: string } {
  if (!flow) return { from: "-", to: "-" };
  const parts = flow.split(" -> ");
  if (parts.length < 2) return { from: parts[0] || "-", to: "-" };
  const [a, b] = parts;
  if (!a) return { from: "-", to: b || "-" };
  if (b === "withdraw") return { from: a, to: "-" };
  return { from: a, to: b };
}

const mapTx = (tx: TransactionRecord): Transaction => ({
  ...(tx as unknown as Transaction),
  type: tx.transaction_type,
  entry_date: tx.created_at ?? null,
});

export default function TransactionsPage() {
  const [transactionsData, setTransactionsData] = useState<Transaction[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency] = useState<"USD" | "THB">("USD");
  const { notify } = useNotification();

  const [filters, setFilters] = useState({
    dateRange: { start: "", end: "" },
    type: "",
  });

  const [formFrom, setFormFrom] = useState("deposit");
  const [formTo, setFormTo] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formErr, setFormErr] = useState("");
  const newTransactionRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const refreshTransactions = useCallback(async () => {
    const txns = await api.getTransactions();
    setTransactionsData(txns.map(mapTx));
  }, []);

  useEffect(() => {
    Promise.all([
      refreshTransactions().catch(() => {}),
      api.getPortfolios().catch(() => []),
    ]).then(([, ports]) => {
      setPortfolios(ports);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [refreshTransactions]);

  const fmtCurrency = (amount: number): string => formatCurrency(amount, currency);

  const filteredTransactions = transactionsData.filter((tx) => {
    if (filters.dateRange.start && filters.dateRange.end) {
      const txDate = new Date(tx.entry_date || 0);
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      if (txDate < startDate || txDate > endDate) return false;
    }
    if (filters.type && tx.type !== filters.type) return false;
    return true;
  });

  const filtersActive = Boolean(filters.dateRange.start || filters.dateRange.end || filters.type);

  const clearFilters = () => {
    setFilters({ dateRange: { start: "", end: "" }, type: "" });
  };

  const startNewTransaction = () => {
    newTransactionRef.current?.scrollIntoView({ block: "center" });
    amountInputRef.current?.focus({ preventScroll: true });
  };

  const resetForm = () => {
    setFormFrom("deposit");
    setFormTo("");
    setFormAmount("");
    setFormErr("");
  };

  const handleSubmitTransaction = async () => {
    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) { setFormErr("Enter a valid amount"); return; }

    const isDeposit = formFrom === "deposit";
    const isWithdraw = formTo === "withdraw";
    const fromPid = isDeposit ? null : parseInt(formFrom);
    const toPid = isWithdraw ? null : parseInt(formTo);

    if (isDeposit && isWithdraw) { setFormErr("Select a portfolio for deposit or withdraw"); return; }
    if (!fromPid && !toPid) { setFormErr("Select at least one portfolio"); return; }
    if (fromPid && toPid && fromPid === toPid) { setFormErr("Source and destination must differ"); return; }

    setFormLoading(true);
    setFormErr("");

    try {
      if (isDeposit && toPid) {
        const target = portfolios.find((p) => p.portfolio_id === toPid);
        await api.createTransaction({
          transaction_type: "Deposit", asset: "USD", amount: amt,
          destination_portfolio_id: toPid, executed_by: "Manual",
        });
        await api.updatePortfolio(toPid, { available_cash: (target?.available_cash || 0) + amt });
        notify(`Deposited ${formatMoney(amt, currency)} to ${target?.portfolio_name || toPid}`, 'success');
      } else if (fromPid && isWithdraw) {
        const target = portfolios.find((p) => p.portfolio_id === fromPid);
        if (amt > (target?.available_cash || 0)) {
          setFormErr(`Maximum withdraw is ${formatMoney(target?.available_cash || 0, currency)}`);
          setFormLoading(false); return;
        }
        await api.createTransaction({
          transaction_type: "Withdraw", asset: "USD", amount: amt,
          source_portfolio_id: fromPid, executed_by: "Manual",
        });
        await api.updatePortfolio(fromPid, { available_cash: (target?.available_cash || 0) - amt });
        notify(`Withdrew ${formatMoney(amt, currency)} from ${target?.portfolio_name || fromPid}`, 'success');
      } else if (fromPid && toPid) {
        const transfer = await api.createTransfer({
          source_portfolio_id: fromPid, destination_portfolio_id: toPid,
          amount: amt, confirmed_by: "Manual",
        });
        await api.confirmTransfer(transfer.transaction_id, "auto-confirm", "Manual");
        notify(`Transferred ${formatMoney(amt, currency)}`, 'success');
      }
      await refreshTransactions();
      resetForm();
    } catch (e) {
      console.error("Failed to submit transaction:", e);
      setFormErr("Couldn't submit the transaction. Try again.");
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <PageHeader title="Transactions" />

        <section
          className="animate-pulse"
          style={{ background: "var(--color-canvas)", borderRadius: "var(--rounded-xl)", padding: "var(--space-md)", marginBottom: "var(--space-xxl)" }}
        >
          <div className="flex flex-col md:flex-row" style={{ gap: 24 }}>
            <div className="w-full md:w-1/2">
              <div className="h-3 bg-surface rounded w-16" />
              <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
                <div className="h-8 bg-surface rounded-lg w-32" />
                <div className="h-8 bg-surface rounded-lg w-32" />
                <div className="h-8 bg-surface rounded-lg w-24" />
              </div>
            </div>
            <div className="w-full md:w-1/2">
              <div className="h-3 bg-surface rounded w-24" />
              <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
                <div className="h-8 bg-surface rounded-lg w-32" />
                <div className="h-8 bg-surface rounded-lg w-24" />
                <div className="h-8 bg-surface rounded-lg w-32" />
                <div className="h-8 bg-surface rounded-lg w-20" />
              </div>
            </div>
          </div>
        </section>

        <section
          className="animate-pulse"
          style={{ background: "var(--color-canvas)", borderRadius: "var(--rounded-xl)", padding: "0 var(--space-md)" }}
        >
          <div className="flex items-center gap-6 py-3">
            <div className="h-3 bg-surface rounded w-24" />
            <div className="h-3 bg-surface rounded w-12" />
            <div className="hidden md:block h-3 bg-surface rounded w-16" />
            <div className="hidden md:block h-3 bg-surface rounded w-16" />
            <div className="ml-auto h-3 bg-surface rounded w-16" />
            <div className="hidden lg:block h-3 bg-surface rounded w-20" />
            <div className="h-3 bg-surface rounded w-12" />
          </div>
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center gap-6 py-3.5 border-t border-hairline">
              <div className="h-4 bg-surface rounded w-40" />
              <div className="h-4 bg-surface rounded w-16" />
              <div className="hidden md:block h-4 bg-surface rounded w-24" />
              <div className="hidden md:block h-4 bg-surface rounded w-24" />
              <div className="ml-auto h-4 bg-surface rounded w-24" />
              <div className="hidden lg:block h-4 bg-surface rounded w-20" />
              <div className="h-4 bg-surface rounded w-16" />
            </div>
          ))}
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout>

      <PageHeader title="Transactions" />

      <section className="mb-[var(--space-xxl)]" style={{ background: "var(--color-canvas)", borderRadius: "var(--rounded-xl)", padding: "var(--space-md)" }}>
        <div className="flex flex-col md:flex-row md:items-start" style={{ gap: 24 }}>
          <div className="w-full md:w-1/2 flex flex-col items-start">
            <h2 style={groupHeading}>Filters</h2>
            <div className="flex flex-wrap items-end" style={{ gap: 8, marginTop: 12 }}>
              <Field label="Start" htmlFor="tx-filter-start">
                <TextInput id="tx-filter-start" type="date" value={filters.dateRange.start}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, start: e.target.value } }))}
                  style={{ width: 140 }} />
              </Field>
              <Field label="End" htmlFor="tx-filter-end">
                <TextInput id="tx-filter-end" type="date" value={filters.dateRange.end}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, end: e.target.value } }))}
                  style={{ width: 140 }} />
              </Field>
              <Field label="Type" htmlFor="tx-filter-type">
                <SelectInput id="tx-filter-type" value={filters.type}
                  onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                  style={{ width: 130 }}
                >
                  <option value="">All types</option>
                  <option value="Deposit">Deposit</option>
                  <option value="Withdraw">Withdraw</option>
                  <option value="Transfer">Transfer</option>
                  <option value="Buy">Buy</option>
                  <option value="Sell">Sell</option>
                </SelectInput>
              </Field>
            </div>
          </div>
          <div ref={newTransactionRef} className="w-full md:w-1/2 flex flex-col items-start">
            <h2 style={groupHeading}>New transaction</h2>
            <div className="flex items-end flex-wrap" style={{ gap: 8, marginTop: 12 }}>
              <Field label="From" htmlFor="tx-form-from">
                <SelectInput id="tx-form-from" value={formFrom} onChange={(e) => setFormFrom(e.target.value)}
                  style={{ width: 130 }}>
                  <option value="deposit" disabled={formTo === "withdraw"}>Deposit →</option>
                  {portfolios.map((p) => (
                    <option key={p.portfolio_id} value={p.portfolio_id}
                      disabled={formTo !== "" && formTo !== "withdraw" && p.portfolio_id === parseInt(formTo)}>{p.portfolio_name}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Amount" htmlFor="tx-form-amount">
                <NumberInput ref={amountInputRef} id="tx-form-amount" step={100} placeholder="Amount" value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  style={{ width: 100 }} />
              </Field>
              <Field label="To" htmlFor="tx-form-to">
                <SelectInput id="tx-form-to" value={formTo} onChange={(e) => setFormTo(e.target.value)}
                  style={{ width: 130 }}>
                  <option value="">Select portfolio</option>
                  {portfolios.map((p) => (
                    <option key={p.portfolio_id} value={p.portfolio_id}
                      disabled={formFrom !== "deposit" && p.portfolio_id === parseInt(formFrom)}>{p.portfolio_name}</option>
                  ))}
                  <option value="withdraw" disabled={formFrom === "deposit"}>← Withdraw</option>
                </SelectInput>
              </Field>
              <button
                type="button"
                onClick={handleSubmitTransaction}
                disabled={formLoading}
                className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={CONTROL_BUTTON_PRIMARY}
              >Confirm</button>
            </div>
            {formErr && <p className="mt-1 text-[length:var(--fs-body)]" style={{ color: "var(--color-danger-text)" }}>{formErr}</p>}
          </div>
        </div>
      </section>

      <section className="overflow-hidden" style={{ background: "var(--color-canvas)", borderRadius: "var(--rounded-xl)" }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface">
                <th className={`px-5 py-3 text-left ${headCellClass}`} style={headCell}>Datetime</th>
                <th className={`px-5 py-3 text-left ${headCellClass}`} style={headCell}>Type</th>
                <th className={`hidden md:table-cell px-5 py-3 text-left ${headCellClass}`} style={headCell}>From</th>
                <th className={`hidden md:table-cell px-5 py-3 text-left ${headCellClass}`} style={headCell}>To</th>
                <th className={`px-5 py-3 text-left ${headCellClass}`} style={headCell}>Amount</th>
                <th className={`hidden lg:table-cell px-5 py-3 text-left ${headCellClass}`} style={headCell}>Executed by</th>
                <th className={`px-5 py-3 text-left ${headCellClass}`} style={headCell}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 text-center">
                    <div className="flex flex-col items-center justify-center" style={{ padding: "20px 0", gap: 8 }}>
                      <p className="m-0 text-[length:var(--fs-body)] text-slate">
                        {filtersActive ? "No transactions match these filters." : "No transactions yet."}
                      </p>
                      <button
                        type="button"
                        onClick={filtersActive ? clearFilters : startNewTransaction}
                        className="transition-opacity hover:opacity-90"
                        style={filtersActive ? CONTROL_BUTTON_SECONDARY : CONTROL_BUTTON_PRIMARY}
                      >
                        {filtersActive ? "Clear filters" : "Record a transaction"}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, index) => {
                  const { from, to } = parseFlow(tx.flow);
                  return (
                    <tr key={tx.history_id ?? tx.transaction_id ?? index}
                      className="border-t border-hairline hover:bg-surface transition-colors">
                      <td className="px-5 py-3.5 text-[length:var(--fs-content)] text-ink">
                        {formatDateTime(tx.entry_date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center text-[length:var(--fs-label)]" style={{
                          fontWeight: 500,
                          color: "var(--color-slate)",
                          background: "var(--color-surface-soft)",
                          borderRadius: "var(--rounded-full)",
                          padding: "2px 10px",
                          whiteSpace: "nowrap",
                        }}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-5 py-3.5 text-[length:var(--fs-content)] text-ink">{from}</td>
                      <td className="hidden md:table-cell px-5 py-3.5 text-[length:var(--fs-content)] text-ink">{to}</td>
                      <td className="px-5 py-3.5 text-[length:var(--fs-content)] text-ink font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {tx.amount != null ? fmtCurrency(tx.amount) : "-"}
                      </td>
                      <td className="hidden lg:table-cell px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{
                            background: tx.executed_by === "AI" ? 'var(--color-brand-teal)' : tx.executed_by === "Bot" ? 'var(--color-brand-yellow)' : 'var(--color-ink)',
                          }} />
                          <span className="text-[length:var(--fs-content)] text-ink">{tx.executed_by || "-"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[length:var(--fs-content)] text-ink">
                        {tx.executed_by === "AI" ? (
                          <span className="text-brand-teal">Completed</span>
                        ) : tx.type === "Transfer" ? (
                          <span className="text-brand-blue">Completed</span>
                        ) : (
                          <span className="text-slate">Done</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageLayout>
  );
}
