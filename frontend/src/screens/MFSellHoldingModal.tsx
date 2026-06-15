import { useState } from "react";
import { MFHolding } from "../types";
import Button from "./components/Button";
import ModalShell from "./components/ModalShell";

interface MFSellHoldingModalProps {
  show: boolean;
  holding: MFHolding | null;
  onClose: () => void;
  onConfirm: (holdingId: number, qty: number, price: number) => void;
}

export default function MFSellHoldingModal({ show, holding, onClose, onConfirm }: MFSellHoldingModalProps) {
  const [price, setPrice] = useState("");

  if (!show || !holding) return null;

  const handleConfirm = () => {
    onConfirm(holding.holding_id, holding.qty, parseFloat(price) || 0);
    setPrice("");
  };

  return (
    <ModalShell open={show} onClose={onClose} title={"Sell " + (holding?.asset || '')} closeOnBackdrop={false}>
      <div className="bg-canvas rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-bold mb-4">Sell {holding.asset}</h3>
        <div className="bg-surface rounded-lg p-3 text-sm space-y-1.5 mb-4">
          <div className="flex justify-between">
            <span className="text-slate">Quantity</span>
            <span className="font-semibold">{holding.qty}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate">Avg Entry</span>
            <span className="font-semibold">${holding.avg_entry_price.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate">Current Value</span>
            <span className="font-semibold">${holding.market_value.toLocaleString()}</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-slate mb-1">Sell Price (Manual Entry)</label>
          <input
            type="number"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Enter sell price"
            className="w-full border border-hairline rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirm}>Create Sell Order</Button>
        </div>
      </div>
    </ModalShell>
  );
}
