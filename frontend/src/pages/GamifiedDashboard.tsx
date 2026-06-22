import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { OverviewResponse, PortfolioOverviewItem } from "../types";
import { fmtAmount } from "../utils/format";

/* ─── Foundry art assets (from stitch_algorithmic_portfolio_dashboard zip) ─── */
const FOUNDRY_ART = [
  "/foundry-art/coal_powerplant.png",
  "/foundry-art/steel_mill.png",
  "/foundry-art/railway_station.png",
  "/foundry-art/dam_construction.png",
  "/foundry-art/food_cannery.png",
  "/foundry-art/textile_mill.png",
];
const FOUNDRY_META = [
  { id: "CP-003", icon: "factory", title: "Coal Plant", desc: "Steam turbine" },
  { id: "SM-101", icon: "hardware", title: "Steel Mill", desc: "Blast furnace" },
  { id: "RW-055", icon: "train", title: "Railway", desc: "Locomotive hub" },
  { id: "DC-117", icon: "water", title: "Dam Works", desc: "Hydro power" },
  { id: "FC-029", icon: "restaurant", title: "Cannery", desc: "Food processing" },
  { id: "TM-077", icon: "widgets", title: "Textile Mill", desc: "Loom works" },
];

function pickFoundry(i: number) {
  return { art: FOUNDRY_ART[i % FOUNDRY_ART.length], meta: FOUNDRY_META[i % FOUNDRY_META.length] };
}

function profitColor(n: number) {
  return n >= 0 ? "#2D5A27" : "#ba1a1a";
}

/* ═══════════════════════════════════════════════════════════════
   Machine Ledger — Factory Card (CCG-style)
   ═══════════════════════════════════════════════════════════════ */
function FactoryCard({ p, i }: { p: PortfolioOverviewItem; i: number }) {
  const navigate = useNavigate();
  const { art, meta } = pickFoundry(i);
  const total = (p.margin || 0) + (p.buffer || 0) + (p.available_cash || 0) + (p.money_market || 0) + (p.total_pl || 0);
  const profitPct = p.profit_percentage ?? 0;
  const isDanger = p.risk_status === "Danger";

  return (
    <div
      className="factory-card ornate-frame cursor-pointer overflow-hidden vintage-shadow relative rounded-xl"
      style={{ background: "#FDFBF7", border: "1px solid #ede7de", transition: "box-shadow 0.15s ease" }}
      onClick={() => navigate(`/analytics/portfolio/${p.portfolio_id}`)}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 28px rgba(0,0,0,0.12)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 10px 30px -5px rgba(0,0,0,0.08)"; }}
    >
      {/* Artwork header */}
      <div className="relative h-48 w-full overflow-hidden" style={{ zIndex: 0 }}>
        <img alt="Foundry Industrial Art" className="w-full h-full object-cover sepia-img" src={art} />
        {/* ID badge */}
        <div className="absolute top-4 left-4 bg-ledger-paper/90 backdrop-blur-sm px-3 py-1 rounded-sm border border-ml-outline/20 shadow-sm">
          <span className="label-caps text-ml-ink-black">{meta.id}</span>
        </div>
        {/* Profit badge */}
        <div className="absolute top-4 right-4 bg-ledger-paper/90 backdrop-blur-sm px-2.5 py-1 rounded-sm flex items-center gap-1.5 shadow-sm">
          <span className="data-lg font-bold" style={{ color: profitColor(profitPct) }}>
            {profitPct >= 0 ? "+" : ""}{profitPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Content with overlap — gradient fade at top for smooth image→paper transition */}
      <div className="relative px-6 pb-6 space-y-6 z-10 border-t border-ml-surface-container-high card-fade-top">
        {/* Factory name */}
        <div className="text-center space-y-1 pt-4">
          <h3 className="headline-lg text-ml-ink-black italic font-bold">{p.portfolio_name}</h3>
          <p className="label-mono text-ml-secondary">{meta.title} · {meta.desc}</p>
        </div>

        <div className="h-px bg-ml-surface-container-high w-full" />

        {/* Primary metric */}
        <div className="text-center space-y-2">
          <p className="label-caps text-ml-ink-grey">Aggregate Capital</p>
          <h3 className="data-display text-ml-ink-black tracking-tighter">{fmtAmount(total, "USD")}</h3>
        </div>

        <div className="h-px bg-ml-surface-container-high w-full" />

        {/* Resource bento grid */}
        <div className="grid grid-cols-2 gap-4">
          <ResourceBento icon="inventory_2" label="Lock" value={fmtAmount(p.margin, "USD")} />
          <ResourceBento icon="local_fire_department" label="Buffer" value={fmtAmount(p.buffer, "USD")} align="right" />
          <ResourceBento icon="trending_up" label="Market" value={fmtAmount(p.money_market, "USD")} />
          <ResourceBento icon="monetization_on" label="Avail" value={fmtAmount(p.available_cash, "USD")} align="right" highlight />
        </div>

        {/* Status bar */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{
            background: isDanger ? "rgba(186,26,26,0.08)" : "rgba(45,90,39,0.06)",
            border: `1px solid ${isDanger ? "rgba(186,26,26,0.2)" : "rgba(45,90,39,0.2)"}`,
          }}
        >
          <div className="wax-seal" />
          <span className="headline-sm italic" style={{ color: isDanger ? "#ba1a1a" : "#2D5A27" }}>
            {isDanger ? "⚠ Boiler pressure critical" : "✓ Operational · Optimal"}
          </span>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-secondary py-3 flex items-center justify-center gap-2"
            onClick={(e) => { e.stopPropagation(); }}>
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>history_edu</span>
            Log
          </button>
          <button className="btn-secondary py-3 flex items-center justify-center gap-2"
            onClick={(e) => { e.stopPropagation(); }}>
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>logout</span>
            Extract
          </button>
        </div>
      </div>
    </div>
  );
}

function ResourceBento({ icon, label, value, align, highlight }: {
  icon: string; label: string; value: string; align?: "right"; highlight?: boolean;
}) {
  return (
    <div
      className="p-4 rounded-xl flex flex-col justify-between transition-all"
      style={{
        background: highlight ? "rgba(45,90,39,0.06)" : "#ffffff",
        border: `1px solid ${highlight ? "rgba(45,90,39,0.2)" : "#ede7de"}`,
        textAlign: align === "right" ? "right" : "left",
      }}
    >
      <div className={`flex items-center gap-1.5 text-ml-ink-grey/60 mb-2 ${align === "right" ? "justify-end" : ""}`}>
        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 0" }}>{icon}</span>
        <span className="label-mono">{label}</span>
      </div>
      <span className={`data-lg font-bold ${highlight ? "text-ml-success" : "text-ml-ink-black"}`}
        style={{ fontFeatureSettings: "'tnum'" }}>
        {value}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Machine Ledger — Main Dashboard
   ═══════════════════════════════════════════════════════════════ */
export default function GamifiedDashboard() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getOverview()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="machine-ledger flex items-center justify-center h-[60vh]">
        <div className="label-caps text-ml-ink-grey">Firing up the furnaces…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="machine-ledger flex items-center justify-center h-[60vh]">
        <div className="label-caps text-ml-ink-grey">No foundry data available</div>
      </div>
    );
  }

  const { portfolios, pool_health_index, margin, buffer, available_cash, money_market, total_pl } = data;
  const gaugePercent = Math.min(100, Math.max(0, Math.round(pool_health_index)));
  const totalEquity = (margin || 0) + (buffer || 0) + (available_cash || 0) + (money_market || 0) + (total_pl || 0);
  const gaugeCircumference = 125.6;
  const gaugeDashoffset = gaugeCircumference * (1 - gaugePercent / 100);

  const lowerBound = (margin + buffer) * 1.2;
  const isReserveDanger = available_cash != null && available_cash < lowerBound;
  const reserveMarkerPct = margin + buffer > 0
    ? Math.min(95, Math.max(5, ((available_cash || 0) / ((margin + buffer) * 2.0 + 1)) * 100))
    : 50;

  return (
    <div className="machine-ledger" style={{ minHeight: "100vh" }}>
      {/* ── Sticky Header ── */}
      <header className="w-full top-0 sticky bg-ml-surface/90 backdrop-blur-sm border-b border-ml-surface-container-high" style={{ zIndex: 40 }}>
        <div className="flex justify-between items-center px-4 md:px-8 py-4 max-w-[1440px] mx-auto">
          <button className="w-10 h-10 flex items-center justify-center rounded border border-ml-outline/20 text-ml-primary">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="headline-lg text-ml-primary tracking-tight italic font-bold">Machine Ledger</h1>
          <button className="w-10 h-10 flex items-center justify-center rounded border border-ml-outline/20 text-ml-primary">
            <span className="material-symbols-outlined text-xl">architecture</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-grow px-4 md:px-8 pt-6 pb-28 max-w-[1440px] mx-auto w-full space-y-8">

        {/* ═══ Hero Portfolio Card ═══ */}
        <section className="bg-ml-ledger-paper border border-ml-surface-container-high overflow-hidden vintage-shadow relative rounded-xl">
          {/* Artwork header */}
          <div className="relative h-64 w-full overflow-hidden" style={{ zIndex: 0 }}>
            <img alt="Central Foundry" className="w-full h-full object-cover sepia-img"
              src="/foundry-art/victorian-station-header.png" />
            <div className="absolute top-4 left-4 bg-ledger-paper/90 backdrop-blur-sm px-3 py-1 rounded-sm shadow-sm border border-ml-outline/20">
              <span className="label-caps text-ml-ink-black">Central Foundry</span>
            </div>
            <div className="absolute top-4 right-4 bg-ledger-paper/90 backdrop-blur-sm px-2.5 py-1 rounded-sm flex items-center gap-1.5 shadow-sm border border-ml-outline/20">
              <span className="data-lg font-bold" style={{ color: (total_pl || 0) >= 0 ? "#2D5A27" : "#ba1a1a" }}>
                {(total_pl || 0) >= 0 ? "+" : ""}{((total_pl || 0) / (totalEquity - (total_pl || 0) || 1) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Content — gradient fade at top for smooth image→paper transition */}
          <div className="relative px-8 pb-8 space-y-8 z-10 -mt-16 border-t border-ml-surface-container-high card-fade-top">
            <div className="text-center space-y-3 pt-4">
              <p className="label-caps text-ml-ink-grey tracking-[0.25em]">Aggregate Capital</p>
              <h3 className="data-display text-ml-ink-black tracking-tighter">{fmtAmount(totalEquity, "USD")}</h3>
            </div>

            <div className="h-px bg-ml-surface-container-high w-full" />

            {/* Bento grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <BentoCard icon="inventory_2" label="Lock" value={fmtAmount(margin, "USD")} />
              <BentoCard icon="local_fire_department" label="Buffer" value={fmtAmount(buffer, "USD")} />
              <BentoCard icon="trending_up" label="Market" value={fmtAmount(money_market, "USD")} />
              <BentoCard icon="monetization_on" label="Avail" value={fmtAmount(available_cash, "USD")} highlight />
            </div>
          </div>
        </section>

        {/* ═══ Foundry Status + Coal Reserve ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* System Integrity */}
          <div className="bg-ml-surface-container-low border border-ml-surface-container-high p-6 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="bg-ml-ledger-paper p-3 rounded-xl border border-ml-surface-container-high shadow-sm">
                <span className="material-symbols-outlined text-ml-ink-black text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              </div>
              <div>
                <h5 className="headline-sm text-ml-primary italic font-semibold">System Integrity</h5>
                <p className="data-lg text-ml-secondary">
                  Foundry status: <span className="text-ml-primary font-bold">{gaugePercent}% efficiency</span> · OPERATIONAL
                </p>
              </div>
            </div>
          </div>

          {/* Coal Reserve */}
          <div className="bg-ml-ledger-paper border border-ml-surface-container-high p-6 rounded-xl vintage-shadow">
            <div className="flex items-center justify-between mb-6">
              <h5 className="headline-sm text-ml-primary italic font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>inventory_2</span>
                Coal Reserve
              </h5>
              <span className="label-caps px-3 py-1 rounded-full"
                style={{
                  background: !isReserveDanger ? "rgba(45,90,39,0.12)" : "rgba(186,26,26,0.12)",
                  color: !isReserveDanger ? "#2D5A27" : "#ba1a1a",
                }}>
                ● {!isReserveDanger ? "Sufficient" : "Shortage"}
              </span>
            </div>
            <div className="flex flex-col gap-4">
              <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "#ede7de" }}>
                <div className="absolute left-0 top-0 bottom-0 w-1/4" style={{ background: "rgba(186,26,26,0.3)" }} />
                <div className="absolute left-1/4 top-0 bottom-0 w-1/2" style={{ background: "rgba(45,90,39,0.25)" }} />
                <div className="absolute left-3/4 top-0 bottom-0 w-1/4" style={{ background: "rgba(178,165,155,0.3)" }} />
                <div className="absolute top-0 bottom-0 w-1.5 rounded-full"
                  style={{
                    left: `${reserveMarkerPct}%`,
                    background: "#675c54",
                    transition: "left 1s ease",
                    boxShadow: "0 0 4px rgba(103,92,84,0.4)",
                  }}
                />
              </div>
              <div className="grid grid-cols-3 label-caps" style={{ color: "#636E72" }}>
                <span style={{ color: "#ba1a1a" }}>Shortage</span>
                <span className="text-center" style={{ color: "#2D5A27" }}>Sufficient</span>
                <span className="text-right" style={{ color: "#B2A59B" }}>Stockpile</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Steam Pressure Gauge ═══ */}
        <section className="bg-ml-ledger-paper border border-ml-surface-container-high p-8 rounded-xl vintage-shadow">
          <div className="flex items-center justify-between mb-8">
            <h3 className="headline-sm text-ml-primary italic font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>speed</span>
              Steam Pressure
            </h3>
            <span className="label-caps px-3 py-1 rounded-full"
              style={{
                background: gaugePercent >= 70 ? "rgba(45,90,39,0.12)" : gaugePercent >= 40 ? "rgba(184,134,11,0.12)" : "rgba(186,26,26,0.12)",
                color: gaugePercent >= 70 ? "#2D5A27" : gaugePercent >= 40 ? "#B8860B" : "#ba1a1a",
              }}>
              ● {gaugePercent >= 70 ? "Optimal" : gaugePercent >= 40 ? "Monitoring" : "Critical"}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <div className="relative w-56 h-28 overflow-hidden">
              <svg width="224" height="224" viewBox="0 0 100 100">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="transparent" stroke="#ede7de" strokeWidth="12" />
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50" fill="transparent"
                  stroke={gaugePercent >= 70 ? "#2D5A27" : gaugePercent >= 40 ? "#B8860B" : "#ba1a1a"}
                  strokeWidth="12" strokeDasharray={gaugeCircumference} strokeDashoffset={gaugeDashoffset}
                  className="health-gauge-path" style={{ transition: "stroke-dashoffset 1.5s ease" }}
                />
                <line x1="50" y1="50" x2="50" y2="18" stroke="#2D3436" strokeWidth="2" strokeLinecap="round"
                  className="steam-needle" style={{
                    transformOrigin: "50px 50px",
                    transform: `rotate(${-90 + (gaugePercent / 100) * 180}deg)`,
                    transition: "transform 1.5s ease",
                  }} />
                <circle cx="50" cy="50" r="5" fill="#675c54" />
                <circle cx="50" cy="50" r="2.5" fill="#ede7de" />
              </svg>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                <p className="data-display text-ml-ink-black m-0" style={{ fontSize: "36px" }}>{gaugePercent}%</p>
                <p className="label-caps text-ml-ink-grey m-0">Pressure</p>
              </div>
            </div>
            <p className="mt-8 text-sm text-center px-8 leading-relaxed font-body" style={{ color: "#636E72" }}>
              Boiler efficiency at {gaugePercent}%. {gaugePercent < 40 ? "Feed more coal urgently!" : gaugePercent < 70 ? "Monitor steam levels." : "Engines at full power."}
            </p>
          </div>
        </section>

        {/* ═══ Factory Cards ═══ */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="headline-lg text-ml-ink-black italic font-bold m-0">
              Industrial Foundries
            </h2>
            <span className="label-caps text-ml-ink-grey">{portfolios.length} facilities</span>
          </div>

          {portfolios.length === 0 ? (
            <div className="rounded-xl text-center p-12" style={{ background: "#FDFBF7", border: "1px solid #ede7de" }}>
              <p className="headline-sm text-ml-ink-black mb-1">No foundries yet</p>
              <p className="font-body text-sm" style={{ color: "#636E72" }}>Establish your first industrial venture</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {portfolios.map((p, i) => (
                <FactoryCard key={p.portfolio_id} p={p} i={i} />
              ))}
            </div>
          )}
        </section>

        {/* ═══ Legend ═══ */}
        <div className="rounded-xl p-4 text-xs flex flex-wrap gap-x-6 gap-y-2 font-label"
          style={{ background: "#FDFBF7", border: "1px solid #ede7de", color: "#636E72" }}>
          <span>🔩 Machinery = Margin locked</span>
          <span>📦 Reserve = Cash buffer</span>
          <span>🏦 Treasury = Money market</span>
          <span>🪨 Coal = Available cash</span>
        </div>
      </main>

      {/* ═══ Bottom Navigation ═══ */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center h-20 pb-2 px-6 bg-ml-surface border-t border-ml-surface-container-high" style={{ zIndex: 50 }}>
        <a className="flex flex-col items-center justify-center gap-1 text-ml-ink-black" href="#"
          style={{ textDecoration: "none" }}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>factory</span>
          <span className="label-mono">Foundry</span>
          <div className="w-1 h-1 bg-ml-ink-black rounded-full mt-0.5" />
        </a>
        <a className="flex flex-col items-center justify-center gap-1 text-ml-ink-grey opacity-50 hover:opacity-100 transition-opacity"
          href="#" style={{ textDecoration: "none" }}>
          <span className="material-symbols-outlined text-2xl">query_stats</span>
          <span className="label-mono">Data</span>
        </a>
        <a className="flex flex-col items-center justify-center gap-1 text-ml-ink-grey opacity-50 hover:opacity-100 transition-opacity"
          href="#" style={{ textDecoration: "none" }}>
          <span className="material-symbols-outlined text-2xl">currency_exchange</span>
          <span className="label-mono">Market</span>
        </a>
        <a className="flex flex-col items-center justify-center gap-1 text-ml-ink-grey opacity-50 hover:opacity-100 transition-opacity"
          href="#" style={{ textDecoration: "none" }}>
          <span className="material-symbols-outlined text-2xl">badge</span>
          <span className="label-mono">Officer</span>
        </a>
      </nav>
    </div>
  );
}

function BentoCard({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="p-5 rounded-xl flex flex-col justify-between transition-all"
      style={{
        background: highlight ? "rgba(45,90,39,0.06)" : "#ffffff",
        border: `1px solid ${highlight ? "rgba(45,90,39,0.2)" : "#ede7de"}`,
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="label-mono text-ml-ink-grey uppercase tracking-widest">{label}</span>
        <span className="material-symbols-outlined text-lg"
          style={{ color: "rgba(99,110,114,0.5)", fontVariationSettings: "'FILL' 0" }}>{icon}</span>
      </div>
      <span className={`data-lg font-bold ${highlight ? "text-ml-success" : "text-ml-ink-black"}`}
        style={{ fontFeatureSettings: "'tnum'" }}>
        {value}
      </span>
    </div>
  );
}
