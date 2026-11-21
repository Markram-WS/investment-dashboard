const STORAGE_KEY = "accent";

export type Accent = { name: string; hex: string };

export const PALETTE: Accent[] = [
  { name: "Canary", hex: "#FFD02F" },
  { name: "Mint", hex: "#7FE3C8" },
  { name: "Sky", hex: "#8FC4FF" },
  { name: "Lilac", hex: "#C7B3FF" },
  { name: "Peach", hex: "#FFB59A" },
  { name: "Lime", hex: "#C7E86B" },
];

export const DEFAULT_ACCENT = PALETTE[0].hex;

export function normalizeAccent(value: string | null): string {
  if (!value) return DEFAULT_ACCENT;
  const match = PALETTE.find(
    (accent) => accent.hex.toLowerCase() === value.trim().toLowerCase()
  );
  return match ? match.hex : DEFAULT_ACCENT;
}

/** WCAG relative luminance of a #rrggbb colour. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastWith(hex: string, other: string): number {
  const a = relativeLuminance(hex);
  const b = relativeLuminance(other);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Ink on light accents, white on dark — whichever measures higher against the
 * chosen accent. The palette is light today; the rule keeps a future dark
 * accent legible without hand-editing tokens.
 */
export function onAccentFor(hex: string): string {
  return contrastWith(hex, "#1c1c1e") >= contrastWith(hex, "#ffffff") ? "#1c1c1e" : "#ffffff";
}

export function getStoredAccent(): string {
  try {
    return normalizeAccent(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function applyAccent(hex: string): void {
  const accent = normalizeAccent(hex);
  const root = document.documentElement;
  root.style.setProperty("--color-brand-accent", accent);
  root.style.setProperty("--color-on-brand-accent", onAccentFor(accent));
  try {
    localStorage.setItem(STORAGE_KEY, accent);
  } catch {
    /* storage unavailable — the accent still applies for this session */
  }
}
