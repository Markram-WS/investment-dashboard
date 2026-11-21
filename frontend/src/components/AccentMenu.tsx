import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "accent";

type Accent = { name: string; hex: string };

const PALETTE: Accent[] = [
  { name: "Canary", hex: "#FFD02F" },
  { name: "Mint", hex: "#7FE3C8" },
  { name: "Sky", hex: "#8FC4FF" },
  { name: "Lilac", hex: "#C7B3FF" },
  { name: "Peach", hex: "#FFB59A" },
  { name: "Lime", hex: "#C7E86B" },
];

const DEFAULT_ACCENT = PALETTE[0].hex;

function normalizeAccent(value: string | null): string {
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

export default function AccentMenu() {
  const [open, setOpen] = useState(false);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setAccent(getStoredAccent());
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = (hex: string) => {
    applyAccent(hex);
    setAccent(normalizeAccent(hex));
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        className="w-10 h-10 flex items-center justify-center bg-transparent border border-hairline rounded-full cursor-pointer"
        aria-label="Change accent color"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          className="w-5 h-5 text-slate"
        >
          <path d="M21.48 10.50 L21.48 13.50 L18.71 13.61 L17.88 15.61 L19.77 17.64 L17.64 19.77 L15.61 17.88 L13.61 18.71 L13.50 21.48 L10.50 21.48 L10.39 18.71 L8.39 17.88 L6.36 19.77 L4.23 17.64 L6.12 15.61 L5.29 13.61 L2.52 13.50 L2.52 10.50 L5.29 10.39 L6.12 8.39 L4.23 6.36 L6.36 4.23 L8.39 6.12 L10.39 5.29 L10.50 2.52 L13.50 2.52 L13.61 5.29 L15.61 6.12 L17.64 4.23 L19.77 6.36 L17.88 8.39 L18.71 10.39 Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 p-[10px] bg-canvas border border-hairline rounded-xl shadow-lg">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {PALETTE.map((option) => {
              const isActive = option.hex === accent;
              return (
                <button
                  key={option.hex}
                  onClick={() => handleSelect(option.hex)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                  }}
                  aria-label={option.name}
                  aria-pressed={isActive}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9999,
                      background: option.hex,
                      boxShadow: isActive
                        ? "0 0 0 2px var(--color-canvas), 0 0 0 3px var(--color-brand-accent)"
                        : "none",
                      transition: "background-color 150ms ease",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
