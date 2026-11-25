import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  CONTROL_HELPER,
  CONTROL_INPUT,
  CONTROL_INPUT_TEXT,
  CONTROL_LABEL,
} from './controlStyles';

interface FieldControlProps {
  id?: string;
  'aria-describedby'?: string;
}

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactElement<FieldControlProps>;
}

/**
 * One labelled control: label, control, optional hint, optional error.
 *
 * The field owns the hint/error ids and appends them to the control's
 * `aria-describedby`; it never replaces props the control already has.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;
  const hasHint = hint !== undefined && hint !== null && hint !== '';
  const hasError = error !== undefined && error !== null && error !== '';

  const describedBy = [
    children.props['aria-describedby'],
    hasHint ? hintId : undefined,
    hasError ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  const controlProps: FieldControlProps = {};
  if (htmlFor && children.props.id === undefined) controlProps.id = htmlFor;
  if (describedBy) controlProps['aria-describedby'] = describedBy;

  const control =
    Object.keys(controlProps).length > 0
      ? cloneElement(children, controlProps)
      : children;

  return (
    <div className={className}>
      <label style={CONTROL_LABEL} htmlFor={htmlFor}>
        {label}
        {required ? ' *' : null}
      </label>
      {control}
      {hasHint && (
        <p id={hintId} style={CONTROL_HELPER}>
          {hint}
        </p>
      )}
      {hasError && (
        <p
          id={errorId}
          style={{ ...CONTROL_HELPER, color: 'var(--color-danger-text)' }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ style, ...props }, ref) {
    return (
      <input
        {...props}
        ref={ref}
        style={{ ...CONTROL_INPUT_TEXT, ...style }}
      />
    );
  },
);

type NumberInputProps = InputHTMLAttributes<HTMLInputElement>;

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput({ style, ...props }, ref) {
    return (
      <input
        {...props}
        ref={ref}
        type="number"
        inputMode="decimal"
        style={{ ...CONTROL_INPUT, ...style }}
      />
    );
  },
);

interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
  muted: boolean;
}

function textContentOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textContentOf).join('');
  }
  if (isValidElement(node)) {
    const props: unknown = node.props;
    if (typeof props === 'object' && props !== null && 'children' in props) {
      return textContentOf(props.children);
    }
    return '';
  }
  return '';
}

function collectOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child) || child.type !== 'option') return;
    const props: unknown = child.props;
    if (typeof props !== 'object' || props === null) return;
    const value =
      'value' in props && (typeof props.value === 'string' || typeof props.value === 'number')
        ? props.value
        : undefined;
    const label =
      'children' in props ? textContentOf(props.children) : '';
    options.push({
      value: value === undefined ? label : String(value),
      label,
      disabled: 'disabled' in props && props.disabled === true,
      muted: 'data-muted' in props && props['data-muted'] === 'true',
    });
  });
  return options;
}

interface SelectInputChangeEvent {
  target: { value: string };
}

interface SelectInputProps {
  id?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: SelectInputChangeEvent) => void;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling';
  'aria-label'?: string;
  required?: boolean;
  name?: string;
  children?: ReactNode;
}

interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const ROW_HEIGHT = 26;
const MENU_MAX_HEIGHT = 240;
const MENU_GAP = 4;

/**
 * In-page select: a button trigger plus a portal listbox.
 *
 * The native `<select>` popup is not usable in this environment (it never
 * opens), so the popup is rendered in-page with `position: fixed` and the
 * full keyboard/ARIA combobox contract. The public API mirrors the native
 * element closely enough for existing call sites (`value`, `defaultValue`,
 * `onChange({ target: { value } })`, `<option>` children).
 */
export const SelectInput = forwardRef<HTMLButtonElement, SelectInputProps>(
  function SelectInput(
    {
      id,
      value,
      defaultValue,
      onChange,
      disabled = false,
      style,
      className,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      'aria-label': ariaLabel,
      required,
      children,
    },
    ref,
  ) {
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
    const typeaheadRef = useRef({ buffer: '', timer: 0 });
    const appliedRef = useRef(false);
    const generatedId = useId();
    const listboxId = `${generatedId}-listbox`;

    const options = useMemo(() => collectOptions(children), [children]);
    const controlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<string | undefined>(
      undefined,
    );
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [position, setPosition] = useState<MenuPosition | null>(null);

    const selectedValue = useMemo(() => {
      if (controlled) return String(value);
      if (internalValue !== undefined) return internalValue;
      if (defaultValue !== undefined) {
        const fallback = String(defaultValue);
        if (options.some((option) => option.value === fallback)) return fallback;
      }
      return options.length > 0 ? options[0].value : '';
    }, [controlled, value, internalValue, defaultValue, options]);

    const selectedIndex = options.findIndex(
      (option) => option.value === selectedValue,
    );
    const selectedLabel =
      selectedIndex >= 0 ? options[selectedIndex].label : '';

    const setTrigger = useCallback(
      (node: HTMLButtonElement | null) => {
        triggerRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as MutableRefObject<HTMLButtonElement | null>).current = node;
        }
      },
      [ref],
    );

    const closeMenu = useCallback(() => {
      setOpen(false);
      setActiveIndex(-1);
      typeaheadRef.current.buffer = '';
    }, []);

    const computePosition = useCallback((): MenuPosition | null => {
      const trigger = triggerRef.current;
      if (!trigger) return null;

      const rect = trigger.getBoundingClientRect();
      const hasSize = rect.width > 0 && rect.height > 0;
      const inViewport =
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth;
      if (!hasSize || !inViewport) return null;

      const width = Math.min(320, Math.max(160, rect.width));
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - width - 8),
      );
      const estimatedHeight = Math.min(
        MENU_MAX_HEIGHT,
        options.length * ROW_HEIGHT + 8,
      );
      const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
      const spaceAbove = rect.top - MENU_GAP;
      const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        80,
        Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow),
      );

      return openUp
        ? {
            left,
            width,
            bottom: window.innerHeight - rect.top + MENU_GAP,
            maxHeight,
          }
        : { left, width, top: rect.bottom + MENU_GAP, maxHeight };
    }, [options.length]);

    const openMenu = useCallback(() => {
      if (disabled) return;
      const nextPosition = computePosition();
      if (!nextPosition) return;

      appliedRef.current = false;
      setPosition(nextPosition);

      const current = options.findIndex(
        (option) => option.value === selectedValue && !option.disabled,
      );
      const firstEnabled = options.findIndex((option) => !option.disabled);
      setActiveIndex(current >= 0 ? current : firstEnabled);
      setOpen(true);
    }, [disabled, computePosition, options, selectedValue]);

    const selectValue = useCallback(
      (nextValue: string) => {
        // A press may be followed by a click (e.g. after a reposition); the
        // value is committed once per opened menu.
        if (appliedRef.current) return;
        appliedRef.current = true;
        if (nextValue !== selectedValue) {
          if (!controlled) setInternalValue(nextValue);
          onChange?.({ target: { value: nextValue } });
        }
        closeMenu();
        triggerRef.current?.focus();
      },
      [selectedValue, controlled, onChange, closeMenu],
    );

    useEffect(() => {
      if (!open) return;
      const handleOutsideMouseDown = (event: globalThis.MouseEvent) => {
        const target = event.target as Node;
        if (triggerRef.current?.contains(target)) return;
        if (listRef.current?.contains(target)) return;
        closeMenu();
      };
      // Reposition instead of closing: scrolling the surrounding modal body
      // (including the focus scroll caused by the opening click) must keep the
      // listbox anchored to its trigger. The menu closes only once the trigger
      // itself leaves the viewport or loses its box.
      let frame = 0;
      const reposition = () => {
        frame = 0;
        const nextPosition = computePosition();
        if (!nextPosition) {
          closeMenu();
          return;
        }
        setPosition(nextPosition);
      };
      const handleViewportChange = (event: Event) => {
        // Scrolling the listbox itself does not move it.
        const target = event.target;
        if (
          listRef.current &&
          target instanceof Node &&
          listRef.current.contains(target)
        ) {
          return;
        }
        if (frame !== 0) return;
        frame = window.requestAnimationFrame(reposition);
      };
      document.addEventListener('mousedown', handleOutsideMouseDown);
      window.addEventListener('scroll', handleViewportChange, {
        capture: true,
        passive: true,
      });
      window.addEventListener('resize', handleViewportChange, { passive: true });
      return () => {
        if (frame !== 0) window.cancelAnimationFrame(frame);
        document.removeEventListener('mousedown', handleOutsideMouseDown);
        window.removeEventListener('scroll', handleViewportChange, true);
        window.removeEventListener('resize', handleViewportChange);
      };
    }, [open, closeMenu, computePosition]);

    useEffect(() => {
      if (!open || activeIndex < 0) return;
      const list = listRef.current;
      const option = optionRefs.current[activeIndex];
      if (!list || !option) return;
      const top = option.offsetTop;
      const bottom = top + option.offsetHeight;
      if (top < list.scrollTop) {
        list.scrollTop = top;
      } else if (bottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = bottom - list.clientHeight;
      }
    }, [open, activeIndex]);

    const moveActive = (delta: number) => {
      if (options.length === 0) return;
      let index = activeIndex;
      for (let step = 0; step < options.length; step += 1) {
        index = (index + delta + options.length) % options.length;
        if (!options[index].disabled) {
          setActiveIndex(index);
          return;
        }
      }
    };

    const jumpActive = (fromEnd: boolean) => {
      if (fromEnd) {
        for (let index = options.length - 1; index >= 0; index -= 1) {
          if (!options[index].disabled) {
            setActiveIndex(index);
            return;
          }
        }
      } else {
        for (let index = 0; index < options.length; index += 1) {
          if (!options[index].disabled) {
            setActiveIndex(index);
            return;
          }
        }
      }
    };

    const runTypeahead = (key: string) => {
      const state = typeaheadRef.current;
      window.clearTimeout(state.timer);
      state.buffer += key.toLowerCase();
      state.timer = window.setTimeout(() => {
        state.buffer = '';
      }, 600);

      let query = state.buffer;
      if (query.length > 1 && query.split('').every((ch) => ch === query[0])) {
        query = query[0];
      }
      const current = open ? activeIndex : selectedIndex;
      for (let step = 1; step <= options.length; step += 1) {
        const index = (Math.max(current, -1) + step) % options.length;
        const option = options[index];
        if (option.disabled || !option.label.toLowerCase().startsWith(query)) {
          continue;
        }
        if (open) {
          setActiveIndex(index);
        } else if (option.value !== selectedValue) {
          if (!controlled) setInternalValue(option.value);
          onChange?.({ target: { value: option.value } });
        }
        return;
      }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp':
          event.preventDefault();
          if (!open) {
            openMenu();
          } else {
            moveActive(event.key === 'ArrowDown' ? 1 : -1);
          }
          return;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (!open) {
            openMenu();
          } else if (activeIndex >= 0) {
            const option = options[activeIndex];
            if (option && !option.disabled) selectValue(option.value);
          }
          return;
        case 'Home':
          if (open) {
            event.preventDefault();
            jumpActive(false);
          }
          return;
        case 'End':
          if (open) {
            event.preventDefault();
            jumpActive(true);
          }
          return;
        case 'Escape':
          if (open) {
            event.preventDefault();
            event.stopPropagation();
            closeMenu();
          }
          return;
        case 'Tab':
          if (open) closeMenu();
          return;
        default:
          if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            runTypeahead(event.key);
          }
      }
    };

    return (
      <>
        <button
          ref={setTrigger}
          type="button"
          id={id}
          className={className}
          disabled={disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={
            open && activeIndex >= 0
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          aria-required={required || undefined}
          onClick={() => {
            if (open) closeMenu();
            else openMenu();
          }}
          onKeyDown={handleKeyDown}
          style={{
            ...CONTROL_INPUT_TEXT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            textAlign: 'left',
            fontFamily: 'inherit',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : undefined,
            ...style,
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedLabel}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
            style={{ flexShrink: 0, color: 'var(--color-slate)' }}
          >
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {open &&
          position &&
          createPortal(
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'fixed',
                left: position.left,
                top: position.top,
                bottom: position.bottom,
                width: position.width,
                maxHeight: position.maxHeight,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                background: 'var(--color-canvas)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 8,
                boxShadow: 'var(--shadow-md)',
                padding: 4,
                zIndex: 10000,
              }}
            >
              {options.map((option, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={`${option.value}-${index}`}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    onMouseEnter={() => {
                      if (!option.disabled) setActiveIndex(index);
                    }}
                    onPointerDown={(event) => {
                      // Commit on press so a reposition between press and
                      // release (e.g. the listbox being re-anchored by a
                      // scroll) can never swallow the selection. Touch keeps
                      // the click path so the list stays scrollable.
                      if (option.disabled || event.pointerType !== 'mouse') {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      selectValue(option.value);
                    }}
                    onMouseDown={(event) => {
                      if (option.disabled) return;
                      event.preventDefault();
                      event.stopPropagation();
                      selectValue(option.value);
                    }}
                    onClick={() => {
                      if (!option.disabled) selectValue(option.value);
                    }}
                    style={{
                      height: ROW_HEIGHT,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '0 8px',
                      borderRadius: 4,
                      fontSize: 'var(--fs-label)',
                      fontWeight: isSelected ? 600 : 500,
                      color: option.disabled || option.muted
                        ? 'var(--color-slate)'
                        : 'var(--color-ink)',
                      opacity: option.disabled ? 0.55 : 1,
                      background:
                        index === activeIndex && !option.disabled
                          ? 'var(--color-surface)'
                          : 'transparent',
                      cursor: option.disabled ? 'default' : 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {option.label}
                    </span>
                    {isSelected && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        aria-hidden="true"
                        focusable="false"
                        style={{ flexShrink: 0 }}
                      >
                        <path
                          d="M1.5 5.2 4 7.5 8.5 2.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>,
            document.body,
          )}
      </>
    );
  },
);
