import React, { useMemo } from 'react';
import { GroupOption } from '../types';
import type { MappedOrderFields } from '../types';
import { GroupCombobox } from './components/GroupCombobox';
import type { AddOrderForm } from '../hooks/useAddOrder';
import ModalShell from './components/ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import { Field, NumberInput, TextInput } from './components/Field';
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_HELPER,
  CONTROL_LABEL,
  CONTROL_TITLE,
} from './components/controlStyles';
import { priceLabel, formatMoney } from '../utils/format';

/** Band label: 11px/600 ink, sentence case. */
const bandLabel = {
  ...CONTROL_LABEL,
  fontWeight: 600,
  color: 'var(--color-ink)',
  margin: '0 0 6px',
} as const;

const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;

const modalPanel = 'bg-canvas border border-hairline w-full max-w-md mx-4';
const modalPanelStyle = {
  padding: 'var(--space-md)',
  borderRadius: 'var(--rounded-xl)',
} as const;

const ROW_GAP = 12;
const FIELD_GAP = 6;

const fieldStack: React.CSSProperties = { display: 'grid', gap: FIELD_GAP };
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: ROW_GAP };

interface AddOrderModalProps {
  formData: AddOrderForm;
  showModal: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onChange: (field: keyof AddOrderForm, value: unknown) => void;
  groups: GroupOption[];
  groupOrderCounts: Record<number, number>;
  assetTypeOptions: string[];
  /** The portfolio's own product; when set it is the only valid symbol. */
  productTicker?: string | null;
  /** Present for a mapped portfolio: render only the foreign-writable fields. */
  mapped?: MappedOrderFields;
}

const CONTRACT_TYPE_OPTS = [
  { value: 'spot', label: 'Spot' },
  { value: 'future', label: 'Future', tone: 'future' },
  { value: 'option', label: 'Option', tone: 'option' },
] as const;

const OPTION_TYPE_OPTS = [
  { value: 'Call', label: 'Call', tone: 'call' },
  { value: 'Put', label: 'Put', tone: 'put' },
] as const;

const STATUS_OPTS = [
  { value: 'FILLED', label: 'Filled' },
  { value: 'PENDING', label: 'Pending' },
] as const;

const MAPPED_SIDE_OPTS = [
  { value: 'LONG', label: 'Long', tone: 'long' },
  { value: 'SHORT', label: 'Short', tone: 'short' },
] as const;

const ToggleBtn = React.memo(function ToggleBtn({ options, value, onChange, fullWidth = false }: {
  options: readonly { value: string; label: string; tone?: string }[];
  value: string;
  onChange: (v: string) => void;
  fullWidth?: boolean;
}) {
  return (
    <div style={fullWidth ? { display: 'flex', gap: 6, width: '100%', minWidth: 0, maxWidth: '100%' } : { display: 'inline-flex', gap: 6 }}>
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="tg-pill"
            data-tone={opt.tone}
            data-active={isActive}
            style={{ flex: fullWidth ? 1 : undefined, minWidth: 0 }}
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
  productTicker,
  mapped,
}) => {
  const entryPrice = parseFloat(formData.entry_price as string) || 0;
  const lockedAssetType = String(productTicker ?? '').trim();
  const selectedGroup = groups.find(g => g.id === formData.group_id);

  const groupWarnings = useMemo(() => {
    if (!selectedGroup || !formData.group_id) return [];
    const warnings: string[] = [];
    if (selectedGroup.min_price != null && entryPrice < selectedGroup.min_price) {
      warnings.push(`Min price for this group is ${formatMoney(selectedGroup.min_price)}`);
    }
    if (selectedGroup.max_price != null && entryPrice > selectedGroup.max_price) {
      warnings.push(`Max price for this group is ${formatMoney(selectedGroup.max_price)}`);
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
          { value: 'BUY', label: 'Buy', tone: 'long' },
          { value: 'SELL', label: 'Sell', tone: 'short' },
        ]
      : [
          { value: 'LONG', label: 'Long', tone: 'long' },
          { value: 'SHORT', label: 'Short', tone: 'short' },
        ],
    [contractType]
  );

  const summary = useMemo(() => {
    const asset = String(formData.asset_type ?? '').trim();
    if (!asset) return '';

    const sideLabel = sideOptions.find(o => o.value === formData.side)?.label ?? '';
    const qty = String(formData.qty ?? '').trim();
    const parts = [sideLabel, qty, asset].filter(Boolean);

    let line = parts.join(' ');
    const entry = Number(formData.entry_price);
    if (String(formData.entry_price ?? '').trim() !== '' && Number.isFinite(entry)) {
      line += ` @ ${Number.isInteger(entry) ? String(entry) : entry.toFixed(2)}`;
    }
    if (selectedGroup) line += ` · Zone ${priceLabel(selectedGroup.name)}`;
    return line;
  }, [formData.asset_type, formData.side, formData.qty, formData.entry_price, selectedGroup, sideOptions]);

  if (!showModal) return null;

  if (mapped) {
    const mappedFields = new Set(mapped.fields);
    const mappedSideValue = formData.side === 'BUY'
      ? 'LONG'
      : formData.side === 'SELL'
        ? 'SHORT'
        : formData.side || 'LONG';
    return (
      <ModalShell open={showModal} onClose={onClose} title="Add order" closeOnBackdrop={false} zIndex={110}>
        <div className={`${MODAL_CARD} ${modalPanel}`} style={modalPanelStyle}>
          <div className={`${MODAL_HEADER} flex items-baseline justify-between`} style={{ gap: 12, margin: '0 0 12px' }}>
            <h3 style={CONTROL_TITLE}>Add order</h3>
            {!mapped.keyGenerated && (
              <Field label="Order ID" htmlFor="add-order-id" className="flex items-baseline gap-1.5">
                <TextInput
                  id="add-order-id"
                  type="text"
                  value={formData.order_id}
                  onChange={(e) => onChange('order_id', e.target.value)}
                  autoComplete="off"
                  aria-label="Order ID"
                  style={{ width: 132 }}
                />
              </Field>
            )}
          </div>

          <div className={`${MODAL_BODY} space-y-3`}>
            {mappedFields.has('asset_type') && (
              <Field label="Asset symbol" htmlFor="add-order-asset-type">
                <TextInput
                  id="add-order-asset-type"
                  type="text"
                  value={formData.asset_type}
                  onChange={(e) => onChange('asset_type', e.target.value)}
                  list="asset-types-add"
                  className="w-full"
                />
              </Field>
            )}
            <datalist id="asset-types-add">
              {assetTypeOptions.map((t) => <option key={t} value={t} />)}
            </datalist>
            {mappedFields.has('side') && (
              <div>
                <label style={CONTROL_LABEL}>Side</label>
                <ToggleBtn
                  options={MAPPED_SIDE_OPTS}
                  value={mappedSideValue}
                  onChange={(v) => onChange('side', v)}
                  fullWidth
                />
              </div>
            )}
            <div style={twoCol}>
              {mappedFields.has('qty') && (
                <Field label="Qty" htmlFor="add-order-qty">
                  <NumberInput
                    id="add-order-qty"
                    step="any"
                    value={formData.qty}
                    onChange={(e) => onChange('qty', e.target.value)}
                    className="w-full"
                  />
                </Field>
              )}
              {mappedFields.has('entry_price') && (
                <Field label="Entry price" htmlFor="add-order-entry-price">
                  <NumberInput
                    id="add-order-entry-price"
                    step="any"
                    value={formData.entry_price}
                    onChange={(e) => onChange('entry_price', e.target.value)}
                    className="w-full"
                  />
                </Field>
              )}
            </div>
            {mappedFields.has('tp_price') && (
              <Field label="TP price" htmlFor="add-order-tp-price">
                <NumberInput
                  id="add-order-tp-price"
                  step="any"
                  value={formData.tp_price}
                  onChange={(e) => onChange('tp_price', e.target.value)}
                  className="w-full"
                />
              </Field>
            )}
            {mappedFields.has('fee') && (
              <Field label="Fee" htmlFor="add-order-fee">
                <NumberInput
                  id="add-order-fee"
                  step="any"
                  value={formData.fee ?? ''}
                  onChange={(e) => onChange('fee', e.target.value)}
                  className="w-full"
                />
              </Field>
            )}
            {mappedFields.has('remark') && (
              <Field label="Remark" htmlFor="add-order-remark">
                <TextInput
                  id="add-order-remark"
                  type="text"
                  value={formData.remark ?? ''}
                  onChange={(e) => onChange('remark', e.target.value)}
                  className="w-full"
                />
              </Field>
            )}
            {mappedFields.has('order_ref') && (
              <Field label="Broker order no." htmlFor="add-order-ref">
                <TextInput
                  id="add-order-ref"
                  type="text"
                  value={formData.order_ref ?? ''}
                  onChange={(e) => onChange('order_ref', e.target.value)}
                  className="w-full"
                />
              </Field>
            )}
          </div>

          <div className={`${MODAL_FOOTER} flex justify-end`} style={{ gap: 8, marginTop: 12 }}>
            <button type="button" onClick={onClose} style={secondaryButton}>Cancel</button>
            <button type="button" onClick={onSave} style={primaryButton}>Create order</button>
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell open={showModal} onClose={onClose} title="Add order" closeOnBackdrop={false} zIndex={110}>
      <div className={`${MODAL_CARD} ${modalPanel}`} style={modalPanelStyle}>
        <div className={`${MODAL_HEADER} flex items-baseline justify-between`} style={{ gap: 12, margin: '0 0 12px' }}>
          <h3 style={CONTROL_TITLE}>Add order</h3>
          <Field label="Order ID" htmlFor="add-order-id" className="flex items-baseline gap-1.5">
            <TextInput
              id="add-order-id"
              type="text"
              value={formData.order_id}
              onChange={(e) => onChange('order_id', e.target.value)}
              autoComplete="off"
              aria-label="Order ID"
              style={{ width: 132 }}
            />
          </Field>
        </div>

        <div className={`${MODAL_BODY} -mr-1 pr-1 overflow-x-hidden`}>
          <div className="grid grid-cols-2 items-start gap-x-4 gap-y-3.5">
          <section className="min-w-0">
            <div style={bandLabel}>Instrument</div>
            <div style={fieldStack}>
              <ToggleBtn
                options={CONTRACT_TYPE_OPTS}
                value={contractType}
                onChange={(v) => onChange('contract_type', v)}
                fullWidth
              />
              <Field
                label="Asset type"
                htmlFor="add-order-asset-type"
                hint={lockedAssetType ? 'Portfolio product — other symbols are rejected.' : undefined}
              >
                <TextInput
                  id="add-order-asset-type"
                  type="text"
                  value={lockedAssetType || formData.asset_type}
                  onChange={(e) => onChange('asset_type', e.target.value)}
                  readOnly={Boolean(lockedAssetType)}
                  list={lockedAssetType ? undefined : 'asset-types-add'}
                  className="w-full"
                  style={lockedAssetType ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
                />
              </Field>
              {!lockedAssetType && (
                <datalist id="asset-types-add">
                  {assetTypeOptions.map((t) => <option key={t} value={t} />)}
                </datalist>
              )}
              {contractType === 'option' ? (
                <div style={twoCol}>
                  <div className="min-w-0">
                    <label style={CONTROL_LABEL}>Side</label>
                    <ToggleBtn
                      options={sideOptions}
                      value={formData.side}
                      onChange={(v) => onChange('side', v)}
                      fullWidth
                    />
                  </div>
                  <div className="min-w-0">
                    <label style={CONTROL_LABEL}>Option type</label>
                    <ToggleBtn
                      options={OPTION_TYPE_OPTS}
                      value={formData.option_type}
                      onChange={(v) => onChange('option_type', v)}
                      fullWidth
                    />
                  </div>
                </div>
              ) : (
                <div className="min-w-0">
                  <label style={CONTROL_LABEL}>Side</label>
                  <ToggleBtn
                    options={sideOptions}
                    value={formData.side}
                    onChange={(v) => onChange('side', v)}
                    fullWidth
                  />
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0">
            <div style={bandLabel}>Size &amp; price</div>
            <div style={fieldStack}>
              <div style={twoCol}>
                <Field className="min-w-0" label="Entry price" htmlFor="add-order-entry-price">
                  <NumberInput
                    id="add-order-entry-price"
                    step="any"
                    value={formData.entry_price}
                    onChange={(e) => onChange('entry_price', e.target.value)}
                    className="w-full"
                  />
                </Field>
                <Field className="min-w-0" label="Qty" htmlFor="add-order-qty">
                  <NumberInput
                    id="add-order-qty"
                    step="any"
                    value={formData.qty}
                    onChange={(e) => onChange('qty', e.target.value)}
                    className="w-full"
                  />
                </Field>
              </div>
              {contractType === 'option' ? (
                <div style={twoCol}>
                  <Field className="min-w-0" label="Cost" htmlFor="add-order-cost">
                    <NumberInput
                      id="add-order-cost"
                      step="any"
                      value={formData.cost}
                      onChange={(e) => onChange('cost', e.target.value)}
                      className="w-full"
                    />
                  </Field>
                  <Field className="min-w-0" label="Strike price" htmlFor="add-order-strike-price">
                    <NumberInput
                      id="add-order-strike-price"
                      step="any"
                      value={formData.strike_price}
                      onChange={(e) => onChange('strike_price', e.target.value)}
                      className="w-full"
                    />
                  </Field>
                </div>
              ) : (
                <Field className="min-w-0" label="Cost" htmlFor="add-order-cost">
                  <NumberInput
                    id="add-order-cost"
                    step="any"
                    value={formData.cost}
                    onChange={(e) => onChange('cost', e.target.value)}
                    className="w-full"
                  />
                </Field>
              )}
            </div>
          </section>

          <section className="min-w-0">
            <div style={bandLabel}>Exits</div>
            <div style={twoCol}>
              <Field className="min-w-0" label="TP price" htmlFor="add-order-tp-price">
                <NumberInput
                  id="add-order-tp-price"
                  step="any"
                  value={formData.tp_price}
                  onChange={(e) => onChange('tp_price', e.target.value)}
                  className="w-full"
                />
              </Field>
              <Field className="min-w-0" label="SL price" htmlFor="add-order-sl-price">
                <NumberInput
                  id="add-order-sl-price"
                  step="any"
                  value={formData.sl_price}
                  onChange={(e) => onChange('sl_price', e.target.value)}
                  className="w-full"
                />
              </Field>
            </div>
          </section>

          <section className="min-w-0">
            <div style={bandLabel}>Placement</div>
            <div style={fieldStack}>
              {contractType !== 'spot' ? (
                <div className="min-w-0" style={fieldStack}>
                  <div className="min-w-0">
                    <label style={CONTROL_LABEL}>Status</label>
                    <ToggleBtn
                      options={STATUS_OPTS}
                      value={formData.order_status}
                      onChange={(v) => onChange('order_status', v)}
                      fullWidth
                    />
                  </div>
                  <Field className="min-w-0" label="Expiry date" htmlFor="add-order-expiry-date">
                    <TextInput
                      id="add-order-expiry-date"
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => onChange('expiry_date', e.target.value)}
                      className="w-full"
                      style={{ minWidth: 0, maxWidth: '100%', height: 'var(--control-h)' }}
                    />
                  </Field>
                </div>
              ) : (
                <div className="min-w-0">
                  <label style={CONTROL_LABEL}>Status</label>
                  <ToggleBtn
                    options={STATUS_OPTS}
                    value={formData.order_status}
                    onChange={(v) => onChange('order_status', v)}
                    fullWidth
                  />
                </div>
              )}
              <div className="min-w-0">
                <label style={CONTROL_LABEL}>Zone</label>
                <GroupCombobox groups={groups} value={formData.group_id} onChange={(v) => onChange('group_id', v)} />
                {groupWarnings.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {groupWarnings.map((w, i) => (
                      <p key={i} style={{ ...CONTROL_HELPER, color: 'var(--color-danger-text)', display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                        {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
          </div>

          {summary && (
            <p style={{ ...CONTROL_HELPER, margin: '10px 0 0' }}>{summary}</p>
          )}
        </div>

        <div className={`${MODAL_FOOTER} flex justify-end`} style={{ gap: 8, marginTop: 12 }}>
          <button type="button" onClick={onClose} style={secondaryButton}>Cancel</button>
          <button type="button" onClick={onSave} style={primaryButton}>Create order</button>
        </div>
      </div>
    </ModalShell>
  );
};
