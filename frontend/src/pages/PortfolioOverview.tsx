import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDrag, useDrop } from "react-dnd";
import { api } from "../lib/api";
import { PortfolioOverviewItem, OverviewResponse } from "../types";
import { getPortfolioTags, getProfitPct } from "../utils/tags";
import { formatMoney, formatPct } from "../utils/format";
import TransferModal from "../screens/components/TransferModal";
import LiquidityStack from "../screens/components/LiquidityStack";
import Button from "../screens/components/Button";
import { SelectInput, TextInput } from "../screens/components/Field";
import { useNotification } from "../contexts/NotificationContext";
import PageLayout from "../components/PageLayout";
import PageHeader from "../components/PageHeader";

interface DragItem {
  sourcePortfolioId: number;
  sourceName: string;
  maxAmount: number;
}

const labelStyle = {
  margin: 0,
  fontWeight: 500,
  color: "var(--color-slate)",
} as const;

const tabular = { fontVariantNumeric: "tabular-nums" } as const;

/** Above this many portfolios the ledger switches to compact rows and gains a toolbar. */
const DENSE_THRESHOLD = 8;

type SortKey = "value" | "pnl" | "name";

/** Splits the formatted amount so cents render smaller, keeping tabular alignment. */
function Amount({ value, currency }: { value: number; currency: "USD" | "THB" }) {
  const text = formatMoney(value, currency);
  const dot = text.lastIndexOf(".");
  if (dot === -1) return <span>{text}</span>;
  return (
    <span className="inline-flex items-baseline" style={tabular}>
      <span>{text.slice(0, dot)}</span>
      <span className="text-[length:var(--fs-label)]" style={{ color: "var(--color-slate)" }}>{text.slice(dot)}</span>
    </span>
  );
}

function secondaryLine(portfolio: PortfolioOverviewItem): string | null {
  // The tag row already carries type and bot-management; repeating them here
  // only made every row taller. Only a status message earns a second line.
  return portfolio.status_message ?? null;
}

function riskColor(riskStatus: string): string {
  if (riskStatus === "Danger") return "var(--color-danger-text)";
  if (riskStatus === "Warning") return "var(--color-status-warning)";
  return "var(--color-brand-teal)";
}

function PortfolioRow({
  portfolio, currency, onTransfer, compact = false,
}: {
  portfolio: PortfolioOverviewItem;
  currency: "USD" | "THB";
  onTransfer: (source: { id: number; name: string; available: number }, dest: { id: number; name: string }) => void;
  compact?: boolean;
}) {
  const [{ isOver, canDrop }, dropRef] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(() => ({
    accept: "AVAILABLE_CASH",
    drop: (item) => {
      if (item.sourcePortfolioId === portfolio.portfolio_id) return;
      onTransfer(
        { id: item.sourcePortfolioId, name: item.sourceName, available: item.maxAmount },
        { id: portfolio.portfolio_id, name: portfolio.portfolio_name },
      );
    },
    collect: (monitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
  }), [portfolio.portfolio_id, onTransfer]);

  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: "AVAILABLE_CASH",
    item: {
      sourcePortfolioId: portfolio.portfolio_id,
      sourceName: portfolio.portfolio_name,
      maxAmount: portfolio.available_cash,
    },
  }), [portfolio.portfolio_id, portfolio.portfolio_name, portfolio.available_cash]);

  const p = portfolio;
  const total = (p.margin || 0) + (p.buffer || 0) + (p.available_cash || 0) + (p.total_pl || 0);
  const tags = getPortfolioTags(p);
  const profitPct = getProfitPct(p);
  const profitSign = profitPct > 0 ? 1 : profitPct < 0 ? -1 : 0;
  const secondary = compact ? null : secondaryLine(p);
  const availableLabel = `${formatMoney(p.available_cash, currency)} available — drag to transfer`;

  return (
    <Link
      ref={dropRef}
      to={`/analytics/portfolio/${p.portfolio_id}`}
      className={[
        "ledger-row",
        compact ? "ledger-row-compact" : "",
        canDrop && isOver ? "ledger-drop-active" : "",
      ].filter(Boolean).join(" ")}
    >
      <div className="ledger-cell-name" style={{ minWidth: 0 }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[length:var(--fs-body)]" style={{ fontWeight: 600, color: "var(--color-ink)" }}>
            {p.portfolio_name}
          </span>
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-[length:var(--fs-micro)]"
              style={{
                fontWeight: 500,
                color: "var(--color-slate)",
                background: "var(--color-surface)",
                borderRadius: "var(--rounded-full)",
                padding: "2px 8px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        {secondary && (
          <p className="text-[length:var(--fs-label)]" style={{ margin: "2px 0 0", color: "var(--color-slate)" }}>{secondary}</p>
        )}
      </div>

      <div className="ledger-cell-alloc" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 48 }}>
          <LiquidityStack
            margin={p.margin}
            buffer={p.buffer}
            available={p.available_cash}
            height={6}
          />
        </div>
        <div
          ref={dragRef}
          aria-label={availableLabel}
          title={availableLabel}
          className="text-[length:var(--fs-body)]"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            cursor: "grab",
            opacity: isDragging ? 0.45 : 1,
            ...tabular,
          }}
        >
          <span style={{ color: "var(--color-slate)" }}>Available</span>
          <span style={{ color: "var(--color-ink)", fontWeight: 600 }}>
            {formatMoney(p.available_cash, currency)}
          </span>
        </div>
      </div>

      <div
        className="ledger-cell-value ledger-num text-[length:var(--fs-content)]"
        style={{ fontWeight: 600, color: "var(--color-ink)", ...tabular }}
      >
        {formatMoney(total, currency)}
      </div>

      <div
        className="ledger-cell-pnl ledger-num text-[length:var(--fs-body)]"
        style={{
          fontWeight: 600,
          color:
            profitSign > 0
              ? "var(--color-positive-text)"
              : profitSign < 0
                ? "var(--color-danger-text)"
                : "var(--color-slate)",
          ...tabular,
        }}
      >
        {formatPct(profitPct)}
      </div>

      <div className="ledger-cell-status text-[length:var(--fs-label)]" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-slate)" }}>
        {p.risk_status && (
          <>
            <span className="status-dot" style={{ background: riskColor(p.risk_status) }} />
            {p.risk_status}
          </>
        )}
      </div>
    </Link>
  );
}

export default function PortfolioOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [currency] = useState<"USD" | "THB">("USD");
  const { notify } = useNotification();
  const [transferModal, setTransferModal] = useState<{
    source: { id: number; name: string; available: number } | null;
    destination: { id: number; name: string } | null;
  }>({ source: null, destination: null });
  const [portfolioQuery, setPortfolioQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const loadOverview = useCallback(() => {
    setLoading(true);
    setFetchError(false);
    api.getOverview()
      .then(setData)
      .catch((error: unknown) => {
        console.error("Failed to load overview:", error);
        setFetchError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  if (loading) return (
    <PageLayout>
      <PageHeader title="Overview" />

      <div className="animate-pulse">
        <section
          style={{
            background: "var(--color-canvas)",
            borderRadius: 12,
            padding: "var(--strip-pad-y) var(--strip-pad-x)",
            marginBottom: "var(--strip-mb)",
          }}
        >
          <div
            className="flex flex-col min-[1024px]:grid min-[1024px]:items-center"
            style={{
              gap: "var(--ledger-gap)",
              gridTemplateColumns: "minmax(0, 300px) 1px minmax(0, 1fr)",
            }}
          >
            <div>
              <div className="h-3 bg-surface rounded w-20" />
              <div className="h-9 bg-surface rounded w-48" style={{ marginTop: 6 }} />
              <div className="flex" style={{ gap: 24, marginTop: 12 }}>
                <div className="h-4 bg-surface rounded w-20" />
                <div className="h-4 bg-surface rounded w-16" />
              </div>
            </div>
            <div
              className="hidden min-[1024px]:block"
              style={{ width: 1, alignSelf: "stretch", background: "var(--color-hairline)" }}
            />
            <div>
              <div className="h-3 bg-surface rounded w-24" />
              <div className="h-7 bg-surface rounded w-full" style={{ marginTop: 6 }} />
            </div>
          </div>
        </section>

        <div className="h-4 bg-surface rounded w-24" style={{ marginBottom: 12 }} />

        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-6 py-4 border-b border-hairline">
            <div className="flex-1 min-w-0">
              <div className="h-4 bg-surface rounded w-40" />
            </div>
            <div className="h-4 bg-surface rounded w-32" />
            <div className="h-4 bg-surface rounded w-24" />
            <div className="h-4 bg-surface rounded w-16" />
            <div className="h-4 bg-surface rounded w-16" />
          </div>
        ))}
      </div>
    </PageLayout>
  );

  if (fetchError || !data) return (
    <PageLayout>
      <PageHeader title="Overview" />

      <div
        className="card"
        role="alert"
        style={{ maxWidth: 440, margin: "12vh auto 0", textAlign: "center" }}
      >
        <h1 className="text-[length:var(--fs-section)]" style={{ margin: 0, fontWeight: 600, color: "var(--color-ink)" }}>
          Overview didn't load
        </h1>
        <p className="text-[length:var(--fs-body)]" style={{ margin: "8px 0 20px", color: "var(--color-slate)" }}>
          The server could not return your portfolio overview.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="primary" onClick={loadOverview}>Retry</Button>
          <Link
            to="/all-assets"
            className="no-underline hover:underline text-[length:var(--fs-body)]"
            style={{ fontWeight: 600, color: "var(--color-brand-teal)" }}
          >
            Go to All Assets
          </Link>
        </div>
      </div>
    </PageLayout>
  );

  const { margin, buffer, available_cash, total_pl, pool_health_index, money_reserve_status, portfolios } = data;
  const totalEquity = (margin || 0) + (buffer || 0) + (available_cash || 0) + (total_pl || 0);
  const initialCapital = totalEquity - (total_pl || 0);
  const overallPLPct = initialCapital > 0 ? ((total_pl || 0) / initialCapital * 100) : 0;
  const overallPLSign = overallPLPct > 0 ? 1 : overallPLPct < 0 ? -1 : 0;

  const plColor =
    total_pl > 0
      ? "var(--color-positive-text)"
      : total_pl < 0
        ? "var(--color-danger-text)"
        : "var(--color-slate)";
  const plPrefix = total_pl > 0 ? "+" : total_pl < 0 ? "-" : "";
  const totalCash = (margin || 0) + (buffer || 0) + (available_cash || 0);
  const deployedPct = totalCash > 0 ? (margin + buffer) / totalCash * 100 : 0;
  const deployedElevated = Math.round(deployedPct) > 85;
  const attentionPortfolios = portfolios.filter(
    (p) => p.risk_status === "Warning" || p.risk_status === "Danger"
  );
  const attentionCount = attentionPortfolios.length;
  const attentionIds = new Set(attentionPortfolios.map((p) => p.portfolio_id));

  const gaugePercent = Math.min(100, Math.max(0, Math.round(pool_health_index)));
  const poolHealthColor = gaugePercent >= 70 ? "var(--color-brand-teal)" : "var(--color-danger-text)";
  const reserveStatusColor = money_reserve_status === "Optimal"
    ? "var(--color-brand-teal)"
    : money_reserve_status === "Danger"
      ? "var(--color-danger-text)"
      : money_reserve_status === "Warning" ? "var(--color-status-warning)" : "var(--color-on-surface-variant)";

  const reserveDangerLimit = (margin + buffer) * 1.2;
  const reserveOptimalLimit = (margin + buffer) * 2.0;
  const reserveRangeLabel = `Reserve ${money_reserve_status.toLowerCase()} — Danger under ${formatMoney(reserveDangerLimit, currency)}, Optimal ${formatMoney(reserveDangerLimit, currency)} to ${formatMoney(reserveOptimalLimit, currency)}, Neutral over ${formatMoney(reserveOptimalLimit, currency)}`;

  const dense = portfolios.length > DENSE_THRESHOLD;
  const normalizedQuery = portfolioQuery.trim().toLowerCase();
  const filteredPortfolios = portfolios.filter((p) => {
    if (attentionOnly && !attentionIds.has(p.portfolio_id)) return false;
    if (normalizedQuery && !(p.portfolio_name || "").toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });
  const sortedPortfolios = filteredPortfolios
    .map((p) => ({
      p,
      value: (p.margin || 0) + (p.buffer || 0) + (p.available_cash || 0) + (p.total_pl || 0),
    }))
    .sort((a, b) => {
      if (sortKey === "name") return (a.p.portfolio_name || "").localeCompare(b.p.portfolio_name || "");
      if (sortKey === "pnl") return getProfitPct(b.p) - getProfitPct(a.p);
      return b.value - a.value;
    })
    .map((entry) => entry.p);

  return (
    <PageLayout>
      <PageHeader
        title="Overview"
        meta={
          <>
            <span className="flex items-center gap-2 text-[length:var(--fs-label)]" style={{ color: "var(--color-slate)" }}>
              <span className="status-dot" style={{ background: poolHealthColor }} />
              Pool health {gaugePercent}%
            </span>
            <span
              className="flex items-center gap-2 text-[length:var(--fs-label)]"
              role="img"
              title={reserveRangeLabel}
              aria-label={reserveRangeLabel}
              style={{ color: "var(--color-slate)" }}
            >
              <span className="status-dot" style={{ background: reserveStatusColor }} />
              Reserve {money_reserve_status.toLowerCase()}
            </span>
          </>
        }
      />

      {/* Overview totals strip: equity on the left, cash allocation on the right, one tonal surface. */}
      <section
        style={{
          background: "var(--color-canvas)",
          borderRadius: 12,
          padding: "var(--strip-pad-y) var(--strip-pad-x)",
          marginBottom: "var(--strip-mb)",
        }}
      >
        <div
          className="flex flex-col min-[1024px]:grid min-[1024px]:items-center"
          style={{
            gap: "var(--ledger-gap)",
            gridTemplateColumns: "minmax(0, 300px) 1px minmax(0, 1fr)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p className="text-[length:var(--fs-label)]" style={labelStyle}>Total equity</p>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              <span
                className="text-ink text-[length:var(--fs-datum)]"
                style={{
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.15,
                  ...tabular,
                }}
              >
                <Amount value={totalEquity} currency={currency} />
              </span>
              <span
                className="text-[length:var(--fs-label)]"
                style={{
                  fontWeight: 600,
                  padding: "2px 10px",
                  borderRadius: 999,
                  ...tabular,
                  color: "var(--color-ink)",
                  background:
                    overallPLSign > 0
                      ? "color-mix(in srgb, var(--color-positive-text) 18%, transparent)"
                      : overallPLSign < 0
                        ? "color-mix(in srgb, var(--color-danger-text) 18%, transparent)"
                        : "var(--color-surface-soft)",
                }}
              >
                {overallPLSign !== 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      color:
                        overallPLSign > 0
                          ? "var(--color-positive-text)"
                          : "var(--color-danger-text)",
                    }}
                  >
                    {overallPLSign > 0 ? "▲ " : "▼ "}
                  </span>
                )}
                {formatPct(overallPLPct)}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 12 }}>
              <div>
                <p className="text-[length:var(--fs-micro)]" style={{ margin: 0, fontWeight: 500, color: "var(--color-slate)" }}>P/L</p>
                <p className="text-[length:var(--fs-body)]" style={{ margin: 0, marginTop: 4, fontWeight: 600, color: plColor, ...tabular }}>
                  {plPrefix}{formatMoney(Math.abs(total_pl || 0), currency)}
                </p>
              </div>
              <div>
                <p className="text-[length:var(--fs-micro)]" style={{ margin: 0, fontWeight: 500, color: "var(--color-slate)" }}>Deployed</p>
                <p className="text-[length:var(--fs-body)]" style={{ margin: 0, marginTop: 4, fontWeight: 600, ...tabular, color: deployedElevated ? "var(--color-status-warning)" : "var(--color-ink)" }}>
                  {Math.round(deployedPct)}%
                </p>
              </div>
            </div>
          </div>

          <div
            className="hidden min-[1024px]:block"
            style={{ width: 1, alignSelf: "stretch", background: "var(--color-hairline)" }}
          />

          <div style={{ minWidth: 0 }}>
            <p className="text-[length:var(--fs-label)]" style={{ ...labelStyle, marginBottom: 6 }}>Cash allocation</p>
            <LiquidityStack
              margin={margin}
              buffer={buffer}
              available={available_cash}
              height={28}
              showLabels
              formatValue={(v) => formatMoney(v, currency)}
              label={`Cash allocation — margin ${formatMoney(margin, currency)}, buffer ${formatMoney(buffer, currency)}, available ${formatMoney(available_cash, currency)}`}
            />
          </div>
        </div>
      </section>

      <section>
        {portfolios.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2
              className="m-0 text-[length:var(--fs-section)]"
              style={{ lineHeight: 1.3, fontWeight: 600, color: "var(--color-ink)" }}
            >
              Portfolios
            </h2>
            <div className="flex items-center gap-3">
              {attentionCount > 0 && (
                <button
                  type="button"
                  className="attention-chip text-[length:var(--fs-label)]"
                  aria-pressed={attentionOnly}
                  onClick={() => setAttentionOnly((value) => !value)}
                  style={{
                    fontWeight: 600,
                    padding: "2px 10px",
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Needs attention · {attentionCount}
                </button>
              )}
              <span className="text-[length:var(--fs-label)]" style={{ color: "var(--color-slate)" }}>
                {dense
                  ? `${sortedPortfolios.length} of ${portfolios.length} portfolios`
                  : `${portfolios.length} ${portfolios.length === 1 ? "portfolio" : "portfolios"}`}
              </span>
            </div>
          </div>
        )}
        {dense && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <TextInput
              type="text"
              value={portfolioQuery}
              onChange={(e) => setPortfolioQuery(e.target.value)}
              placeholder="Search portfolios"
              aria-label="Search portfolios"
              style={{ minWidth: 200, maxWidth: 280 }}
            />
            <SelectInput
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Sort portfolios"
              style={{ width: "auto" }}
            >
              <option value="value">Value</option>
              <option value="pnl">P&amp;L %</option>
              <option value="name">Name</option>
            </SelectInput>
          </div>
        )}
        {portfolios.length === 0 ? (
          <div
            style={{
              border: "1px solid var(--color-hairline)",
              borderRadius: 8,
              padding: "24px 20px",
            }}
          >
            <p className="m-0 text-ink text-[length:var(--fs-section)]" style={{ fontWeight: 600 }}>No portfolios yet</p>
            <p className="m-0 mb-4 text-[length:var(--fs-body)]" style={{ color: "var(--color-slate)", marginTop: 4 }}>
              Create your first portfolio
            </p>
            <Button variant="primary" onClick={() => navigate("/create-portfolio")}>+ Create Portfolio</Button>
          </div>
        ) : (
          <div className="ledger-table">
            <div className="ledger-head" aria-hidden="true">
              <span>Portfolio</span>
              <span>Allocation</span>
              <span style={{ textAlign: "right" }}>Value</span>
              <span style={{ textAlign: "right" }}>P&amp;L</span>
              <span>Status</span>
            </div>
            {sortedPortfolios.length === 0 ? (
              <div
                style={{
                  minHeight: 56,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  gap: 4,
                  padding: 8,
                }}
              >
                <span className="text-[length:var(--fs-body)]" style={{ color: "var(--color-slate)" }}>
                  {attentionOnly ? "No portfolios need attention" : `No portfolios match "${portfolioQuery}"`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (attentionOnly) setAttentionOnly(false);
                    else setPortfolioQuery("");
                  }}
                  className="bg-transparent border-none cursor-pointer text-[length:var(--fs-body)]"
                  style={{
                    padding: 0,
                    color: "var(--color-brand-teal)",
                    textDecoration: "underline",
                  }}
                >
                  {attentionOnly ? "Show all portfolios" : "Clear search"}
                </button>
              </div>
            ) : (
              sortedPortfolios.map((portfolio) => (
                <PortfolioRow
                  key={portfolio.portfolio_id}
                  portfolio={portfolio}
                  currency={currency}
                  compact={dense}
                  onTransfer={(source, destination) => setTransferModal({ source, destination })}
                />
              ))
            )}
          </div>
        )}
      </section>

      <TransferModal
        open={!!transferModal.source}
        source={transferModal.source!}
        destination={transferModal.destination!}
        onClose={() => setTransferModal({ source: null, destination: null })}
        onSuccess={(msg) => { notify(msg, "success"); loadOverview(); }}
      />
    </PageLayout>
  );
}
