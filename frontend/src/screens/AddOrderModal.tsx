import React, { useMemo } from 'react';
import { GroupOption } from '../types';
import { GroupCombobox } from './components/GroupCombobox';
import type { AddOrderForm } from '../hooks/useAddOrder';
import ModalShell from './components/ModalShell';
import { priceLabel } from '../utils/format';

/** Field label: 11px/500 slate, sentence case. */
const fieldLabel = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--color-slate)',
  margin: '0 0 3px',
} as const;

/** Band label: 11px/600 ink, sentence case. */
const bandLabel = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-ink)',
  margin: '0 0 6px',
} as const;

/** Text field: 13px ink on canvas, 1px hairline, radius 8. */
const fieldInput = {
  width: '100%',
  fontSize: 13,
  color: 'var(--color-ink)',
  background: 'var(--color-canvas)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 8,
  padding: '6px 10px',
} as const;

const primaryButton = {
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 500,
  background: 'var(--color-ink)',
  color: 'var(--color-canvas)',
  border: '1px solid var(--color-ink)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const secondaryButton = {
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 500,
  background: 'var(--color-canvas)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const modalPanel = 'bg-canvas border border-hairline rounded-xl p-3.5 w-full max-w-md mx-4';

const BAND_GAP = 14;
const ROW_GAP = 12;
const FIELD_GAP = 6;

const bandStack: React.CSSProperties = { display: 'grid', gap: BAND_GAP };
const fieldStack: React.CSSProperties = { display: 'grid', gap: FIELD_GAP };
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: ROW_GAP };

interface AddOrderModalProps {
  formData: AddOrderForm;
  showModal: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onChange: (field: keyof AddOrderForm, value: unknown) => void;
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

const ToggleBtn = React.memo(function ToggleBtn({ options, value, onChange, fullWidth = false }: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  fullWidth?: boolean;
}) {
  return (
    <div style={fullWidth ? { display: 'flex', gap: 6, width: '100%' } : { display: 'inline-flex', gap: 6 }}>
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
              flex: fullWidth ? 1 : undefined,
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

  return (
    <ModalShell open={showModal} onClose={onClose} title="Add order" closeOnBackdrop={false} zIndex={110}>
      <div className={modalPanel}>
        <div className="flex items-baseline justify-between" style={{ gap: 12, margin: '0 0 12px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0 }}>Add order</h3>
          <span style={{ fontSize: 11, color: 'var(--color-slate)', whiteSpace: 'nowrap' }}>
            ID {formData.order_id}
          </span>
        </div>

        <div style={bandStack}>
          <section>
            <div style={bandLabel}>Instrument</div>
            <div style={fieldStack}>
              <ToggleBtn
                options={CONTRACT_TYPE_OPTS}
                value={contractType}
                onChange={(v) => onChange('contract_type', v)}
                fullWidth
              />
              <div>
                <label className="block" style={fieldLabel}>Asset type</label>
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
              {contractType === 'option' ? (
                <div style={twoCol}>
                  <div>
                    <label className="block" style={fieldLabel}>Side</label>
                    <ToggleBtn
                      options={sideOptions}
                      value={formData.side}
                      onChange={(v) => onChange('side', v)}
                      fullWidth
                    />
                  </div>
                  <div>
                    <label className="block" style={fieldLabel}>Option type</label>
                    <ToggleBtn
                      options={OPTION_TYPE_OPTS}
                      value={formData.option_type}
                      onChange={(v) => onChange('option_type', v)}
                      fullWidth
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block" style={fieldLabel}>Side</label>
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

          <section>
            <div style={bandLabel}>Size &amp; price</div>
            <div style={fieldStack}>
              <div style={twoCol}>
                <div>
                  <label className="block" style={fieldLabel}>Entry price</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.entry_price}
                    onChange={(e) => onChange('entry_price', e.target.value)}
                    className="w-full" style={fieldInput}
                  />
                </div>
                <div>
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
              {contractType === 'option' ? (
                <div style={twoCol}>
                  <div>
                    <label className="block" style={fieldLabel}>Cost</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.cost}
                      onChange={(e) => onChange('cost', e.target.value)}
                      className="w-full" style={fieldInput}
                    />
                  </div>
                  <div>
                    <label className="block" style={fieldLabel}>Strike price</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.strike_price}
                      onChange={(e) => onChange('strike_price', e.target.value)}
                      className="w-full" style={fieldInput}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block" style={fieldLabel}>Cost</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.cost}
                    onChange={(e) => onChange('cost', e.target.value)}
                    className="w-full" style={fieldInput}
                  />
                </div>
              )}
            </div>
          </section>

          <section>
            <div style={bandLabel}>Exits</div>
            <div style={twoCol}>
              <div>
                <label className="block" style={fieldLabel}>TP price</label>
                <input
                  type="number"
                  step="any"
                  value={formData.tp_price}
                  onChange={(e) => onChange('tp_price', e.target.value)}
                  className="w-full" style={fieldInput}
                />
              </div>
              <div>
                <label className="block" style={fieldLabel}>SL price</label>
                <input
                  type="number"
                  step="any"
                  value={formData.sl_price}
                  onChange={(e) => onChange('sl_price', e.target.value)}
                  className="w-full" style={fieldInput}
                />
              </div>
            </div>
          </section>

          <section>
            <div style={bandLabel}>Placement</div>
            <div style={fieldStack}>
              {contractType !== 'spot' ? (
                <div style={twoCol}>
                  <div>
                    <label className="block" style={fieldLabel}>Status</label>
                    <ToggleBtn
                      options={STATUS_OPTS}
                      value={formData.order_status}
                      onChange={(v) => onChange('order_status', v)}
                      fullWidth
                    />
                  </div>
                  <div>
                    <label className="block" style={fieldLabel}>Expiry date</label>
                    <input
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => onChange('expiry_date', e.target.value)}
                      className="w-full" style={fieldInput}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block" style={fieldLabel}>Status</label>
                  <ToggleBtn
                    options={STATUS_OPTS}
                    value={formData.order_status}
                    onChange={(v) => onChange('order_status', v)}
                    fullWidth
                  />
                </div>
              )}
              <div>
                <label className="block" style={fieldLabel}>Zone</label>
                <GroupCombobox groups={groups} value={formData.group_id} onChange={(v) => onChange('group_id', v)} />
                {groupWarnings.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {groupWarnings.map((w, i) => (
                      <p key={i} style={{ fontSize: 11, color: 'var(--color-danger-text)', display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
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
          <p style={{ fontSize: 11, color: 'var(--color-slate)', margin: '10px 0 0' }}>{summary}</p>
        )}

        <div className="flex justify-end" style={{ gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={secondaryButton}>Cancel</button>
          <button type="button" onClick={onSave} style={primaryButton}>Create order</button>
        </div>
      </div>
    </ModalShell>
  );
};
