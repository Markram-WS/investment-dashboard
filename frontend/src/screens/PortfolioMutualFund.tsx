import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
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
import PageLayout from "../components/PageLayout";
import PageHeader from "../components/PageHeader";

interface ManagedFundProps {
  portfolioId?: string;
}

const panelStyle: CSSProperties = {
  background: "var(--color-canvas)",
  borderRadius: 16,
  padding: "20px 24px",
};

const panelHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  paddingBottom: 12,
  borderBottom: "1px solid var(--color-hairline)",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--color-slate)",
  margin: 0,
};

const panelActionStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-ink)",
  border: "1px solid var(--color-hairline)",
  borderRadius: 999,
  padding: "5px 12px",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
};

const statValueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-ink)",
  margin: "4px 0 0",
};

const thStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--color-slate)",
  whiteSpace: "nowrap",
};

function PctBadge({ value }: { value: number }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        color: value >= 0 ? "var(--color-positive-text)" : "var(--color-danger-text)",
      }}
    >
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "done"
      ? "var(--color-positive-text)"
      : status === "cancelled"
        ? "var(--color-danger-text)"
        : "var(--color-status-warning)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: "var(--color-surface)",
        fontSize: 11,
        fontWeight: 600,
        color,
      }}
    >
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
      <PageLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface rounded w-64" />
          <div className="h-32 bg-surface rounded-xl" />
          <div className="h-48 bg-surface rounded-xl" />
          <div className="h-48 bg-surface rounded-xl" />
        </div>
      </PageLayout>
    );
  }

  if (error && !portfolio) {
    return (
      <PageLayout>
        <div style={panelStyle}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3, color: "var(--color-ink)", margin: "0 0 8px" }}>
            Error loading portfolio
          </h2>
          <p style={{ fontSize: 15, color: "var(--color-danger-text)", margin: 0 }}>{error}</p>
        </div>
      </PageLayout>
    );
  }

  if (!portfolio) {
    return (
      <PageLayout>
        <div style={{ ...panelStyle, textAlign: "center" }}>
          <p style={{ fontSize: 15, color: "var(--color-slate)", margin: 0 }}>No portfolio data available</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div
        className="flex items-center gap-2 mb-2"
        style={{ fontSize: 12, fontWeight: 500, color: "var(--color-slate)" }}
      >
        <Link
          to="/"
          className="no-underline transition-colors hover:text-ink"
          style={{ color: "var(--color-slate)" }}
        >
          Portfolios
        </Link>
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ color: "var(--color-ink)" }}>{portfolio.portfolio_name}</span>
      </div>
      <PageHeader
        title={portfolio.portfolio_name}
        meta={
          <>
            <span className="px-3 py-1 rounded-full bg-teal-light text-brand-teal" style={{ fontSize: 12, fontWeight: 500 }}>
              Managed Fund
            </span>
            {portfolio.last_rebalance_date && (
              <span className="text-slate" style={{ fontSize: 12 }}>Last rebalanced: {portfolio.last_rebalance_date}</span>
            )}
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
          </>
        }
      />

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2" style={{ marginBottom: 48 }}>
          {alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-2"
              style={{ background: "var(--color-coral-light)", borderRadius: 12, padding: "12px 16px" }}
            >
              <svg className="w-5 h-5 text-brand-coral shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-danger-text)" }}>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ marginBottom: 48 }}>
        <div style={{ background: "var(--color-teal-light)", borderRadius: 16, padding: 20 }}>
          <p style={sectionLabelStyle}>Current NAV</p>
          <p style={statValueStyle}>${(portfolio.current_nav || 0).toLocaleString()}</p>
        </div>
        <div style={{ background: "var(--color-canvas)", borderRadius: 16, padding: 20 }}>
          <p style={sectionLabelStyle}>Available cash</p>
          <p style={statValueStyle}>${(portfolio.available_cash || 0).toLocaleString()}</p>
        </div>
        <div style={{ background: "var(--color-canvas)", borderRadius: 16, padding: 20 }}>
          <p style={sectionLabelStyle}>Total invested</p>
          <p style={statValueStyle}>${totalInvested.toLocaleString()}</p>
        </div>
        <div style={{ background: "var(--color-canvas)", borderRadius: 16, padding: 20 }}>
          <p style={sectionLabelStyle}>Unrealized P/L</p>
          <p style={{ ...statValueStyle, color: totalPl >= 0 ? "var(--color-positive-text)" : "var(--color-danger-text)" }}>
            ${totalPl >= 0 ? "+" : ""}{totalPl.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Asset List */}
      <section style={{ ...panelStyle, marginBottom: 48 }}>
        <div style={panelHeadStyle}>
          <h3 style={sectionLabelStyle}>Asset list (holdings)</h3>
          <button
            type="button"
            onClick={fetchData}
            className="transition-colors hover:bg-surface"
            style={panelActionStyle}
          >
            Refresh
          </button>
        </div>
        {holdings.length === 0 ? (
          <div style={{ padding: "32px 0 12px", textAlign: "center", fontSize: 15, color: "var(--color-slate)" }}>
            No holdings yet. Create an order to get started.
          </div>
        ) : (
          <table className="w-full" style={{ fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="border-b border-hairline">
                <th className="text-left px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Asset</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Qty</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Entry price</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Current price</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Market value</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>P/L</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>P/L %</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.holding_id} className="border-b border-hairline hover:bg-surface transition-colors">
                  <td className="px-3 py-3 first:pl-0 last:pr-0 font-semibold text-ink">{h.asset}</td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right">{h.qty.toFixed(4)}</td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right">${h.avg_entry_price.toFixed(2)}</td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right">${h.current_price.toFixed(2)}</td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right">${h.market_value.toLocaleString()}</td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right font-medium" style={{ color: h.unrealized_pl >= 0 ? "var(--color-positive-text)" : "var(--color-danger-text)" }}>
                    ${h.unrealized_pl >= 0 ? "+" : ""}{h.unrealized_pl.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right"><PctBadge value={h.unrealized_pl_pct} /></td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right">
                    <button
                      onClick={() => { setSellHoldingTarget(h); setShowSellHolding(true); }}
                      className="text-brand-coral hover:underline"
                      style={{ fontSize: 12, fontWeight: 600 }}
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
      </section>

      {/* Order in Progress */}
      <section style={{ ...panelStyle, marginBottom: 48 }}>
        <div style={panelHeadStyle}>
          <h3 style={sectionLabelStyle}>Order in progress</h3>
          <button
            type="button"
            onClick={() => setShowCreateOrder(true)}
            className="transition-colors hover:bg-surface"
            style={panelActionStyle}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Order
          </button>
        </div>
        {orders.length === 0 ? (
          <div style={{ padding: "32px 0 12px", textAlign: "center", fontSize: 15, color: "var(--color-slate)" }}>
            No orders in progress
          </div>
        ) : (
          <table className="w-full" style={{ fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="border-b border-hairline">
                <th className="text-left px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Asset</th>
                <th className="text-left px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Side</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Qty</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Price</th>
                <th className="text-center px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Status</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id} className="border-b border-hairline hover:bg-surface transition-colors">
                  <td className="px-3 py-3 first:pl-0 last:pr-0 font-semibold text-ink">{o.asset}</td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0">
                    <span className={`px-2 py-0.5 rounded ${o.side === "Buy" ? "bg-teal-light text-brand-teal" : "bg-coral-light text-brand-coral"}`} style={{ fontSize: 11, fontWeight: 600 }}>
                      {o.side}
                    </span>
                  </td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right">{o.qty.toFixed(4)}</td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right">${o.price?.toFixed(2) || "—"}</td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-center"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right">
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
                        className="p-1.5 rounded hover:bg-surface text-slate hover:text-error transition-colors"
                        title="Cancel">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                      <button onClick={() => handleConfirmOrder(o.order_id)}
                        className="p-1.5 rounded hover:bg-surface text-slate hover:text-success transition-colors"
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
      </section>

      {/* Order History */}
      <section style={panelStyle}>
        <div style={panelHeadStyle}>
          <h3 style={sectionLabelStyle}>Order history</h3>
        </div>
        {history.length === 0 ? (
          <div style={{ padding: "32px 0 12px", textAlign: "center", fontSize: 15, color: "var(--color-slate)" }}>
            No order history yet
          </div>
        ) : (
          <table className="w-full" style={{ fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="border-b border-hairline">
                <th className="text-left px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Asset</th>
                <th className="text-left px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Side</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Qty</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Price</th>
                <th className="text-center px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Result</th>
                <th className="text-right px-3 py-3 first:pl-0 last:pr-0" style={thStyle}>Executed</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.history_id} className="border-b border-hairline hover:bg-surface transition-colors">
                  <td className="px-3 py-3 first:pl-0 last:pr-0 font-semibold text-ink">{h.asset}</td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0">
                    <span className={`px-2 py-0.5 rounded ${h.side === "Buy" ? "bg-teal-light text-brand-teal" : "bg-coral-light text-brand-coral"}`} style={{ fontSize: 11, fontWeight: 600 }}>
                      {h.side}
                    </span>
                  </td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right">{h.qty.toFixed(4)}</td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right">${h.price?.toFixed(2) || "—"}</td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-center"><StatusBadge status={h.status} /></td>
                  <td className="px-3 py-3 first:pl-0 last:pr-0 text-right text-slate" style={{ fontSize: 12 }}>
                    {h.executed_at ? new Date(h.executed_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Modals */}
      <MFEditPortfolioModal
        portfolioId={parseInt(portfolioId)}
        portfolio={{
          portfolio_name: portfolio.portfolio_name,
          available_cash: portfolio.available_cash || 0,
          margin_locked: portfolio.margin_locked || 0,
          cash_buffer_limit: portfolio.cash_buffer_limit || 0,
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
    </PageLayout>
  );
}
