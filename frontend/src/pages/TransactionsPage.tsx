import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Transaction } from "../types";
import { colors, rounded, spacing } from "../constants/colors";
import { formatCurrency, formatDate } from "../utils/format";

export default function TransactionsPage() {
  const [transactionsData, setTransactionsData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"USD" | "THB">("USD");
  const [filters, setFilters] = useState({
    dateRange: { start: "", end: "" },
    type: "",
    optimalControl: false,
  });

  // Fetch transactions data from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await api.getTransactions();
        setTransactionsData(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch transactions data:", err);
        setError("Failed to load transactions data. Please try again later.");
        setTransactionsData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const fmtCurrency = (amount: number): string => formatCurrency(amount, currency);

  // Get transaction type label with icon
  const getTransactionType = (type: string): { label: string; color: string } => {
    switch (type) {
      case "Deposit":
        return { label: "Funding", color: colors.success };
      case "Withdraw":
        return { label: "Funding", color: colors.error };
      case "Transfer":
        return { label: "Transfer", color: colors.brandBlue };
      case "Buy":
        return { label: "Trade", color: colors.brandTeal };
      case "Sell":
        return { label: "Trade", color: colors.brandCoral };
      default:
        return { label: type, color: colors.slate };
    }
  };

  // Get executed by label with icon
  const getExecutedBy = (executedBy: string): { label: string; color: string } => {
    switch (executedBy) {
      case "Manual":
        return { label: "Manual", color: colors.ink };
      case "Bot":
        return { label: "Bot", color: colors.brandYellow };
      case "AI":
        return { label: "AI", color: colors.brandTeal };
      default:
        return { label: executedBy, color: colors.slate };
    }
  };

  // Filter transactions based on filters
  const filteredTransactions = transactionsData.filter((tx) => {
    // Date range filter
    if (filters.dateRange.start && filters.dateRange.end) {
      const txDate = new Date(tx.entry_date || 0);
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      if (txDate < startDate || txDate > endDate) return false;
    }

    // Type filter
    if (filters.type && tx.type !== filters.type) return false;

    // Optimal Control filter (placeholder - would need to check if transaction affects rebalancing)
    if (filters.optimalControl) {
      // For now, we'll show all transactions - in a real app we'd check if it's a transfer/trade that affects portfolio balance
      return true;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold text-center mb-8">Loading Transactions...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold text-center text-red-600 mb-8">Error Loading Transactions</h2>
        <p className="text-center text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <section className={`min-h-screen bg-[var(--canvas-color, #ffffff)] p-6`}>
      {/* Page Header & Global Controls */} 
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-[var(--display-xl-font-size, 64px)] font-[var(--display-xl-font-weight, 500)] text-[var(--color-ink, #1c1c1e)] leading-[var(--display-xl-line-height, 1.1)]">
            Transactions
          </h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrency(currency === "USD" ? "THB" : "USD")}
              className={`px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                currency === "USD"
                  ? `bg-[var(--color-brand-teal, #0fbcb0)] text-[var(--color-on-primary, #ffffff)] hover:bg-[var(--color-teal-light, #e0f7f6)]`
                  : `bg-[var(--color-surface-soft, #fafbfc)] text-[var(--color-ink, #1c1c1e)] border border-[var(--color-hairline, #e0e2e8)] hover:bg-[var(--color-surface, #f7f8fa)]`
              }`}
            >
              {currency === "USD" ? "Switch to THB" : "Switch to USD"}
            </button>
            <button
              onClick={() => {
                // In a real app, this would trigger a refresh
                alert("Refreshing transactions data...");
              }}
              className="px-4 py-2 rounded-md font-medium text-[var(--color-ink, #1c1c1e)] border border-[var(--color-hairline, #e0e2e8)] hover:bg-[var(--color-surface, #f7f8fa)]"
            >
              Refresh Data
            </button>
          </div>
        </div>

        {/* Master Filter Bar (Miro Style) */}
        <div className="bg-[var(--color-surface-soft, #fafbfc)] rounded-[var(--rounded-xl, 16px)] p-[var(--spacing-lg, 24px)] mb-6">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Date Range Picker */}
            <div>
              <label className="block text-[var(--color-ink, #1c1c1e)] text-sm font-medium mb-2">Date Range</label>
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, start: e.target.value } }))}
                  className="px-3 py-2 rounded-md border border-[var(--color-hairline, #e0e2e8)] bg-[var(--color-canvas, #ffffff)] text-[var(--color-ink, #1c1c1e)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-teal, #0fbcb0)]"
                />
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, end: e.target.value } }))}
                  className="px-3 py-2 rounded-md border border-[var(--color-hairline, #e0e2e8)] bg-[var(--color-canvas, #ffffff)] text-[var(--color-ink, #1c1c1e)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-teal, #0fbcb0)]"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-[var(--color-ink, #1c1c1e)] text-sm font-medium mb-2">Type Filter</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                className="px-3 py-2 rounded-md border border-[var(--color-hairline, #e0e2e8)] bg-[var(--color-canvas, #ffffff)] text-[var(--color-ink, #1c1c1e)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-teal, #0fbcb0)]"
              >
                <option value="">All Types</option>
                <option value="Deposit">Deposit</option>
                <option value="Withdraw">Withdraw</option>
                <option value="Transfer">Transfer</option>
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
              </select>
            </div>

            {/* Optimal Control Filter */}
            <div>
              <label className="block text-[var(--color-ink, #1c1c1e)] text-sm font-medium mb-2">Optimal Control Filter</label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.optimalControl}
                  onChange={(e) => setFilters((prev) => ({ ...prev, optimalControl: e.target.checked }))}
                  className="h-4 w-4 text-[var(--color-brand-teal, #0fbcb0)] border-[var(--color-hairline, #e0e2e8)] rounded focus:ring-[var(--color-brand-teal, #0fbcb0)]"
                />
                <span className="text-[var(--color-ink, #1c1c1e)] text-sm">Show only transactions affecting portfolio balance</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Consolidated Transaction Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--color-hairline, #e0e2e8)]">
          <thead className="bg-[var(--color-surface-soft, #fafbfc)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-slate, #555a6a)] uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-slate, #555a6a)] uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-slate, #555a6a)] uppercase tracking-wider">
                Asset/Detail
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-slate, #555a6a)] uppercase tracking-wider">
                Amount &amp; Balance Delta
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-slate, #555a6a)] uppercase tracking-wider">
                Flow (Source → Destination)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-slate, #555a6a)] uppercase tracking-wider">
                Executed By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-slate, #555a6a)] uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline, #e0e2e8)]">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td className="px-6 py-4 text-center text-[var(--color-slate, #555a6a)]" colSpan="7">
                  No transactions found in this period.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx, index) => (
                <tr key={tx.history_id} className="hover:bg-[var(--color-teal-light, #e0f7f6)] transition-colors duration-150">
                  <td className="px-6 py-4 text-sm text-[var(--color-ink, #1c1c1e)]">
                    {formatDate(tx.entry_date)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionType(tx.type).color}20`}>
                      {getTransactionType(tx.type).label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--color-ink, #1c1c1e)]">
                    {tx.asset}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--color-ink, #1c1c1e)]">
                    {/* For simplicity, we'll show amount and realized_pl as the "Amount & Balance Delta" */}
                    <div className="space-y-1">
                      {tx.amount !== null ? (
                        <div className="text-right">
                          {fmtCurrency(tx.amount)}
                        </div>
                      ) : (
                        <div className="text-right text-[var(--color-slate, #555a6a)]">-</div>
                      )}
                      {tx.realized_pl !== null ? (
                        <div className="text-right text-sm">
                          {fmtCurrency(tx.realized_pl)} {tx.realized_pl >= 0 ? "+" : ""}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--color-ink, #1c1c1e)]">
                    {tx.flow || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm flex items-center space-x-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${getExecutedBy(tx.executed_by).color}`} />
                    <span className="text-[var(--color-ink, #1c1c1e)]">{getExecutedBy(tx.executed_by).label}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--color-ink, #1c1c1e)]">
                    {/* Status placeholder - we don't have a status field, so we'll show based on executed_by or type */}
                    {tx.executed_by === "AI" ? (
                      <span className="text-[var(--color-success, #00b473)]">Completed</span>
                    ) : tx.type === "Transfer" ? (
                      <span className="text-[var(--color-warning, #f4d03f)]">Pending</span>
                    ) : (
                      <span className="text-[var(--color-slate, #555a6a)]">Done</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Empty State (if no transactions after filtering) */}
      {filteredTransactions.length === 0 && transactionsData.length > 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="bg-[var(--color-brand-yellow, #ffd02f)] rounded-[var(--rounded-lg, 12px)] p-[var(--spacing-lg, 24px)] text-center mb-6">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-[var(--color-ink, #1c1c1e)] font-semibold text-[var(--heading-2-font-size, 24px)]">
              No transactions match the current filters
            </p>
          </div>
          <button
            onClick={() => {
              setFilters({
                dateRange: { start: "", end: "" },
                type: "",
                optimalControl: false,
              });
            }}
            className={`px-6 py-3 rounded-[var(--rounded-md, 8px)] font-medium bg-[var(--color-brand-teal, #0fbcb0)] text-[var(--color-on-primary, #ffffff)] hover:bg-[var(--color-teal-light, #e0f7f6)] transition-colors duration-200`}
          >
            Reset Filters
          </button>
        </div>
      )}
    </section>
  );
}