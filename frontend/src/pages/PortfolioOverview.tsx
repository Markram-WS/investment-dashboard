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
  profit_percentage?: number;
  portfolio_type?: string;
  is_bot_trading?: boolean;
  status_message?: string;
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
  const [gaugeOffset, setGaugeOffset] = useState(125.6);

  useEffect(() => {
    api.getOverview()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => {
        const circumference = 125.6;
        setGaugeOffset(circumference * (1 - data.pool_health_index / 100));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data]);

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

  const { margin, buffer, available_cash, money_market, pool_health_index, money_reserve_status, portfolios } = data;
  const lock = margin;
  const tPlus3 = money_market;
  const totalCash = lock + buffer + available_cash + tPlus3;

  const riskColor = (status: string | null) =>
    status === "Safe" ? "var(--color-brand-teal)" :
    status === "Warning" ? "var(--color-brand-yellow)" :
    status === "Danger" ? "var(--color-brand-coral)" : "var(--color-slate)";

  const getTags = (p: PortfolioOverviewItem) => {
    const tags: string[] = [];
    if (p.portfolio_name.toLowerCase().includes('binance') || p.portfolio_name.toLowerCase().includes('btc')) {
      tags.push('crypto');
    }
    if (p.is_bot_trading || p.portfolio_name.toLowerCase().includes('binance')) {
      tags.push('bot');
    }
    if (tags.length === 0 && (p.portfolio_name.toLowerCase().includes('fund') || p.portfolio_name.toLowerCase().includes('global'))) {
      tags.push('FUND');
    }
    return tags;
  };

  const getProfitPct = (p: PortfolioOverviewItem) => {
    if (p.profit_percentage !== undefined) return p.profit_percentage;
    const total = p.margin + p.buffer + p.available;
    return total > 0 ? (p.available / total * 100) : 0;
  };

  const getStatusMessage = (p: PortfolioOverviewItem) => {
    if (p.status_message) return p.status_message;
    if (p.risk_status === "Danger") return "Rebalancing recommended: Variance above threshold.";
    if (p.risk_status === "Warning") return "Pool health monitoring required.";
    return "Pool health remains stable at 92% efficiency.";
  };

  const overallPLPct = ((available_cash + tPlus3 - lock) / (lock + buffer + 1) * 100);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }} className="animate-fade-up">
        <h1 className="page-title" style={{ margin: 0 }}>Overview</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 240 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-slate)', fontSize: 14 }}>🔍</span>
            <input 
              type="text" 
              placeholder="Search..." 
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                       background: 'var(--color-surface)', border: 'none', borderRadius: 6, fontSize: 14 }} 
            />
          </div>
          <button onClick={() => setCurrency(currency === "USD" ? "THB" : "USD")} className="btn-ghost" style={{ fontSize: 13 }}>
            {currency === "USD" ? "Switch to THB ฿" : "Switch to USD $"}
          </button>
        </div>
      </header>

      {/* Hero Card */}
      <section style={{ marginBottom: 32 }} className="animate-fade-up stagger-1">
        <div style={{ 
          background: 'var(--color-teal-light)',
          border: '1px solid var(--color-outline-variant)',
          borderRadius: 'var(--rounded-xxl)',
          padding: 40
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 32 }}>
            <div>
              <p style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase',
                          fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>Asset total</p>
              <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 4px' }}>
                {fmt(totalCash)}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-brand-teal)' }}>
                <span style={{ fontSize: 14 }}>↗</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>+{overallPLPct.toFixed(1)}% Overall P/L</span>
              </div>
            </div>
            
            <div>
              <p style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase',
                          fontWeight: 700, letterSpacing: 1, marginBottom: 16 }}>Cash (overall) breakdown</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div style={{ padding: 16, background: 'var(--color-canvas)', borderRadius: 'var(--rounded-xl)',
                             border: '1px solid var(--color-outline-variant)' }}>
                  <p style={{ fontSize: 10, color: 'var(--color-slate)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Lock</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmt(lock)}</p>
                </div>
                <div style={{ padding: 16, background: 'var(--color-canvas)', borderRadius: 'var(--rounded-xl)',
                             border: '1px solid var(--color-outline-variant)' }}>
                  <p style={{ fontSize: 10, color: 'var(--color-slate)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Buffer</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmt(buffer)}</p>
                </div>
                <div style={{ padding: 16, background: 'var(--color-brand-yellow)', borderRadius: 'var(--rounded-xl)',
                             boxShadow: 'var(--shadow-sm)' }} className="pulse-available">
                  <p style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Available</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmt(available_cash)}</p>
                </div>
                <div style={{ padding: 16, background: 'var(--color-canvas)', borderRadius: 'var(--rounded-xl)',
                             border: '1px solid var(--color-outline-variant)' }}>
                  <p style={{ fontSize: 10, color: 'var(--color-slate)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>T+3</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmt(tPlus3)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Widgets Row */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32, position: 'relative', zIndex: 2 }}>
        {/* Pool Health */}
        <div style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)',
                     borderRadius: 'var(--rounded-xxl)', padding: 32 }} className="animate-fade-up stagger-2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Pool Health Index
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                         background: 'var(--color-teal-light)', borderRadius: 'var(--rounded-full)', color: 'var(--color-brand-teal)' }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>✓</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Healthy</span>
            </div>
          </div>
          <div style={{ position: 'relative', width: 192, height: 120, overflow: 'visible', margin: '0 auto' }}>
            <svg width="192" height="120" viewBox="0 0 100 60">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="transparent" stroke="#f4f4f6" strokeWidth="10" />
              <path 
                d="M 10 50 A 40 40 0 0 1 90 50" 
                fill="transparent" 
                stroke="#0fbcb0" 
                strokeWidth="10"
                className="health-gauge-path"
                style={{ strokeDasharray: 125.6, strokeDashoffset: gaugeOffset }}
              />
            </svg>
            <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
              <p style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>{pool_health_index.toFixed(0)}%</p>
              <p style={{ fontSize: 10, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                Efficiency
              </p>
            </div>
          </div>
          <p style={{ fontSize: 14, color: 'var(--color-slate)', textAlign: 'center', marginTop: 24, padding: '0 48px' }}>
            Aggregated performance is 13.35% above the monthly risk benchmark.
          </p>
        </div>

        {/* Money Reserve */}
        <div style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)',
                     borderRadius: 'var(--rounded-xxl)', padding: 32 }} className="animate-fade-up stagger-3">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Money Reserve Status
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                         background: 'var(--color-teal-light)', borderRadius: 'var(--rounded-full)', color: 'var(--color-brand-teal)' }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>✓</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Optimal Reserve</span>
            </div>
          </div>
          <div style={{ marginBottom: 32 }}>
            <div style={{ position: 'relative', height: 12, background: '#f4f4f6', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '25%', background: 'rgba(255,153,153,0.3)' }} />
              <div style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, width: '50%', background: 'rgba(15,188,176,0.3)' }} />
              <div style={{ position: 'absolute', left: '75%', top: 0, bottom: 0, width: '25%', background: '#dbe0ff' }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '48%', width: 6, background: 'var(--color-primary)', zIndex: 10 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', fontSize: 10,
                         textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-slate)',
                         letterSpacing: 0.5, marginTop: 8 }} className="shimmer-bar">
              <div style={{ textAlign: 'left', color: '#ff9999' }}>Danger<br/>&lt; $45k</div>
              <div style={{ textAlign: 'center', color: '#0fbcb0' }}>Optimal<br/>$45k - $90k</div>
              <div style={{ textAlign: 'right', color: '#4262ff' }}>Neutral<br/>&gt; $90k</div>
            </div>
          </div>
          <div style={{ padding: 16, background: 'rgba(195,250,245,0.3)', borderRadius: 'var(--rounded-xl)',
                       border: '1px solid rgba(15,188,176,0.2)' }}>
            <p style={{ fontSize: 13, color: 'var(--color-slate)', fontStyle: 'italic', margin: 0 }}>
              Current available liquidity ({fmt(available_cash + tPlus3)}) is within the optimal threshold relative to the $45k buffer.
            </p>
          </div>
        </div>
      </section>

      {/* Portfolio Grid - 2 columns on desktop */}
      <section style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: -0.5 }}>
            Active Portfolios
          </h2>
          <span style={{ fontSize: 12, color: 'var(--color-slate)' }}>{portfolios.length} portfolios</span>
        </div>

        {portfolios.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 4px' }}>No portfolios yet</p>
            <p style={{ fontSize: 13, color: 'var(--color-slate)', margin: '0 0 20px' }}>Create your first portfolio</p>
            <button className="btn-primary" onClick={() => navigate('/create-portfolio')}>+ Create Portfolio</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {portfolios.map((p, idx) => {
              const total = p.margin + p.buffer + p.available;
              const profitColor = p.risk_status === 'Safe' ? 'var(--color-brand-teal)' : p.risk_status === 'Warning' ? 'var(--color-brand-yellow)' : 'var(--color-brand-coral)';
              const tags = getTags(p);
              const profitPct = getProfitPct(p);
              const statusMessage = getStatusMessage(p);
              const isDanger = p.risk_status === "Danger";
              const isWarning = p.risk_status === "Warning";
              const cardBg = isDanger ? 'rgba(255,198,198,0.4)' : isWarning ? 'rgba(255,208,47,0.2)' : 'var(--color-canvas)';
              const statusBg = isDanger ? 'var(--color-primary)' : 'var(--color-canvas)';
              const statusText = isDanger ? 'var(--color-on-primary)' : 'var(--color-slate)';

              return (
                <div key={p.portfolio_id} className={"card card-hover animate-fade-up stagger-" + (idx % 2 + 4)}
                     style={{ 
                       padding: 32, 
                       cursor: 'pointer', 
                       borderLeft: `3px solid ${riskColor(p.risk_status)}`,
                       background: cardBg
                     }}
                     onClick={() => navigate(`/analytics/portfolio/${p.portfolio_id}`)}>
                  
                  {/* Top row: Portfolio name with tags + Profit */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                        <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>
                          {p.portfolio_name}
                        </h3>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {tags.map(tag => (
                            <span key={tag} style={{ 
                              padding: '4px 12px', 
                              background: 'rgba(255,255,255,0.8)', 
                              borderRadius: 'var(--rounded-full)', 
                              fontSize: 9, 
                              fontWeight: 700, 
                              textTransform: 'uppercase', 
                              letterSpacing: 1,
                              color: 'var(--color-primary)'
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p style={{ fontSize: 14, color: 'var(--color-slate)', fontWeight: 500, margin: 0 }}>
                        Managed algorithmic portfolio
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: 'var(--color-slate)', fontWeight: 700,
                                  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                        Profit
                      </p>
                      <p style={{ 
                        fontSize: 24, 
                        fontWeight: 900, 
                        color: 'var(--color-brand-teal)',
                        margin: 0
                      }}>
                        +{profitPct.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Asset Total */}
                  <div style={{ marginBottom: 28 }}>
                    <p style={{ fontSize: 10, color: 'var(--color-slate)', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                      Asset Total
                    </p>
                    <p style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: -1, margin: 0 }}>
                      {fmt(total)}
                    </p>
                  </div>

                  {/* Lock/Buffer/Available breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                    <div style={{ padding: 16, background: 'var(--color-canvas)', borderRadius: 'var(--rounded-xl)',
                                 boxShadow: 'var(--shadow-sm)', transition: 'boxShadow 0.15s ease' }}>
                      <p style={{ fontSize: 9, color: 'var(--color-slate)', fontWeight: 700,
                                  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Lock</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmt(p.margin)}</p>
                    </div>
                    <div style={{ padding: 16, background: 'var(--color-canvas)', borderRadius: 'var(--rounded-xl)',
                                 boxShadow: 'var(--shadow-sm)', transition: 'boxShadow 0.15s ease' }}>
                      <p style={{ fontSize: 9, color: 'var(--color-slate)', fontWeight: 700,
                                  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Buffer</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmt(p.buffer)}</p>
                    </div>
                    <div style={{ padding: 16, background: 'var(--color-brand-yellow)', borderRadius: 'var(--rounded-xl)',
                                 boxShadow: 'var(--shadow-sm)', transition: 'boxShadow 0.15s ease' }} className="pulse-available">
                      <p style={{ fontSize: 9, color: 'var(--color-primary)', fontWeight: 700,
                                  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Available</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmt(p.available)}</p>
                    </div>
                  </div>

                  {/* Status indicator */}
                  <div style={{ 
                    padding: 16, 
                    background: statusBg, 
                    borderRadius: 'var(--rounded-xl)', 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {isDanger && (
                      <div className="shimmer-bar" style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }} />
                    )}
                    <span style={{ 
                      fontSize: 14, 
                      color: isDanger ? 'var(--color-brand-coral)' : 'var(--color-brand-teal)',
                      fontWeight: 700 
                    }}>
                      {isDanger ? '⚠' : '✓'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: statusText }}>
                      {statusMessage}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}