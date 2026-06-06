import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { api } from "../lib/api";
import { PortfolioOverviewItem, OverviewResponse } from "../types";
import { getPortfolioTags, getProfitPct, getStatusMessage } from "../utils/tags";
import { getRiskColor } from "../utils/risk";
import { fmtAmount } from "../utils/format";
import TransferModal from "../screens/components/TransferModal";
import ToastAlert from "../screens/components/ToastAlert";

interface DragItem {
  sourcePortfolioId: number;
  sourceName: string;
  maxAmount: number;
}

function PortfolioCard({
  portfolio, currency, navigate, onTransfer,
}: {
  portfolio: PortfolioOverviewItem;
  currency: "USD" | "THB";
  navigate: (p: string) => void;
  onTransfer: (source: { id: number; name: string; available: number }, dest: { id: number; name: string }) => void;
}) {
  const [{ isOver, canDrop }, dropRef] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(() => ({
    accept: 'AVAILABLE_CASH',
    drop: (item) => {
      if (item.sourcePortfolioId === portfolio.portfolio_id) return;
      onTransfer(
        { id: item.sourcePortfolioId, name: item.sourceName, available: item.maxAmount },
        { id: portfolio.portfolio_id, name: portfolio.portfolio_name },
      );
    },
    collect: (monitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
  }), [portfolio.portfolio_id]);

  const p = portfolio;
  const total = (p.margin || 0) + (p.buffer || 0) + (p.available_cash || 0) + (p.money_market || 0) + (p.total_pl || 0);
  const profitColor = p.risk_status === 'Safe' ? 'var(--color-brand-teal)' : p.risk_status === 'Warning' ? 'var(--color-brand-yellow)' : 'var(--color-brand-coral)';
  const tags = getPortfolioTags(p);
  const profitPct = getProfitPct(p);
  const statusMessage = getStatusMessage(p);
  const isDanger = p.risk_status === "Danger";
  const isWarning = p.risk_status === "Warning";
  const cardBg = isDanger ? 'rgba(255,198,198,0.4)' : isWarning ? 'rgba(255,208,47,0.2)' : 'var(--color-canvas)';
  const statusBg = isDanger ? 'var(--color-primary)' : 'var(--color-canvas)';
  const statusText = isDanger ? 'var(--color-on-primary)' : 'var(--color-slate)';
  const dropGlow = canDrop && isOver ? '0 0 0 3px #0fbcb0' : canDrop ? '0 0 0 2px rgba(15,188,176,0.3)' : '';

  return (
    <div ref={dropRef} className="card card-hover animate-fade-up"
      style={{
        padding: 32, cursor: 'pointer', borderLeft: `3px solid ${getRiskColor(p.risk_status)}`,
        background: cardBg, transition: 'box-shadow 0.2s ease',
        boxShadow: dropGlow || undefined,
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
                  padding: '4px 12px', background: 'rgba(255,255,255,0.8)',
                  borderRadius: 'var(--rounded-full)', fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-primary)',
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
          <p style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-brand-teal)', margin: 0 }}>
            {profitPct >= 0 ? '+' : ''}{profitPct.toFixed(1)}%
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
          {fmtAmount(total, currency)}
        </p>
      </div>

      {/* Lock/Buffer/Available/Money Market breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <div style={{ padding: 16, background: 'var(--color-canvas)', borderRadius: 'var(--rounded-xl)',
          boxShadow: 'var(--shadow-sm)', transition: 'boxShadow 0.15s ease' }}>
          <p style={{ fontSize: 9, color: 'var(--color-slate)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Lock</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmtAmount(p.margin, currency)}</p>
        </div>
        <div style={{ padding: 16, background: 'var(--color-canvas)', borderRadius: 'var(--rounded-xl)',
          boxShadow: 'var(--shadow-sm)', transition: 'boxShadow 0.15s ease' }}>
          <p style={{ fontSize: 9, color: 'var(--color-slate)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Buffer</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmtAmount(p.buffer, currency)}</p>
        </div>
        <div style={{ padding: 16, background: 'var(--color-canvas)', borderRadius: 'var(--rounded-xl)',
          boxShadow: 'var(--shadow-sm)', transition: 'boxShadow 0.15s ease' }}>
          <p style={{ fontSize: 9, color: 'var(--color-slate)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Money Market</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmtAmount(p.money_market, currency)}</p>
        </div>
        <DraggableAvailable portfolio={p} currency={currency} />
      </div>

      {/* Status indicator */}
      <div style={{
        padding: 16, background: statusBg, borderRadius: 'var(--rounded-xl)',
        display: 'flex', alignItems: 'center', gap: 10, position: 'relative', overflow: 'hidden',
      }}>
        {isDanger && <div className="shimmer-bar" style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }} />}
        <span style={{ fontSize: 14, color: isDanger ? 'var(--color-brand-coral)' : 'var(--color-brand-teal)', fontWeight: 700 }}>
          {isDanger ? '⚠' : '✓'}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: statusText }}>
          {statusMessage}
        </span>
      </div>
    </div>
  );
}

function DraggableAvailable({ portfolio, currency }: { portfolio: PortfolioOverviewItem; currency: "USD" | "THB" }) {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: 'AVAILABLE_CASH',
    item: { sourcePortfolioId: portfolio.portfolio_id, sourceName: portfolio.portfolio_name, maxAmount: portfolio.available_cash },
  }), [portfolio.portfolio_id, portfolio.available_cash]);

  return (
    <div ref={dragRef} style={{
      padding: 16, background: 'var(--color-brand-yellow)', borderRadius: 'var(--rounded-xl)',
      boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.15s ease, opacity 0.15s ease',
      position: 'relative', opacity: isDragging ? 0.4 : 1, cursor: 'grab',
    }} className="pulse-available">
      <p style={{ fontSize: 9, color: 'var(--color-primary)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Available</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>
        {fmtAmount(portfolio.available_cash, currency)}
      </p>
    </div>
  );
}

export default function PortfolioOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<"USD" | "THB">("USD");
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [transferModal, setTransferModal] = useState<{
    source: { id: number; name: string; available: number } | null;
    destination: { id: number; name: string } | null;
  }>({ source: null, destination: null });

  useEffect(() => {
    api.getOverview()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: 'var(--color-slate)' }}>Loading…</div>
    </div>
  );

  if (!data) return null;

  const { margin, buffer, available_cash, money_market, total_pl, pool_health_index, money_reserve_status, portfolios } = data;
  const totalEquity = (margin || 0) + (buffer || 0) + (available_cash || 0) + (money_market || 0) + (total_pl || 0);
  const initialCapital = totalEquity - (total_pl || 0);
  const overallPLPct = initialCapital > 0 ? ((total_pl || 0) / initialCapital * 100) : 0;
  const plPositive = (total_pl || 0) >= 0;

  const gaugePercent = Math.min(100, Math.max(0, Math.round(pool_health_index)));
  const gaugeCircumference = 125.6;
  const gaugeDashoffset = gaugeCircumference * (1 - gaugePercent / 100);

  const lowerBound = (margin + buffer) * 1.2;
  const upperBound = (margin + buffer) * 2.0;
  const reserveMarkerLeft = margin + buffer > 0
    ? Math.min(95, Math.max(5, ((available_cash || 0) / (upperBound + 1)) * 100))
    : 50;

  const isReserveOptimal = money_reserve_status === "Optimal";
  const isReserveDanger = money_reserve_status === "Danger";

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }} className="animate-fade-up">
        <h1 style={{ fontSize: 48, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.04em', margin: 0 }}>
          Overview
        </h1>
      </header>

      {/* Hero Card: Summary View */}
      <section style={{ marginBottom: 24 }} className="animate-fade-up stagger-1">
        <div style={{
          background: 'var(--color-teal-light)', border: '1px solid rgba(224,226,232,0.3)',
          borderRadius: 28, padding: 40, boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 32 }}>
            {/* Left: Asset total + P/L */}
            <div>
              <p style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Asset total</p>
              <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.03em', margin: '0 0 16px' }}>
                {fmtAmount(totalEquity, currency)}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: plPositive ? 'var(--color-brand-teal)' : 'var(--color-brand-coral)' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{plPositive ? '▲' : '▼'}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{plPositive ? '+' : ''}{overallPLPct.toFixed(1)}% Overall P/L</span>
              </div>
            </div>
            {/* Right: Cash breakdown */}
            <div>
              <p style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Cash (overall) breakdown</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div style={{ padding: 16, background: 'white', borderRadius: 16, border: '1px solid rgba(224,226,232,0.5)' }}>
                  <p style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', fontWeight: 700,
                    textTransform: 'uppercase', marginBottom: 4 }}>Lock</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmtAmount(margin, currency)}</p>
                </div>
                <div style={{ padding: 16, background: 'white', borderRadius: 16, border: '1px solid rgba(224,226,232,0.5)' }}>
                  <p style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', fontWeight: 700,
                    textTransform: 'uppercase', marginBottom: 4 }}>Buffer</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmtAmount(buffer, currency)}</p>
                </div>
                <div style={{ padding: 16, background: 'white', borderRadius: 16, border: '1px solid rgba(224,226,232,0.5)' }}>
                  <p style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', fontWeight: 700,
                    textTransform: 'uppercase', marginBottom: 4 }}>Money Market</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmtAmount(money_market, currency)}</p>
                </div>
                <div style={{ padding: 16, background: 'var(--color-brand-yellow)', borderRadius: 16, boxShadow: 'var(--shadow-sm)' }} className="pulse-available">
                  <p style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 700,
                    textTransform: 'uppercase', marginBottom: 4 }}>Available</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmtAmount(available_cash, currency)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Widgets Row: Pool Health + Money Reserve Status */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Pool Health Index */}
        <div style={{
          background: 'white', border: '1px solid var(--color-hairline)', borderRadius: 28, padding: 32,
          boxShadow: 'var(--shadow-sm)',
        }} className="animate-fade-up stagger-2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
              Pool Health Index
            </h3>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
              borderRadius: 9999, background: 'var(--color-teal-light)', color: 'var(--color-brand-teal)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>●</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {money_reserve_status}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 192, height: 96, overflow: 'hidden' }}>
              <svg width="192" height="192" viewBox="0 0 100 100">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="transparent" stroke="#f4f4f6" strokeWidth="12" />
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="transparent" stroke="#0fbcb0" strokeWidth="12"
                  strokeDasharray={gaugeCircumference} strokeDashoffset={gaugeDashoffset} className="health-gauge-path" />
              </svg>
              <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                <p style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-primary)', margin: 0 }}>
                  {gaugePercent}%
                </p>
                <p style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                  Efficiency
                </p>
              </div>
            </div>
            <p style={{ marginTop: 32, fontSize: 14, color: 'var(--color-on-surface-variant)', textAlign: 'center', padding: '0 48px', lineHeight: 1.6 }}>
              Aggregated performance is 13.35% above the monthly risk benchmark.
            </p>
          </div>
        </div>

        {/* Money Reserve Status */}
        <div style={{
          background: 'white', border: '1px solid var(--color-hairline)', borderRadius: 28, padding: 32,
          boxShadow: 'var(--shadow-sm)',
        }} className="animate-fade-up stagger-3">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
              Money Reserve Status
            </h3>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
              borderRadius: 9999, background: isReserveOptimal ? 'var(--color-teal-light)' : isReserveDanger ? 'rgba(255,153,153,0.2)' : 'rgba(66,98,255,0.12)',
              color: isReserveOptimal ? 'var(--color-brand-teal)' : isReserveDanger ? 'var(--color-brand-coral)' : 'var(--color-brand-blue)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>●</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {money_reserve_status}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Bar with zones */}
            <div style={{ position: 'relative', height: 12, background: '#f4f4f6', borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '25%', background: 'rgba(255,153,153,0.3)' }} />
              <div style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, width: '50%', background: 'rgba(15,188,176,0.3)' }} />
              <div style={{ position: 'absolute', left: '75%', top: 0, bottom: 0, width: '25%', background: 'rgba(66,98,255,0.15)' }} />
              <div className="shimmer-bar" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
              <div style={{
                position: 'absolute', top: 0, bottom: 0, width: 6, background: 'var(--color-primary)',
                borderRadius: 9999, left: `${reserveMarkerLeft}%`, transition: 'left 1s ease',
              }} />
            </div>
            {/* Zone labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', fontSize: 10, fontWeight: 700, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <div style={{ textAlign: 'left', color: 'var(--color-brand-coral)' }}>
                Danger<br /><span style={{ fontWeight: 400, textTransform: 'none' }}>{'< '}{fmtAmount(lowerBound || 45000, currency)}</span>
              </div>
              <div style={{ textAlign: 'center', color: 'var(--color-brand-teal)' }}>
                Optimal<br /><span style={{ fontWeight: 400, textTransform: 'none' }}>{fmtAmount(lowerBound || 45000, currency)} - {fmtAmount(upperBound || 90000, currency)}</span>
              </div>
              <div style={{ textAlign: 'right', color: 'var(--color-brand-blue)' }}>
                Neutral<br /><span style={{ fontWeight: 400, textTransform: 'none' }}>{'> '}{fmtAmount(upperBound || 90000, currency)}</span>
              </div>
            </div>
            {/* Info */}
            <div style={{
              padding: 16, background: 'rgba(15,188,176,0.08)', borderRadius: 16,
              border: '1px solid rgba(15,188,176,0.2)',
            }}>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-on-surface-variant)', fontStyle: 'italic', margin: 0 }}>
                Current available liquidity ({fmtAmount(available_cash || 0, currency)}) is within the optimal threshold relative to the {fmtAmount(margin + buffer || 0, currency)} buffer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio Grid */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: -0.5, margin: 0 }}>
            Active Portfolios
          </h2>
          <span style={{ fontSize: 12, color: 'var(--color-slate)' }}>{portfolios.length} portfolios</span>
        </div>

        {portfolios.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 4px' }}>No portfolios yet</p>
            <p style={{ fontSize: 13, color: 'var(--color-slate)', margin: '0 0 20px' }}>Create your first portfolio</p>
            <button className="btn-primary" onClick={() => navigate('/create-portfolio')}>+ Create Portfolio</button>
          </div>
        ) : (
          <DndProvider backend={HTML5Backend}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
              {portfolios.map((p) => (
                <PortfolioCard
                  key={p.portfolio_id}
                  portfolio={p}
                  currency={currency}
                  navigate={navigate}
                  onTransfer={(source, dest) => setTransferModal({ source, destination: dest })}
                />
              ))}
            </div>
          </DndProvider>
        )}
      </section>

      <TransferModal
        open={!!transferModal.source}
        source={transferModal.source!}
        destination={transferModal.destination!}
        onClose={() => setTransferModal({ source: null, destination: null })}
        onSuccess={(msg) => { setAlertMsg(msg); api.getOverview().then(setData).catch(() => {}); }}
      />

      {alertMsg && <ToastAlert message={alertMsg} onClose={() => setAlertMsg(null)} />}
    </div>
  );
}
