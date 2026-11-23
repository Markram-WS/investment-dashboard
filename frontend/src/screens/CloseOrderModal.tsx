import React, { useState, useEffect, useRef } from "react";
import { SpreadOrder } from "../types";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from "./components/modalLayout";
import { formatMoney } from "../utils/format";
import { Field, NumberInput, TextInput } from "./components/Field";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_TITLE,
  CONTROL_VALUE,
} from "./components/controlStyles";

const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;

const summaryLabel = { fontWeight: 500, color: "var(--color-slate)" } as const;
const summaryValue = {
  ...CONTROL_VALUE,
  fontVariantNumeric: "tabular-nums",
} as const;

const actionButtonClass = "transition-opacity disabled:opacity-50 disabled:cursor-not-allowed";
const modalPanel = "bg-canvas border border-hairline w-full max-w-sm mx-4";
const modalPanelStyle = {
  padding: "var(--space-md)",
  borderRadius: "var(--rounded-xl)",
} as const;

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
  /** Mapped close writes only exit price and realised P/L to the history row. */
  mapped?: boolean;
}

type LastEdited = "exitPrice" | "pl" | null;

export const CloseOrderModal: React.FC<CloseOrderModalProps> = ({
  order,
  showModal,
  onClose,
  onConfirm,
  activeOrders,
  mapped = false,
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

  const orderCost = order?.cost;
  const orderId = order?.order_id ?? null;

  useEffect(() => {
    if (showModal && orderId != null) {
      setCloseId(`CLS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
      setExitPrice("");
      setRealizedPl("");
      setCost(String(orderCost || 0));
      lastEdited.current = null;
    }
  }, [showModal, orderId, orderCost]);

  if (!showModal || !order) return null;

  const entryPrice = order.entry_price ?? 0;
  const qty = Number(order.qty) || 0;

  const handleExitPriceChange = (val: string) => {
    setExitPrice(val);
    lastEdited.current = "exitPrice";
    if (val !== "" && qty > 0) {
      const ep = parseFloat(val);
      const c = mapped ? 0 : parseFloat(cost) || 0;
      setRealizedPl(((ep - entryPrice) * qty - c).toFixed(2));
    }
  };

  const handlePlChange = (val: string) => {
    setRealizedPl(val);
    lastEdited.current = "pl";
    if (val !== "" && qty > 0) {
      const pl = parseFloat(val);
      const c = mapped ? 0 : parseFloat(cost) || 0;
      setExitPrice((entryPrice + (pl + c) / qty).toFixed(2));
    }
  };

  const handleCostChange = (val: string) => {
    setCost(val);
    if (lastEdited.current === "exitPrice" && exitPrice !== "" && qty > 0) {
      const ep = parseFloat(exitPrice);
      const c = mapped ? 0 : parseFloat(val) || 0;
      setRealizedPl(((ep - entryPrice) * qty - c).toFixed(2));
    } else if (lastEdited.current === "pl" && realizedPl !== "" && qty > 0) {
      const pl = parseFloat(realizedPl);
      const c = mapped ? 0 : parseFloat(val) || 0;
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
        mapped ? 0 : parseFloat(cost) || 0,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={showModal} onClose={onClose} title={"Close Order " + (order?.order_id || '')} closeOnBackdrop={false}>
      <div className={`${MODAL_CARD} ${modalPanel}`} style={modalPanelStyle}>
        <h3 className={`${MODAL_HEADER} block`} style={{ ...CONTROL_TITLE, margin: '0 0 12px' }}>
          Close order {linkedInfo ? `(linked to #${linkedInfo.order_id?.slice(0, 8)})` : ''}
        </h3>

        <div className={`${MODAL_BODY} space-y-3`}>
          {!mapped && (
            <Field label="Close ID" htmlFor="close-order-id">
              <TextInput
                id="close-order-id"
                type="text"
                value={closeId}
                onChange={(e) => setCloseId(e.target.value)}
                placeholder="CLS-XXXXXXXX"
                className="w-full"
              />
            </Field>
          )}

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[length:var(--fs-label)]" style={summaryLabel}>Order</span>
              <span style={summaryValue}>#{order.order_id} &middot; {order.asset_type} &middot; {order.side}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[length:var(--fs-label)]" style={summaryLabel}>Qty</span>
              <span style={summaryValue}>{qty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[length:var(--fs-label)]" style={summaryLabel}>Entry price</span>
              <span style={summaryValue}>{formatMoney(entryPrice)}</span>
            </div>
            {linkedInfo && (
              <>
                <div className="flex justify-between">
                  <span className="text-[length:var(--fs-label)]" style={summaryLabel}>Linked order</span>
                  <span style={summaryValue}>#{linkedInfo.order_id?.slice(0, 8)} &middot; {linkedInfo.asset_type} &middot; {linkedInfo.side}</span>
                </div>
                <div className="flex justify-between" style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 6 }}>
                  <span className="text-[length:var(--fs-label)]" style={summaryLabel}>Linked entry</span>
                  <span style={summaryValue}>{linkedInfo.entry_price ? formatMoney(linkedInfo.entry_price) : '-'}</span>
                </div>
              </>
            )}
          </div>

          <div className="pt-3 space-y-3" style={{ borderTop: '1px solid var(--color-hairline)' }}>
            {!mapped && (
              <Field label="Cost (spread/commission)" htmlFor="close-order-cost">
                <NumberInput
                  id="close-order-cost"
                  step="any"
                  value={cost}
                  onChange={(e) => handleCostChange(e.target.value)}
                  className="w-full"
                />
              </Field>
            )}
            <Field label="Exit price" htmlFor="close-order-exit-price">
              <NumberInput
                id="close-order-exit-price"
                step="any"
                value={exitPrice}
                onChange={(e) => handleExitPriceChange(e.target.value)}
                placeholder={order.current_price ? String(order.current_price) : "0"}
                className="w-full"
              />
            </Field>
            <Field label="P/L" htmlFor="close-order-pl">
              <NumberInput
                id="close-order-pl"
                step="any"
                value={realizedPl}
                onChange={(e) => handlePlChange(e.target.value)}
                placeholder="0"
                className="w-full"
              />
            </Field>
          </div>
        </div>

        <div className={`${MODAL_FOOTER} flex justify-end`} style={{ gap: 8, marginTop: 12 }}>
          <button type="button" onClick={onClose} disabled={saving} className={actionButtonClass} style={secondaryButton}>Cancel</button>
          <button type="button" onClick={handleConfirm} disabled={saving} className={actionButtonClass} style={primaryButton}>Close Order</button>
        </div>
      </div>
    </ModalShell>
  );
};
