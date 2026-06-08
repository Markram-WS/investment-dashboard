import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import {
  FundPortfolio, MFHolding, MFOrder, MFHistory, MFSetting,
  MFRebalanceRecommendation, MFAlert, MFOrderCreate, MFOrderUpdate,
} from "../types";
import Button from "./components/Button";
import MFRebalanceRecommendModal from "./MFRebalanceRecommendModal";
import MFCreateOrderModal from "./MFCreateOrderModal";
import MFEditOrderModal from "./MFEditOrderModal";
import MFSellHoldingModal from "./MFSellHoldingModal";
import MFEditPortfolioModal from "./MFEditPortfolioModal";

interface ManagedFundProps {
  portfolioId?: string;
}

function PctBadge({ value }: { value: number }) {
  const color = value >= 0 ? "text-success" : "text-error";
  return <span className={`text-xs font-bold ${color}`}>{value >= 0 ? "+" : ""}{value.toFixed(2)}%</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    done: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${map[status] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}

export default function ManagedFund({ portfolioId = "1" }: ManagedFundProps) {
  const [portfolio, setPortfolio] = useState<FundPortfolio | null>(null);
  const [holdings, setHoldings] = useState<MFHolding[]>([]);
  const [orders, setOrders] = useState<MFOrder[]>([]);
  const [history, setHistory] = useState<MFHistory[]>([]);
  const [settings, setSettings] = useState<MFSetting | null>(null);
  const [alerts, setAlerts] = useState<MFAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const [editOrderTarget, setEditOrderTarget] = useState<MFOrder | null>(null);
  const [showSellHolding, setShowSellHolding] = useState(false);
  const [sellHoldingTarget, setSellHoldingTarget] = useState<MFHolding | null>(null);
  const [rebalanceRecs, setRebalanceRecs] = useState<MFRebalanceRecommendation[]>([]);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);


  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const pid = parseInt(portfolioId);
      const [portData, settingsData, holdingsData, ordersData, historyData, alertsData] = await Promise.all([
        api.getPortfolio(pid),
        api.mfSettings(pid),
        api.mfHoldings(pid).catch(() => []),
        api.mfOrders(pid).catch(() => []),
        api.mfHistory(pid).catch(() => []),
        api.mfAlerts(pid).catch(() => ({ alerts: [] })),
      ]);
      setPortfolio(portData);
      setSettings(settingsData);
      setHoldings(holdingsData);
      setOrders(ordersData);
      setHistory(historyData);
      setAlerts(alertsData.alerts || []);
      setError(null);
    } catch (err) {
      console.error("Failed to load managed fund data:", err);
      setError("Failed to load portfolio data");
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCalculateRebalance = async () => {
    setRebalanceLoading(true);
    setShowRebalanceModal(true);
    try {
      const res = await api.mfCalculateRebalance(parseInt(portfolioId));
      setRebalanceRecs(res.recommendations || []);
    } catch (e) {
      console.error("Rebalance calc failed:", e);
      setRebalanceRecs([]);
    } finally {
      setRebalanceLoading(false);
    }
  };

  const handleCreateRebalanceOrders = async (recs: MFRebalanceRecommendation[]) => {
    for (const r of recs) {
      await api.mfCreateOrder(parseInt(portfolioId), {
        asset: r.symbol,
        side: r.side,
        qty: r.qty,
        price: r.estimated_price || null,
        order_type: "rebalance",
      });
    }
    setShowRebalanceModal(false);
    await fetchData();
  };

  const handleCreateOrder = async (data: MFOrderCreate) => {
    await api.mfCreateOrder(parseInt(portfolioId), data);
    setShowCreateOrder(false);
    await fetchData();
  };

  const handleEditOrder = async (orderId: number, data: MFOrderUpdate) => {
    await api.mfUpdateOrder(parseInt(portfolioId), orderId, data);
    setShowEditOrder(false);
    setEditOrderTarget(null);
    await fetchData();
  };

  const handleConfirmOrder = async (orderId: number) => {
    await api.mfConfirmOrder(parseInt(portfolioId), orderId);
    await fetchData();
  };

  const handleCancelOrder = async (orderId: number) => {
    await api.mfCancelOrder(parseInt(portfolioId), orderId);
    await fetchData();
  };

  const handleSellHolding = async (holdingId: number, qty: number, price: number) => {
    await api.mfSellHolding(parseInt(portfolioId), holdingId, { qty, price });
    setShowSellHolding(false);
    setSellHoldingTarget(null);
    await fetchData();
  };

  const totalPl = holdings.reduce((s, h) => s + (h.unrealized_pl || 0), 0);
  const totalInvested = holdings.reduce((s, h) => s + (h.avg_entry_price * h.qty), 0);

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 bg-surface rounded w-64" />
        <div className="h-32 bg-surface rounded-xl" />
        <div className="h-48 bg-surface rounded-xl" />
        <div className="h-48 bg-surface rounded-xl" />
      </div>
    );
  }

  if (error && !portfolio) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-red-700 mb-2">Error Loading Portfolio</h2>
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="p-6">
        <div className="bg-surface rounded-xl border border-hairline p-8 text-center">
          <p className="text-slate">No portfolio data available</p>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-canvas p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[32px] font-semibold text-ink">{portfolio.portfolio_name}</h1>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-teal-light text-brand-teal">
              Managed Fund
            </span>
          </div>
          {portfolio.last_rebalance_date && (
            <p className="text-sm text-slate mt-1">Last rebalanced: {portfolio.last_rebalance_date}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={handleCalculateRebalance}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            Rebalance
          </Button>
          <button onClick={() => setShowEditModal(true)}
            className="p-2 rounded-full hover:bg-surface border border-hairline transition-colors">
            <svg className="w-4 h-4 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 bg-coral-light border border-brand-coral rounded-lg px-4 py-3">
              <svg className="w-5 h-5 text-brand-coral shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span className="text-sm font-medium text-red-800">{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-teal-light rounded-xl p-4">
          <p className="text-xs text-slate uppercase tracking-wider font-bold">Current NAV</p>
          <p className="text-2xl font-bold text-ink mt-1">${(portfolio.current_nav || 0).toLocaleString()}</p>
        </div>
        <div className="bg-surface-soft rounded-xl p-4 border border-hairline">
          <p className="text-xs text-slate uppercase tracking-wider font-bold">Available Cash</p>
          <p className="text-2xl font-bold text-ink mt-1">${(portfolio.available_cash || 0).toLocaleString()}</p>
        </div>
        <div className="bg-surface-soft rounded-xl p-4 border border-hairline">
          <p className="text-xs text-slate uppercase tracking-wider font-bold">Total Invested</p>
          <p className="text-2xl font-bold text-ink mt-1">${totalInvested.toLocaleString()}</p>
        </div>
        <div className="bg-surface-soft rounded-xl p-4 border border-hairline">
          <p className="text-xs text-slate uppercase tracking-wider font-bold">Unrealized P/L</p>
          <p className={`text-2xl font-bold mt-1 ${totalPl >= 0 ? "text-success" : "text-error"}`}>
            ${totalPl >= 0 ? "+" : ""}{totalPl.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tree Table: Asset List */}
      <div className="bg-canvas rounded-xl border border-hairline mb-4 overflow-hidden">
        <div className="px-4 py-3 bg-surface border-b border-hairline flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate">Asset List (Holdings)</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchData}>Refresh</Button>
          </div>
        </div>
        {holdings.length === 0 ? (
          <div className="p-6 text-center text-slate text-sm">No holdings yet. Create an order to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface/50">
                <th className="text-left py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Asset</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Qty</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Entry Price</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Current Price</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Market Value</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">P/L</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">P/L %</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.holding_id} className="border-b border-hairline hover:bg-surface transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-ink">{h.asset}</td>
                  <td className="py-2.5 px-4 text-right">{h.qty.toFixed(4)}</td>
                  <td className="py-2.5 px-4 text-right">${h.avg_entry_price.toFixed(2)}</td>
                  <td className="py-2.5 px-4 text-right">${h.current_price.toFixed(2)}</td>
                  <td className="py-2.5 px-4 text-right">${h.market_value.toLocaleString()}</td>
                  <td className={`py-2.5 px-4 text-right font-medium ${h.unrealized_pl >= 0 ? "text-success" : "text-error"}`}>
                    ${h.unrealized_pl >= 0 ? "+" : ""}{h.unrealized_pl.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right"><PctBadge value={h.unrealized_pl_pct} /></td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => { setSellHoldingTarget(h); setShowSellHolding(true); }}
                      className="text-xs font-bold text-brand-coral hover:underline"
                      title="Sell all"
                    >
                      <svg className="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="7 13 12 18 17 13"/><path d="M12 18V2"/><path d="M3 22h18"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Tree Table: Order in Progress */}
      <div className="bg-canvas rounded-xl border border-hairline mb-4 overflow-hidden">
        <div className="px-4 py-3 bg-surface border-b border-hairline flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate">Order in Progress</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowCreateOrder(true)}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Order
          </Button>
        </div>
        {orders.length === 0 ? (
          <div className="p-6 text-center text-slate text-sm">No orders in progress</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface/50">
                <th className="text-left py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Asset</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Side</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Qty</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Price</th>
                <th className="text-center py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Status</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id} className="border-b border-hairline hover:bg-surface transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-ink">{o.asset}</td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      o.side === "Buy" ? "bg-teal-light text-brand-teal" : "bg-coral-light text-brand-coral"
                    }`}>{o.side}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right">{o.qty.toFixed(4)}</td>
                  <td className="py-2.5 px-4 text-right">${o.price?.toFixed(2) || "—"}</td>
                  <td className="py-2.5 px-4 text-center"><StatusBadge status={o.status} /></td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => { setEditOrderTarget(o); setShowEditOrder(true); }}
                        className="p-1.5 rounded hover:bg-surface text-slate hover:text-ink transition-colors"
                        title="Edit">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleCancelOrder(o.order_id)}
                        className="p-1.5 rounded hover:bg-surface text-slate hover:text-red-500 transition-colors"
                        title="Cancel">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                      <button onClick={() => handleConfirmOrder(o.order_id)}
                        className="p-1.5 rounded hover:bg-surface text-slate hover:text-emerald-600 transition-colors"
                        title="Confirm Done">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Tree Table: Order History */}
      <div className="bg-canvas rounded-xl border border-hairline overflow-hidden">
        <div className="px-4 py-3 bg-surface border-b border-hairline">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate">Order History</h3>
        </div>
        {history.length === 0 ? (
          <div className="p-6 text-center text-slate text-sm">No order history yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface/50">
                <th className="text-left py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Asset</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Side</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Qty</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Price</th>
                <th className="text-center py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Result</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate text-[10px] uppercase tracking-wider">Executed</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.history_id} className="border-b border-hairline hover:bg-surface transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-ink">{h.asset}</td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      h.side === "Buy" ? "bg-teal-light text-brand-teal" : "bg-coral-light text-brand-coral"
                    }`}>{h.side}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right">{h.qty.toFixed(4)}</td>
                  <td className="py-2.5 px-4 text-right">${h.price?.toFixed(2) || "—"}</td>
                  <td className="py-2.5 px-4 text-center"><StatusBadge status={h.status} /></td>
                  <td className="py-2.5 px-4 text-right text-xs text-slate">
                    {h.executed_at ? new Date(h.executed_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <MFEditPortfolioModal
        portfolioId={parseInt(portfolioId)}
        portfolio={{
          portfolio_name: portfolio.portfolio_name,
          available_cash: portfolio.available_cash || 0,
          margin_locked: portfolio.margin_locked || 0,
          cash_buffer_limit: portfolio.cash_buffer_limit || 0,
          money_market: portfolio.money_market || 0,
          tags: portfolio.tags || null,
        }}
        settings={settings}
        holdings={holdings}
        showModal={showEditModal}
        onClose={() => { setShowEditModal(false); fetchData(); }}
        onSaved={fetchData}
      />
      <MFRebalanceRecommendModal
        show={showRebalanceModal}
        loading={rebalanceLoading}
        recommendations={rebalanceRecs}
        onClose={() => { setShowRebalanceModal(false); setRebalanceRecs([]); }}
        onCreateOrders={handleCreateRebalanceOrders}
      />
      <MFCreateOrderModal
        show={showCreateOrder}
        onClose={() => setShowCreateOrder(false)}
        onSave={handleCreateOrder}
      />
      <MFEditOrderModal
        show={showEditOrder}
        order={editOrderTarget}
        onClose={() => { setShowEditOrder(false); setEditOrderTarget(null); }}
        onSave={handleEditOrder}
      />
      <MFSellHoldingModal
        show={showSellHolding}
        holding={sellHoldingTarget}
        onClose={() => { setShowSellHolding(false); setSellHoldingTarget(null); }}
        onConfirm={handleSellHolding}
      />
    </section>
  );
}
