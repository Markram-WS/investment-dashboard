interface ChevronProps {
  /** Expanded shows a down chevron; collapsed rotates it to point right. */
  open: boolean;
  /** Rendered width and height in px. */
  size: number;
}

/** Disclosure chevron shared by every collapsible list header. */
export default function Chevron({ open, size }: ChevronProps) {
  return (
    <svg className="transition-transform" style={{ width: size, height: size, flexShrink: 0, color: 'var(--color-slate)', transform: open ? 'none' : 'rotate(-90deg)' }}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
