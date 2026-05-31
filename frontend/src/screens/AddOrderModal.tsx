import React from 'react';

interface AddOrderForm {
  order_id: string;
  asset_type: string;
  side: string;
  qty: number | string;
  entry_price: number | string;
  tp_price: number | string;
  sl_price: number | string;
  zone: string;
  order_status: string;
}

interface AddOrderModalProps {
  formData: AddOrderForm;
  showModal: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onChange: (field: keyof AddOrderForm, value: any) => void;
  zones: string[];
}

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  formData,
  showModal,
  onClose,
  onSave,
  onChange,
  zones,
}) => {
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold mb-4">Add Order</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Order ID</label>
            <input
              type="text"
              value={formData.order_id}
              onChange={(e) => onChange('order_id', e.target.value)}
              placeholder="Auto-generated"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Asset Type</label>
            <input
              type="text"
              value={formData.asset_type}
              onChange={(e) => onChange('asset_type', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Side</label>
            <select
              value={formData.side}
              onChange={(e) => onChange('side', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Qty</label>
            <input
              type="number"
              step="any"
              value={formData.qty}
              onChange={(e) => onChange('qty', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Entry Price</label>
            <input
              type="number"
              step="any"
              value={formData.entry_price}
              onChange={(e) => onChange('entry_price', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">TP Price</label>
            <input
              type="number"
              step="any"
              value={formData.tp_price}
              onChange={(e) => onChange('tp_price', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">SL Price</label>
            <input
              type="number"
              step="any"
              value={formData.sl_price}
              onChange={(e) => onChange('sl_price', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Zone</label>
            <select
              value={formData.zone}
              onChange={(e) => onChange('zone', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">-- No Zone --</option>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Status</label>
            <select
              value={formData.order_status}
              onChange={(e) => onChange('order_status', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="PENDING">PENDING</option>
              <option value="FILLED">FILLED</option>
              <option value="CANCELED">CANCELED</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800"
          >
            Create Order
          </button>
        </div>
      </div>
    </div>
  );
};
