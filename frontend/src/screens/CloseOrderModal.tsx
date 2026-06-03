import React, { useState, useEffect, useRef } from "react";
import { SpreadOrder } from "../types";

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-bold mb-4">
          Close Order {linkedInfo ? `(linked to #${linkedInfo.order_id?.slice(0, 8)})` : ''}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Close ID</label>
            <input
              type="text"
              value={closeId}
              onChange={(e) => setCloseId(e.target.value)}
              placeholder="CLS-XXXXXXXX"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Order</span>
              <span className="font-semibold">#{order.order_id} &middot; {order.asset_type} &middot; {order.side}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Qty</span>
              <span className="font-semibold">{qty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Entry Price</span>
              <span className="font-semibold">${entryPrice.toLocaleString()}</span>
            </div>
            {linkedInfo && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Linked Order</span>
                  <span className="font-semibold">#{linkedInfo.order_id?.slice(0, 8)} &middot; {linkedInfo.asset_type} &middot; {linkedInfo.side}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Linked Entry</span>
                  <span className="font-semibold">${linkedInfo.entry_price?.toLocaleString() || '-'}</span>
                </div>
              </>
            )}
          </div>

          <div className="border-t pt-3 space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Cost (spread/commission)</label>
              <input
                type="number"
                step="any"
                value={cost}
                onChange={(e) => handleCostChange(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Exit Price</label>
              <input
                type="number"
                step="any"
                value={exitPrice}
                onChange={(e) => handleExitPriceChange(e.target.value)}
                placeholder={order.current_price ? String(order.current_price) : "0"}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">P/L</label>
              <input
                type="number"
                step="any"
                value={realizedPl}
                onChange={(e) => handlePlChange(e.target.value)}
                placeholder="0"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Closing..." : "Close Order"}
          </button>
        </div>
      </div>
    </div>
  );
};
