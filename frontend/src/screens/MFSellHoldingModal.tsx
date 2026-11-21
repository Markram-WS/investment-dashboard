import { useState } from "react";
import type { CSSProperties } from "react";
import { MFHolding } from "../types";
import { formatMoney } from "../utils/format";
import ModalShell from "./components/ModalShell";
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from "./components/modalLayout";
import { Field, NumberInput } from "./components/Field";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_LABEL,
  CONTROL_TITLE,
  CONTROL_VALUE,
} from "./components/controlStyles";

interface MFSellHoldingModalProps {
  show: boolean;
  holding: MFHolding | null;
  onClose: () => void;
  onConfirm: (holdingId: number, qty: number, price: number) => void;
}

const modalPanelStyle: CSSProperties = {
  padding: "var(--space-md)", borderRadius: "var(--rounded-xl)",
};
const ROW: CSSProperties = {
  display: "flex", justifyContent: "space-between", gap: 12,
  padding: "8px 0", borderTop: "1px solid var(--color-hairline-soft)",
};
const ROW_KEY: CSSProperties = { ...CONTROL_LABEL, margin: 0 };
const ROW_VALUE: CSSProperties = { ...CONTROL_VALUE, fontVariantNumeric: "tabular-nums" };
const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;

export default function MFSellHoldingModal({ show, holding, onClose, onConfirm }: MFSellHoldingModalProps) {
  const [price, setPrice] = useState("");

  if (!show || !holding) return null;

  const handleConfirm = () => {
    onConfirm(holding.holding_id, holding.qty, parseFloat(price) || 0);
    setPrice("");
  };

  return (
    <ModalShell open={show} onClose={onClose} title={"Sell " + (holding?.asset || '')} closeOnBackdrop={false}>
      <div className={`${MODAL_CARD} bg-canvas border border-hairline w-full max-w-sm mx-4`} style={modalPanelStyle}>
        <h3 className={MODAL_HEADER} style={{ ...CONTROL_TITLE, marginBottom: 12 }}>Sell {holding.asset}</h3>
        <div className={MODAL_BODY}>
        <div style={{ marginBottom: 20 }}>
          <div style={ROW}>
            <span style={ROW_KEY}>Quantity</span>
            <span style={ROW_VALUE}>{holding.qty}</span>
          </div>
          <div style={ROW}>
            <span style={ROW_KEY}>Avg entry</span>
            <span style={ROW_VALUE}>{formatMoney(holding.avg_entry_price)}</span>
          </div>
          <div style={{ ...ROW, borderBottom: "1px solid var(--color-hairline-soft)" }}>
            <span style={ROW_KEY}>Current value</span>
            <span style={ROW_VALUE}>{formatMoney(holding.market_value)}</span>
          </div>
        </div>
        <Field label="Sell price (manual entry)" htmlFor="mf-sell-price">
          <NumberInput
            id="mf-sell-price"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Enter sell price"
          />
        </Field>
        </div>
        <div className={`${MODAL_FOOTER} flex justify-end gap-2`} style={{ marginTop: 12 }}>
          <button onClick={onClose} style={secondaryButton} className="transition-colors hover:bg-surface-soft">Cancel</button>
          <button onClick={handleConfirm} style={primaryButton} className="transition-opacity hover:opacity-90">Create sell order</button>
        </div>
      </div>
    </ModalShell>
  );
}
