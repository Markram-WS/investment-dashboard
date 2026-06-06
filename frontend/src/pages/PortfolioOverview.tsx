import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { api } from "../lib/api";
import { PortfolioOverviewItem, OverviewResponse } from "../types";
import { getPortfolioTags, getProfitPct, getStatusMessage } from "../utils/tags";
import { fmtAmount } from "../utils/format";
import TransferModal from "../screens/components/TransferModal";
import ToastAlert from "../screens/components/ToastAlert";
import Button from "../screens/components/Button";

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
  const tags = getPortfolioTags(p);
  const profitPct = getProfitPct(p);
  const statusMessage = getStatusMessage(p);
  const isDanger = p.risk_status === "Danger";
  const isWarning = p.risk_status === "Warning";
  const cardBg = isDanger ? 'var(--color-coral-light)' : isWarning ? 'var(--color-yellow-light)' : 'var(--color-canvas)';
  const statusBg = isDanger ? 'var(--color-primary)' : 'var(--color-canvas)';
  const statusText = isDanger ? 'var(--color-on-primary)' : 'var(--color-slate)';
  const dropGlow = canDrop && isOver ? '0 0 0 3px var(--color-brand-teal)' : canDrop ? '0 0 0 2px color-mix(in srgb, var(--color-brand-teal) 30%, transparent)' : '';

  return (
    <div ref={dropRef}
      className="card card-hover animate-fade-up p-8 cursor-pointer"
      style={{
        background: cardBg,
        boxShadow: dropGlow || undefined,
      }}
      onClick={() => navigate(`/analytics/portfolio/${p.portfolio_id}`)}>

      <div className="flex justify-between items-start mb-7">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h3 className="text-2xl font-bold text-ink m-0">
              {p.portfolio_name}
            </h3>
            <div className="flex gap-1.5">
              {tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-white/80 rounded-full text-[9px] font-bold uppercase tracking-widest text-ink">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <p className="text-sm text-slate font-medium m-0">
            Managed algorithmic portfolio
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate font-bold uppercase tracking-widest mb-1">
            Profit
          </p>
          <p className="text-2xl font-black text-brand-teal m-0">
            {profitPct >= 0 ? '+' : ''}{profitPct.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="mb-7">
        <p className="text-[10px] text-slate font-bold uppercase tracking-widest mb-1">
          Asset Total
        </p>
        <p className="text-4xl font-bold text-ink tracking-tight m-0">
          {fmtAmount(total, currency)}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-7">
        <div className="p-4 bg-canvas rounded-xl shadow-sm">
          <p className="text-[9px] text-slate font-bold uppercase tracking-wide mb-1">Lock</p>
          <p className="text-base font-bold text-ink m-0">{fmtAmount(p.margin, currency)}</p>
        </div>
        <div className="p-4 bg-canvas rounded-xl shadow-sm">
          <p className="text-[9px] text-slate font-bold uppercase tracking-wide mb-1">Buffer</p>
          <p className="text-base font-bold text-ink m-0">{fmtAmount(p.buffer, currency)}</p>
        </div>
        <div className="p-4 bg-canvas rounded-xl shadow-sm">
          <p className="text-[9px] text-slate font-bold uppercase tracking-wide mb-1">Money Market</p>
          <p className="text-base font-bold text-ink m-0">{fmtAmount(p.money_market, currency)}</p>
        </div>
        <DraggableAvailable portfolio={p} currency={currency} />
      </div>

      <div className="px-4 py-4 rounded-xl flex items-center gap-2.5 relative overflow-hidden"
        style={{ background: statusBg }}>
        {isDanger && <div className="shimmer-bar absolute inset-0 opacity-10 pointer-events-none" />}
        <span className="text-sm font-bold" style={{ color: isDanger ? 'var(--color-brand-coral)' : 'var(--color-brand-teal)' }}>
          {isDanger ? '⚠' : '✓'}
        </span>
        <span className="text-[13px] font-medium" style={{ color: statusText }}>
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
    <div ref={dragRef}
      className="p-4 bg-brand-yellow rounded-xl shadow-sm pulse-available"
      style={{
        transition: 'box-shadow 0.15s ease, opacity 0.15s ease',
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
      }}>
      <p className="text-[9px] text-primary font-bold uppercase tracking-wide mb-1">Available</p>
      <p className="text-base font-bold text-primary m-0">
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
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-slate">Loading…</div>
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
    <div className="max-w-[1200px] mx-auto px-6 py-10">

      <header className="flex items-center justify-between mb-10 animate-fade-up">
        <h1 className="text-5xl font-bold text-ink tracking-tight m-0">
          Overview
        </h1>
      </header>

      <section className="mb-6 animate-fade-up stagger-1">
        <div className="bg-teal-light border border-hairline/30 rounded-[28px] p-10 shadow-sm">
          <div className="grid grid-cols-[1fr_2fr] gap-8">
            <div>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-2">Asset total</p>
              <h1 className="text-4xl font-bold text-ink tracking-tight mb-4">
                {fmtAmount(totalEquity, currency)}
              </h1>
              <div className="flex items-center gap-1.5" style={{ color: plPositive ? 'var(--color-brand-teal)' : 'var(--color-brand-coral)' }}>
                <span className="text-sm font-bold">{plPositive ? '▲' : '▼'}</span>
                <span className="text-sm font-bold">{plPositive ? '+' : ''}{overallPLPct.toFixed(1)}% Overall P/L</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-4">Cash (overall) breakdown</p>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-canvas rounded-xl border border-hairline/50">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase mb-1">Lock</p>
                  <p className="text-2xl font-bold text-ink m-0">{fmtAmount(margin, currency)}</p>
                </div>
                <div className="p-4 bg-canvas rounded-xl border border-hairline/50">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase mb-1">Buffer</p>
                  <p className="text-2xl font-bold text-ink m-0">{fmtAmount(buffer, currency)}</p>
                </div>
                <div className="p-4 bg-canvas rounded-xl border border-hairline/50">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase mb-1">Money Market</p>
                  <p className="text-2xl font-bold text-ink m-0">{fmtAmount(money_market, currency)}</p>
                </div>
                <div className="p-4 bg-brand-yellow rounded-xl shadow-sm pulse-available">
                  <p className="text-[10px] text-primary font-bold uppercase mb-1">Available</p>
                  <p className="text-2xl font-bold text-primary m-0">{fmtAmount(available_cash, currency)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-canvas border border-hairline rounded-[28px] p-8 shadow-sm animate-fade-up stagger-2">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-ink uppercase tracking-widest m-0">
              Pool Health Index
            </h3>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-light text-brand-teal">
              <span className="text-xs font-bold">●</span>
              <span className="text-[10px] font-bold uppercase tracking-wide">
                {money_reserve_status}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-24 overflow-hidden">
              <svg width="192" height="192" viewBox="0 0 100 100">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="transparent" stroke="var(--color-hairline-soft)" strokeWidth="12" />
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="transparent" stroke="var(--color-brand-teal)" strokeWidth="12"
                  strokeDasharray={gaugeCircumference} strokeDashoffset={gaugeDashoffset} className="health-gauge-path" />
              </svg>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                <p className="text-4xl font-bold tracking-tight text-ink m-0">
                  {gaugePercent}%
                </p>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest m-0">
                  Efficiency
                </p>
              </div>
            </div>
            <p className="mt-8 text-sm text-on-surface-variant text-center px-12 leading-relaxed">
              Aggregated performance is 13.35% above the monthly risk benchmark.
            </p>
          </div>
        </div>

        <div className="bg-canvas border border-hairline rounded-[28px] p-8 shadow-sm animate-fade-up stagger-3">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-ink uppercase tracking-widest m-0">
              Money Reserve Status
            </h3>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{
                background: isReserveOptimal ? 'var(--color-teal-light)' : isReserveDanger ? 'color-mix(in srgb, var(--color-brand-coral) 20%, transparent)' : 'color-mix(in srgb, var(--color-brand-blue) 12%, transparent)',
                color: isReserveOptimal ? 'var(--color-brand-teal)' : isReserveDanger ? 'var(--color-brand-coral)' : 'var(--color-brand-blue)',
              }}>
              <span className="text-xs font-bold">●</span>
              <span className="text-[10px] font-bold uppercase tracking-wide">
                {money_reserve_status}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-8">
            <div className="relative h-3 bg-hairline-soft rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1/4" style={{ background: 'color-mix(in srgb, var(--color-brand-coral) 30%, transparent)' }} />
              <div className="absolute left-1/4 top-0 bottom-0 w-1/2" style={{ background: 'color-mix(in srgb, var(--color-brand-teal) 30%, transparent)' }} />
              <div className="absolute left-3/4 top-0 bottom-0 w-1/4" style={{ background: 'color-mix(in srgb, var(--color-brand-blue) 15%, transparent)' }} />
              <div className="shimmer-bar absolute inset-0 pointer-events-none" />
              <div className="absolute top-0 bottom-0 w-1.5 bg-primary rounded-full" style={{ left: `${reserveMarkerLeft}%`, transition: 'left 1s ease' }} />
            </div>
            <div className="grid grid-cols-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">
              <div className="text-left text-brand-coral">
                Danger<br /><span className="font-normal normal-case">{'< '}{fmtAmount(lowerBound || 45000, currency)}</span>
              </div>
              <div className="text-center text-brand-teal">
                Optimal<br /><span className="font-normal normal-case">{fmtAmount(lowerBound || 45000, currency)} - {fmtAmount(upperBound || 90000, currency)}</span>
              </div>
              <div className="text-right text-brand-blue">
                Neutral<br /><span className="font-normal normal-case">{'> '}{fmtAmount(upperBound || 90000, currency)}</span>
              </div>
            </div>
            <div className="p-4 rounded-xl border" style={{ background: 'color-mix(in srgb, var(--color-brand-teal) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--color-brand-teal) 20%, transparent)' }}>
              <p className="text-[13px] leading-relaxed text-on-surface-variant italic m-0">
                Current available liquidity ({fmtAmount(available_cash || 0, currency)}) is within the optimal threshold relative to the {fmtAmount(margin + buffer || 0, currency)} buffer.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-ink tracking-tight m-0">
            Active Portfolios
          </h2>
          <span className="text-xs text-slate">{portfolios.length} portfolios</span>
        </div>

        {portfolios.length === 0 ? (
          <div className="card text-center p-12">
            <p className="text-base font-medium text-ink mb-1">No portfolios yet</p>
            <p className="text-[13px] text-slate mb-5">Create your first portfolio</p>
            <Button variant="primary" onClick={() => navigate('/create-portfolio')}>+ Create Portfolio</Button>
          </div>
        ) : (
          <DndProvider backend={HTML5Backend}>
            <div className="grid grid-cols-2 gap-6">
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
