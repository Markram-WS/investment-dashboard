import { useState } from "react";
import type { CSSProperties } from "react";
import { MFOrderCreate } from "../types";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from "./components/modalLayout";
import { Field, NumberInput, TextInput } from "./components/Field";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_LABEL,
  CONTROL_TITLE,
} from "./components/controlStyles";

interface MFCreateOrderModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (data: MFOrderCreate) => void;
}

const modalPanelStyle: CSSProperties = {
  padding: "var(--space-md)", borderRadius: "var(--rounded-xl)",
};
const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;

export default function MFCreateOrderModal({ show, onClose, onSave }: MFCreateOrderModalProps) {
  const [asset, setAsset] = useState("");
  const [side, setSide] = useState("Buy");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");

  if (!show) return null;

  const handleSave = () => {
    if (!asset.trim() || !qty) return;
    onSave({
      asset: asset.trim().toUpperCase(),
      side,
      qty: parseFloat(qty),
      price: price ? parseFloat(price) : null,
    });
    setAsset("");
    setSide("Buy");
    setQty("");
    setPrice("");
  };

  return (
    <ModalShell open={show} onClose={onClose} title="Create order" closeOnBackdrop={false}>
      <div className={`${MODAL_CARD} bg-canvas border border-hairline w-full max-w-sm mx-4`} style={modalPanelStyle}>
        <h3 className={MODAL_HEADER} style={{ ...CONTROL_TITLE, marginBottom: 12 }}>Create order</h3>
        <div className={`${MODAL_BODY} flex flex-col`} style={{ gap: 12 }}>
          <Field label="Asset" htmlFor="mf-create-order-asset">
            <TextInput
              id="mf-create-order-asset"
              type="text"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              placeholder="e.g. BTC"
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
            <Field className="flex-1" label="Quantity" htmlFor="mf-create-order-qty">
              <NumberInput
                id="mf-create-order-qty"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field className="flex-1" label="Price" htmlFor="mf-create-order-price">
              <NumberInput
                id="mf-create-order-price"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>
        </div>
        <div className={`${MODAL_FOOTER} flex justify-end gap-2`} style={{ marginTop: 12 }}>
          <button onClick={onClose} style={secondaryButton} className="transition-colors hover:bg-surface-soft">Cancel</button>
          <button onClick={handleSave} style={primaryButton} className="transition-opacity hover:opacity-90">Create order</button>
        </div>
      </div>
    </ModalShell>
  );
}
