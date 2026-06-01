import React, { useMemo } from 'react';
import { SpreadOrder, GroupOption } from '../types';
import { GroupCombobox } from './components/GroupCombobox';

interface EditOrderModalProps {
  order: SpreadOrder | null;
  formData: Partial<SpreadOrder>;
  showModal: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onChange: (field: keyof typeof formData, value: any) => void;
  groups: GroupOption[];
  groupOrderCounts: Record<number, number>;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  order,
  formData,
  showModal,
  onClose,
  onSave,
  onChange,
  groups,
  groupOrderCounts,
}) => {
  const entryPrice = parseFloat(formData.entry_price as string) || 0;
  const groupId = formData.group_id ?? null;
  const selectedGroup = groups.find(g => g.id === groupId);

  const groupWarnings = useMemo(() => {
    if (!selectedGroup || groupId == null) return [];
    const warnings: string[] = [];
    if (selectedGroup.min_price != null && entryPrice < selectedGroup.min_price) {
      warnings.push(`Min price for this group is $${selectedGroup.min_price.toLocaleString()}`);
    }
    if (selectedGroup.max_price != null && entryPrice > selectedGroup.max_price) {
      warnings.push(`Max price for this group is $${selectedGroup.max_price.toLocaleString()}`);
    }
    if (selectedGroup.max_orders != null) {
      const currentCount = groupOrderCounts[groupId] || 0;
      const isEditingOwn = order?.group_id === groupId;
      const actualCount = isEditingOwn ? currentCount - 1 : currentCount;
      if (actualCount >= selectedGroup.max_orders) {
        warnings.push(`Group is full (${actualCount + 1}/${selectedGroup.max_orders})`);
      }
    }
    return warnings;
  }, [selectedGroup, entryPrice, groupId, groupOrderCounts, order?.group_id]);
  if (!showModal || !order) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold mb-4">Edit Order #{order.order_id}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Asset Type</label>
            <input
              type="text"
              value={formData.asset_type || ''}
              onChange={(e) => onChange('asset_type', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Side</label>
            <select
              value={formData.side || ''}
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
              value={formData.qty || ''}
              onChange={(e) => onChange('qty', parseFloat(e.target.value))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Entry Price</label>
            <input
              type="number"
              step="any"
              value={formData.entry_price || ''}
              onChange={(e) => onChange('entry_price', parseFloat(e.target.value))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">TP Price</label>
            <input
              type="number"
              step="any"
              value={formData.tp_price || ''}
              onChange={(e) => onChange('tp_price', parseFloat(e.target.value))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">SL Price</label>
            <input
              type="number"
              step="any"
              value={formData.sl_price || ''}
              onChange={(e) => onChange('sl_price', parseFloat(e.target.value))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Group</label>
            <GroupCombobox groups={groups} value={formData.group_id ?? null} onChange={(v) => onChange('group_id', v)} />
            {groupWarnings.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {groupWarnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Status</label>
            <select
              value={formData.order_status || ''}
              onChange={(e) => onChange('order_status', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="FILLED">FILLED</option>
              <option value="PENDING">PENDING</option>
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
            className="px-4 py-2 text-sm bg-teal-600 text-white rounded hover:bg-teal-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};