import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Transaction } from "../types";
import { formatCurrency, formatDateTime } from "../utils/format";
import Button from "../screens/components/Button";
import { useNotification } from "../contexts/NotificationContext";
import PageLayout from "../components/PageLayout";

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

  const getTransactionType = (type: string): { label: string; color: string } => {
    switch (type) {
      case "Deposit": return { label: "Deposit", color: "text-emerald-600 bg-emerald-50" };
      case "Withdraw": return { label: "Withdraw", color: "text-red-600 bg-red-50" };
      case "Transfer": return { label: "Transfer", color: "text-blue-600 bg-blue-50" };
      case "Buy": return { label: "Buy", color: "text-brand-teal bg-teal-50" };
      case "Sell": return { label: "Sell", color: "text-brand-coral bg-red-50" };
      default: return { label: type, color: "text-slate bg-surface" };
    }
  };

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

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-ink tracking-tight m-0">Transactions</h1>
      </header>

      <section className="mb-6 bg-canvas border border-hairline rounded-2xl p-4 shadow-sm">
        <div className="flex gap-4 items-center">
          <div className="w-1/2 flex flex-col items-start">
            <h2 className="text-[10px] font-bold text-slate uppercase tracking-widest">Filters</h2>
            <div className="flex gap-2 mt-2 flex-wrap">
              <input type="date" value={filters.dateRange.start}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, start: e.target.value } }))}
                className="px-2 py-1.5 border border-hairline rounded-lg text-xs" />
              <input type="date" value={filters.dateRange.end}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, end: e.target.value } }))}
                className="px-2 py-1.5 border border-hairline rounded-lg text-xs" />
              <select value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                className="px-2 py-1.5 border border-hairline rounded-lg text-xs bg-canvas"
              >
                <option value="">All Types</option>
                <option value="Deposit">Deposit</option>
                <option value="Withdraw">Withdraw</option>
                <option value="Transfer">Transfer</option>
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
              </select>
            </div>
          </div>
          <div className="w-1/2 flex flex-col items-start">
            <h2 className="text-[10px] font-bold text-slate uppercase tracking-widest">New Transaction</h2>
            <div className="flex gap-2 mt-2 items-center flex-wrap">
              <select value={formFrom} onChange={(e) => setFormFrom(e.target.value)}
                className="px-2 py-1.5 border border-hairline rounded-lg text-xs bg-canvas w-[130px]">
                <option value="deposit" disabled={formTo === "withdraw"}>Deposit →</option>
                {portfolios.map((p) => (
                  <option key={p.portfolio_id} value={p.portfolio_id}
                    disabled={formTo !== "" && formTo !== "withdraw" && p.portfolio_id === parseInt(formTo)}>{p.portfolio_name}</option>
                ))}
              </select>
              <input type="number" step={100} placeholder="Amount" value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="px-2 py-1.5 border border-hairline rounded-lg text-xs w-[100px]" />
              <select value={formTo} onChange={(e) => setFormTo(e.target.value)}
                className="px-2 py-1.5 border border-hairline rounded-lg text-xs bg-canvas w-[130px]">
                <option value="">Select portfolio</option>
                {portfolios.map((p) => (
                  <option key={p.portfolio_id} value={p.portfolio_id}
                    disabled={formFrom !== "deposit" && p.portfolio_id === parseInt(formFrom)}>{p.portfolio_name}</option>
                ))}
                <option value="withdraw" disabled={formFrom === "deposit"}>← Withdraw</option>
              </select>
              <Button variant="primary" onClick={handleSubmitTransaction} loading={formLoading}>Confirm</Button>
            </div>
            {formErr && <p className="text-red-500 text-xs mt-1">{formErr}</p>}
          </div>
        </div>
      </section>

      <section className="bg-canvas border border-hairline rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface">
                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">Datetime</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">Type</th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">From</th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">To</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">Amount</th>
                <th className="hidden lg:table-cell px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">Executed By</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate text-sm">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, index) => {
                  const typeStyle = getTransactionType(tx.type);
                  const { from, to } = parseFlow(tx.flow);
                  return (
                    <tr key={tx.history_id ?? tx.transaction_id ?? index}
                      className="border-t border-hairline hover:bg-surface transition-colors">
                      <td className="px-5 py-3.5 text-[13px] text-ink">
                        {formatDateTime(tx.entry_date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeStyle.color}`}>
                          {typeStyle.label}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-5 py-3.5 text-[13px] text-ink">{from}</td>
                      <td className="hidden md:table-cell px-5 py-3.5 text-[13px] text-ink">{to}</td>
                      <td className="px-5 py-3.5 text-[13px] text-ink font-medium">
                        {tx.amount != null ? fmtCurrency(tx.amount) : "-"}
                      </td>
                      <td className="hidden lg:table-cell px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{
                            background: tx.executed_by === "AI" ? 'var(--color-brand-teal)' : tx.executed_by === "Bot" ? 'var(--color-brand-yellow)' : 'var(--color-ink)',
                          }} />
                          <span className="text-[13px] text-ink">{tx.executed_by || "-"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-ink">
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
