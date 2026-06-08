import { useState, useEffect } from "react";
import { MFOrder, MFOrderUpdate } from "../types";
import Button from "./components/Button";

interface MFEditOrderModalProps {
  show: boolean;
  order: MFOrder | null;
  onClose: () => void;
  onSave: (orderId: number, data: MFOrderUpdate) => void;
}

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-canvas rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-bold mb-4">Edit Order</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-slate mb-1">Asset</label>
            <input
              type="text"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="w-full border border-hairline rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate mb-1">Side</label>
            <div className="inline-flex gap-x-1.5">
              {["Buy", "Sell"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full border transition-all ${
                    side === s
                      ? s === "Buy"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-red-500 text-white border-red-500"
                      : "border-hairline bg-canvas text-slate"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase text-slate mb-1">Quantity</label>
              <input
                type="number"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full border border-hairline rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase text-slate mb-1">Price</label>
              <input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border border-hairline rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
