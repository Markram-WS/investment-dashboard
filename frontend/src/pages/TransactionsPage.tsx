import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Transaction } from "../types";
import { formatCurrency, formatDate } from "../utils/format";
import Button from "../screens/components/Button";

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
      default: return { label: type, color: "text-gray-500 bg-gray-50" };
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ color: 'var(--color-slate)' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      {toastMsg && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: '#0fbcb0', color: 'white', padding: '12px 24px', borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 14, fontWeight: 600,
        }}>
          {toastMsg}
          <button onClick={() => setToastMsg(null)} style={{ marginLeft: 16, background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }} className="animate-fade-up">
        <h1 style={{ fontSize: 48, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.04em', margin: 0 }}>
          Transactions
        </h1>
      </header>

      {/* Hero Card: Action Section */}
      <section style={{ marginBottom: 24 }} className="animate-fade-up stagger-1">
        <div style={{
          background: 'var(--color-teal-light)', border: '1px solid rgba(224,226,232,0.3)',
          borderRadius: 28, padding: 32, boxShadow: 'var(--shadow-sm)',
        }}>
          <p style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>New Transaction</p>
          <div style={{ display: 'flex', gap: 16 }}>
            <Button variant="primary" onClick={() => openModal("transfer")}>Transfer</Button>
            <Button variant="primary" onClick={() => openModal("deposit")}>Deposit</Button>
            <Button variant="primary" onClick={() => openModal("withdraw")}>Withdraw</Button>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <section style={{
        background: 'white', border: '1px solid var(--color-hairline)', borderRadius: 28, padding: 24,
        boxShadow: 'var(--shadow-sm)', marginBottom: 24,
      }} className="animate-fade-up stagger-2">
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'block' }}>Date Range</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={filters.dateRange.start}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, start: e.target.value } }))}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-hairline)', borderRadius: 8, fontSize: 13 }}
              />
              <input type="date" value={filters.dateRange.end}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: { ...prev.dateRange, end: e.target.value } }))}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-hairline)', borderRadius: 8, fontSize: 13 }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'block' }}>Type Filter</label>
            <select value={filters.type}
              onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-hairline)', borderRadius: 8, fontSize: 13, background: 'white' }}
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

      {/* Transaction Table */}
      <section style={{
        background: 'white', border: '1px solid var(--color-hairline)', borderRadius: 28,
        boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
      }} className="animate-fade-up stagger-3">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface)' }}>
                {["Date", "Type", "Asset", "Amount", "Flow (Source → Destination)", "Executed By", "Status"].map((h) => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-slate)', fontSize: 14 }}>
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, index) => {
                  const typeStyle = getTransactionType(tx.type);
                  return (
                    <tr key={tx.history_id ?? tx.transaction_id ?? index}
                      style={{ borderTop: '1px solid var(--color-hairline)', transition: 'background 0.15s' }}
                      className="hover:bg-teal-50"
                    >
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--color-ink)' }}>
                        {formatDate(tx.entry_date)}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeStyle.color}`}>
                          {typeStyle.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--color-ink)' }}>
                        {tx.asset || "-"}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--color-ink)' }}>
                        {tx.amount != null ? fmtCurrency(tx.amount) : "-"}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--color-ink)' }}>
                        {tx.flow || "-"}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: tx.executed_by === "AI" ? 'var(--color-brand-teal)' : tx.executed_by === "Bot" ? 'var(--color-brand-yellow)' : 'var(--color-ink)',
                          }} />
                          <span style={{ fontSize: 13, color: 'var(--color-ink)' }}>{tx.executed_by || "-"}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--color-ink)' }}>
                        {tx.executed_by === "AI" ? (
                          <span style={{ color: 'var(--color-brand-teal)' }}>Completed</span>
                        ) : tx.type === "Transfer" ? (
                          <span style={{ color: 'var(--color-brand-blue)' }}>Completed</span>
                        ) : (
                          <span style={{ color: 'var(--color-slate)' }}>Done</span>
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
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{ background: 'white', borderRadius: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: '100%', maxWidth: 420, margin: 16, padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>Transfer</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>From Portfolio</label>
                <select value={transferForm.sourcePortfolioId}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, sourcePortfolioId: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-hairline)', borderRadius: 10, fontSize: 13, background: 'white' }}
                >
                  <option value="">Select source</option>
                  {portfolios.map((p) => (
                    <option key={p.portfolio_id} value={p.portfolio_id}>{p.portfolio_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>To Portfolio</label>
                <select value={transferForm.destPortfolioId}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, destPortfolioId: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-hairline)', borderRadius: 10, fontSize: 13, background: 'white' }}
                >
                  <option value="">Select destination</option>
                  {portfolios.map((p) => (
                    <option key={p.portfolio_id} value={p.portfolio_id} disabled={p.portfolio_id === parseInt(transferForm.sourcePortfolioId)}>{p.portfolio_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Amount</label>
                <input type="number" step={100} placeholder="0"
                  value={transferForm.amount} onChange={(e) => setTransferForm((prev) => ({ ...prev, amount: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-hairline)', borderRadius: 10, fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Date</label>
                <input type="date" value={transferForm.date}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, date: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-hairline)', borderRadius: 10, fontSize: 13 }}
                />
              </div>
            </div>

            {modalErr && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 12 }}>{modalErr}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button variant="primary" onClick={handleTransfer} loading={submitting}>Confirm Transfer</Button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {activeModal === "deposit" && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{ background: 'white', borderRadius: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: '100%', maxWidth: 420, margin: 16, padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>Deposit</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Portfolio</label>
                <select value={depositForm.portfolioId}
                  onChange={(e) => setDepositForm((prev) => ({ ...prev, portfolioId: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-hairline)', borderRadius: 10, fontSize: 13, background: 'white' }}
                >
                  <option value="">Select portfolio</option>
                  {portfolios.map((p) => (
                    <option key={p.portfolio_id} value={p.portfolio_id}>{p.portfolio_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Amount</label>
                <input type="number" step={100} placeholder="0"
                  value={depositForm.amount} onChange={(e) => setDepositForm((prev) => ({ ...prev, amount: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-hairline)', borderRadius: 10, fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Date</label>
                <input type="date" value={depositForm.date}
                  onChange={(e) => setDepositForm((prev) => ({ ...prev, date: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-hairline)', borderRadius: 10, fontSize: 13 }}
                />
              </div>
            </div>

            {modalErr && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 12 }}>{modalErr}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button variant="primary" onClick={handleDeposit} loading={submitting}>Confirm Deposit</Button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {activeModal === "withdraw" && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{ background: 'white', borderRadius: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: '100%', maxWidth: 420, margin: 16, padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>Withdraw</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Portfolio</label>
                <select value={withdrawForm.portfolioId}
                  onChange={(e) => setWithdrawForm((prev) => ({ ...prev, portfolioId: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-hairline)', borderRadius: 10, fontSize: 13, background: 'white' }}
                >
                  <option value="">Select portfolio</option>
                  {portfolios.map((p) => (
                    <option key={p.portfolio_id} value={p.portfolio_id}>{p.portfolio_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Amount</label>
                <input type="number" step={100} placeholder="0"
                  value={withdrawForm.amount} onChange={(e) => setWithdrawForm((prev) => ({ ...prev, amount: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-hairline)', borderRadius: 10, fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Date</label>
                <input type="date" value={withdrawForm.date}
                  onChange={(e) => setWithdrawForm((prev) => ({ ...prev, date: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-hairline)', borderRadius: 10, fontSize: 13 }}
                />
              </div>
            </div>

            {modalErr && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 12 }}>{modalErr}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button variant="primary" onClick={handleWithdraw} loading={submitting}>Confirm Withdraw</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
