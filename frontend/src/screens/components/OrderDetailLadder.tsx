import React, { useEffect, useMemo, useState } from "react";
import type { SpreadOrder } from "../../types";
import type { ZoneGroupRecord } from "../../lib/api";
import { formatQty, priceLabel } from "../../utils/format";

export type LadderView = "all" | "eq" | "option";

interface OrderDetailLadderProps {
  activeOrders: SpreadOrder[];
  zones: ZoneGroupRecord[];
  onShowZoneGroupModal: () => void;
  onAddOrder: () => void;
  onEditOrder: (order: SpreadOrder) => void;
  onCloseOrder: (order: SpreadOrder) => void;
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
  all: "80px 44px 44px 56px 56px 72px 46px 30px 52px 40px minmax(72px, 1fr)",
  eqFull: "80px 56px 56px 44px 44px 60px 60px 72px minmax(0, 1fr)",
  optFull: "80px 56px 56px 46px 30px 52px 40px 56px 56px 72px minmax(0, 1fr)",
  narrow: "76px minmax(0, 1fr) 72px",
};

const HEADS: Record<string, string[]> = {
  all: ["Mark", "Side", "qty", "In", "Out", "Net P&L", "Type", "DTE", "Strike", "Size", "Net P&L"],
  eqFull: ["Mark", "Status", "Date", "Side", "qty", "Price in", "Price out", "Net P&L", "Comment"],
  optFull: ["Mark", "Status", "Date", "Type", "DTE", "Strike", "Size", "Pre in", "Pre out", "Net P&L", "Comment"],
  narrow: ["Mark", "Leg", "Net P&L"],
};

/** Column heads whose content is a word, not a number. */
const LEFT_HEADS = new Set(["Mark", "Side", "Status", "Date", "Comment"]);

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
  if (lo == null && hi == null) return [empty(null, zone.name.trim() || "—")];
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

const Dash = () => <span className="at-num at-dash">—</span>;

/** n consecutive em-dash cells for a level without a leg. */
const dasher = (count: number) =>
  Array.from({ length: count }, (_, i) => <span className="at-num at-dash" key={i}>—</span>);

const NetCell = ({ order }: { order: SpreadOrder }) => {
  const v = netOf(order);
  return <span className={`at-num ${v < 0 ? "at-neg" : "at-pos"}`}>{signedMoney(v)}</span>;
};

const legLabel = (o: SpreadOrder) =>
  o.contract_type === "option"
    ? `${o.asset_type} ${o.option_type ?? ""} ${o.strike_price != null ? money(o.strike_price) : ""}`.trim()
    : `${o.asset_type} · ${o.contract_type ?? "spot"}`;

/** LC / LP / SC / SP: option type as a two-letter code, side first. */
const typeCode = (o: SpreadOrder) => {
  const s = (o.side ?? "").trim().toUpperCase();
  const t = (o.option_type ?? "").trim().toUpperCase();
  if ((s === "LONG" || s === "SHORT") && (t === "CALL" || t === "PUT")) return `${s[0]}${t[0]}`;
  return t || "—";
};

/** Two-letter option code as a chip: hue = call/put, fill = long/short. */
const TypeChip = ({ order }: { order: SpreadOrder }) => (
  <span
    className="at-type"
    data-kind={(order.option_type ?? "").toLowerCase() === "put" ? "put" : "call"}
    data-side={(order.side ?? "").toUpperCase()}
  >
    {typeCode(order)}
  </span>
);

const OrderDetailLadder: React.FC<OrderDetailLadderProps> = ({
  activeOrders, zones, onShowZoneGroupModal, onAddOrder,
  onEditOrder, onCloseOrder, onAssignGroup, onLinkOrder,
}) => {
  const [view, setView] = useState<LadderView>("all");
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const narrow = useIsNarrow();

  const lines = useMemo(() => buildLines(zones, activeOrders), [zones, activeOrders]);

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
    const legs = narrow || view === "all"
      ? ([line.eq, line.opt].filter(Boolean) as SpreadOrder[])
      : view === "eq"
        ? (line.eq ? [line.eq] : [])
        : (line.opt ? [line.opt] : []);
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
              title={`Drag ${legLabel(o)} onto a zone to move it`}
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
              aria-label={`Link ${legLabel(o)}`}
              title={`Link ${legLabel(o)}`}
              onClick={() => handleLink(o.order_id)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
            <button type="button" className="at-act" aria-label={`Edit ${legLabel(o)}`} title={`Edit ${legLabel(o)}`} onClick={() => onEditOrder(o)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 11.5 8 16l4.5-7.5z" />
              </svg>
            </button>
            <button
              type="button"
              className="at-act"
              data-danger="true"
              aria-label={`Close ${legLabel(o)}`}
              title={`Close ${legLabel(o)}`}
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
            {dasher(8)}
          </>
        );
      }
      return (
        <>
          {mark}
          <span className="at-left at-muted">{statusText(eq.order_status)}</span>
          <span className="at-left at-muted">{shortDate(eq.created_at)}</span>
          <span className="at-left">{statusText(eq.side)}</span>
          <span className={`at-num${eq.contract_type === "future" ? " at-class-future" : ""}`}>
            {formatQty(eq.qty)}
          </span>
          <span className="at-num">{money(eq.entry_price)}</span>
          <span className="at-num">{money(eq.current_price)}</span>
          <NetCell order={eq} />
          <span className="at-left at-muted at-comment">{eq.group_name ?? "—"}</span>
        </>
      );
    }

    if (view === "option") {
      if (!opt) {
        return (
          <>
            {mark}
            {dasher(10)}
          </>
        );
      }
      const dte = daysTo(opt.expiry_date);
      return (
        <>
          {mark}
          <span className="at-left at-muted">{statusText(opt.order_status)}</span>
          <span className="at-left at-muted">{shortDate(opt.expiry_date)}</span>
          <TypeChip order={opt} />
          <span className="at-num at-muted">{dte ?? "—"}</span>
          <span className="at-num">{money(opt.strike_price)}</span>
          <span className="at-num at-class-option">{formatQty(opt.qty)}</span>
          <span className="at-num">{money(opt.entry_price)}</span>
          <span className="at-num">{money(opt.current_price)}</span>
          <NetCell order={opt} />
          <span className="at-left at-muted at-comment">{opt.group_name ?? "—"}</span>
        </>
      );
    }

    const dte = opt ? daysTo(opt.expiry_date) : null;
    return (
      <>
        {mark}
        <span className={`at-left${eq ? "" : " at-muted"}`}>{eq ? statusText(eq.side) : "—"}</span>
        {eq ? (
          <span className={`at-num${eq.contract_type === "future" ? " at-class-future" : ""}`}>
            {formatQty(eq.qty)}
          </span>
        ) : (
          <Dash />
        )}
        {eq ? <span className="at-num">{money(eq.entry_price)}</span> : <Dash />}
        {eq ? <span className="at-num">{money(eq.current_price)}</span> : <Dash />}
        {eq ? <NetCell order={eq} /> : <Dash />}
        {opt ? <TypeChip order={opt} /> : <Dash />}
        {opt ? <span className="at-num at-muted">{dte ?? "—"}</span> : <Dash />}
        {opt ? <span className="at-num">{money(opt.strike_price)}</span> : <Dash />}
        {opt ? <span className="at-num at-class-option">{formatQty(opt.qty)}</span> : <Dash />}
        {opt ? <NetCell order={opt} /> : <Dash />}
      </>
    );
  };

  const template = narrow
    ? TEMPLATE.narrow
    : view === "eq"
      ? TEMPLATE.eqFull
      : view === "option"
        ? TEMPLATE.optFull
        : TEMPLATE.all;
  const heads = narrow
    ? HEADS.narrow
    : view === "eq"
      ? HEADS.eqFull
      : view === "option"
        ? HEADS.optFull
        : HEADS.all;

  return (
    <section className="at-card at-detail" aria-label="Order detail">
      <div className="at-dh">
        <h2>Order detail</h2>
        <div className="at-dh-right">
          <div className="at-tabs" role="group" aria-label="Ladder view">
            <button type="button" className="at-tab" aria-pressed={view === "all"} onClick={() => setView("all")}>
              All
            </button>
            <button type="button" className="at-tab" aria-pressed={view === "eq"} onClick={() => setView("eq")}>
              EQ · Future
            </button>
            <button type="button" className="at-tab" aria-pressed={view === "option"} onClick={() => setView("option")}>
              Options
            </button>
          </div>
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
            {!narrow && (
              <div
                className="at-groups"
                style={{
                  gridTemplateColumns:
                    view === "eq" ? TEMPLATE.eqFull : view === "option" ? TEMPLATE.optFull : TEMPLATE.all,
                }}
              >
                {view === "eq" ? (
                  <span className="at-grp at-band-eq" style={{ gridColumn: "span 9" }}>EQ · Future</span>
                ) : view === "option" ? (
                  <span className="at-grp at-band-opt" style={{ gridColumn: "span 11" }}>Options</span>
                ) : (
                  <>
                    <span />
                    <span />
                    <span className="at-grp at-band-eq" style={{ gridColumn: "span 4" }}>EQ · Future</span>
                    <span className="at-grp at-band-opt" style={{ gridColumn: "span 5" }}>Options</span>
                  </>
                )}
              </div>
            )}
            <div className="at-cols" style={{ gridTemplateColumns: template }}>
              {heads.map((h, i) => (
                <span
                  key={`${h}-${i}`}
                  className={h === "Comment" ? "at-comment" : undefined}
                  style={{ textAlign: LEFT_HEADS.has(h) ? "left" : "right" }}
                >{h}</span>
              ))}
            </div>
          </div>

          {lines.map((line) => (
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
