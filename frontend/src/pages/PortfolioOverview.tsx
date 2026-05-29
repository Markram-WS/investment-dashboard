import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface PortfolioOverviewItem {
  portfolio_id: number;
  portfolio_name: string;
  margin: number;
  buffer: number;
  available: number;
  risk_status: string | null;
}

interface OverviewResponse {
  margin: number;
  buffer: number;
  available_cash: number;
  money_market: number;
  pool_health_index: number;
  money_reserve_status: string;
  portfolios: PortfolioOverviewItem[];
}

const EXCHANGE_RATE = 35;

export default function PortfolioOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<"USD" | "THB">("USD");

  useEffect(() => {
    api.getOverview()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => {
    const v = currency === "THB" ? n * EXCHANGE_RATE : n;
    return currency === "USD"
      ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `฿${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: 'var(--color-slate)' }}>Loading…</div>
    </div>
  );

  if (!data) return null;

  const { margin, buffer, available_cash, money_market, pool_health_index, portfolios } = data;
  const totalCash = margin + buffer + available_cash + money_market;

  const riskColor = (status: string | null) =>
    status === "Safe" ? "var(--color-brand-teal)" :
    status === "Warning" ? "var(--color-brand-yellow)" :
    status === "Danger" ? "var(--color-brand-coral)" : "var(--color-slate)";

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Overview</h1>
        <button onClick={() => setCurrency(currency === "USD" ? "THB" : "USD")} className="btn-ghost" style={{ fontSize: 13 }}>
          {currency === "USD" ? "Switch to THB ฿" : "Switch to USD $"}
        </button>
      </div>

      {/* ===== Top Row: Cash Stats (left) + Gauges (right) ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, marginBottom: 32 }}>

        {/* Left — Cash Breakdown */}
        <div>
          <p className="label-caps" style={{ marginBottom: 12 }}>Cash Breakdown</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: "Margin", value: margin, color: 'var(--color-primary)', icon: '🔒' },
              { label: "Buffer", value: buffer, color: 'var(--color-brand-yellow)', icon: '🛡️' },
              { label: "Available", value: available_cash, color: 'var(--color-brand-teal)', icon: '💵' },
              { label: "Money Market", value: money_market, color: 'var(--color-brand-blue)', icon: '🏦' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                  {icon}
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--color-slate)', margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-ink)', margin: 0, lineHeight: 1.2 }}>{fmt(value)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Total Cash bar */}
          <div className="card" style={{ padding: '16px 20px', marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-slate)' }}>Total Cash</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{fmt(totalCash)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--color-surface)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
              {totalCash > 0 && (
                <>
                  <div style={{ width: `${(margin / totalCash) * 100}%`, background: 'var(--color-primary)' }} />
                  <div style={{ width: `${(buffer / totalCash) * 100}%`, background: 'var(--color-brand-yellow)' }} />
                  <div style={{ width: `${(available_cash / totalCash) * 100}%`, background: 'var(--color-brand-teal)' }} />
                  <div style={{ width: `${(money_market / totalCash) * 100}%`, background: 'var(--color-brand-blue)' }} />
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
              {[
                { label: 'Margin', color: 'var(--color-primary)', v: margin },
                { label: 'Buffer', color: 'var(--color-brand-yellow)', v: buffer },
                { label: 'Avail', color: 'var(--color-brand-teal)', v: available_cash },
                { label: 'Mkt', color: 'var(--color-brand-blue)', v: money_market },
              ].map(({ label, color, v }) => (
                <span key={label} style={{ fontSize: 10, color: 'var(--color-slate)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: color, display: 'inline-block' }} />
                  {fmt(v)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Gauges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Pool Health */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--color-slate)', margin: 0 }}>Pool Health</p>
                <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-ink)', margin: '4px 0 0' }}>
                  {pool_health_index.toFixed(0)}%
                </p>
              </div>
              <div style={{ position: 'relative', width: 64, height: 64 }}>
                <svg width="64" height="64" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="var(--color-hairline)" strokeWidth="2.5" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="var(--color-brand-teal)" strokeWidth="2.5"
                    strokeDasharray={`${pool_health_index * 0.88} 100`} strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Money Reserve */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--color-slate)', margin: 0 }}>Money Reserve</p>
                <p style={{ fontSize: 14, fontWeight: 600, margin: '4px 0 0', color:
                  data.money_reserve_status === "Danger" ? "var(--color-brand-coral)" :
                  data.money_reserve_status === "Optimal" ? "var(--color-brand-teal)" : "var(--color-brand-yellow)"
                }}>
                  {data.money_reserve_status}
                </p>
              </div>
              <span style={{ fontSize: 20 }}>{data.money_reserve_status === "Danger" ? "🔴" : data.money_reserve_status === "Optimal" ? "🟢" : "🟡"}</span>
            </div>
            <div style={{ height: 6, background: 'var(--color-surface)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${totalCash > 0 ? Math.min(100, ((available_cash + money_market) / totalCash) * 100) : 0}%`,
                background: data.money_reserve_status === "Danger" ? "var(--color-brand-coral)" :
                           data.money_reserve_status === "Optimal" ? "var(--color-brand-teal)" : "var(--color-brand-yellow)",
                borderRadius: 3
              }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-slate)', margin: '8px 0 0' }}>
              Reserve: {fmt(available_cash + money_market)}
            </p>
          </div>

          {/* Global Risk */}
          <div className="card" style={{ padding: 16, background: 'var(--color-brand-yellow)', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⚡</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>Global Risk Alert</p>
                <p style={{ fontSize: 11, color: 'var(--color-slate)', margin: '2px 0 0' }}>
                  {portfolios.filter(p => p.risk_status === "Danger").length} danger · {portfolios.filter(p => p.risk_status === "Warning").length} warning
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Portfolio Grid ===== */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Active Portfolios</h2>
          <span style={{ fontSize: 12, color: 'var(--color-slate)' }}>{portfolios.length} portfolios</span>
        </div>

        {portfolios.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 4px' }}>No portfolios yet</p>
            <p style={{ fontSize: 13, color: 'var(--color-slate)', margin: '0 0 20px' }}>Create your first portfolio</p>
            <button className="btn-primary">+ Create Portfolio</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {portfolios.map((p) => (
              <div key={p.portfolio_id} className="card card-hover" style={{ padding: 20, cursor: 'pointer', borderLeft: `3px solid ${riskColor(p.risk_status)}` }}
                onClick={() => navigate(`/analytics/portfolio/${p.portfolio_id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>{p.portfolio_name}</h3>
                    <span style={{ fontSize: 11, color: riskColor(p.risk_status) }}>● {p.risk_status ?? 'N/A'}</span>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-ink)' }}>
                    {fmt(p.margin + p.buffer + p.available)}
                  </span>
                </div>

                {/* Mini bar breakdown */}
                <div style={{ height: 4, background: 'var(--color-surface)', borderRadius: 2, overflow: 'hidden', display: 'flex', marginBottom: 12 }}>
                  {(() => {
                    const t = p.margin + p.buffer + p.available;
                    return t > 0 ? (
                      <>
                        <div style={{ width: `${(p.margin / t) * 100}%`, background: 'var(--color-primary)' }} />
                        <div style={{ width: `${(p.buffer / t) * 100}%`, background: 'var(--color-brand-yellow)' }} />
                        <div style={{ width: `${(p.available / t) * 100}%`, background: 'var(--color-brand-teal)' }} />
                      </>
                    ) : null;
                  })()}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--color-slate)', margin: 0 }}>Margin</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>{fmt(p.margin)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--color-slate)', margin: 0 }}>Buffer</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>{fmt(p.buffer)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--color-slate)', margin: 0 }}>Available</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>{fmt(p.available)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
