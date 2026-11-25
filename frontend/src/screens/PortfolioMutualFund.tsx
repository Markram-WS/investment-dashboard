import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  FundPortfolio, MFHolding, MFOrder, MFHistory, MFSetting,
  MFRebalanceRecommendation, MFAlert, MFOrderCreate, MFOrderUpdate,
} from "../types";
import IconButton from "../components/IconButton";
import MFRebalanceRecommendModal from "./MFRebalanceRecommendModal";
import MFCreateOrderModal from "./MFCreateOrderModal";
import MFEditOrderModal from "./MFEditOrderModal";
import MFSellHoldingModal from "./MFSellHoldingModal";
import MFEditPortfolioModal from "./MFEditPortfolioModal";
import PageLayout from "../components/PageLayout";
import PortfolioHeader from "./components/PortfolioHeader";
import { useNotification } from "../contexts/NotificationContext";
import { apiErrorDetail } from "./components/apiError";
import { formatDate, formatMoney, formatPct } from "../utils/format";

interface ManagedFundProps {
  portfolioId?: string;
}

const historyDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

/** `23/11/26` — fixed day/month/year, independent of the host locale/calendar. */
function formatHistoryDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : historyDateFormatter.format(d);
}

/** Sign colour for a P/L figure: ink-positive, danger-negative, slate at zero. */
const plClass = (value: number) =>
  value > 0 ? "at-pos" : value < 0 ? "at-neg" : "at-muted";

function PctBadge({ value }: { value: number }) {
  return (
    <span className={plClass(value)} style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatPct(value)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="mf-status" data-status={status}>
      {status}
    </span>
  );
}

function SideBadge({ side }: { side: string }) {
  return (
    <span className="mf-side" data-side={side}>
      {side}
    </span>
  );
}

export default function ManagedFund({ portfolioId }: ManagedFundProps) {
  // The explicit prop (analytics embed) wins; the route param is the normal
  // standalone path; "1" keeps the historical default for a bare mount.
  const { portfolioId: routePortfolioId } = useParams<{ portfolioId: string }>();
  const resolvedId = portfolioId ?? routePortfolioId ?? "1";

  const [portfolio, setPortfolio] = useState<FundPortfolio | null>(null);
  const [holdings, setHoldings] = useState<MFHolding[]>([]);
  const [orders, setOrders] = useState<MFOrder[]>([]);
  const [history, setHistory] = useState<MFHistory[]>([]);
  const [settings, setSettings] = useState<MFSetting | null>(null);
  const [alerts, setAlerts] = useState<MFAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const [showEditModal, setShowEditModal] = useState(false);
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const [editOrderTarget, setEditOrderTarget] = useState<MFOrder | null>(null);
  const [showSellHolding, setShowSellHolding] = useState(false);
  const [sellHoldingTarget, setSellHoldingTarget] = useState<MFHolding | null>(null);
  const [rebalanceRecs, setRebalanceRecs] = useState<MFRebalanceRecommendation[]>([]);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { notify } = useNotification();


  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const pid = parseInt(resolvedId);
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
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to load managed fund data:", err);
      setError("Failed to load portfolio data");
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCalculateRebalance = async () => {
    setRebalanceLoading(true);
    setShowRebalanceModal(true);
    try {
      const res = await api.mfCalculateRebalance(parseInt(resolvedId));
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
      await api.mfCreateOrder(parseInt(resolvedId), {
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
    await api.mfCreateOrder(parseInt(resolvedId), data);
    setShowCreateOrder(false);
    await fetchData();
  };

  const handleEditOrder = async (orderId: number, data: MFOrderUpdate) => {
    await api.mfUpdateOrder(parseInt(resolvedId), orderId, data);
    setShowEditOrder(false);
    setEditOrderTarget(null);
    await fetchData();
  };

  const handleConfirmOrder = async (orderId: number) => {
    await api.mfConfirmOrder(parseInt(resolvedId), orderId);
    await fetchData();
  };

  const handleCancelOrder = async (orderId: number) => {
    await api.mfCancelOrder(parseInt(resolvedId), orderId);
    await fetchData();
  };

  const handleSellHolding = async (holdingId: number, qty: number, price: number) => {
    await api.mfSellHolding(parseInt(resolvedId), holdingId, { qty, price });
    setShowSellHolding(false);
    setSellHoldingTarget(null);
    await fetchData();
  };

  const handleSyncPrices = async () => {
    setSyncing(true);
    try {
      const result = await api.mfSyncPrices(parseInt(resolvedId));
      await fetchData();
      if (result.total === 0) {
        notify("No holdings to price", "success");
      } else {
        const parts: string[] = [];
        if (result.missing.length > 0) {
          parts.push(
            `not in the registry: ${result.missing.join(", ")} — add them from All Assets → Sync from orders`,
          );
        }
        if (result.failed.length > 0) {
          parts.push(
            `price not refreshed: ${result.failed.join(", ")} — check the quote in All Assets`,
          );
        }
        const prefix = `Synced ${result.synced} of ${result.total} prices`;
        if (parts.length === 0) {
          notify(prefix, "success");
        } else {
          notify(`${prefix} · ${parts.join(" · ")}`, "warning");
        }
      }
    } catch (e) {
      console.error("Failed to sync managed fund prices", e);
      notify(apiErrorDetail(e, "Couldn't sync prices"), "warning");
    } finally {
      setSyncing(false);
    }
  };

  const totalPl = holdings.reduce((s, h) => s + (h.unrealized_pl || 0), 0);
  const totalInvested = holdings.reduce((s, h) => s + (h.avg_entry_price * h.qty), 0);
  const totalPlPct = totalInvested > 0 ? (totalPl / totalInvested) * 100 : 0;

  // --- loading: the same shell, with pulse blocks where the data goes ---------
  if (loading) {
    return (
      <PageLayout>
        <div className="at-page" aria-busy="true">
          <div className="at-head animate-pulse">
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div className="mf-skel" style={{ width: 130, height: 9 }} />
              <div className="mf-skel" style={{ width: 230, height: 22 }} />
            </div>
            <div className="at-head-meta" style={{ gap: 8 }}>
              <div className="mf-skel" style={{ width: 74, height: 18, borderRadius: 999 }} />
              <div className="mf-skel" style={{ width: 98, height: 22, borderRadius: 999 }} />
              <div className="mf-skel" style={{ width: 66, height: 22, borderRadius: 999 }} />
            </div>
          </div>
          <div className="at-card mf-rail animate-pulse" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div className="mf-kpi" key={i}>
                <div className="mf-skel" style={{ width: "42%", height: 9 }} />
                <div className="mf-skel" style={{ width: "70%", height: 18, marginTop: 7 }} />
              </div>
            ))}
          </div>
          <div className="mf-workspace animate-pulse" aria-hidden="true">
            <div className="mf-col">
              <div className="at-card mf-card" style={{ height: 214 }}>
                <div className="mf-skel" style={{ width: 84, height: 10 }} />
                {[0, 1, 2, 3, 4].map((i) => (
                  <div className="mf-skel" key={i} style={{ height: 8, marginTop: 15 }} />
                ))}
              </div>
              <div className="at-card mf-card" style={{ height: 166 }}>
                <div className="mf-skel" style={{ width: 108, height: 10 }} />
                {[0, 1, 2, 3].map((i) => (
                  <div className="mf-skel" key={i} style={{ height: 8, marginTop: 15 }} />
                ))}
              </div>
            </div>
            <div className="mf-col">
              <div className="at-card mf-card" style={{ height: 118 }}>
                <div className="mf-skel" style={{ width: 72, height: 10 }} />
                {[0, 1].map((i) => (
                  <div className="mf-skel" key={i} style={{ height: 8, marginTop: 15 }} />
                ))}
              </div>
              <div className="at-card mf-card" style={{ height: 118 }}>
                <div className="mf-skel" style={{ width: 92, height: 10 }} />
                {[0, 1].map((i) => (
                  <div className="mf-skel" key={i} style={{ height: 8, marginTop: 15 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error && !portfolio) {
    return (
      <PageLayout>
        <div className="at-page">
          <div className="at-head">
            <div style={{ minWidth: 0 }}>
              <div className="at-crumb">Portfolios</div>
              <h1 className="at-h1">Managed Fund</h1>
            </div>
          </div>
          <div className="at-card mf-state">
            <p className="mf-state-title">Portfolio didn't load</p>
            <p className="mf-state-text">The server could not return this managed fund. Refresh to try again.</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!portfolio) {
    return (
      <PageLayout>
        <div className="at-page">
          <div className="at-head">
            <div style={{ minWidth: 0 }}>
              <div className="at-crumb">Portfolios</div>
              <h1 className="at-h1">Managed Fund</h1>
            </div>
          </div>
          <div className="at-card mf-state">
            <p className="mf-state-title">No managed fund here</p>
            <p className="mf-state-text">This portfolio has no fund data yet.</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  const targetCount = settings?.target_ratio ? Object.keys(settings.target_ratio).length : 0;
  const lastRebalance = portfolio.last_rebalance_date ?? settings?.last_rebalance_date ?? null;

  return (
    <PageLayout>
      <div className="at-page">
        <PortfolioHeader
          portfolioName={portfolio.portfolio_name}
          portType={portfolio.port_type || "Managed Fund"}
          lastUpdated={lastUpdated}
          onRefresh={fetchData}
          onEditPortfolio={() => setShowEditModal(true)}
          extraActions={
            <button type="button" className="at-btn" onClick={handleCalculateRebalance}>
              Rebalance
            </button>
          }
        />

        {/* KPI rail: four compact figures on one 84px band. */}
        <section className="at-card mf-rail" aria-label="Fund summary">
          <div className="mf-kpi">
            <p className="mf-kpi-k">Current NAV</p>
            <p className="mf-kpi-v">{formatMoney(portfolio.current_nav || 0)}</p>
            <p className="mf-kpi-foot">
              {portfolio.risk_status ? `Risk ${portfolio.risk_status}` : "Net asset value"}
            </p>
          </div>
          <div className="mf-kpi">
            <p className="mf-kpi-k">Available cash</p>
            <p className="mf-kpi-v">{formatMoney(portfolio.available_cash || 0)}</p>
            <p className="mf-kpi-foot">
              {(portfolio.cash_buffer_limit || 0) > 0
                ? `Buffer ${formatMoney(portfolio.cash_buffer_limit)}`
                : "No buffer set"}
            </p>
          </div>
          <div className="mf-kpi">
            <p className="mf-kpi-k">Total invested</p>
            <p className="mf-kpi-v">{formatMoney(totalInvested)}</p>
            <p className="mf-kpi-foot">
              {holdings.length} {holdings.length === 1 ? "holding" : "holdings"}
            </p>
          </div>
          <div className="mf-kpi">
            <p className="mf-kpi-k">Unrealized P/L</p>
            <p className={`mf-kpi-v ${plClass(totalPl)}`}>
              {totalPl > 0 ? "+" : ""}{formatMoney(totalPl)}
            </p>
            <p className="mf-kpi-foot">
              {totalInvested > 0 ? `${formatPct(totalPlPct)} on invested` : "No open positions"}
            </p>
          </div>
        </section>

        <div className="mf-workspace">
          <div className="mf-col">
            {/* Asset list (holdings) */}
            <section className="at-card mf-card mf-holdings" aria-label="Asset list">
              <header className="mf-card-h">
                <h2>Asset list</h2>
                <span className="at-count">{holdings.length}</span>
                <button
                  type="button"
                  className="at-btn-ghost"
                  onClick={handleSyncPrices}
                  disabled={syncing}
                  title="Refresh every holding's price from the asset registry"
                >
                  {syncing ? "Syncing…" : "Sync prices"}
                </button>
                <button type="button" className="at-btn-ghost" onClick={fetchData}>
                  Refresh
                </button>
              </header>
              {holdings.length === 0 ? (
                <p className="mf-empty" data-testid="holdings-empty">
                  No holdings yet.
                </p>
              ) : (
                <div className="mf-rows">
                  <div className="mf-head" aria-hidden="true">
                    <span>Asset</span>
                    <span className="at-num">Qty</span>
                    <span className="at-num">Entry</span>
                    <span className="at-num">Current</span>
                    <span className="at-num">Market value</span>
                    <span className="at-num">P/L</span>
                    <span className="at-num">P/L %</span>
                    <span className="at-num">Sell</span>
                  </div>
                  {holdings.map((h) => (
                    <div className="mf-row" key={h.holding_id}>
                      <span className="mf-ticker" title={h.asset}>{h.asset}</span>
                      <span className="at-num">{h.qty.toFixed(4)}</span>
                      <span className="at-num">{formatMoney(h.avg_entry_price)}</span>
                      <span className="at-num">{formatMoney(h.current_price)}</span>
                      <span className="at-num">{formatMoney(h.market_value)}</span>
                      <span className={`at-num ${plClass(h.unrealized_pl)}`}>
                        {h.unrealized_pl > 0 ? "+" : ""}{formatMoney(h.unrealized_pl)}
                      </span>
                      <span className="at-num"><PctBadge value={h.unrealized_pl_pct} /></span>
                      <div className="mf-actions">
                        <IconButton
                          label="Sell all"
                          danger
                          onClick={() => { setSellHoldingTarget(h); setShowSellHolding(true); }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="7 13 12 18 17 13" /><path d="M12 18V2" /><path d="M3 22h18" />
                          </svg>
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Order in progress */}
            <section className="at-card mf-card mf-orders" aria-label="Order in progress">
              <header className="mf-card-h">
                <h2>Order in progress</h2>
                <span className="at-count">{orders.length}</span>
                <button type="button" className="at-btn-ghost" onClick={() => setShowCreateOrder(true)}>
                  Add order
                </button>
              </header>
              {orders.length === 0 ? (
                <p className="mf-empty">No orders in progress.</p>
              ) : (
                <div className="mf-rows">
                  <div className="mf-head" aria-hidden="true">
                    <span>Asset</span>
                    <span>Side</span>
                    <span className="at-num">Qty</span>
                    <span className="at-num">Price</span>
                    <span>Status</span>
                    <span className="at-num">Actions</span>
                  </div>
                  {orders.map((o) => (
                    <div className="mf-row" key={o.order_id}>
                      <span className="mf-ticker" title={o.asset}>{o.asset}</span>
                      <span><SideBadge side={o.side} /></span>
                      <span className="at-num">{o.qty.toFixed(4)}</span>
                      <span className="at-num">{o.price != null ? formatMoney(o.price) : "—"}</span>
                      <span><StatusBadge status={o.status} /></span>
                      <div className="mf-actions">
                        <IconButton label="Edit" onClick={() => { setEditOrderTarget(o); setShowEditOrder(true); }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </IconButton>
                        <IconButton label="Cancel" danger onClick={() => handleCancelOrder(o.order_id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </IconButton>
                        <IconButton label="Confirm Done" success onClick={() => handleConfirmOrder(o.order_id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="mf-col">
            {/* Rebalance */}
            <section className="at-card mf-card" aria-label="Rebalance">
              <header className="mf-card-h">
                <h2>Rebalance</h2>
                {targetCount > 0 && <span className="at-count">{targetCount} targets</span>}
              </header>
              <div className="mf-kv">
                <div>
                  <span>Last rebalanced</span>
                  <span>{lastRebalance ? formatDate(lastRebalance) : "Never"}</span>
                </div>
              </div>
              <button type="button" className="at-btn mf-rebalance-btn" onClick={handleCalculateRebalance}>
                Rebalance
              </button>
            </section>

            {/* Alerts: only when the fund reports one. */}
            {alerts.length > 0 && (
              <section className="at-card mf-card" aria-label="Alerts">
                <header className="mf-card-h">
                  <h2>Alerts</h2>
                  <span className="at-count">{alerts.length}</span>
                </header>
                {alerts.map((a, i) => (
                  <div className="mf-alert" key={i} title={a.message}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>{a.message}</span>
                  </div>
                ))}
              </section>
            )}

            {/* Order history */}
            <section className="at-card mf-card mf-history" aria-label="Order history">
              <header className="mf-card-h">
                <h2>Order history</h2>
                <span className="at-count">{history.length}</span>
              </header>
              {history.length === 0 ? (
                <p className="mf-empty">No order history yet.</p>
              ) : (
                <div className="mf-rows">
                  <div className="mf-head" aria-hidden="true">
                    <span>Asset</span>
                    <span>Side</span>
                    <span className="at-num">Qty</span>
                    <span className="at-num">Price</span>
                    <span>Status</span>
                    <span className="at-num">Date</span>
                  </div>
                  {history.map((h) => (
                    <div className="mf-row" key={h.history_id}>
                      <span className="mf-ticker" title={h.asset}>{h.asset}</span>
                      <span><SideBadge side={h.side} /></span>
                      <span className="at-num">{h.qty.toFixed(4)}</span>
                      <span className="at-num">{h.price != null ? formatMoney(h.price) : "—"}</span>
                      <span><StatusBadge status={h.status} /></span>
                      <span className="at-num at-muted">
                        {formatHistoryDate(h.executed_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MFEditPortfolioModal
        portfolioId={parseInt(resolvedId)}
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
