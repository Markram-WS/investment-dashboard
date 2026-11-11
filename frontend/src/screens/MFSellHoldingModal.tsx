import { useState } from "react";
import type { CSSProperties } from "react";
import { MFHolding } from "../types";
import ModalShell from "./components/ModalShell";

interface MFSellHoldingModalProps {
  show: boolean;
  holding: MFHolding | null;
  onClose: () => void;
  onConfirm: (holdingId: number, qty: number, price: number) => void;
}

const CARD: CSSProperties = { background: "var(--color-canvas)", borderRadius: 16, padding: 24 };
const TITLE: CSSProperties = {
  fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-ink)", margin: 0,
};
const LABEL: CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-slate)", margin: "0 0 6px",
};
const INPUT: CSSProperties = {
  width: "100%", padding: "8px 12px", fontSize: 15, fontWeight: 500,
  fontVariantNumeric: "tabular-nums", color: "var(--color-ink)", background: "transparent",
  borderRadius: 8,
};
const ROW: CSSProperties = {
  display: "flex", justifyContent: "space-between", gap: 12,
  padding: "8px 0", borderTop: "1px solid var(--color-hairline-soft)",
};
const ROW_KEY: CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--color-slate)" };
const ROW_VALUE: CSSProperties = {
  fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--color-ink)",
};
const BTN: CSSProperties = {
  fontSize: 12, fontWeight: 500, borderRadius: 999, padding: "6px 14px",
  border: "1px solid transparent", cursor: "pointer",
};
const BTN_PRIMARY: CSSProperties = {
  ...BTN, background: "var(--color-ink)", color: "var(--color-canvas)",
};
const BTN_SECONDARY: CSSProperties = {
  ...BTN, background: "transparent", color: "var(--color-ink)", borderColor: "var(--color-hairline)",
};

export default function MFSellHoldingModal({ show, holding, onClose, onConfirm }: MFSellHoldingModalProps) {
  const [price, setPrice] = useState("");

  if (!show || !holding) return null;

  const handleConfirm = () => {
    onConfirm(holding.holding_id, holding.qty, parseFloat(price) || 0);
    setPrice("");
  };

  return (
    <ModalShell open={show} onClose={onClose} title={"Sell " + (holding?.asset || '')} closeOnBackdrop={false}>
      <div className="w-full max-w-sm mx-4" style={CARD}>
        <h3 style={{ ...TITLE, marginBottom: 16 }}>Sell {holding.asset}</h3>
        <div style={{ marginBottom: 20 }}>
          <div style={ROW}>
            <span style={ROW_KEY}>Quantity</span>
            <span style={ROW_VALUE}>{holding.qty}</span>
          </div>
          <div style={ROW}>
            <span style={ROW_KEY}>Avg entry</span>
            <span style={ROW_VALUE}>${holding.avg_entry_price.toLocaleString()}</span>
          </div>
          <div style={{ ...ROW, borderBottom: "1px solid var(--color-hairline-soft)" }}>
            <span style={ROW_KEY}>Current value</span>
            <span style={ROW_VALUE}>${holding.market_value.toLocaleString()}</span>
          </div>
        </div>
        <div>
          <label style={LABEL}>Sell price (manual entry)</label>
          <input
            type="number"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Enter sell price"
            className="border border-hairline focus:border-brand-teal"
            style={INPUT}
          />
        </div>
        <div className="flex justify-end gap-2" style={{ marginTop: 24 }}>
          <button onClick={onClose} style={BTN_SECONDARY} className="transition-colors hover:bg-surface-soft">Cancel</button>
          <button onClick={handleConfirm} style={BTN_PRIMARY} className="transition-opacity hover:opacity-90">Create sell order</button>
        </div>
      </div>
    </ModalShell>
  );
}
