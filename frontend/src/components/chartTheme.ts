import type { ChartTheme } from "ztd-charts";

/**
 * ztd-charts theme for this app, mapped key-for-key onto the tokens in
 * index.css. Passing a Partial<ChartTheme> object (never CSS variables) keeps
 * the library's own contrast computation working.
 *
 * Charts introduce no new hue: the highlight is ink, and colour is reserved
 * for meaning (green/red on signed values, teal/amber/red on status). Canary
 * yellow stays the liquidity bar's fill only — at ~1.4:1 on white it cannot
 * carry a chart series.
 */
export function chartTheme(mode: "light" | "dark"): Partial<ChartTheme> {
  if (mode === "dark") {
    return {
      name: "portfolio-dark",
      bg: "#1a1a2e", // --color-surface (.dark)
      panel: "#13131f", // --color-canvas (.dark)
      ink: "#e8e8e8", // --color-ink (.dark)
      muted: "#9a9ab0", // --color-slate (.dark)
      dim: "#5B6272", // --color-tier-1 (.dark)
      accent: "#e8e8e8", // --color-ink (.dark) — the single highlight is ink
      accentText: "#e8e8e8", // --color-ink (.dark), AA text on the card
      onAccent: "#13131f", // --color-canvas (.dark), text on the ink fill
      accent2: "#0fbcb0", // --color-brand-teal
      accent3: "#ff9999", // --color-brand-coral
      onInk: "#1c1c1e", // text on ink-colored shapes
      line: "#2a2a40", // --color-hairline (.dark)
      line2: "#222238", // --color-hairline-soft (.dark)
      neutral: "#343845", // --color-tier-3 (.dark)
      neutralStrong: "#5B6272", // --color-tier-1 (.dark)
      onNeutralStrong: "#e8e8e8", // --color-ink (.dark)
      neutralSoft: "#1a1a2e", // --color-surface (.dark)
      lift: "#1f1f33", // --color-row-hover (.dark)
      tint: "#473D23", // --color-yellow-light (.dark): brand accent 22% over canvas
      radius: 8, // --rounded-md
      radiusCode: 8, // --rounded-md
      radiusMark: 4, // small marks: half of --rounded-md
      fontFamily: "Sora, system-ui, sans-serif", // --font-sans (One-Family Rule)
      monoFamily: "Sora, system-ui, sans-serif", // --font-sans keeps the single family
    };
  }

  return {
    name: "portfolio-light",
    bg: "#f7f8fa", // --color-surface
    panel: "#ffffff", // --color-canvas
    ink: "#1c1c1e", // --color-ink
    muted: "#555a6a", // --color-slate
    dim: "#9BA1AE", // --color-tier-1
    accent: "#1c1c1e", // --color-ink — the single highlight is ink
    accentText: "#1c1c1e", // --color-ink, AA text on the card
    onAccent: "#ffffff", // text on the ink fill
    accent2: "#0fbcb0", // --color-brand-teal
    accent3: "#ff9999", // --color-brand-coral
    onInk: "#ffffff", // text on ink-colored shapes
    line: "#e0e2e8", // --color-hairline
    line2: "#f0f1f3", // --color-hairline-soft
    neutral: "#d2d7e0", // --color-tier-3
    neutralStrong: "#9BA1AE", // --color-tier-1
    onNeutralStrong: "#1c1c1e", // --color-ink
    neutralSoft: "#f7f8fa", // --color-surface
    lift: "#f2f4f7", // --color-row-hover
    tint: "#fff9e6", // --color-yellow-light: brand accent 14% over canvas
    radius: 8, // --rounded-md
    radiusCode: 8, // --rounded-md
    radiusMark: 4, // small marks: half of --rounded-md
    fontFamily: "Sora, system-ui, sans-serif", // --font-sans (One-Family Rule)
    monoFamily: "Sora, system-ui, sans-serif", // --font-sans keeps the single family
  };
}
