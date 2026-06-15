import React from "react";

interface ButtonProps {
  variant: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<string, string> = {
  primary: "bg-brand-teal text-white hover:bg-teal-600",
  secondary: "bg-canvas text-ink border border-hairline hover:bg-surface",
  outline: "border border-brand-teal text-brand-teal hover:bg-teal-50",
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