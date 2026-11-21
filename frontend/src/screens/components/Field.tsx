import {
  cloneElement,
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
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

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement>;

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(
  function SelectInput({ style, ...props }, ref) {
    return (
      <select
        {...props}
        ref={ref}
        style={{ ...CONTROL_INPUT_TEXT, ...style }}
      />
    );
  },
);
