import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CONTROL_INPUT } from './controlStyles';

export interface EntityOption {
  value: string;
  label: string;
  muted?: boolean;
}

interface EntityComboboxProps {
  id?: string;
  ariaLabel?: string;
  listboxLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: EntityOption[];
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Extra non-option row rendered after the filtered options. */
  footer?: React.ReactNode;
}

const PANEL_MAX_HEIGHT = 180;
const ROW_HEIGHT = 28;

const sameValue = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * One text input over an in-page listbox. Typing filters the options; the
 * typed value is always allowed, so callers can offer create affordances.
 */
const EntityCombobox: React.FC<EntityComboboxProps> = ({
  id, ariaLabel, listboxLabel, value, onChange, options, placeholder, inputRef, footer,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const localInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return options;
    return options.filter(option => option.label.toLowerCase().includes(query));
  }, [options, value]);

  useEffect(() => {
    if (!open) return;
    const exact = filtered.findIndex(option => sameValue(option.value, value));
    setActiveIndex(exact >= 0 ? exact : 0);
  }, [filtered, open, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const assignRef = (node: HTMLInputElement | null) => {
    localInputRef.current = node;
    if (inputRef) inputRef.current = node;
  };

  const select = (option: EntityOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => (filtered.length === 0 ? 0 : Math.min(filtered.length - 1, index + 1)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => (filtered.length === 0 ? 0 : Math.max(0, index - 1)));
      return;
    }
    if (event.key === 'Enter') {
      if (open && filtered[activeIndex]) {
        event.preventDefault();
        select(filtered[activeIndex]);
      }
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'Tab') setOpen(false);
  };

  const listboxId = `${id ?? 'entity'}-listbox`;
  const activeOptionId = open && filtered[activeIndex]
    ? `${listboxId}-option-${activeIndex}`
    : undefined;

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <input
        ref={assignRef}
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        value={value}
        onChange={event => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ ...CONTROL_INPUT, width: '100%' }}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: PANEL_MAX_HEIGHT,
            overflowY: 'auto',
            background: 'var(--color-canvas)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 8,
            boxShadow: 'var(--elevation-md, var(--shadow-md))',
            padding: 4,
          }}
        >
          <div id={listboxId} role="listbox" aria-label={listboxLabel}>
          {filtered.map((option, index) => (
            <div
              key={`${option.value}-${option.label}`}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={event => {
                event.preventDefault();
                select(option);
              }}
              style={{
                height: ROW_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                borderRadius: 4,
                fontSize: 'var(--fs-label)',
                fontWeight: sameValue(option.value, value) ? 600 : 500,
                color: option.muted ? 'var(--color-slate)' : 'var(--color-ink)',
                background: index === activeIndex ? 'var(--color-surface)' : 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {option.label}
            </div>
          ))}
          </div>
          {footer}
        </div>
      )}
    </div>
  );
};

export default EntityCombobox;
