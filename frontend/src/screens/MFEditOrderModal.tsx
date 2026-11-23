import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { MFOrder, MFOrderUpdate } from "../types";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from "./components/modalLayout";
import { Field, NumberInput, TextInput } from "./components/Field";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_LABEL,
  CONTROL_TITLE,
} from "./components/controlStyles";

interface MFEditOrderModalProps {
  show: boolean;
  order: MFOrder | null;
  onClose: () => void;
  onSave: (orderId: number, data: MFOrderUpdate) => void;
}

const modalPanelStyle: CSSProperties = {
  padding: "var(--space-md)", borderRadius: "var(--rounded-xl)",
};
const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;

export default function MFEditOrderModal({ show, order, onClose, onSave }: MFEditOrderModalProps) {
  const [asset, setAsset] = useState("");
  const [side, setSide] = useState("Buy");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (order) {
      setAsset(order.asset);
      setSide(order.side);
      setQty(String(order.qty));
      setPrice(order.price ? String(order.price) : "");
    }
  }, [order]);

  if (!show || !order) return null;

  const handleSave = () => {
    const data: MFOrderUpdate = {};
    if (asset.trim()) data.asset = asset.trim().toUpperCase();
    if (side) data.side = side;
    if (qty) data.qty = parseFloat(qty);
    if (price) data.price = parseFloat(price);
    onSave(order.order_id, data);
  };

  return (
    <ModalShell open={show} onClose={onClose} title="Edit order" closeOnBackdrop={false}>
      <div className={`${MODAL_CARD} bg-canvas border border-hairline w-full max-w-sm mx-4`} style={modalPanelStyle}>
        <h3 className={MODAL_HEADER} style={{ ...CONTROL_TITLE, marginBottom: 12 }}>Edit order</h3>
        <div className={`${MODAL_BODY} flex flex-col`} style={{ gap: 12 }}>
          <Field label="Asset" htmlFor="mf-edit-order-asset">
            <TextInput
              id="mf-edit-order-asset"
              type="text"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
            />
          </Field>
          <div>
            <span style={CONTROL_LABEL}>Side</span>
            <div className="inline-flex gap-x-1.5">
              {["Buy", "Sell"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className="transition-colors"
                  style={side === s ? primaryButton : secondaryButton}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Field className="flex-1" label="Quantity" htmlFor="mf-edit-order-qty">
              <NumberInput
                id="mf-edit-order-qty"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </Field>
            <Field className="flex-1" label="Price" htmlFor="mf-edit-order-price">
              <NumberInput
                id="mf-edit-order-price"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <div className={`${MODAL_FOOTER} flex justify-end gap-2`} style={{ marginTop: 12 }}>
          <button onClick={onClose} style={secondaryButton} className="transition-colors hover:bg-surface-soft">Cancel</button>
          <button onClick={handleSave} style={primaryButton} className="transition-opacity hover:opacity-90">Save changes</button>
        </div>
      </div>
    </ModalShell>
  );
}
