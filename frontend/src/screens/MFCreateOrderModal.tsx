import { useState } from "react";
import type { CSSProperties } from "react";
import { MFOrderCreate } from "../types";
import ModalShell from "./components/ModalShell";

interface MFCreateOrderModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (data: MFOrderCreate) => void;
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
      <div className="w-full max-w-sm mx-4" style={CARD}>
        <h3 style={{ ...TITLE, marginBottom: 16 }}>Create order</h3>
        <div className="flex flex-col" style={{ gap: 12 }}>
          <div>
            <label style={LABEL}>Asset</label>
            <input
              type="text"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              placeholder="e.g. BTC"
              className="border border-hairline focus:border-brand-teal"
              style={INPUT}
            />
          </div>
          <div>
            <label style={LABEL}>Side</label>
            <div className="inline-flex gap-x-1.5">
              {["Buy", "Sell"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className="transition-colors"
                  style={side === s
                    ? { ...BTN, background: "var(--color-ink)", color: "var(--color-canvas)" }
                    : { ...BTN_SECONDARY }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={LABEL}>Quantity</label>
              <input
                type="number"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0.00"
                className="border border-hairline focus:border-brand-teal"
                style={INPUT}
              />
            </div>
            <div className="flex-1">
              <label style={LABEL}>Price</label>
              <input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="border border-hairline focus:border-brand-teal"
                style={INPUT}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2" style={{ marginTop: 24 }}>
          <button onClick={onClose} style={BTN_SECONDARY} className="transition-colors hover:bg-surface-soft">Cancel</button>
          <button onClick={handleSave} style={BTN_PRIMARY} className="transition-opacity hover:opacity-90">Create order</button>
        </div>
      </div>
    </ModalShell>
  );
}
