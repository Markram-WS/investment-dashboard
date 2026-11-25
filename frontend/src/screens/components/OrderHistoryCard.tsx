import React, { useMemo, useState } from "react";
import type { TradeHistoryRecord } from "../../lib/api";
import { formatMoney, formatQty } from "../../utils/format";
import SideChip from "../../components/SideChip";

interface OrderHistoryCardProps {
  tradeHistory: TradeHistoryRecord[];
  onViewAll: () => void;
  onDropOrder?: (orderId: string) => void;
}

const VISIBLE_ROWS = 3;
const MAX_ROWS = 12;

const money = (v: unknown) =>
  v == null || v === "" ? "—" : formatMoney(Number(v));

const signedMoney = (v: unknown) => {
  const n = Number(v ?? 0);
  return `${n > 0 ? "+" : ""}${formatMoney(n)}`;
};

const shortDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(2)}`;
};

/** Entry to exit, in whole days; "<1d" when the trade opened and closed the same day. */
const heldFor = (entry?: string | null, exit?: string | null) => {
  if (!entry || !exit) return "—";
  const ms = new Date(exit).getTime() - new Date(entry).getTime();
  if (!Number.isFinite(ms)) return "—";
  const days = Math.floor(ms / 86400000);
  return days <= 0 ? "<1d" : `${days}d`;
};

/** A closed order says Close unless the cancel path wrote its note. */
const closeStatus = (h: TradeHistoryRecord) => {
  const note = (h.remark as { note?: string } | null | undefined)?.note;
  return note === "Canceled" ? "Canceled" : "Close";
};

const who = (v?: string | null) =>
  v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : "—";

const sourceText = (source?: string | null) =>
  source === "mapped" ? "Connected DB" : source === "dashboard" ? "Dashboard" : null;

/** React identity is (source, key): colliding legacy integers are not identity. */
const historyKey = (h: TradeHistoryRecord) =>
  `${h.history_source ?? "legacy"}:${h.history_key ?? h.history_id}`;

/** 11px pill on the helper surface; no new colour token. */
const sourceBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "var(--fs-label)",
  fontWeight: 500,
  lineHeight: "14px",
  color: "var(--color-slate)",
  background: "var(--color-surface-soft)",
  borderRadius: "var(--rounded-full)",
  padding: "0 5px",
};

const sourceRank = (source?: string | null) => (source === "dashboard" ? 0 : source === "mapped" ? 1 : 2);

/** Closed-trade card: a 32px disclosure bar by default, expanding to 138px with the column heads and newest three rows. */
const OrderHistoryCard: React.FC<OrderHistoryCardProps> = ({ tradeHistory, onViewAll, onDropOrder }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const rows = useMemo(
    () =>
      [...tradeHistory]
        .sort((a, b) => {
          const byExit = String(b.exit_date ?? "").localeCompare(String(a.exit_date ?? ""));
          if (byExit !== 0) return byExit;
          const bySource = sourceRank(a.history_source) - sourceRank(b.history_source);
          if (bySource !== 0) return bySource;
          return String(a.history_key ?? a.history_id).localeCompare(String(b.history_key ?? b.history_id));
        })
        .slice(0, Math.max(MAX_ROWS, VISIBLE_ROWS)),
    [tradeHistory],
  );

  return (
    <section
      className={`at-card at-hist${isOpen ? " is-open" : ""}${isDragOver ? " is-drop" : ""}`}
      aria-label="Order history"
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("text/plain")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const orderId = e.dataTransfer.getData("text/plain");
        if (orderId) onDropOrder?.(orderId);
      }}
    >
      <div className="at-hh" onClick={() => setIsOpen((v) => !v)}>
        <h3>Order history</h3>
        <span className="at-count">{tradeHistory.length}</span>
        <button
          type="button"
          className="at-chev"
          aria-expanded={isOpen}
          aria-controls="at-hist-body"
          aria-label={isOpen ? "Collapse order history" : "Expand order history"}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((v) => !v);
          }}
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
            <path
              d="M3 4.5 6 7.5 9 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="at-hmore"
          onClick={(e) => {
            e.stopPropagation();
            onViewAll();
          }}
        >
          View all
        </button>
      </div>

      <div className="at-hist-body" id="at-hist-body" hidden={!isOpen}>
        {rows.length === 0 ? (
          <div className="at-hist-empty">Nothing closed yet. Filled orders land here once they exit.</div>
        ) : (
          <>
            <div className="at-histhead">
              <span>Date</span>
              <span>Symbol</span>
              <span>Order</span>
              <span className="at-num">Qty</span>
              <span className="at-num">In</span>
              <span className="at-num">Out</span>
              <span className="at-num">Net P&amp;L</span>
              <span className="at-num">Held</span>
              <span className="at-hist-status">Status</span>
              <span className="at-hist-by">By</span>
              <span className="at-hist-remark">Remark</span>
            </div>
            {rows.slice(0, VISIBLE_ROWS).map((h) => {
              const net = Number(h.realized_pl ?? 0);
              const note = (h.remark as { note?: string } | null | undefined)?.note;
              return (
                <div className="at-histrow" key={historyKey(h)}>
                  <span title={h.exit_date ?? undefined}>{shortDate(h.exit_date)}</span>
                  <span title={h.asset ?? undefined}>{h.asset ?? "—"}</span>
                  <SideChip side={h.type} />
                  <span className="at-num">{formatQty(h.amount)}</span>
                  <span className="at-num">{money(h.entry_price)}</span>
                  <span className="at-num">{money(h.exit_price)}</span>
                  <span className={`at-num ${net < 0 ? "at-neg" : "at-pos"}`}>{signedMoney(net)}</span>
                  <span className="at-num" title={`${h.entry_date ?? "—"} → ${h.exit_date ?? "—"}`}>
                    {heldFor(h.entry_date, h.exit_date)}
                  </span>
                  <span className="at-hist-status" title={note ?? "Closed"}>
                    {closeStatus(h)}
                  </span>
                  <span className="at-hist-by">{who(h.executed_by)}</span>
                  <span className="at-hist-remark" title={h.order_remark ?? undefined}>
                    {sourceText(h.history_source) && (
                      <span style={{ ...sourceBadgeStyle, marginRight: 6 }}>{sourceText(h.history_source)}</span>
                    )}
                    {h.order_remark ?? "—"}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
};

export default React.memo(OrderHistoryCard);
