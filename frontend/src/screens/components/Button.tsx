import React from "react";

type ButtonVariant = "primary" | "accent" | "secondary" | "outline" | "danger" | "ghost";

interface ButtonProps {
  variant: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  // Ink pill — the shipped primary CTA (Refresh, Create order, Create Portfolio).
  // White in light mode; `on-primary` flips the label to ink when the token
  // inverts in dark mode so the pill never carries white on pale gray.
  // Hover mixes toward the label colour: a lighter ink step in light mode and a
  // visibly darker step on the pale dark-mode pill. Press darkens below hover.
  primary: "bg-primary text-on-primary hover:bg-[color-mix(in_srgb,var(--color-primary)_88%,var(--color-on-primary))] active:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)]",
  // Teal confirmation fill (ex-primary). White on --color-brand-teal-strong
  // measures 5.19:1; the token is not redefined in dark mode.
  accent: "bg-[var(--color-brand-teal-strong)] text-white hover:bg-[var(--color-brand-teal-strong-hover)] active:bg-[var(--color-brand-teal-strong-active)]",
  secondary: "bg-canvas text-ink border border-hairline hover:bg-surface",
  outline: "border border-[color:var(--color-teal-chip-text)] text-[color:var(--color-teal-chip-text)] hover:bg-teal-light",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "bg-transparent text-slate border border-hairline hover:bg-surface",
};

const sizeClasses: Record<string, string> = {
  sm: "px-3 py-1.5 text-[10px]",
  md: "px-4 py-2 text-xs",
  lg: "px-6 py-3 text-sm",
};

const Button: React.FC<ButtonProps> = ({
  variant,
  size = "md",
  loading = false,
  disabled = false,
  onClick,
  children,
  className = "",
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`font-bold rounded-full transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 inline-flex items-center gap-1.5 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};

export default React.memo(Button);
