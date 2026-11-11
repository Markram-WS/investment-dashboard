import React, { useMemo } from 'react';
import { GroupOption } from '../types';
import { GroupCombobox } from './components/GroupCombobox';
import type { AddOrderForm } from '../hooks/useAddOrder';
import ModalShell from './components/ModalShell';

/** Field label: 12px/500 slate, sentence case. */
const fieldLabel = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-slate)',
  margin: '0 0 5px',
} as const;

/** Text field: 15px ink on canvas, 1px hairline, radius 8. */
const fieldInput = {
  width: '100%',
  fontSize: 15,
  color: 'var(--color-ink)',
  background: 'var(--color-canvas)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 8,
  padding: '8px 12px',
} as const;

const primaryButton = {
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  background: 'var(--color-ink)',
  color: 'var(--color-canvas)',
  border: '1px solid var(--color-ink)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const secondaryButton = {
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  background: 'var(--color-canvas)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const modalPanel = 'bg-canvas border border-hairline rounded-xl p-6 w-full max-w-md mx-4';

interface AddOrderModalProps {
  formData: AddOrderForm;
  showModal: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onChange: (field: keyof AddOrderForm, value: any) => void;
  groups: GroupOption[];
  groupOrderCounts: Record<number, number>;
  assetTypeOptions: string[];
}

const CONTRACT_TYPE_OPTS = [
  { value: 'spot', label: 'Spot' },
  { value: 'future', label: 'Future' },
  { value: 'option', label: 'Option' },
] as const;

const OPTION_TYPE_OPTS = [
  { value: 'Call', label: 'Call' },
  { value: 'Put', label: 'Put' },
] as const;

const STATUS_OPTS = [
  { value: 'FILLED', label: 'Filled' },
  { value: 'PENDING', label: 'Pending' },
] as const;

const ToggleBtn = React.memo(function ToggleBtn({ options, value, onChange }: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex" style={{ gap: 6 }}>
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="transition-colors"
            style={{
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 999,
              border: `1px solid ${isActive ? 'var(--color-ink)' : 'var(--color-hairline)'}`,
              background: isActive ? 'var(--color-ink)' : 'var(--color-canvas)',
              color: isActive ? 'var(--color-canvas)' : 'var(--color-slate)',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
});

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  formData,
  showModal,
  onClose,
  onSave,
  onChange,
  groups,
  groupOrderCounts,
  assetTypeOptions,
}) => {
  const entryPrice = parseFloat(formData.entry_price as string) || 0;
  const selectedGroup = groups.find(g => g.id === formData.group_id);

  const groupWarnings = useMemo(() => {
    if (!selectedGroup || !formData.group_id) return [];
    const warnings: string[] = [];
    if (selectedGroup.min_price != null && entryPrice < selectedGroup.min_price) {
      warnings.push(`Min price for this group is $${selectedGroup.min_price.toLocaleString()}`);
    }
    if (selectedGroup.max_price != null && entryPrice > selectedGroup.max_price) {
      warnings.push(`Max price for this group is $${selectedGroup.max_price.toLocaleString()}`);
    }
    if (selectedGroup.max_orders != null) {
      const currentCount = groupOrderCounts[formData.group_id] || 0;
      if (currentCount >= selectedGroup.max_orders) {
        warnings.push(`Group is full (${currentCount}/${selectedGroup.max_orders})`);
      }
    }
    return warnings;
  }, [selectedGroup, entryPrice, formData.group_id, groupOrderCounts]);

  const contractType = formData.contract_type || 'spot';

  const sideOptions = useMemo(() =>
    contractType === 'spot'
      ? [
          { value: 'BUY', label: 'Buy' },
          { value: 'SELL', label: 'Sell' },
        ]
      : [
          { value: 'LONG', label: 'Long' },
          { value: 'SHORT', label: 'Short' },
        ],
    [contractType]
  );

  if (!showModal) return null;

  return (
    <ModalShell open={showModal} onClose={onClose} title="Add Order" closeOnBackdrop={false} zIndex={110}>
      <div className={modalPanel}>
        <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: '0 0 16px' }}>Add order</h3>
        <div className="space-y-4">
          <div>
            <label className="block" style={fieldLabel}>Order ID</label>
            <input
              type="text"
              value={formData.order_id}
              onChange={(e) => onChange('order_id', e.target.value)}
              placeholder="Auto-generated"
              className="w-full" style={fieldInput}
            />
          </div>
          <div>
            <label className="block" style={fieldLabel}>Contract Type</label>
            <ToggleBtn
              options={CONTRACT_TYPE_OPTS}
              value={contractType}
              onChange={(v) => onChange('contract_type', v)}
            />
          </div>
          <div>
            <label className="block" style={fieldLabel}>Asset Type</label>
            <input
              type="text"
              value={formData.asset_type}
              onChange={(e) => onChange('asset_type', e.target.value)}
              list="asset-types-add"
              className="w-full" style={fieldInput}
            />
            <datalist id="asset-types-add">
              {assetTypeOptions.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block" style={fieldLabel}>Side</label>
              <ToggleBtn
                options={sideOptions}
                value={formData.side}
                onChange={(v) => onChange('side', v)}
              />
            </div>
            {contractType === 'option' && (
              <div className="flex-1">
                <label className="block" style={fieldLabel}>Option Type</label>
                <ToggleBtn
                  options={OPTION_TYPE_OPTS}
                  value={formData.option_type}
                  onChange={(v) => onChange('option_type', v)}
                />
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block" style={fieldLabel}>Entry Price</label>
              <input
                type="number"
                step="any"
                value={formData.entry_price}
                onChange={(e) => onChange('entry_price', e.target.value)}
                className="w-full" style={fieldInput}
              />
            </div>
            <div className="flex-1">
              <label className="block" style={fieldLabel}>Qty</label>
              <input
                type="number"
                step="any"
                value={formData.qty}
                onChange={(e) => onChange('qty', e.target.value)}
                className="w-full" style={fieldInput}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block" style={fieldLabel}>Cost (spread/commission)</label>
              <input
                type="number"
                step="any"
                value={formData.cost}
                onChange={(e) => onChange('cost', e.target.value)}
                className="w-full" style={fieldInput}
              />
            </div>
            {contractType === 'option' ? (
              <div className="flex-1">
                <label className="block" style={fieldLabel}>Strike Price</label>
                <input
                  type="number"
                  step="any"
                  value={formData.strike_price}
                  onChange={(e) => onChange('strike_price', e.target.value)}
                  className="w-full" style={fieldInput}
                />
              </div>
            ) : (
              <div className="flex-1" />
            )}
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block" style={fieldLabel}>TP Price</label>
              <input
                type="number"
                step="any"
                value={formData.tp_price}
                onChange={(e) => onChange('tp_price', e.target.value)}
                className="w-full" style={fieldInput}
              />
            </div>
            <div className="flex-1">
              <label className="block" style={fieldLabel}>SL Price</label>
              <input
                type="number"
                step="any"
                value={formData.sl_price}
                onChange={(e) => onChange('sl_price', e.target.value)}
                className="w-full" style={fieldInput}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block" style={fieldLabel}>Status</label>
              <ToggleBtn
                options={STATUS_OPTS}
                value={formData.order_status}
                onChange={(v) => onChange('order_status', v)}
              />
            </div>
            {contractType !== 'spot' && (
              <div className="flex-1">
                <label className="block" style={fieldLabel}>Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => onChange('expiry_date', e.target.value)}
                  className="w-full" style={fieldInput}
                />
              </div>
            )}
          </div>
          <div>
            <label className="block" style={fieldLabel}>Group</label>
            <GroupCombobox groups={groups} value={formData.group_id} onChange={(v) => onChange('group_id', v)} />
            {groupWarnings.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {groupWarnings.map((w, i) => (
                  <p key={i} style={{ fontSize: 12, color: 'var(--color-danger-text)', display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end" style={{ gap: 8, marginTop: 24 }}>
          <button type="button" onClick={onClose} style={secondaryButton}>Cancel</button>
          <button type="button" onClick={onSave} style={primaryButton}>Create Order</button>
        </div>
      </div>
    </ModalShell>
  );
};