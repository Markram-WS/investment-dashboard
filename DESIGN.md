---
name: Investment Dashboard (Miro Portfolio System)
description: Unified dashboard for manual + bot trade portfolio management
colors:
  primary: "#1c1c1e"
  on-primary: "#ffffff"
  brand-yellow: "#ffd02f"
  brand-teal: "#0fbcb0"
  brand-coral: "#ff9999"
  brand-blue: "#4262ff"
  teal-light: "#c3faf5"
  coral-light: "#ffc6c6"
  yellow-light: "#fff9e6"
  canvas: "#ffffff"
  surface: "#f7f8fa"
  surface-soft: "#fafbfc"
  hairline: "#e0e2e8"
  ink: "#1c1c1e"
  slate: "#555a6a"
  on-surface-variant: "#46464a"
  success: "#00b473"
  error: "#e74c3c"
  warning: "#f4d03f"
typography:
  display:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Sora, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Sora, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.03125em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  xxl: "20px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.brand-teal}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "16px 24px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "16px 24px"
  button-outline:
    backgroundColor: transparent
    textColor: "{colors.brand-teal}"
    rounded: "{rounded.full}"
    padding: "16px 24px"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "16px 24px"
  card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  input:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  nav-link:
    backgroundColor: transparent
    rounded: "{rounded.full}"
    padding: "8px 16px"
  chip:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Investment Dashboard (Miro Portfolio System)

## 1. Overview

**Creative North Star: "The Portfolio Workshop"**

A workshop where every tool is within reach and every number is instantly legible. Clean white and near-white surfaces form the workbench; bold canary yellow and pastel teal/coral/blue accents provide signal without noise. This is a space for confident action — monitoring, rebalancing, transferring, closing — not decoration.

The system sits at the intersection of playful and precise. Generous rounded corners (16px on cards, full pills on buttons) and soft pastel tints keep the tool approachable, while tight typography (Sora at 15px body, crisp uppercase labels) and flat tonal layering keep the data authoritative. Depth is conveyed through background color shifts and hairline borders, not shadows — surfaces are flat at rest.

What this system explicitly rejects: fintech navy-and-gold, dark-mode-terminal aesthetics, SaaS-cream minimalism, gradient text, glassmorphism, and side-stripe borders.

### Key Characteristics:
- Flat tonal depth — no ambient shadows, depth via surface color shifts
- One bold accent (yellow) carries signal weight; all other colors are muted-to-accent
- Full-pill buttons with generous horizontal padding
- Pastel tints for status backgrounds (teal-light, coral-light, yellow-light)
- Sora geometric sans throughout — one family, weight contrast carries hierarchy
- 16px card corners as the dominant container radius
- Uppercase tracking on short labels only — never on body copy

## 2. Colors

Four named accent roles — yellow (anchor), teal (safe/primary action), coral (danger/warning), blue (neutral accent/info) — on a clean neutral surface.

### Primary
- **Ink** (`#1c1c1e`): Primary text, active nav backgrounds, button text on tinted surfaces. The black-pill anchor.

### Accent
- **Brand Yellow** (`#ffd02f`): The single loud note. Used for the Available Cash card, logo mark, and attention calls. Never decorative.
- **Brand Teal** (`#0fbcb0`): Primary action color (main CTA buttons), success indicators, safe/target status. The default "go" signal.
- **Brand Coral** (`#ff9999`): Danger signals, negative P&L, risk warnings.
- **Brand Blue** (`#4262ff`): Neutral accent for info cards, secondary indicators, link behavior.

### Light Variants
- **Teal Light** (`#c3faf5`), **Coral Light** (`#ffc6c6`), **Yellow Light** (`#fff9e6`): Tinted backgrounds for status banners, cards, and badges. At 12-25% opacity equivalents, they tint without overwhelming the container.

### Neutral
- **Canvas** (`#ffffff`): Default card and page background. Pure white.
- **Surface** (`#f7f8fa`): Page body background, secondary container bg.
- **Surface Soft** (`#fafbfc`): Extra-subtle container variant.
- **Hairline** (`#e0e2e8`): Borders, dividers, input strokes. No opacity; exact value.
- **Slate** (`#555a6a`): Secondary text, stat labels, muted navigation links.
- **On-Surface Variant** (`#46464a`): Medium-emphasis text, supplementary info.

### Status
- **Success** (`#00b473`), **Error** (`#e74c3c`), **Warning** (`#f4d03f`): Semantic indicators. Used sparingly — prefer the tinted backgrounds (teal-light, coral-light) over raw status colors for container fills.

### Dark Mode
Each light color has a dark-mode counterpart defined as CSS custom properties on `.dark`. Canvas becomes deep navy (`#13131f`), ink becomes pale gray (`#e8e8e8`), and pastel tints invert to dark-toned variants. The same accent colors carry through with slightly adjusted luminosity.

### Named Rules

**The One Voice Rule.** Brand Yellow is the only saturated accent that appears as a full surface. Every other accent (teal, coral, blue) is used as text, border, or tinted background — never as a dominant fill color.

**The No-Gradient-Rule.** Gradients on text or backgrounds are forbidden. Color is solid or it's absent. Emphasis is conveyed through weight, size, or spacing, not through color blending.

## 3. Typography

**Display + Body Font:** Sora (geometric sans-serif) with system-ui and -apple-system fallbacks.

**Character:** A single geometric sans-serif family that carries the full hierarchy through weight and scale contrast. Sora's clean, slightly rounded terminals and generous x-height maintain readability at small sizes (12px labels) while carrying authority at display scale (32px page titles). No serif, no mono, no competing second family — just weight contrast from 300 to 800.

### Hierarchy
- **Display** (700, `clamp(2rem, 5vw, 3rem)`, 1.1): Page titles (e.g. "Overview" heading). Tight tracking at -0.02em. Use `text-wrap: balance`.
- **Heading** (600, `clamp(1.5rem, 3vw, 2rem)`, 1.25): Section headings (e.g. "Active Portfolios"). Bold but not dominant.
- **Title** (600, 1.25rem, 1.3): Card titles, dialog headings, secondary section titles.
- **Body** (400, 0.9375rem / 15px, 1.5): Primary reading size. Used for statistics, descriptions, table cells. Max line length 75ch.
- **Label Caps** (600, 0.75rem / 12px, 1, +0.03125em tracking, uppercase): Stat labels, section eyebrows, badge text. Never used for sentences — 4 words max.

### Named Rules

**The One-Family Rule.** All text uses Sora. No serif, no mono, no secondary display face. Hierarchy is carried by weight (300 to 800), size (12px to 48px), and letter-spacing, not by font switching.

**The No-All-Caps-Body Rule.** Uppercase is reserved for stat labels and short badges (≤4 words). Never use all-caps for sentences, section intros, or body copy.

## 4. Elevation

Flat by default, depth through tonal layering. The system uses **zero ambient shadows on containers at rest**. Surfaces are distinguished through background color shifts:
- Page body: Surface (`#f7f8fa`)
- Card/container: Canvas (`#ffffff`)
- Tinted container: One of the light variant backgrounds

Interaction states and overlays (modals, dropdowns, sticky nav) use the three-step shadow vocabulary for structural hierarchy, not decorative depth. This keeps the financial data on a single visual plane where nothing "floats" above the content.

### Shadow Vocabulary
- **Sm** (`0 1px 2px rgba(0,0,0,0.05)`): Subtle separation for hover states on cards and buttons.
- **Md** (`0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)`): Dropdowns, modal containers, sticky elements.
- **Lg** (`0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)`): Modals, popovers, large overlays.

### Named Rules

**The Flat-By-Default Rule.** Containers are flat at rest. Shadows appear only as a structural cue (dropdown lifted above the page) or a response to interaction (card hover — and only `shadow-sm`, not a larger grade).

## 5. Components

### Buttons
- **Shape:** Full pill (9999px radius).
- **Primary (teal):** `bg-brand-teal text-white` — the default call to action. Hover darkens to `teal-600`.
- **Secondary:** `bg-canvas text-ink border hairline` — outlined with white fill. Hover gets `bg-surface`.
- **Outline:** `border brand-teal text-brand-teal` — transparent fill. Hover gets `bg-teal-50`.
- **Danger:** `bg-red-600 text-white` — destructive actions. Hover darkens.
- **Ghost:** `bg-transparent text-slate border hairline` — lowest emphasis.
- **States:** All disabled at `opacity-50 cursor-not-allowed`. All use `transition-colors`. No transform or scale on press.
- **Sizes:** sm (10px, 12px/16px padding), md (12px, 16px/24px), lg (14px, 24px/32px).

### Cards / Containers
- **Corner Style:** Generous 16px radius (`rounded-xl`).
- **Background:** Canvas (`#ffffff`) with 1px hairline border.
- **Shadow Strategy:** Flat by default; `shadow-sm` on hover via `.card-hover`.
- **Internal Padding:** 24px consistently.
- **Tinted variants:** Background shifts to teal-light, coral-light, or yellow-light for status cards.

### Inputs & Fields
- **Style:** 1px hairline stroke, canvas fill, 8px radius.
- **Focus:** Border shifts to brand-teal. Uses `:focus-visible` outline at 2px brand-teal with 2px offset for accessibility.
- **Placeholder:** `--color-outline` (#77767b) — meets 4.5:1 contrast against canvas.
- **Disabled/Error:** Inherit standard browser defaults.

### Navigation
- **Style:** Horizontal pill links in the top bar. Inactive: slate text. Active: ink background with white text.
- **Hover:** Surface background tint with ink text.
- **Mobile:** Full-width vertical drawer below the nav bar, same pill styling.
- **Logo:** Yellow "M" square with "InvestDesk Dashboard" stacked label.
- **Icons:** Feather-style SVGs at 20px, with scale hover animation (1.12x).

### Chips / Badges
- **Style:** Pill shape (9999px), 2px/10px padding, 12px font, 500 weight.
- **Colors match accent roles:** teal, yellow, coral, blue — each with a 12-18% opacity tinted background.
- **Neutral variant:** Surface background, slate text.
- **Dark mode:** Background opacity increases to 25%.

### Status Dot
- **Style:** 8px circle, filled with the matching accent color (teal, yellow, coral, blue).
- **Use:** Inline with status labels in cards, dropdowns, and row indicators.

### Select / Dropdown
- **Trigger:** Matches input styling (1px hairline, 8px radius, canvas fill). Min-width 160px.
- **Dropdown Panel:** Positioned absolute below trigger. Canvas background, hairline border, 12px radius, `shadow-lg`. 4px internal padding around options.
- **Options:** 8px/12px padding, 6px radius. Hover gets surface background. Active gets `surface-container-low` background with 500 font-weight.

## 6. Do's and Don'ts

### Do:
- **Do** use Brand Yellow as the single bold surface — it carries signal weight because nothing else competes at that saturation.
- **Do** use pastel tints (teal-light, coral-light, yellow-light) for status backgrounds instead of the raw saturated accent.
- **Do** use full-pill buttons for all actions — it's the system's most recognizable shape pattern.
- **Do** use flat containers with hairline borders at rest and tonal surface shifts for depth.
- **Do** keep body text at 15px with a max line length of 75ch.
- **Do** use `text-wrap: balance` on heading elements and `text-wrap: pretty` on long prose.
- **Do** use uppercase labels only for short stat labels and badges (4 words max).
- **Do** use Sora across the entire interface — one family, weight contrast for hierarchy.

### Don't:
- **Don't** use gradient text (`background-clip: text` + gradient). Solid color or nothing.
- **Don't** use glassmorphism (backdrop blur on cards) as a default pattern.
- **Don't** use side-stripe borders (border-left >1px as a colored accent on cards or callouts).
- **Don't** use the hero-metric template (big number + small label + gradient accent) — a SaaS cliché.
- **Don't** use numbered section markers (01 / 02 / 03) as default scaffolding above sections.
- **Don't** use all-caps for body copy, sentences, or section introductions.
- **Don't** use navy-and-gold fintech aesthetics, dark-mode-terminal-only looks, or SaaS-cream minimalism.
- **Don't** stack nested cards — cards are flat by default and should not contain other cards.
- **Don't** use fonts outside the Sora family — no serif, mono, or competing sans-serif.
- **Don't** place uppercase tracked eyebrows ("OVERVIEW", "RISK") above every section as a default pattern.
