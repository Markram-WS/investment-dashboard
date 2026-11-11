import React, { useMemo, useState } from 'react';
import { SpreadOrder, GroupOption } from '../types';
import { GroupCombobox } from './components/GroupCombobox';
import { api } from '../lib/api';
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
  portfolioId?: number;
}

const EDIT_CONTRACT_OPTS = [
  { value: 'spot', label: 'Spot' },
  { value: 'future', label: 'Future' },
  { value: 'option', label: 'Option' },
] as const;

const EDIT_OPTION_TYPE_OPTS = [
  { value: 'Call', label: 'Call' },
  { value: 'Put', label: 'Put' },
] as const;

const EDIT_STATUS_OPTS = [
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
  portfolioId,
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

  const contractType = formData.contract_type || 'spot';

  const editSideOptions = useMemo(() =>
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

  if (!showModal || !order) return null;

  return (
    <ModalShell open={showModal} onClose={onClose} title={"Edit Order #" + (order?.order_id || '')} closeOnBackdrop={false} zIndex={110}>
      <div className={modalPanel}>
        <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: '0 0 16px' }}>Edit order #{order.order_id}</h3>
        <div className="space-y-4">
          <div>
            <label className="block" style={fieldLabel}>Contract Type</label>
            <ToggleBtn
              options={EDIT_CONTRACT_OPTS}
              value={contractType}
              onChange={(v) => onChange('contract_type', v)}
            />
          </div>
          <div>
            <label className="block" style={fieldLabel}>Asset Type</label>
            <input
              type="text"
              value={formData.asset_type || ''}
              onChange={(e) => onChange('asset_type', e.target.value)}
              list="asset-types-edit"
              className="w-full" style={fieldInput}
            />
            <datalist id="asset-types-edit">
              {assetTypeOptions.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block" style={fieldLabel}>Side</label>
              <ToggleBtn
                options={editSideOptions}
                value={formData.side || (contractType === 'spot' ? 'BUY' : 'LONG')}
                onChange={(v) => onChange('side', v)}
              />
            </div>
            {contractType === 'option' && (
              <div className="flex-1">
                <label className="block" style={fieldLabel}>Option Type</label>
                <ToggleBtn
                  options={EDIT_OPTION_TYPE_OPTS}
                  value={formData.option_type || ''}
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
                value={formData.entry_price || ''}
                onChange={(e) => onChange('entry_price', parseFloat(e.target.value))}
                className="w-full" style={fieldInput}
              />
            </div>
            <div className="flex-1">
              <label className="block" style={fieldLabel}>Qty</label>
              <input
                type="number"
                step="any"
                value={formData.qty || ''}
                onChange={(e) => onChange('qty', parseFloat(e.target.value))}
                className="w-full" style={fieldInput}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block" style={fieldLabel}>TP Price</label>
              <input
                type="number"
                step="any"
                value={formData.tp_price || ''}
                onChange={(e) => onChange('tp_price', parseFloat(e.target.value))}
                className="w-full" style={fieldInput}
              />
            </div>
            <div className="flex-1">
              <label className="block" style={fieldLabel}>SL Price</label>
              <input
                type="number"
                step="any"
                value={formData.sl_price || ''}
                onChange={(e) => onChange('sl_price', parseFloat(e.target.value))}
                className="w-full" style={fieldInput}
              />
            </div>
          </div>
          {contractType === 'option' && (
            <div>
              <label className="block" style={fieldLabel}>Strike Price</label>
              <input
                type="number"
                step="any"
                value={formData.strike_price ?? ''}
                onChange={(e) => onChange('strike_price', parseFloat(e.target.value))}
                className="w-full" style={fieldInput}
              />
            </div>
          )}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block" style={fieldLabel}>Cost (spread/commission)</label>
              <input
                type="number"
                step="any"
                value={formData.cost ?? ''}
                onChange={(e) => onChange('cost', parseFloat(e.target.value))}
                className="w-full" style={fieldInput}
              />
            </div>
            {contractType !== 'spot' && (
              <div className="flex-1">
                <label className="block" style={fieldLabel}>Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiry_date ? (formData.expiry_date as string).slice(0, 10) : ''}
                  onChange={(e) => onChange('expiry_date', e.target.value)}
                  className="w-full" style={fieldInput}
                />
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block" style={fieldLabel}>Status</label>
              <ToggleBtn
                options={EDIT_STATUS_OPTS}
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
                      style={{ color: pendingUnlink ? 'var(--color-danger-text)' : linkType === 'spread' ? 'var(--color-accent)' : 'var(--color-status-warning)' }}
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
                  <span className="font-mono text-ink" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                    #{order?.linked_order_id || 'unknown'}
                  </span>
                  {pendingUnlink && (
                    <span className="ml-auto" style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-danger-text)' }}>Will unlink</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block" style={fieldLabel}>Group</label>
            <GroupCombobox groups={groups} value={formData.group_id ?? null} onChange={(v) => onChange('group_id', v)} />
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
          <button type="button" onClick={async () => {
            if (pendingUnlink && order?.order_id) {
              try {
                await api.unlinkOrder(order.order_id, portfolioId);
                setPendingUnlink(false);
              } catch (e) {
                console.error('Unlink failed:', e);
              }
            }
            await onSave();
          }} style={primaryButton}>Save Changes</button>
        </div>
      </div>
    </ModalShell>
  );
};