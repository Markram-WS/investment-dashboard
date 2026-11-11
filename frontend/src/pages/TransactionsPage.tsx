import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Transaction } from "../types";
import { formatCurrency, formatDateTime } from "../utils/format";
import Button from "../screens/components/Button";
import { useNotification } from "../contexts/NotificationContext";
import PageLayout from "../components/PageLayout";
import PageHeader from "../components/PageHeader";

/** Ledger column head: 12px/500 slate, sentence case. */
const headCell = { fontSize: 12, fontWeight: 500, color: "var(--color-slate)" } as const;

function parseFlow(flow: string | null): { from: string; to: string } {
  if (!flow) return { from: "-", to: "-" };
  const parts = flow.split(" -> ");
  if (parts.length < 2) return { from: parts[0] || "-", to: "-" };
  const [a, b] = parts;
  if (!a) return { from: "-", to: b || "-" };
  if (b === "withdraw") return { from: a, to: "-" };
  return { from: a, to: b };
}

export default function TransactionsPage() {
  const [transactionsData, setTransactionsData] = useState<Transaction[]>([]);
  const [portfolios, setPortfolios] = useState<any[]>([]);
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

  useEffect(() => {
    Promise.all([
      refreshTransactions().catch(() => {}),
      api.getPortfolios().catch(() => []),
    ]).then(([_, ports]) => {
      setPortfolios(ports);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const mapTx = (tx: any) => ({ ...tx, type: tx.transaction_type ?? tx.type, entry_date: tx.created_at ?? tx.entry_date });

  const refreshTransactions = async () => {
    const txns = await api.getTransactions();
    setTransactionsData((txns as any[]).map(mapTx));
  };

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
        notify(`Deposited $${amt.toLocaleString()} to ${target?.portfolio_name || toPid}`, 'success');
      } else if (fromPid && isWithdraw) {
        const target = portfolios.find((p) => p.portfolio_id === fromPid);
        if (amt > (target?.available_cash || 0)) {
          setFormErr(`Maximum withdraw is $${(target?.available_cash || 0).toLocaleString()}`);
          setFormLoading(false); return;
        }
        await api.createTransaction({
          transaction_type: "Withdraw", asset: "USD", amount: amt,
          source_portfolio_id: fromPid, executed_by: "Manual",
        });
        await api.updatePortfolio(fromPid, { available_cash: (target?.available_cash || 0) - amt });
        notify(`Withdrew $${amt.toLocaleString()} from ${target?.portfolio_name || fromPid}`, 'success');
      } else if (fromPid && toPid) {
        const transfer = await api.createTransfer({
          source_portfolio_id: fromPid, destination_portfolio_id: toPid,
          amount: amt, confirmed_by: "Manual",
        });
        await api.confirmTransfer(transfer.transaction_id, "auto-confirm", "Manual");
        notify(`Transferred $${amt.toLocaleString()}`, 'success');
      }
      await refreshTransactions();
      resetForm();
    } catch (e: any) {
      setFormErr(e.message || "Transaction failed");
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-slate">Loading…</div>
      </div>
    );
  }

  return (
    <PageLayout>

      <PageHeader title="Transactions" />

      <section className="mb-[var(--space-xxl)]" style={{ background: "var(--color-canvas)", borderRadius: 16, padding: 20 }}>
        <div className="flex flex-col md:flex-row md:items-start" style={{ gap: 24 }}>
          <div className="w-full md:w-1/2 flex flex-col items-start">
            <h2 className="m-0" style={{ fontSize: 12, fontWeight: 500, color: "var(--color-slate)" }}>Filters</h2>
            <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
              <input type="date" value={filters.dateRange.start}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, start: e.target.value } }))}
                className="px-2 py-1.5 border border-hairline rounded-lg text-[13px] text-ink bg-canvas" />
              <input type="date" value={filters.dateRange.end}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, end: e.target.value } }))}
                className="px-2 py-1.5 border border-hairline rounded-lg text-[13px] text-ink bg-canvas" />
              <select value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                className="px-2 py-1.5 border border-hairline rounded-lg text-[13px] text-ink bg-canvas"
              >
                <option value="">All types</option>
                <option value="Deposit">Deposit</option>
                <option value="Withdraw">Withdraw</option>
                <option value="Transfer">Transfer</option>
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
              </select>
            </div>
          </div>
          <div className="w-full md:w-1/2 flex flex-col items-start">
            <h2 className="m-0" style={{ fontSize: 12, fontWeight: 500, color: "var(--color-slate)" }}>New transaction</h2>
            <div className="flex items-center flex-wrap" style={{ gap: 8, marginTop: 12 }}>
              <select value={formFrom} onChange={(e) => setFormFrom(e.target.value)}
                className="px-2 py-1.5 border border-hairline rounded-lg text-[13px] text-ink bg-canvas w-[130px]">
                <option value="deposit" disabled={formTo === "withdraw"}>Deposit →</option>
                {portfolios.map((p) => (
                  <option key={p.portfolio_id} value={p.portfolio_id}
                    disabled={formTo !== "" && formTo !== "withdraw" && p.portfolio_id === parseInt(formTo)}>{p.portfolio_name}</option>
                ))}
              </select>
              <input type="number" step={100} placeholder="Amount" value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="px-2 py-1.5 border border-hairline rounded-lg text-[13px] text-ink bg-canvas w-[100px]" />
              <select value={formTo} onChange={(e) => setFormTo(e.target.value)}
                className="px-2 py-1.5 border border-hairline rounded-lg text-[13px] text-ink bg-canvas w-[130px]">
                <option value="">Select portfolio</option>
                {portfolios.map((p) => (
                  <option key={p.portfolio_id} value={p.portfolio_id}
                    disabled={formFrom !== "deposit" && p.portfolio_id === parseInt(formFrom)}>{p.portfolio_name}</option>
                ))}
                <option value="withdraw" disabled={formFrom === "deposit"}>← Withdraw</option>
              </select>
              <Button variant="primary" onClick={handleSubmitTransaction} loading={formLoading}>Confirm</Button>
            </div>
            {formErr && <p className="mt-1" style={{ fontSize: 12, color: "var(--color-danger-text)" }}>{formErr}</p>}
          </div>
        </div>
      </section>

      <section className="overflow-hidden" style={{ background: "var(--color-canvas)", borderRadius: 16 }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface">
                <th className="px-5 py-3 text-left" style={headCell}>Datetime</th>
                <th className="px-5 py-3 text-left" style={headCell}>Type</th>
                <th className="hidden md:table-cell px-5 py-3 text-left" style={headCell}>From</th>
                <th className="hidden md:table-cell px-5 py-3 text-left" style={headCell}>To</th>
                <th className="px-5 py-3 text-left" style={headCell}>Amount</th>
                <th className="hidden lg:table-cell px-5 py-3 text-left" style={headCell}>Executed by</th>
                <th className="px-5 py-3 text-left" style={headCell}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate" style={{ fontSize: 15 }}>
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, index) => {
                  const { from, to } = parseFlow(tx.flow);
                  return (
                    <tr key={tx.history_id ?? tx.transaction_id ?? index}
                      className="border-t border-hairline hover:bg-surface transition-colors">
                      <td className="px-5 py-3.5 text-[15px] text-ink">
                        {formatDateTime(tx.entry_date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center" style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--color-slate)",
                          background: "var(--color-surface-soft)",
                          borderRadius: 999,
                          padding: "2px 10px",
                          whiteSpace: "nowrap",
                        }}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-5 py-3.5 text-[15px] text-ink">{from}</td>
                      <td className="hidden md:table-cell px-5 py-3.5 text-[15px] text-ink">{to}</td>
                      <td className="px-5 py-3.5 text-[15px] text-ink font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {tx.amount != null ? fmtCurrency(tx.amount) : "-"}
                      </td>
                      <td className="hidden lg:table-cell px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{
                            background: tx.executed_by === "AI" ? 'var(--color-brand-teal)' : tx.executed_by === "Bot" ? 'var(--color-brand-yellow)' : 'var(--color-ink)',
                          }} />
                          <span className="text-[15px] text-ink">{tx.executed_by || "-"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[15px] text-ink">
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
