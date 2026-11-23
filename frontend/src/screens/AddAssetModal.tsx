import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { BrokerRecord } from '../lib/api';
import ModalShell from './components/ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import { Field, NumberInput, SelectInput, TextInput } from './components/Field';
import { CONTROL_HELPER, CONTROL_TITLE } from './components/controlStyles';

interface AddAssetModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  groups: { id: number; name: string }[];
}

const SOURCES = ['manual', 'yfinance', 'tfex'];
const TYPES = ['stock', 'future', 'option', 'crypto'];

const primaryButton = {
  padding: '5px 12px',
  fontWeight: 500,
  background: 'var(--color-ink)',
  color: 'var(--color-canvas)',
  border: '1px solid var(--color-ink)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const secondaryButton = {
  padding: '5px 12px',
  fontWeight: 500,
  background: 'var(--color-canvas)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const errorText = {
  color: 'var(--color-danger-text)',
  background: 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)',
  borderRadius: 8,
  padding: '6px 8px',
  marginBottom: 12,
} as const;

const modalPanel = 'bg-canvas border border-hairline rounded-xl p-4 w-[400px] max-w-[90vw]';

const emptyForm = {
  ticker: '',
  price_symbol: '',
  name: '',
  asset_type: 'stock',
  source: 'manual',
  group_id: '',
  broker_id: '',
  multiplier: '1',
  margin_rate: '0',
};

const AddAssetModal: React.FC<AddAssetModalProps> = ({ open, onClose, onSaved, groups }) => {
  const [form, setForm] = useState({ ...emptyForm });
  const [brokers, setBrokers] = useState<BrokerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && groups.length > 0) {
      const defaultGroup = groups.find(g => g.name === 'Watchlist') || groups[0];
      setForm(p => ({ ...p, group_id: String(defaultGroup.id) }));
    }
  }, [open, groups]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.getBrokers()
      .then(rows => {
        if (cancelled) return;
        setBrokers(rows);
        setForm(p => (p.broker_id === '' && rows.length > 0 ? { ...p, broker_id: String(rows[0].id) } : p));
      })
      .catch(() => { /* broker list is optional here */ });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.ticker.trim()) { setError('Symbol is required'); return; }
    const multiplier = parseFloat(form.multiplier);
    const marginRate = parseFloat(form.margin_rate);
    if (form.multiplier.trim() === '' || isNaN(multiplier) || multiplier <= 0) {
      setError('Multiplier must be greater than 0');
      return;
    }
    if (form.margin_rate.trim() === '' || isNaN(marginRate) || marginRate < 0 || marginRate > 1) {
      setError('Margin rate must be between 0 and 1');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.createAsset({
        ticker: form.ticker.trim(),
        price_symbol: form.price_symbol.trim() || undefined,
        name: form.name.trim() || form.ticker.trim(),
        asset_type: form.asset_type,
        source: form.source,
        group_id: form.group_id ? parseInt(form.group_id) : undefined,
        broker_id: form.broker_id ? parseInt(form.broker_id) : undefined,
        multiplier,
        margin_rate: marginRate,
      });
      onSaved();
      onClose();
      setForm({ ...emptyForm, broker_id: brokers.length > 0 ? String(brokers[0].id) : '' });
    } catch (e) {
      console.error('Failed to create the asset', e);
      setError("Couldn't create the asset. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Add Asset" zIndex={9999}>
      <div className={`${MODAL_CARD} ${modalPanel}`}>
        <h3 className={`${MODAL_HEADER} block`} style={{ ...CONTROL_TITLE, margin: '0 0 12px' }}>Add asset</h3>

        <div className={MODAL_BODY}>
        {error && <div style={errorText} className="text-[length:var(--fs-label)]">{error}</div>}

        <div className="space-y-2.5">
          <Field label="Symbol" htmlFor="add-asset-ticker" required>
            <TextInput id="add-asset-ticker" value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))}
              placeholder="e.g. AAPL" />
          </Field>
          <div>
            <Field label="Price symbol" htmlFor="add-asset-price-symbol">
              <TextInput id="add-asset-price-symbol" value={form.price_symbol} onChange={e => setForm(p => ({ ...p, price_symbol: e.target.value }))}
                placeholder={form.ticker.trim() || 'Optional'} />
            </Field>
            <p style={CONTROL_HELPER}>Symbol used to fetch prices (yfinance / TFEX); leave blank to use the Symbol</p>
          </div>
          <Field label="Name" htmlFor="add-asset-name">
            <TextInput id="add-asset-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Optional" />
          </Field>
          <div className="flex gap-2.5">
            <Field className="flex-1" label="Type" htmlFor="add-asset-type">
              <SelectInput id="add-asset-type" value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </SelectInput>
            </Field>
            <Field className="flex-1" label="Source" htmlFor="add-asset-source">
              <SelectInput id="add-asset-source" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
                {SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </SelectInput>
            </Field>
          </div>
          <Field label="Group" htmlFor="add-asset-group">
            <SelectInput id="add-asset-group" value={form.group_id} onChange={e => setForm(p => ({ ...p, group_id: e.target.value }))}>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Broker" htmlFor="add-asset-broker">
            <SelectInput id="add-asset-broker" value={form.broker_id} onChange={e => setForm(p => ({ ...p, broker_id: e.target.value }))}>
              <option value="">—</option>
              {brokers.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </SelectInput>
          </Field>
          <div>
            <div className="flex gap-2.5">
              <Field className="flex-1" label="Multiplier" htmlFor="add-asset-multiplier">
                <NumberInput id="add-asset-multiplier" step="any" value={form.multiplier}
                  onChange={e => setForm(p => ({ ...p, multiplier: e.target.value }))}
                  placeholder="1" />
              </Field>
              <Field className="flex-1" label="Margin rate" htmlFor="add-asset-margin-rate">
                <NumberInput id="add-asset-margin-rate" step="any" value={form.margin_rate}
                  onChange={e => setForm(p => ({ ...p, margin_rate: e.target.value }))}
                  placeholder="0" />
              </Field>
            </div>
            <p style={CONTROL_HELPER}>Margin 0.10 = 10% of notional</p>
          </div>
        </div>
        </div>

        <div className={`${MODAL_FOOTER} flex justify-end`} style={{ gap: 8, marginTop: 12 }}>
          <button type="button" onClick={onClose} style={secondaryButton} className="text-xs">Cancel</button>
          <button type="button" onClick={handleSave} disabled={loading} style={primaryButton} className="text-xs transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Saving...' : 'Add asset'}</button>
        </div>
      </div>
    </ModalShell>
  );
};

export default AddAssetModal;
