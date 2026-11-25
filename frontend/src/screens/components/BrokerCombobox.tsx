import React, { useMemo } from 'react';
import type { BrokerRecord } from '../../lib/api';
import EntityCombobox from './EntityCombobox';
import type { EntityOption } from './EntityCombobox';
import { CONTROL_HELPER, CONTROL_INPUT, CONTROL_LABEL } from './controlStyles';

interface BrokerComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  brokers: BrokerRecord[];
  /** Non-empty typed code with no broker match; renders the create row last. */
  createCode: string;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

const UNASSIGNED = '— Unassigned —';

const sameCode = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Editable broker picker: a text input over an in-page listbox.
 *
 * The typed value stays the source of truth; choosing an option only replaces
 * that text. The caller resolves the code to a broker id and decides whether
 * the unmatched code is a new broker.
 */
const BrokerCombobox: React.FC<BrokerComboboxProps> = ({
  id, value, onChange, brokers, createCode, currency, onCurrencyChange, placeholder, inputRef,
}) => {
  const options = useMemo<EntityOption[]>(() => {
    const codes = brokers
      .map(broker => broker.code)
      .filter((code, index, all) => all.findIndex(other => sameCode(other, code)) === index)
      .sort((a, b) => a.localeCompare(b));
    return [
      { value: UNASSIGNED, label: UNASSIGNED, muted: true },
      ...codes.map(code => ({ value: code, label: code })),
    ];
  }, [brokers]);

  const footer = createCode ? (
    <div
      style={{
        borderTop: '1px solid var(--color-hairline)',
        marginTop: 4,
        padding: '6px 8px 8px',
      }}
    >
      <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--color-ink)' }}>
        New broker · {createCode}
      </div>
      <label htmlFor={`${id}-currency`} style={{ ...CONTROL_LABEL, display: 'block', marginTop: 6 }}>
        Currency
      </label>
      <select
        id={`${id}-currency`}
        value={currency}
        onChange={event => onCurrencyChange(event.target.value)}
        style={CONTROL_INPUT}
      >
        <option value="THB">THB</option>
        <option value="USD">USD</option>
      </select>
      <p style={{ ...CONTROL_HELPER, margin: '4px 0 0' }}>
        Creates this broker with the typed code as its name.
      </p>
    </div>
  ) : undefined;

  return (
    <EntityCombobox
      id={id}
      listboxLabel="Brokers"
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      inputRef={inputRef}
      footer={footer}
    />
  );
};

export default BrokerCombobox;
