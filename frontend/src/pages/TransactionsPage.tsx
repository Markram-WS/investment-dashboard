import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Transaction } from "../types";
import { formatCurrency, formatDate } from "../utils/format";
import Button from "../screens/components/Button";
import ToastAlert from "../screens/components/ToastAlert";

type ModalType = "transfer" | "deposit" | "withdraw" | null;

export default function TransactionsPage() {
  const [transactionsData, setTransactionsData] = useState<Transaction[]>([]);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency] = useState<"USD" | "THB">("USD");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    dateRange: { start: "", end: "" },
    type: "",
  });

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalErr, setModalErr] = useState("");

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    sourcePortfolioId: "",
    destPortfolioId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });

  // Deposit form
  const [depositForm, setDepositForm] = useState({
    portfolioId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });

  // Withdraw form
  const [withdrawForm, setWithdrawForm] = useState({
    portfolioId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });

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
  const nowStr = () => new Date().toISOString().split("T")[0];

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

  const resetForms = () => {
    setTransferForm({ sourcePortfolioId: "", destPortfolioId: "", amount: "", date: nowStr() });
    setDepositForm({ portfolioId: "", amount: "", date: nowStr() });
    setWithdrawForm({ portfolioId: "", amount: "", date: nowStr() });
    setModalErr("");
  };

  const openModal = (type: ModalType) => {
    resetForms();
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSubmitting(false);
    setModalErr("");
  };

  const handleTransfer = async () => {
    const srcId = parseInt(transferForm.sourcePortfolioId);
    const dstId = parseInt(transferForm.destPortfolioId);
    const amt = parseFloat(transferForm.amount);
    if (isNaN(srcId) || isNaN(dstId)) { setModalErr("Select source and destination portfolios"); return; }
    if (isNaN(amt) || amt <= 0) { setModalErr("Enter a valid amount"); return; }
    setSubmitting(true);
    setModalErr("");
    try {
      const transfer = await api.createTransfer({
        source_portfolio_id: srcId,
        destination_portfolio_id: dstId,
        amount: amt,
        confirmed_by: "Manual",
      });
      await api.confirmTransfer(transfer.transfer_id, transfer.confirmation_token, "Manual");
      setToastMsg(`Transferred $${amt.toLocaleString()}`);
      await refreshTransactions();
      closeModal();
    } catch (e: any) {
      setModalErr(e.message || "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeposit = async () => {
    const pid = parseInt(depositForm.portfolioId);
    const amt = parseFloat(depositForm.amount);
    if (isNaN(pid)) { setModalErr("Select a portfolio"); return; }
    if (isNaN(amt) || amt <= 0) { setModalErr("Enter a valid amount"); return; }
    setSubmitting(true);
    setModalErr("");
    try {
      const target = portfolios.find((p) => p.portfolio_id === pid);
      await api.createTransaction({
        transaction_type: "Deposit",
        asset: "USD",
        amount: amt,
        destination_portfolio_id: pid,
        executed_by: "Manual",
      });
      await api.updatePortfolio(pid, { available_cash: (target?.available_cash || 0) + amt });
      setToastMsg(`Deposited $${amt.toLocaleString()} to ${target?.portfolio_name || pid}`);
      await refreshTransactions();
      closeModal();
    } catch (e: any) {
      setModalErr(e.message || "Deposit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const pid = parseInt(withdrawForm.portfolioId);
    const amt = parseFloat(withdrawForm.amount);
    if (isNaN(pid)) { setModalErr("Select a portfolio"); return; }
    if (isNaN(amt) || amt <= 0) { setModalErr("Enter a valid amount"); return; }
    setSubmitting(true);
    setModalErr("");
    try {
      const target = portfolios.find((p) => p.portfolio_id === pid);
      if (amt > (target?.available_cash || 0)) { setModalErr(`Maximum withdraw is $${(target?.available_cash || 0).toLocaleString()}`); setSubmitting(false); return; }
      await api.createTransaction({
        transaction_type: "Withdraw",
        asset: "USD",
        amount: amt,
        source_portfolio_id: pid,
        executed_by: "Manual",
      });
      await api.updatePortfolio(pid, { available_cash: (target?.available_cash || 0) - amt });
      setToastMsg(`Withdrew $${amt.toLocaleString()} from ${target?.portfolio_name || pid}`);
      await refreshTransactions();
      closeModal();
    } catch (e: any) {
      setModalErr(e.message || "Withdraw failed");
    } finally {
      setSubmitting(false);
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
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      {toastMsg && <ToastAlert message={toastMsg} type="success" onClose={() => setToastMsg(null)} />}

      <header className="flex items-center justify-between mb-10 animate-fade-up">
        <h1 className="text-5xl font-bold text-ink tracking-tight m-0">
          Transactions
        </h1>
      </header>

      <section className="mb-6 animate-fade-up stagger-1">
        <div className="bg-teal-light border border-hairline/30 rounded-[28px] p-8 shadow-sm">
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-5">New Transaction</p>
          <div className="flex gap-4">
            <Button variant="primary" onClick={() => openModal("transfer")}>Transfer</Button>
            <Button variant="primary" onClick={() => openModal("deposit")}>Deposit</Button>
            <Button variant="primary" onClick={() => openModal("withdraw")}>Withdraw</Button>
          </div>
        </div>
      </section>

      <section className="bg-canvas border border-hairline rounded-[28px] p-6 shadow-sm mb-6 animate-fade-up stagger-2">
        <div className="grid gap-4 grid-cols-3">
          <div>
            <label className="text-[10px] font-bold text-slate uppercase tracking-widest mb-2 block">Date Range</label>
            <div className="flex gap-2">
              <input type="date" value={filters.dateRange.start}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, start: e.target.value } }))}
                className="flex-1 px-3 py-2 border border-hairline rounded-lg text-[13px]"
              />
              <input type="date" value={filters.dateRange.end}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, end: e.target.value } }))}
                className="flex-1 px-3 py-2 border border-hairline rounded-lg text-[13px]"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate uppercase tracking-widest mb-2 block">Type Filter</label>
            <select value={filters.type}
              onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border border-hairline rounded-lg text-[13px] bg-canvas"
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
      </section>

      <section className="bg-canvas border border-hairline rounded-[28px] shadow-sm overflow-hidden animate-fade-up stagger-3">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface">
                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">Date</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">Type</th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">Asset</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">Amount</th>
                <th className="hidden lg:table-cell px-5 py-3 text-left text-[10px] font-bold text-slate uppercase tracking-widest">Flow</th>
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
                  return (
                    <tr key={tx.history_id ?? tx.transaction_id ?? index}
                      className="border-t border-hairline hover:bg-teal-50 transition-colors">
                      <td className="px-5 py-3.5 text-[13px] text-ink">
                        {formatDate(tx.entry_date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeStyle.color}`}>
                          {typeStyle.label}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-5 py-3.5 text-[13px] text-ink">
                        {tx.asset || "-"}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-ink">
                        {tx.amount != null ? fmtCurrency(tx.amount) : "-"}
                      </td>
                      <td className="hidden lg:table-cell px-5 py-3.5 text-[13px] text-ink">
                        {tx.flow || "-"}
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

      {/* Transfer Modal */}
      {activeModal === "transfer" && (
        <ModalShell title="Transfer" onClose={closeModal} onSubmit={handleTransfer} submitting={submitting} modalErr={modalErr}>
          <FormSelect label="From Portfolio" value={transferForm.sourcePortfolioId}
            onChange={(e) => setTransferForm((prev) => ({ ...prev, sourcePortfolioId: e.target.value }))}>
            <option value="">Select source</option>
            {portfolios.map((p) => (
              <option key={p.portfolio_id} value={p.portfolio_id}>{p.portfolio_name}</option>
            ))}
          </FormSelect>
          <FormSelect label="To Portfolio" value={transferForm.destPortfolioId}
            onChange={(e) => setTransferForm((prev) => ({ ...prev, destPortfolioId: e.target.value }))}>
            <option value="">Select destination</option>
            {portfolios.map((p) => (
              <option key={p.portfolio_id} value={p.portfolio_id} disabled={p.portfolio_id === parseInt(transferForm.sourcePortfolioId)}>{p.portfolio_name}</option>
            ))}
          </FormSelect>
          <FormInput label="Amount" type="number" step={100} placeholder="0"
            value={transferForm.amount}
            onChange={(e) => setTransferForm((prev) => ({ ...prev, amount: e.target.value }))} />
          <FormInput label="Date" type="date" value={transferForm.date}
            onChange={(e) => setTransferForm((prev) => ({ ...prev, date: e.target.value }))} />
        </ModalShell>
      )}

      {/* Deposit Modal */}
      {activeModal === "deposit" && (
        <ModalShell title="Deposit" onClose={closeModal} onSubmit={handleDeposit} submitting={submitting} modalErr={modalErr}>
          <FormSelect label="Portfolio" value={depositForm.portfolioId}
            onChange={(e) => setDepositForm((prev) => ({ ...prev, portfolioId: e.target.value }))}>
            <option value="">Select portfolio</option>
            {portfolios.map((p) => (
              <option key={p.portfolio_id} value={p.portfolio_id}>{p.portfolio_name}</option>
            ))}
          </FormSelect>
          <FormInput label="Amount" type="number" step={100} placeholder="0"
            value={depositForm.amount}
            onChange={(e) => setDepositForm((prev) => ({ ...prev, amount: e.target.value }))} />
          <FormInput label="Date" type="date" value={depositForm.date}
            onChange={(e) => setDepositForm((prev) => ({ ...prev, date: e.target.value }))} />
        </ModalShell>
      )}

      {/* Withdraw Modal */}
      {activeModal === "withdraw" && (
        <ModalShell title="Withdraw" onClose={closeModal} onSubmit={handleWithdraw} submitting={submitting} modalErr={modalErr}>
          <FormSelect label="Portfolio" value={withdrawForm.portfolioId}
            onChange={(e) => setWithdrawForm((prev) => ({ ...prev, portfolioId: e.target.value }))}>
            <option value="">Select portfolio</option>
            {portfolios.map((p) => (
              <option key={p.portfolio_id} value={p.portfolio_id}>{p.portfolio_name}</option>
            ))}
          </FormSelect>
          <FormInput label="Amount" type="number" step={100} placeholder="0"
            value={withdrawForm.amount}
            onChange={(e) => setWithdrawForm((prev) => ({ ...prev, amount: e.target.value }))} />
          <FormInput label="Date" type="date" value={withdrawForm.date}
            onChange={(e) => setWithdrawForm((prev) => ({ ...prev, date: e.target.value }))} />
        </ModalShell>
      )}
    </div>
  );
}

function ModalShell({ title, onClose, onSubmit, submitting, modalErr, children }: {
  title: string; onClose: () => void; onSubmit: () => void; submitting: boolean; modalErr: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-canvas rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-[420px] mx-4 p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-ink m-0">{title}</h3>
          <button onClick={onClose} className="bg-none border-none cursor-pointer p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {children}
        </div>

        {modalErr && <p className="text-error text-xs mt-3">{modalErr}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} loading={submitting}>Confirm {title}</Button>
        </div>
      </div>
    </div>
  );
}

function FormSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate uppercase tracking-widest mb-1.5 block">{label}</label>
      <select value={value} onChange={onChange}
        className="w-full px-3.5 py-2.5 border border-hairline rounded-[10px] text-[13px] bg-canvas">
        {children}
      </select>
    </div>
  );
}

function FormInput({ label, type, step, placeholder, value, onChange }: {
  label: string; type: string; step?: number; placeholder?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate uppercase tracking-widest mb-1.5 block">{label}</label>
      <input type={type} step={step} placeholder={placeholder}
        value={value} onChange={onChange}
        className="w-full px-3.5 py-2.5 border border-hairline rounded-[10px] text-[13px]" />
    </div>
  );
}
