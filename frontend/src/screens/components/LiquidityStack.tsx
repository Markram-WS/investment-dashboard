interface LiquidityStackProps {
  margin: number;
  buffer: number;
  available: number;
  /** Height of the stack in px. 40 for the aggregate block, 8 for table rows. */
  height?: number;
  /** Accessible description. Omit when the stack merely illustrates adjacent values. */
  label?: string;
  className?: string;
  /** Renders each bucket's name and formatted amount inside its segment. */
  showLabels?: boolean;
  /** Formats a bucket amount for the in-segment value. Required when showLabels is true. */
  formatValue?: (value: number) => string;
}

/**
 * One liquidity primitive, two scales: the three cash buckets rendered as a
 * single proportional bar. Available cash is the only canary-yellow segment.
 */
export default function LiquidityStack({
  margin,
  buffer,
  available,
  height = 40,
  label,
  className = "",
  showLabels = false,
  formatValue,
}: LiquidityStackProps) {
  const segments = [
    { name: "Margin", value: margin, color: "var(--color-tier-1)" },
    { name: "Buffer", value: buffer, color: "var(--color-tier-2)" },
    { name: "Available", value: available, color: "var(--color-brand-yellow)" },
  ];

  return (
    <div
      className={`flex w-full overflow-hidden ${className}`}
      style={{
        height,
        gap: 2,
        borderRadius: 8,
        background: "var(--color-surface)",
      }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {segments.map((segment) => {
        const value = Number.isFinite(segment.value) && segment.value > 0 ? segment.value : 0;
        return (
          <div
            key={segment.name}
            className="liquidity-seg"
            style={{
              flexGrow: value,
              flexBasis: 0,
              minWidth: value > 0 ? 2 : 0,
              background: segment.color,
              color:
                segment.name === "Available"
                  ? "var(--color-on-brand-yellow)"
                  : "var(--color-ink)",
            }}
          >
            {showLabels && (
              <>
                <span className="liquidity-seg-text liquidity-seg-label">{segment.name}</span>
                <span className="liquidity-seg-text liquidity-seg-value">
                  {formatValue ? formatValue(value) : ""}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
