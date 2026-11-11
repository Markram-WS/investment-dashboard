import React, { useState, useEffect, useRef } from "react";
import { SpreadOrder } from "../types";
import ModalShell from "./components/ModalShell";

/** Field label: 12px/500 slate, sentence case. */
const fieldLabel = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--color-slate)",
  margin: "0 0 5px",
} as const;

/** Text field: 15px ink on canvas, 1px hairline, radius 8. */
const fieldInput = {
  width: "100%",
  fontSize: 15,
  color: "var(--color-ink)",
  background: "var(--color-canvas)",
  border: "1px solid var(--color-hairline)",
  borderRadius: 8,
  padding: "8px 12px",
} as const;

const primaryButton = {
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 500,
  background: "var(--color-ink)",
  color: "var(--color-canvas)",
  border: "1px solid var(--color-ink)",
  borderRadius: 999,
  cursor: "pointer",
} as const;

const secondaryButton = {
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 500,
  background: "var(--color-canvas)",
  color: "var(--color-ink)",
  border: "1px solid var(--color-hairline)",
  borderRadius: 999,
  cursor: "pointer",
} as const;

const summaryLabel = { fontSize: 12, fontWeight: 500, color: "var(--color-slate)" } as const;
const summaryValue = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-ink)",
  fontVariantNumeric: "tabular-nums",
} as const;

const actionButtonClass = "transition-opacity disabled:opacity-50 disabled:cursor-not-allowed";
const modalPanel = "bg-canvas border border-hairline rounded-xl p-6 w-full max-w-sm mx-4";

interface CloseOrderModalProps {
  order: SpreadOrder | null;
  showModal: boolean;
  onClose: () => void;
  onConfirm: (
    orderId: string,
    closeOrderId: string,
    exitPrice: number | null,
    realizedPl: number | null,
    cost: number,
  ) => Promise<void>;
  activeOrders: SpreadOrder[];
}

type LastEdited = "exitPrice" | "pl" | null;

export const CloseOrderModal: React.FC<CloseOrderModalProps> = ({
  order,
  showModal,
  onClose,
  onConfirm,
  activeOrders,
}) => {
  const [closeId, setCloseId] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [realizedPl, setRealizedPl] = useState("");
  const [cost, setCost] = useState("0");
  const [saving, setSaving] = useState(false);
  const lastEdited = useRef<LastEdited>(null);

  const linkedOrder = order?.linked_order_id
    ? activeOrders.find(o => o.order_id === order.linked_order_id)
    : null;

  const isSpreadLeg = order?.link_type === 'spread';
  const isSubOrder = order?.link_type === 'pending_close';
  const linkedInfo = isSpreadLeg && linkedOrder ? linkedOrder : isSubOrder && linkedOrder ? linkedOrder : null;

  useEffect(() => {
    if (showModal && order) {
      setCloseId(`CLS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
      setExitPrice("");
      setRealizedPl("");
      setCost(String(order.cost || 0));
      lastEdited.current = null;
    }
  }, [showModal, order?.order_id]);

  if (!showModal || !order) return null;

  const entryPrice = order.entry_price ?? 0;
  const qty = Number(order.qty) || 0;

  const handleExitPriceChange = (val: string) => {
    setExitPrice(val);
    lastEdited.current = "exitPrice";
    if (val !== "" && qty > 0) {
      const ep = parseFloat(val);
      const c = parseFloat(cost) || 0;
      setRealizedPl(((ep - entryPrice) * qty - c).toFixed(2));
    }
  };

  const handlePlChange = (val: string) => {
    setRealizedPl(val);
    lastEdited.current = "pl";
    if (val !== "" && qty > 0) {
      const pl = parseFloat(val);
      const c = parseFloat(cost) || 0;
      setExitPrice((entryPrice + (pl + c) / qty).toFixed(2));
    }
  };

  const handleCostChange = (val: string) => {
    setCost(val);
    if (lastEdited.current === "exitPrice" && exitPrice !== "" && qty > 0) {
      const ep = parseFloat(exitPrice);
      const c = parseFloat(val) || 0;
      setRealizedPl(((ep - entryPrice) * qty - c).toFixed(2));
    } else if (lastEdited.current === "pl" && realizedPl !== "" && qty > 0) {
      const pl = parseFloat(realizedPl);
      const c = parseFloat(val) || 0;
      setExitPrice((entryPrice + (pl + c) / qty).toFixed(2));
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(
        order.order_id,
        closeId || String(order.order_id),
        exitPrice !== "" ? parseFloat(exitPrice) : null,
        realizedPl !== "" ? parseFloat(realizedPl) : null,
        parseFloat(cost) || 0,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={showModal} onClose={onClose} title={"Close Order " + (order?.order_id || '')} closeOnBackdrop={false}>
      <div className={modalPanel}>
        <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: '0 0 16px' }}>
          Close order {linkedInfo ? `(linked to #${linkedInfo.order_id?.slice(0, 8)})` : ''}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block" style={fieldLabel}>Close ID</label>
            <input
              type="text"
              value={closeId}
              onChange={(e) => setCloseId(e.target.value)}
              placeholder="CLS-XXXXXXXX"
              className="w-full" style={fieldInput}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span style={summaryLabel}>Order</span>
              <span style={summaryValue}>#{order.order_id} &middot; {order.asset_type} &middot; {order.side}</span>
            </div>
            <div className="flex justify-between">
              <span style={summaryLabel}>Qty</span>
              <span style={summaryValue}>{qty}</span>
            </div>
            <div className="flex justify-between">
              <span style={summaryLabel}>Entry price</span>
              <span style={summaryValue}>${entryPrice.toLocaleString()}</span>
            </div>
            {linkedInfo && (
              <>
                <div className="flex justify-between">
                  <span style={summaryLabel}>Linked order</span>
                  <span style={summaryValue}>#{linkedInfo.order_id?.slice(0, 8)} &middot; {linkedInfo.asset_type} &middot; {linkedInfo.side}</span>
                </div>
                <div className="flex justify-between" style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 6 }}>
                  <span style={summaryLabel}>Linked entry</span>
                  <span style={summaryValue}>${linkedInfo.entry_price?.toLocaleString() || '-'}</span>
                </div>
              </>
            )}
          </div>

          <div className="pt-3 space-y-3" style={{ borderTop: '1px solid var(--color-hairline)' }}>
            <div>
              <label className="block" style={fieldLabel}>Cost (spread/commission)</label>
              <input
                type="number"
                step="any"
                value={cost}
                onChange={(e) => handleCostChange(e.target.value)}
                className="w-full" style={fieldInput}
              />
            </div>
            <div>
              <label className="block" style={fieldLabel}>Exit price</label>
              <input
                type="number"
                step="any"
                value={exitPrice}
                onChange={(e) => handleExitPriceChange(e.target.value)}
                placeholder={order.current_price ? String(order.current_price) : "0"}
                className="w-full" style={fieldInput}
              />
            </div>
            <div>
              <label className="block" style={fieldLabel}>P/L</label>
              <input
                type="number"
                step="any"
                value={realizedPl}
                onChange={(e) => handlePlChange(e.target.value)}
                placeholder="0"
                className="w-full" style={fieldInput}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end" style={{ gap: 8, marginTop: 24 }}>
          <button type="button" onClick={onClose} disabled={saving} className={actionButtonClass} style={secondaryButton}>Cancel</button>
          <button type="button" onClick={handleConfirm} disabled={saving} className={actionButtonClass} style={primaryButton}>Close Order</button>
        </div>
      </div>
    </ModalShell>
  );
};
