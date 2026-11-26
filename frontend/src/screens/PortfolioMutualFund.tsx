import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { ApiError } from "../lib/api";
import {
  FundPortfolio, MFHolding, MFOrder, MFHistory, MFSetting,
  MFRebalanceRecommendation, MFOrderCreate, MFOrderUpdate, MFAllocationMode,
} from "../types";
import Chevron from "../components/Chevron";
import IconButton from "../components/IconButton";
import MFRebalanceRecommendModal from "./MFRebalanceRecommendModal";
import MFCreateOrderModal from "./MFCreateOrderModal";
import MFEditOrderModal from "./MFEditOrderModal";
import MFSellHoldingModal from "./MFSellHoldingModal";
import MFEditPortfolioModal from "./MFEditPortfolioModal";
import PageLayout from "../components/PageLayout";
import PortfolioHeader from "./components/PortfolioHeader";
import { formatDate, formatMoney, formatPct } from "../utils/format";
import { computeGroupSplit } from "../utils/mfWeights";

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

/**
 * Button reset for a group header: the `.mf-row.mf-group-row` class keeps the
 * grid and the type scale, so the toggle occupies exactly the static header's
 * box instead of the UA button box.
 */
const groupToggle = {
  width: "100%",
  padding: 0,
  borderWidth: 0,
  borderTop: "1px solid var(--color-hairline)",
  background: "var(--color-surface-soft)",
  cursor: "pointer",
  textAlign: "left",
  color: "inherit",
  fontFamily: "inherit",
} as const;

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
  // Group labels whose holdings are folded away; empty means every group is open.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [rebalanceRecs, setRebalanceRecs] = useState<MFRebalanceRecommendation[]>([]);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [rebalanceAllocationBase, setRebalanceAllocationBase] = useState<number | null>(null);
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);


  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const pid = parseInt(resolvedId);
      const [portData, settingsData, holdingsData, ordersData, historyData] = await Promise.all([
        api.getPortfolio(pid),
        api.mfSettings(pid),
        api.mfHoldings(pid).catch(() => []),
        api.mfOrders(pid).catch(() => []),
        api.mfHistory(pid).catch(() => []),
      ]);
      setPortfolio(portData);
      setSettings(settingsData);
      setHoldings(holdingsData);
      setOrders(ordersData);
      setHistory(historyData);
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

  const runRebalanceCalc = useCallback(async (cashTopUp?: number) => {
    setRebalanceLoading(true);
    setRebalanceError(null);
    try {
      const res = await api.mfCalculateRebalance(parseInt(resolvedId), cashTopUp);
      setRebalanceRecs(res.recommendations || []);
      setRebalanceAllocationBase(res.allocation_base ?? null);
    } catch (e) {
      console.error("Rebalance calc failed:", e);
      setRebalanceRecs([]);
      setRebalanceAllocationBase(null);
      const apiError = e as Partial<ApiError> | null;
      const status = typeof apiError?.status === "number" ? apiError.status : null;
      let message = status != null
        ? `Rebalance calculation failed (HTTP ${status})`
        : "Rebalance calculation failed.";
      if (typeof apiError?.body === "string" && apiError.body !== "") {
        try {
          const parsed: unknown = JSON.parse(apiError.body);
          if (parsed !== null && typeof parsed === "object" && "detail" in parsed) {
            const detail = parsed.detail;
            if (typeof detail === "string" && detail.trim() !== "") message = detail;
          }
        } catch {
          // Non-JSON error bodies keep the generic HTTP message.
        }
      }
      setRebalanceError(message);
    } finally {
      setRebalanceLoading(false);
    }
  }, [resolvedId]);

  // The modal debounces top-up edits and asks for a recompute with the new amount.
  const handleRebalanceRecalc = useCallback((cashTopUp: number) => {
    void runRebalanceCalc(cashTopUp);
  }, [runRebalanceCalc]);

  const handleCalculateRebalance = async () => {
    setRebalanceAllocationBase(null);
    setRebalanceError(null);
    setShowRebalanceModal(true);
    await runRebalanceCalc();
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

  const totalPl = holdings.reduce((s, h) => s + (h.unrealized_pl || 0), 0);
  const totalInvested = holdings.reduce((s, h) => s + (h.avg_entry_price * h.qty), 0);

  // Group by the registry underlying (never stored on the holding); a holding
  // with no registry identity lands in a single Unassigned group rendered last.
  const holdingGroups = useMemo(() => {
    const groups = new Map<string, MFHolding[]>();
    for (const holding of holdings) {
      const label = holding.underlying?.trim() || "Unassigned";
      const rows = groups.get(label);
      if (rows) rows.push(holding);
      else groups.set(label, [holding]);
    }
    const ordered = [...groups.entries()].filter(([label]) => label !== "Unassigned");
    const unassigned = groups.get("Unassigned");
    if (unassigned) ordered.push(["Unassigned", unassigned]);
    return ordered.map(([label, rows]) => ({ label, holdings: rows, split: computeGroupSplit(rows) }));
  }, [holdings]);
  const totalPlPct = totalInvested > 0 ? (totalPl / totalInvested) * 100 : 0;

  // Target share per group follows the stored mode: neutral splits equally,
  // weight uses the label-keyed stored percentage (0 when unset).
  const groupCount = holdingGroups.length;
  const activeMode: MFAllocationMode = settings?.allocation_mode === "weight" ? "weight" : "neutral";

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
                    <span>Broker</span>
                    <span>Symbol</span>
                    <span className="at-num">Qty</span>
                    <span className="at-num">Avg. NAV</span>
                    <span className="at-num">Current NAV</span>
                    <span className="at-num">Mkt. val</span>
                    <span className="at-num">P/L</span>
                    <span className="at-num">P/L %</span>
                    <span className="at-num">Sell</span>
                  </div>
                  {holdingGroups.map((group) => {
                    const targetPct = activeMode === "weight"
                      ? (settings?.target_ratio?.[group.label] ?? 0)
                      : (groupCount > 0 ? 100 / groupCount : 0);
                    const collapsed = collapsedGroups.has(group.label);
                    return (
                    <Fragment key={group.label}>
                      <button
                        type="button"
                        className="mf-row mf-group-row"
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
                        onClick={() => setCollapsedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.label)) next.delete(group.label);
                          else next.add(group.label);
                          return next;
                        })}
                        style={groupToggle}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Chevron open={!collapsed} size={12} />
                          {group.label}
                        </span>
                        <span className="mf-group-meta">
                          {targetPct.toFixed(1)}% target share
                        </span>
                      </button>
                      {!collapsed && (
                        <>
                          <div className="mf-split-row" data-testid={`group-split-${group.label}`}>
                            <span className="mf-split-mode">
                              {group.split.mode === "configured" ? "Configured weights" : "Market-value fallback"}
                            </span>
                            {group.split.shares.map(share => (
                              <span key={share.holding_id}>
                                {share.symbol} {share.pct.toFixed(1)}%
                              </span>
                            ))}
                          </div>
                          {group.holdings.map((h) => (
                            <div className="mf-row" key={h.holding_id}>
                              <span className="mf-broker" title={h.broker_id != null ? `Broker #${h.broker_id}` : undefined}>
                                {h.broker_code ?? "—"}
                              </span>
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
                        </>
                      )}
                    </Fragment>
                    );
                  })}
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
                {groupCount > 0 && <span className="at-count">{groupCount} underlyings</span>}
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
        allocationBase={rebalanceAllocationBase}
        error={rebalanceError}
        onRecalculate={handleRebalanceRecalc}
        onClose={() => {
          setShowRebalanceModal(false);
          setRebalanceRecs([]);
          setRebalanceAllocationBase(null);
          setRebalanceError(null);
        }}
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
