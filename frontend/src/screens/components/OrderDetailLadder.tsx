import React, { useEffect, useMemo, useState } from "react";
import type { SpreadOrder } from "../../types";
import type { ZoneGroupRecord } from "../../lib/api";
import { formatQty } from "../../utils/format";

export type LadderView = "same" | "eq" | "option";
type Density = "key" | "full";

interface OrderDetailLadderProps {
  activeOrders: SpreadOrder[];
  zones: ZoneGroupRecord[];
  onShowZoneGroupModal: () => void;
  onAddOrder: () => void;
  onEditOrder: (order: SpreadOrder) => void;
  onCloseOrder: (order: SpreadOrder) => void;
  onEditZone?: (orders: SpreadOrder[], zone: string) => void;
  onAssignGroup?: (orderIds: string[], groupId: number | null) => void;
  onLinkOrder?: (sourceOrderId: string, targetOrderId: string) => void;
}

/** One visual ladder line: a price level, or one leg when a level holds several. */
interface LadderLine {
  key: string;
  zoneId: number | null;
  label: string;
  eq?: SpreadOrder;
  opt?: SpreadOrder;
  hasLevelLegs: boolean;
}

const money = (v: number | null | undefined) =>
  v == null
    ? "—"
    : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Zone labels that are prices ("32.0") render as `$32.00`; other labels pass through. */
const priceLabel = (label: string) => {
  const trimmed = (label ?? "").trim();
  if (trimmed === "") return label;
  const n = Number(trimmed);
  return Number.isFinite(n) ? money(n) : label;
};

/** A zone's price: its declared band, else a numeric name; non-numeric names sort last. */
const zonePrice = (zone: ZoneGroupRecord) => {
  const price = zone.min_price ?? zone.max_price;
  if (price != null) return price;
  const trimmed = (zone.name ?? "").trim();
  const n = Number(trimmed);
  return trimmed !== "" && Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
};

/** Ladder order: highest price first, non-numeric zone names last. */
const sortZones = (zones: ZoneGroupRecord[]) =>
  [...zones].sort((a, b) => {
    const ap = zonePrice(a);
    const bp = zonePrice(b);
    if (ap !== bp) return ap > bp ? -1 : 1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

const signedMoney = (v: number) =>
  `${v < 0 ? "−" : "+"}$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const statusText = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—";

const shortDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(2)}`;
};

const daysTo = (d?: string | null) => {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.ceil((t - Date.now()) / 86400000));
};

const netOf = (o: SpreadOrder) => {
  if (o.entry_price == null || o.current_price == null) return 0;
  return (o.current_price - o.entry_price) * Number(o.qty || 0);
};


/** Column tracks: fixed, with the flexing track carrying the leftover width. */
const TEMPLATE: Record<string, string> = {
  same: "88px 70px 40px 54px 54px 70px 44px 26px 50px 34px minmax(66px, 1fr)",
  eqKey: "120px 60px minmax(0, 1fr) 60px 96px",
  eqFull: "92px 92px minmax(0, 1fr) 56px 66px 66px 76px",
  optKey: "104px 60px minmax(0, 1fr) 52px 48px 92px",
  optFull: "64px 70px minmax(0, 1fr) 48px 60px 32px 52px 36px 48px 48px 64px",
  narrow: "76px minmax(0, 1fr) 72px",
};

const HEADS: Record<string, string[]> = {
  same: ["Mark", "Status", "Size", "In", "Out", "Net P&L", "Type", "DTE", "Strike", "Size", "Net P&L"],
  eqKey: ["Mark", "Side", "Leg", "Size", "Net P&L"],
  eqFull: ["Mark", "Status", "Comment", "Size", "Price in", "Price out", "Net P&L"],
  optKey: ["Mark", "Side", "Contract", "Size", "DTE", "Net P&L"],
  optFull: ["Mark", "Status", "Comment", "Type", "Date", "DTE", "Strike", "Size", "Pre in", "Pre out", "Net P&L"],
  narrow: ["Mark", "Leg", "Net P&L"],
};

const roundPrice = (v: number) => Math.round(v * 1e8) / 1e8;

const useIsNarrow = () => {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899px)");
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
};

/** Price ladder for one zone: max_price down to min_price by `range`. */
const zoneLevels = (zone: ZoneGroupRecord) => {
  const lo = zone.min_price;
  const hi = zone.max_price;
  const step = zone.range;
  const empty = (price: number | null, label: string) => ({ price, label, legs: [] as SpreadOrder[] });
  if (lo == null && hi == null) return [empty(null, zone.name)];
  const top = (hi ?? lo) as number;
  const bottom = (lo ?? hi) as number;
  if (step == null || step <= 0 || top <= bottom) return [empty(top, money(top))];
  const count = Math.min(199, Math.floor((top - bottom) / step + 1e-9));
  return Array.from({ length: count + 1 }, (_, i) => {
    const price = roundPrice(top - i * step);
    return empty(price, money(price));
  });
};

const buildLines = (zones: ZoneGroupRecord[], orders: SpreadOrder[]): LadderLine[] => {
  const sorted = sortZones(zones);
  const buckets = sorted.map((zone) => ({ zone, levels: zoneLevels(zone) }));
  const byId = new Map(buckets.map((b) => [b.zone.id, b]));
  const ungrouped: SpreadOrder[] = [];

  for (const order of orders) {
    const bucket = order.group_id != null ? byId.get(order.group_id) : undefined;
    if (!bucket) {
      ungrouped.push(order);
      continue;
    }
    const levels = bucket.levels;
    let target = levels[0];
    if (order.entry_price != null && levels[0]?.price != null) {
      // Levels run high to low: the last level at or above the entry price is
      // the nearest one. An entry above the top level clamps to the top row.
      const atOrAbove = levels.filter((l) => l.price != null && l.price >= (order.entry_price as number));
      target = atOrAbove.length > 0 ? atOrAbove[atOrAbove.length - 1] : levels[0];
    }
    target.legs.push(order);
  }

  const emit = (zoneId: number | null, levels: { price: number | null; label: string; legs: SpreadOrder[] }[]) => {
    const lines: LadderLine[] = [];
    levels.forEach((level, li) => {
      const eq = level.legs.filter((o) => o.contract_type !== "option");
      const opt = level.legs.filter((o) => o.contract_type === "option");
      const count = Math.max(eq.length, opt.length, 1);
      for (let i = 0; i < count; i += 1) {
        lines.push({
          key: `${zoneId ?? "none"}-${li}-${i}`,
          zoneId,
          label: i === 0 ? level.label : "",
          eq: eq[i],
          opt: opt[i],
          hasLevelLegs: level.legs.length > 0,
        });
      }
    });
    return lines;
  };

  const lines = buckets.flatMap((b) => emit(b.zone.id, b.levels));
  if (ungrouped.length > 0) {
    const eq = ungrouped.filter((o) => o.contract_type !== "option");
    const opt = ungrouped.filter((o) => o.contract_type === "option");
    const count = Math.max(eq.length, opt.length, 1);
    for (let i = 0; i < count; i += 1) {
      lines.push({
        key: `none-${i}`,
        zoneId: null,
        label: i === 0 ? "—" : "",
        eq: eq[i],
        opt: opt[i],
        hasLevelLegs: true,
      });
    }
  }
  return lines;
};

const Dash = () => <span className="at-num at-muted">—</span>;

/** n consecutive em-dash cells for a level without a leg. */
const dasher = (count: number) =>
  Array.from({ length: count }, (_, i) => <span className="at-num at-muted" key={i}>—</span>);

const NetCell = ({ order }: { order: SpreadOrder }) => {
  const v = netOf(order);
  return <span className={`at-num ${v < 0 ? "at-neg" : "at-pos"}`}>{signedMoney(v)}</span>;
};

const legLabel = (o: SpreadOrder) =>
  o.contract_type === "option"
    ? `${o.asset_type} ${o.option_type ?? ""} ${o.strike_price != null ? money(o.strike_price) : ""}`.trim()
    : `${o.asset_type} · ${o.contract_type ?? "spot"}`;

const OrderDetailLadder: React.FC<OrderDetailLadderProps> = ({
  activeOrders, zones, onShowZoneGroupModal, onAddOrder,
  onEditOrder, onCloseOrder, onAssignGroup, onLinkOrder, onEditZone,
}) => {
  const [view, setView] = useState<LadderView>("same");
  const [density, setDensity] = useState<Density>("key");
  const [zoneFilter, setZoneFilter] = useState<number | null>(null);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const narrow = useIsNarrow();

  const lines = useMemo(() => buildLines(zones, activeOrders), [zones, activeOrders]);
  const chipZones = useMemo(() => sortZones(zones), [zones]);
  const zoneCounts = useMemo(() => {
    const counts = new Map<number, number>();
    activeOrders.forEach((o) => {
      if (o.group_id != null) counts.set(o.group_id, (counts.get(o.group_id) ?? 0) + 1);
    });
    return counts;
  }, [activeOrders]);
  const visible = useMemo(
    () => (zoneFilter == null ? lines : lines.filter((l) => l.zoneId === zoneFilter)),
    [lines, zoneFilter],
  );

  const marks = useMemo(() => {
    const seen = new Set<string>();
    lines.forEach((l) => {
      if (l.hasLevelLegs) seen.add(l.key.slice(0, l.key.lastIndexOf("-")));
    });
    return seen.size;
  }, [lines]);

  const countLabel = activeOrders.length === 0
    ? "No legs · no marks"
    : `${activeOrders.length} ${activeOrders.length === 1 ? "leg" : "legs"} · ${marks} ${marks === 1 ? "mark" : "marks"}`;

  // Nothing to place on a level: no zones to define the ladder and no orders
  // at all. Ungrouped orders still get their No zone row instead.
  const showEmptyState = zones.length === 0 && activeOrders.length === 0;

  const handleLink = (orderId: string) => {
    if (linkSource == null) {
      setLinkSource(orderId);
      return;
    }
    if (linkSource !== orderId) onLinkOrder?.(linkSource, orderId);
    setLinkSource(null);
  };

  const handleDrop = (e: React.DragEvent, zoneId: number | null) => {
    e.preventDefault();
    setDropKey(null);
    const orderId = e.dataTransfer.getData("text/plain");
    if (orderId) onAssignGroup?.([orderId], zoneId);
  };

  const rowDropProps = (line: LadderLine) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!Array.from(e.dataTransfer.types).includes("text/plain")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropKey !== line.key) setDropKey(line.key);
    },
    onDragLeave: () => setDropKey(null),
    onDrop: (e: React.DragEvent) => handleDrop(e, line.zoneId),
  });

  const actionsFor = (line: LadderLine) => {
    const legs = [line.eq, line.opt].filter(Boolean) as SpreadOrder[];
    if (legs.length === 0) return null;
    return (
      <div className="at-actions">
        {legs.map((o) => (
          <React.Fragment key={o.order_id}>
            <span
              className="at-act"
              draggable
              role="button"
              tabIndex={-1}
              title={`Drag ${o.asset_type} onto a zone to move it`}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", o.order_id);
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
              </svg>
            </span>
            <button
              type="button"
              className="at-act"
              aria-pressed={linkSource === o.order_id}
              aria-label={`Link ${o.asset_type}`}
              title={`Link ${o.asset_type}`}
              onClick={() => handleLink(o.order_id)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
            <button type="button" className="at-act" aria-label={`Edit ${o.asset_type}`} title={`Edit ${o.asset_type}`} onClick={() => onEditOrder(o)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 11.5 8 16l4.5-7.5z" />
              </svg>
            </button>
            <button
              type="button"
              className="at-act"
              data-danger="true"
              aria-label={`Close ${o.asset_type}`}
              title={`Close ${o.asset_type}`}
              onClick={() => onCloseOrder(o)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderCells = (line: LadderLine) => {
    const { eq, opt } = line;
    const mark = <span className="at-mark">{priceLabel(line.label)}</span>;

    if (narrow) {
      const leg = eq ?? opt;
      const total = (eq ? netOf(eq) : 0) + (opt ? netOf(opt) : 0);
      return (
        <>
          {mark}
          <span className="at-left">{leg ? legLabel(leg) : <span className="at-muted">No order</span>}</span>
          {leg ? (
            <span className={`at-num ${total < 0 ? "at-neg" : "at-pos"}`}>{signedMoney(total)}</span>
          ) : (
            <Dash />
          )}
        </>
      );
    }

    if (view === "eq") {
      if (!eq) {
        return (
          <>
            {mark}
            {dasher(density === "key" ? 4 : 6)}
          </>
        );
      }
      if (density === "key") {
        return (
          <>
            {mark}
            <span className="at-num at-muted">{statusText(eq.side)}</span>
            <span className="at-left">{legLabel(eq)}</span>
            <span className="at-num">{formatQty(eq.qty)}</span>
            <NetCell order={eq} />
          </>
        );
      }
      return (
        <>
          {mark}
          <span className="at-num at-muted">{statusText(eq.order_status)}</span>
          <span className="at-left">{eq.group_name ?? "—"}</span>
          <span className="at-num">{formatQty(eq.qty)}</span>
          <span className="at-num">{money(eq.entry_price)}</span>
          <span className="at-num">{money(eq.current_price)}</span>
          <NetCell order={eq} />
        </>
      );
    }

    if (view === "option") {
      if (!opt) {
        return (
          <>
            {mark}
            {dasher(density === "key" ? 5 : 10)}
          </>
        );
      }
      const dte = daysTo(opt.expiry_date);
      if (density === "key") {
        return (
          <>
            {mark}
            <span className="at-num at-muted">{statusText(opt.side)}</span>
            <span className="at-left">{legLabel(opt)}</span>
            <span className="at-num">{formatQty(opt.qty)}</span>
            <span className="at-num at-muted">{dte ?? "—"}</span>
            <NetCell order={opt} />
          </>
        );
      }
      return (
        <>
          {mark}
          <span className="at-num at-muted">{statusText(opt.order_status)}</span>
          <span className="at-left">{opt.group_name ?? "—"}</span>
          <span className="at-num at-muted">{opt.option_type ?? "—"}</span>
          <span className="at-num at-muted">{shortDate(opt.expiry_date)}</span>
          <span className="at-num at-muted">{dte ?? "—"}</span>
          <span className="at-num">{money(opt.strike_price)}</span>
          <span className="at-num">{formatQty(opt.qty)}</span>
          <span className="at-num">{money(opt.entry_price)}</span>
          <span className="at-num">{money(opt.current_price)}</span>
          <NetCell order={opt} />
        </>
      );
    }

    const status = eq || opt ? [eq ? "EQ/FUT" : "", opt ? "OPT" : ""].filter(Boolean).join(" + ") : "No order";
    const dte = opt ? daysTo(opt.expiry_date) : null;
    return (
      <>
        {mark}
        <span className={`at-num ${eq || opt ? "" : "at-muted"}`}>{status}</span>
        {eq ? <span className="at-num">{formatQty(eq.qty)}</span> : <Dash />}
        {eq ? <span className="at-num">{money(eq.entry_price)}</span> : <Dash />}
        {eq ? <span className="at-num">{money(eq.current_price)}</span> : <Dash />}
        {eq ? <NetCell order={eq} /> : <Dash />}
        {opt ? <span className="at-num at-muted">{opt.option_type ?? "—"}</span> : <Dash />}
        {opt ? <span className="at-num at-muted">{dte ?? "—"}</span> : <Dash />}
        {opt ? <span className="at-num">{money(opt.strike_price)}</span> : <Dash />}
        {opt ? <span className="at-num">{formatQty(opt.qty)}</span> : <Dash />}
        {opt ? <NetCell order={opt} /> : <Dash />}
      </>
    );
  };

  const template = narrow
    ? TEMPLATE.narrow
    : view === "eq"
      ? TEMPLATE[density === "key" ? "eqKey" : "eqFull"]
      : view === "option"
        ? TEMPLATE[density === "key" ? "optKey" : "optFull"]
        : TEMPLATE.same;
  const heads = narrow
    ? HEADS.narrow
    : view === "eq"
      ? HEADS[density === "key" ? "eqKey" : "eqFull"]
      : view === "option"
        ? HEADS[density === "key" ? "optKey" : "optFull"]
        : HEADS.same;

  return (
    <section className="at-card at-detail" aria-label="Order detail">
      <div className="at-dh">
        <h2>Order detail</h2>
        <span className="at-count">{countLabel}</span>
        <div className="at-tabs at-tabs-right" role="group" aria-label="Ladder view">
          <button type="button" className="at-tab" aria-pressed={view === "same"} onClick={() => setView("same")}>
            Same view
          </button>
          <button type="button" className="at-tab" aria-pressed={view === "eq"} onClick={() => setView("eq")}>
            EQ · Future
          </button>
          <button type="button" className="at-tab" aria-pressed={view === "option"} onClick={() => setView("option")}>
            Options
          </button>
        </div>
        {view !== "same" && !narrow && (
          <div className="at-tabs" role="group" aria-label="Row density">
            <button type="button" className="at-tab" aria-pressed={density === "key"} onClick={() => setDensity("key")}>
              Key
            </button>
            <button type="button" className="at-tab" aria-pressed={density === "full"} onClick={() => setDensity("full")}>
              Full
            </button>
          </div>
        )}
      </div>

      <div className="at-zones">
        <div className="at-zchips">
          {chipZones.map((z) => {
            const count = zoneCounts.get(z.id) ?? 0;
            return (
              <button
                type="button"
                key={z.id}
                className="at-zchip"
                aria-pressed={zoneFilter === z.id}
                onClick={() => setZoneFilter((prev) => (prev === z.id ? null : z.id))}
              >
                <span>
                  Zone <b>{priceLabel(z.name)}</b>{count > 0 ? ` · ${count}` : ""}
                </span>
              </button>
            );
          })}
          {zoneFilter != null && onEditZone && (
            <button
              type="button"
              className="at-znew"
              onClick={() => {
                const zone = zones.find((z) => z.id === zoneFilter);
                onEditZone(
                  activeOrders.filter((o) => o.group_id === zoneFilter),
                  zone?.name ?? "",
                );
              }}
            >
              Edit zone
            </button>
          )}
        </div>
        <div className="at-zactions">
          <button type="button" className="at-znew" onClick={onShowZoneGroupModal}>
            + New zone
          </button>
          <button type="button" className="at-znew" onClick={onAddOrder}>
            + New order
          </button>
        </div>
      </div>

      {showEmptyState ? (
        <div className="at-empty">
          <p className="at-empty-title">No zones yet</p>
          <p className="at-empty-text">Create a zone to place orders on a price level.</p>
          <button type="button" className="at-btn-ghost" onClick={onShowZoneGroupModal}>
            + New zone
          </button>
        </div>
      ) : (
        <div className="at-scroll">
          <div className="at-lhead">
            {view === "same" && !narrow && (
              <div className="at-groups" style={{ gridTemplateColumns: TEMPLATE.same }}>
                <span />
                <span />
                <span className="at-grp" style={{ gridColumn: "span 4" }}>EQ · Future</span>
                <span className="at-grp" style={{ gridColumn: "span 5" }}>Options</span>
              </div>
            )}
            <div className="at-cols" style={{ gridTemplateColumns: template }}>
              {heads.map((h, i) => (
                <span key={`${h}-${i}`}>{h}</span>
              ))}
            </div>
          </div>

          {visible.map((line) => (
            <div
              key={line.key}
              className={`at-row${dropKey === line.key ? " is-drop" : ""}`}
              style={{ gridTemplateColumns: template }}
              {...rowDropProps(line)}
            >
              {renderCells(line)}
              {actionsFor(line)}
            </div>
          ))}

          {zones.length === 0 && (
            <div className="at-invite">
              <span>No zones yet — grouping orders by price level makes the ladder</span>
              <button type="button" className="at-btn-ghost" onClick={onShowZoneGroupModal}>
                + New zone
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default React.memo(OrderDetailLadder);
