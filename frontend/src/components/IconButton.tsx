import React from "react";

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  /** Accessible name; doubles as the tooltip. */
  label: string;
  danger?: boolean;
  success?: boolean;
  pressed?: boolean;
}

/** A row-level icon action: 20px circle, hairline border, one hover. */
const IconButton: React.FC<IconButtonProps> = ({
  label, danger, success, pressed, className, children, ...rest
}) => (
  <button
    type="button"
    className={className ? `icon-btn ${className}` : "icon-btn"}
    aria-label={label}
    title={label}
    data-danger={danger ? "true" : undefined}
    data-success={success ? "true" : undefined}
    aria-pressed={pressed}
    {...rest}
  >
    {children}
  </button>
);

export default IconButton;
