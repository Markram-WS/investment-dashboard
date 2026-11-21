import React, { useMemo, useState } from 'react';
import { SpreadOrder, GroupOption } from '../types';
import { GroupCombobox } from './components/GroupCombobox';
import { api } from '../lib/api';
import { formatMoney } from '../utils/format';
import ModalShell from './components/ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import { Field, NumberInput, TextInput } from './components/Field';
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_LABEL,
  CONTROL_TITLE,
  CONTROL_VALUE,
} from './components/controlStyles';

const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;

const modalPanel = 'bg-canvas border border-hairline w-full max-w-md mx-4';
const modalPanelStyle = {
  padding: 'var(--space-md)',
  borderRadius: 'var(--rounded-xl)',
} as const;

interface EditOrderModalProps {
  order: SpreadOrder | null;
  formData: Partial<SpreadOrder>;
  showModal: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onChange: (field: keyof typeof formData, value: unknown) => void;
  groups: GroupOption[];
  groupOrderCounts: Record<number, number>;
  assetTypeOptions: string[];
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
            className="transition-colors text-[length:var(--fs-label)]"
            style={{
              padding: '5px 12px',
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
  portfolioId,
}) => {
  const entryPrice = parseFloat(formData.entry_price as string) || 0;
  const groupId = formData.group_id ?? null;
  const selectedGroup = groups.find(g => g.id === groupId);

  const [pendingUnlink, setPendingUnlink] = useState(false);
  const linkType = order?.link_type;
  const showLinkDetail = linkType === 'spread' || linkType === 'pending_close';

  const groupWarnings = useMemo(() => {
    if (!selectedGroup || groupId == null) return [];
    const warnings: string[] = [];
    if (selectedGroup.min_price != null && entryPrice < selectedGroup.min_price) {
      warnings.push(`Min price for this group is ${formatMoney(selectedGroup.min_price)}`);
    }
    if (selectedGroup.max_price != null && entryPrice > selectedGroup.max_price) {
      warnings.push(`Max price for this group is ${formatMoney(selectedGroup.max_price)}`);
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
      <div className={`${MODAL_CARD} ${modalPanel}`} style={modalPanelStyle}>
        <h3 className={`${MODAL_HEADER} block`} style={{ ...CONTROL_TITLE, margin: '0 0 12px' }}>Edit order #{order.order_id}</h3>
        <div className={`${MODAL_BODY} space-y-3`}>
          <div>
            <label style={CONTROL_LABEL}>Contract Type</label>
            <ToggleBtn
              options={EDIT_CONTRACT_OPTS}
              value={contractType}
              onChange={(v) => onChange('contract_type', v)}
            />
          </div>
          <div>
            <Field label="Asset Type" htmlFor="edit-order-asset-type">
              <TextInput
                id="edit-order-asset-type"
                type="text"
                value={formData.asset_type || ''}
                onChange={(e) => onChange('asset_type', e.target.value)}
                list="asset-types-edit"
                className="w-full"
              />
            </Field>
            <datalist id="asset-types-edit">
              {assetTypeOptions.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label style={CONTROL_LABEL}>Side</label>
              <ToggleBtn
                options={editSideOptions}
                value={formData.side || (contractType === 'spot' ? 'BUY' : 'LONG')}
                onChange={(v) => onChange('side', v)}
              />
            </div>
            {contractType === 'option' && (
              <div className="flex-1">
                <label style={CONTROL_LABEL}>Option Type</label>
                <ToggleBtn
                  options={EDIT_OPTION_TYPE_OPTS}
                  value={formData.option_type || ''}
                  onChange={(v) => onChange('option_type', v)}
                />
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <Field className="flex-1" label="Entry Price" htmlFor="edit-order-entry-price">
              <NumberInput
                id="edit-order-entry-price"
                step="any"
                value={formData.entry_price || ''}
                onChange={(e) => onChange('entry_price', parseFloat(e.target.value))}
                className="w-full"
              />
            </Field>
            <Field className="flex-1" label="Qty" htmlFor="edit-order-qty">
              <NumberInput
                id="edit-order-qty"
                step="any"
                value={formData.qty || ''}
                onChange={(e) => onChange('qty', parseFloat(e.target.value))}
                className="w-full"
              />
            </Field>
          </div>
          <div className="flex gap-4">
            <Field className="flex-1" label="TP Price" htmlFor="edit-order-tp-price">
              <NumberInput
                id="edit-order-tp-price"
                step="any"
                value={formData.tp_price || ''}
                onChange={(e) => onChange('tp_price', parseFloat(e.target.value))}
                className="w-full"
              />
            </Field>
            <Field className="flex-1" label="SL Price" htmlFor="edit-order-sl-price">
              <NumberInput
                id="edit-order-sl-price"
                step="any"
                value={formData.sl_price || ''}
                onChange={(e) => onChange('sl_price', parseFloat(e.target.value))}
                className="w-full"
              />
            </Field>
          </div>
          {contractType === 'option' && (
            <Field label="Strike Price" htmlFor="edit-order-strike-price">
              <NumberInput
                id="edit-order-strike-price"
                step="any"
                value={formData.strike_price ?? ''}
                onChange={(e) => onChange('strike_price', parseFloat(e.target.value))}
                className="w-full"
              />
            </Field>
          )}
          <div className="flex gap-4">
            <Field className="flex-1" label="Cost (spread/commission)" htmlFor="edit-order-cost">
              <NumberInput
                id="edit-order-cost"
                step="any"
                value={formData.cost ?? ''}
                onChange={(e) => onChange('cost', parseFloat(e.target.value))}
                className="w-full"
              />
            </Field>
            {contractType !== 'spot' && (
              <Field className="flex-1" label="Expiry Date" htmlFor="edit-order-expiry-date">
                <TextInput
                  id="edit-order-expiry-date"
                  type="date"
                  value={formData.expiry_date ? (formData.expiry_date as string).slice(0, 10) : ''}
                  onChange={(e) => onChange('expiry_date', e.target.value)}
                  className="w-full"
                  style={{ height: 'var(--control-h)' }}
                />
              </Field>
            )}
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label style={CONTROL_LABEL}>Status</label>
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
                  <span className="font-mono text-ink" style={CONTROL_VALUE}>
                    #{order?.linked_order_id || 'unknown'}
                  </span>
                  {pendingUnlink && (
                    <span className="ml-auto text-[length:var(--fs-label)]" style={{ fontWeight: 500, color: 'var(--color-danger-text)' }}>Will unlink</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label style={CONTROL_LABEL}>Group</label>
            <GroupCombobox groups={groups} value={formData.group_id ?? null} onChange={(v) => onChange('group_id', v)} />
            {groupWarnings.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {groupWarnings.map((w, i) => (
                  <p key={i} className="text-[length:var(--fs-label)]" style={{ color: 'var(--color-danger-text)', display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={`${MODAL_FOOTER} flex justify-end`} style={{ gap: 8, marginTop: 12 }}>
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
