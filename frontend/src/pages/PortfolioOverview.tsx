import { useState, useEffect, useCallback } from "react";
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
  portfolio, currency, navigate, onTransfer, isDragging,
}: {
  portfolio: PortfolioOverviewItem;
  currency: "USD" | "THB";
  navigate: (p: string) => void;
  onTransfer: (source: { id: number; name: string; available: number }, dest: { id: number; name: string }) => void;
  isDragging: boolean;
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
        <DraggableAvailable portfolio={p} currency={currency} />
        <div style={{ padding: 16, background: 'var(--color-canvas)', borderRadius: 'var(--rounded-xl)',
          boxShadow: 'var(--shadow-sm)', transition: 'boxShadow 0.15s ease' }}>
          <p style={{ fontSize: 9, color: 'var(--color-slate)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Money Market</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmtAmount(p.money_market, currency)}</p>
        </div>
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
  const [gaugeOffset, setGaugeOffset] = useState(125.6);
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

  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => {
        const circumference = 125.6;
        setGaugeOffset(circumference * (1 - data.pool_health_index / 100));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: 'var(--color-slate)' }}>Loading…</div>
    </div>
  );

  if (!data) return null;

  const { margin, buffer, available_cash, money_market, total_pl, pool_health_index, money_reserve_status, portfolios } = data;
  const totalEquity = (margin || 0) + (buffer || 0) + (available_cash || 0) + (money_market || 0) + (total_pl || 0);
  const overallAvailable = (available_cash || 0) + (total_pl || 0);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      {/* Overall Summary */}
      <div className="card" style={{ padding: '24px 32px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {/* Pool Health Gauge */}
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <svg width="64" height="64" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="none" stroke="var(--color-hairline)" strokeWidth="3" />
              <circle cx="20" cy="20" r="18" fill="none" stroke={pool_health_index >= 70 ? 'var(--color-brand-teal)' : pool_health_index >= 40 ? 'var(--color-brand-yellow)' : 'var(--color-brand-coral)'} strokeWidth="3"
                strokeDasharray={`${(pool_health_index / 100) * 113} 113`} strokeLinecap="round" transform="rotate(-90 20 20)" />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-ink)' }}>
              {Math.round(pool_health_index)}
            </span>
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Pool Health</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>{money_reserve_status}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Total Equity</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{fmtAmount(totalEquity, currency)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Available Cash</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-brand-teal)', margin: 0 }}>{fmtAmount(overallAvailable, currency)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Total P/L</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: (total_pl || 0) >= 0 ? 'var(--color-brand-teal)' : 'var(--color-brand-coral)', margin: 0 }}>{fmtAmount(total_pl || 0, currency)}</p>
          </div>
        </div>
      </div>
      {/* Breakdown bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Margin Locked', value: margin, color: 'var(--color-slate)' },
          { label: 'Cash Buffer', value: buffer, color: 'var(--color-slate)' },
          { label: 'Cash Available', value: available_cash, color: 'var(--color-brand-teal)' },
          { label: 'Money Market', value: money_market, color: 'var(--color-brand-yellow)' },
        ].map(item => (
          <div key={item.label} style={{ flex: 1, padding: '12px 16px', background: 'var(--color-canvas)', borderRadius: 'var(--rounded-xl)', boxShadow: 'var(--shadow-sm)' }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{item.label}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: item.color, margin: 0 }}>{fmtAmount(item.value || 0, currency)}</p>
          </div>
        ))}
      </div>

      <DndProvider backend={HTML5Backend}>
        {/* Portfolio Grid - 2 columns on desktop */}
        <section style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, zIndex: 2, position: 'relative' }}>
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
          )}
        </section>
      </DndProvider>

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