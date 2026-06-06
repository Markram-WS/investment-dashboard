import React, { useMemo, useState } from 'react';
import { SpreadOrder, GroupOption } from '../types';
import { GroupCombobox } from './components/GroupCombobox';
import { api } from '../lib/api';
import { buttonTheme } from '../constants/colors';
import Button from './components/Button';

interface EditOrderModalProps {
  order: SpreadOrder | null;
  formData: Partial<SpreadOrder>;
  showModal: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onChange: (field: keyof typeof formData, value: any) => void;
  groups: GroupOption[];
  groupOrderCounts: Record<number, number>;
  assetTypeOptions: string[];
  activeOrders?: SpreadOrder[];
  onRefresh?: () => void;
}

function ToggleBtn({ options, value, onChange }: {
  options: { value: string; label: string; activeClass: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex gap-x-1.5">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full border transition-all ${
              isActive
                ? opt.activeClass
                : 'border-hairline bg-canvas text-slate hover:border-gray-300 hover:text-slate'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
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
  assetTypeOptions,
  activeOrders,
}) => {
  const entryPrice = parseFloat(formData.entry_price as string) || 0;
  const groupId = formData.group_id ?? null;
  const selectedGroup = groups.find(g => g.id === groupId);

  const [pendingUnlink, setPendingUnlink] = useState(false);
  const linkType = order?.link_type;
  const showLinkDetail = linkType === 'spread' || linkType === 'pending_close';
  const linkedPartner = order?.linked_order_id
    ? (activeOrders || []).find(o => o.order_id === order.linked_order_id)
    : null;

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

  const contractType = formData.contract_type || 'spot';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110]">
      <div className="bg-canvas rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold mb-4">Edit Order #{order.order_id}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate mb-1">Contract Type</label>
            <ToggleBtn
              options={[
                { value: 'spot', label: 'Spot', activeClass: 'bg-indigo-600 text-white border-indigo-600' },
                { value: 'future', label: 'Future', activeClass: 'bg-blue-600 text-white border-blue-600' },
                { value: 'option', label: 'Option', activeClass: 'bg-purple-600 text-white border-purple-600' },
              ]}
              value={contractType}
              onChange={(v) => onChange('contract_type', v)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate mb-1">Asset Type</label>
            <input
              type="text"
              value={formData.asset_type || ''}
              onChange={(e) => onChange('asset_type', e.target.value)}
              list="asset-types-edit"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <datalist id="asset-types-edit">
              {assetTypeOptions.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase text-slate mb-1">Side</label>
              <ToggleBtn
                options={
                  contractType === 'spot'
                    ? [
                        { value: 'BUY', label: 'BUY', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
                        { value: 'SELL', label: 'SELL', activeClass: 'bg-red-500 text-white border-red-500' },
                      ]
                    : [
                        { value: 'LONG', label: 'LONG', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
                        { value: 'SHORT', label: 'SHORT', activeClass: 'bg-red-500 text-white border-red-500' },
                      ]
                }
                value={formData.side || (contractType === 'spot' ? 'BUY' : 'LONG')}
                onChange={(v) => onChange('side', v)}
              />
            </div>
            {contractType === 'option' && (
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase text-slate mb-1">Option Type</label>
                <ToggleBtn
                  options={[
                    { value: 'Call', label: 'CALL', activeClass: `${buttonTheme.optionType.Call.bg} ${buttonTheme.optionType.Call.text} ${buttonTheme.optionType.Call.border}` },
                    { value: 'Put', label: 'PUT', activeClass: `${buttonTheme.optionType.Put.bg} ${buttonTheme.optionType.Put.text} ${buttonTheme.optionType.Put.border}` },
                  ]}
                  value={formData.option_type || ''}
                  onChange={(v) => onChange('option_type', v)}
                />
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase text-slate mb-1">Entry Price</label>
              <input
                type="number"
                step="any"
                value={formData.entry_price || ''}
                onChange={(e) => onChange('entry_price', parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase text-slate mb-1">Qty</label>
              <input
                type="number"
                step="any"
                value={formData.qty || ''}
                onChange={(e) => onChange('qty', parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase text-slate mb-1">TP Price</label>
              <input
                type="number"
                step="any"
                value={formData.tp_price || ''}
                onChange={(e) => onChange('tp_price', parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase text-slate mb-1">SL Price</label>
              <input
                type="number"
                step="any"
                value={formData.sl_price || ''}
                onChange={(e) => onChange('sl_price', parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          {contractType === 'option' && (
            <div>
              <label className="block text-xs font-bold uppercase text-slate mb-1">Strike Price</label>
              <input
                type="number"
                step="any"
                value={formData.strike_price ?? ''}
                onChange={(e) => onChange('strike_price', parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase text-slate mb-1">Cost (spread/commission)</label>
              <input
                type="number"
                step="any"
                value={formData.cost ?? ''}
                onChange={(e) => onChange('cost', parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            {contractType !== 'spot' && (
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase text-slate mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiry_date ? (formData.expiry_date as string).slice(0, 10) : ''}
                  onChange={(e) => onChange('expiry_date', e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase text-slate mb-1">Status</label>
              <ToggleBtn
                options={[
                  { value: 'FILLED', label: 'FILLED', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
                  { value: 'PENDING', label: 'PENDING', activeClass: 'bg-amber-400 text-white border-amber-400' },
                ]}
                value={formData.order_status || 'FILLED'}
                onChange={(v) => onChange('order_status', v)}
              />
            </div>
            {showLinkDetail && (
              <div className="flex-1">
                <div className="flex items-center gap-2 py-2 px-3">
                  <span
                    className="cursor-pointer inline-flex items-center justify-center transition-colors"
                    title={pendingUnlink ? 'Will unlink on save' : 'Click to unlink'}
                    onClick={() => setPendingUnlink(true)}
                    onMouseEnter={(e) => {
                      if (!pendingUnlink) {
                        const svg = e.currentTarget.querySelector('svg');
                        if (svg) svg.style.opacity = '0.3';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!pendingUnlink) {
                        const svg = e.currentTarget.querySelector('svg');
                        if (svg) svg.style.opacity = '1';
                      }
                    }}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ color: pendingUnlink ? '#ef4444' : linkType === 'spread' ? '#2563eb' : '#eab308' }}
                    >
                      {pendingUnlink ? (
                        <>
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" />
                          <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" />
                        </>
                      ) : (
                        <>
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" fill="none" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" fill="none" />
                        </>
                      )}
                    </svg>
                  </span>
                  <span className="text-sm font-mono text-ink">
                    #{order?.linked_order_id || 'unknown'}
                  </span>
                  {pendingUnlink && (
                    <span className="text-[10px] text-red-500 dark:text-red-400 font-semibold ml-auto">Will unlink</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate mb-1">Group</label>
            <GroupCombobox groups={groups} value={formData.group_id ?? null} onChange={(v) => onChange('group_id', v)} />
            {groupWarnings.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {groupWarnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={async () => {
            if (pendingUnlink && order?.order_id) {
              try {
                await api.unlinkOrder(order.order_id);
                setPendingUnlink(false);
              } catch (e) {
                console.error('Unlink failed:', e);
              }
            }
            await onSave();
          }}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
};