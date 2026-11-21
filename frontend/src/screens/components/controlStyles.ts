/**
 * Shared control scale.
 *
 * The element scale established by `AddOrderModal.tsx` (its `fieldLabel`,
 * `fieldInput`, `primaryButton`, `secondaryButton`): 11px/500 slate labels,
 * 11px/500 ink inputs on canvas with a 1px hairline and 8px radius, 11px/500
 * pill buttons at `3px 10px`. Every screen imports these instead of
 * re-deriving per-screen numbers.
 *
 * A control draws exactly one focus indicator: the global `:focus-visible`
 * accent ring in `index.css`. These styles never set a teal border — teal is a
 * fill token, never a stroke.
 */

/** Field label: 11px/500 slate, sentence case — same size as the control text. */
export const CONTROL_LABEL = {
  display: 'block',
  fontSize: 'var(--control-fs-label)',
  fontWeight: 500,
  color: 'var(--color-slate)',
  margin: '0 0 3px',
} as const;

/** Numeric/text field: 11px/500 ink on canvas, 1px hairline, radius 8. */
export const CONTROL_INPUT = {
  width: '100%',
  minHeight: 'var(--control-h)',
  fontSize: 'var(--fs-label)',
  fontWeight: 500,
  color: 'var(--color-ink)',
  background: 'var(--color-canvas)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 'var(--control-radius)',
  padding: 'var(--control-pad-y) var(--control-pad-x)',
  lineHeight: 1.3,
  fontVariantNumeric: 'tabular-nums',
} as const;

/** Text field: same as CONTROL_INPUT without tabular figures. */
export const CONTROL_INPUT_TEXT = {
  width: '100%',
  minHeight: 'var(--control-h)',
  fontSize: 'var(--fs-label)',
  fontWeight: 500,
  color: 'var(--color-ink)',
  background: 'var(--color-canvas)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 'var(--control-radius)',
  padding: 'var(--control-pad-y) var(--control-pad-x)',
  lineHeight: 1.3,
} as const;

/** Helper paragraph under a field: 11px/400 slate. */
export const CONTROL_HELPER = {
  fontSize: 'var(--fs-label)',
  fontWeight: 400,
  color: 'var(--color-slate)',
  margin: '4px 0 0',
  lineHeight: 1.4,
} as const;

/** Button base: 11px/500 pill at `3px 10px`. */
export const CONTROL_BUTTON = {
  fontSize: 'var(--fs-label)',
  fontWeight: 500,
  lineHeight: 1.3,
  borderRadius: 'var(--rounded-full)',
  padding: 'var(--control-btn-pad-y) var(--control-btn-pad-x)',
  cursor: 'pointer',
  border: '1px solid transparent',
} as const;

/** Primary action: ink fill, canvas label. */
export const CONTROL_BUTTON_PRIMARY = {
  ...CONTROL_BUTTON,
  background: 'var(--color-ink)',
  color: 'var(--color-canvas)',
  borderColor: 'var(--color-ink)',
} as const;

/** Secondary action: canvas fill, ink label, hairline stroke. */
export const CONTROL_BUTTON_SECONDARY = {
  ...CONTROL_BUTTON,
  background: 'var(--color-canvas)',
  color: 'var(--color-ink)',
  borderColor: 'var(--color-hairline)',
} as const;

/**
 * Read-only value (e.g. a modal's From/To row): 13px/500 ink — one step above
 * control text (11px), below content (15px). The value is what the eye tracks;
 * its label stays at `--control-fs-label`.
 */
export const CONTROL_VALUE = {
  fontSize: 'var(--fs-body)',
  fontWeight: 500,
  color: 'var(--color-ink)',
  margin: 0,
} as const;

/** Modal/section title: 15px/600 ink, tight tracking. */
export const CONTROL_TITLE = {
  fontSize: 'var(--fs-content)',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: 'var(--color-ink)',
  margin: 0,
} as const;
