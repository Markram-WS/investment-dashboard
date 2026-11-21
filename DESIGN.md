---
name: Investment Dashboard (Miro Portfolio System)
description: Unified dashboard for manual + bot trade portfolio management
colors:
  primary: "#1c1c1e"
  on-primary: "#ffffff"
  brand-yellow: "#ffd02f"
  brand-teal: "#0a7a73"
  brand-teal-strong: "#0a7a73"
  teal-chip-text: "#0a6f69"
  positive-text: "#00746d"
  danger-text: "#c22f2f"
  on-brand-accent: "#1c1c1e"
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
  page-title:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  datum:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Sora, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"   # dashboard text uses --fs-body (13px)
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Sora, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0"
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
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "16px 24px"
  button-accent:
    backgroundColor: "{colors.brand-teal-strong}"
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
    textColor: "{colors.teal-chip-text}"
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
  overview-strip:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    padding: "20px 24px"
  stat-chip:
    backgroundColor: "{colors.surface-soft}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  filter-chip:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Investment Dashboard (Miro Portfolio System)

## 1. Overview

**Creative North Star: "The Portfolio Workshop"**

A workshop where every tool is within reach and every number is instantly legible. Clean white and near-white surfaces form the workbench; bold canary yellow and pastel teal/coral/blue accents provide signal without noise. This is a space for confident action — monitoring, rebalancing, transferring, closing — not decoration.

The system sits at the intersection of playful and precise. Generous rounded corners (16px on cards, full pills on buttons) and soft pastel tints keep the tool approachable, while tight typography (Sora at 13px body, crisp sentence-case labels) and flat tonal layering keep the data authoritative. Depth is conveyed through background color shifts and hairline borders, not shadows — surfaces are flat at rest.

What this system explicitly rejects: fintech navy-and-gold, dark-mode-terminal aesthetics, SaaS-cream minimalism, gradient text, glassmorphism, and side-stripe borders.

### Key Characteristics:
- Flat tonal depth — no ambient shadows, depth via surface color shifts
- One bold accent (yellow) carries signal weight; all other colors are muted-to-accent
- Full-pill buttons with generous horizontal padding
- Pastel tints for status backgrounds (teal-light, coral-light, yellow-light)
- Sora geometric sans throughout — one family, weight contrast carries hierarchy
- 16px card corners as the dominant container radius
- Sentence-case labels at `--fs-label` (11px) /500 — no uppercase or tracked letterforms anywhere

## 2. Colors

Four named accent roles — yellow (anchor), teal (safe/confirmation action), coral (danger/warning), blue (neutral accent/info) — on a clean neutral surface.

### Primary
- **Ink** (`#1c1c1e`): Primary text, active nav backgrounds, button text on tinted surfaces. The black-pill anchor.

### Accent
- **Brand Yellow** (`#ffd02f`): The single loud note. Used for the Available Cash card, logo mark, and attention calls. Never decorative.
- **Brand Teal** (`#0a7a73` light / `#0fbcb0` dark): the text, line, focus, and small-indicator colour — safe/target status, the focus ring, the status dot, links, and the ladder's progress and profit fills. The pastel teal could not carry a white 11–13px label (2.38:1) and could not carry a focus indicator at the 3:1 non-text floor, so the fills moved to a darker step of the same hue rather than the labels moving to ink. `#0a7a73` measures 5.19:1 on white; dark mode keeps `#0fbcb0`, which measures 7.75:1 on the dark canvas.
- **Brand Teal Strong** (`#0a7a73`, hover `#087068`, active `#075f5a`): the solid fill of the `accent` button variant — the teal confirmation action, no longer the default CTA. The same hue at a value dark enough that a white label clears the floor: white on it measures 5.19:1. The token is not redefined in `.dark`, so the fill holds in both themes.
- **Brand Coral** (`#ff9999`): Danger signals, negative P&L, risk warnings.
- **Brand Blue** (`#4262ff`): Neutral accent for info cards, secondary indicators, link behavior.

### Light Variants
- **Teal Light** (`#c3faf5`), **Coral Light** (`#ffc6c6`), **Yellow Light** (`#fff9e6`): Tinted backgrounds for status banners, cards, and badges. At 12-25% opacity equivalents, they tint without overwhelming the container.

### Text on tinted surfaces

A text token is measured against the fill it lands on, not against white, and each pair below ships together.

- **`--color-teal-chip-text`** (`#0a6f69` light / `#7fe3d8` dark): text on the teal chip fill (`#c3faf5`), 5.25:1. The brand teal itself already clears 4.53:1 there; the chip token adds headroom at 11px.
- **`--color-coral-chip-text`** (`#a32020` / `#ffb3b3`): text on the coral chip fill (`#ffc6c6`), 5.08:1.
- **`--color-warning-text`** (`#8a6200` / `#ffd02f`): warning copy on canvas or surface, distinct from the solid `--color-status-warning` fill (`#b57f00`) the attention chip paints when pressed.
- **`--color-positive-text`** (`#00746d` / `#29b3a8`) and **`--color-danger-text`** (`#c22f2f` / `#ff8a8a`): P/L, deltas, and instrument direction text on canvas.
- **`--color-on-brand-accent`** (`#1c1c1e` default): text and icons sitting on the user-selected accent. `AccentMenu` recomputes it from the accent's luminance whenever the accent changes, so ink wins on a light accent and white on a dark one without per-palette hand-editing.

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

### Instrument key

Four text-safe hues carry instrument identity — never decoration. Defined in `index.css` for both themes and used only as text or on a 10% tint of themselves (The One Voice Rule forbids a saturated fill).

- **Future** (`#3346C9` light / `#9FA9FF` dark): a futures leg's quantity, and the EQ · Future group band.
- **Option** (`#6A3BC0` / `#C4A9FF`): an option leg's Size, the Options group band, and the Option product pill.
- **Call** (`#96600A` / `#F5BE55`) and **Put** (`#A62E63` / `#FF9CB8`): the two-letter option-type chip (`.at-type`). Long is a filled 10% tint, short is the same hue outlined.

Spot stays neutral: it is the plain instrument, and the teal family is reserved for long/buy. Measured contrast at 11px: future 6.26:1, option 5.99:1, call 4.5:1, put 5.44:1 on their own light tints; 6.85/7.39/8.56/7.61:1 in dark.

## 3. Typography

**Display + Body Font:** Sora (geometric sans-serif) with system-ui and -apple-system fallbacks.

**Character:** A single geometric sans-serif family that carries the full hierarchy through weight and scale contrast. Sora's clean, slightly rounded terminals and generous x-height maintain readability at small sizes (12px labels) while carrying authority at display scale (32px page titles). No serif, no mono, no competing second family — just weight contrast from 300 to 800.

### Hierarchy
- **Display** (700, `clamp(2rem, 5vw, 3rem)`, 1.1): Page titles (e.g. "Overview" heading). Tight tracking at -0.02em. Use `text-wrap: balance`.
- **Heading** (600, `clamp(1.5rem, 3vw, 2rem)`, 1.25): Section headings (e.g. "Active Portfolios"). Bold but not dominant.
- **Title** (600, 1.25rem, 1.3): Card titles, dialog headings, secondary section titles.
- **Body** (400, 0.9375rem / 15px, 1.5): Primary reading size. Used for statistics, descriptions, table cells. Dashboard pages set it from `--fs-body` (13px). Max line length 75ch.
- **Label** (500, 0.75rem / 12px, `--color-slate`, sentence case, no letter-spacing): Column heads, chip text, stat labels, and captions. Always sentence case, never uppercase — 4 words max, so it stays a label and not a sentence.

Uppercase and tracked letterforms are not used on dashboard pages: a tracked all-caps kicker above every block is a template tell, and the ledger's own column heads are sentence case.

### Dashboard Scale (Overview is the reference)

Dashboard pages use a fixed px scale, never `clamp`. This is a product register: users sit at a consistent DPI, and a number that shrinks with the viewport is harder to compare between visits. The clamp-based `display` and `heading` entries above stay documented for brand surfaces, but no dashboard page uses them.

The scale is **one set of compact values at every width**: the desktop viewport is the primary device, so nothing reverts on narrower screens. The values ship as custom properties in `:root` (`index.css`) and only Overview currently reads them. Below 1024px the page *layout* still collapses (see Responsive Behavior); the type and row geometry do not.

| Level | Token | Value (all widths) |
|---|---|---|
| Page title | `--fs-page-title` | 22px |
| Primary datum | `--fs-datum` | 19px |
| Section title | `--fs-section` | 16px |
| Body / table cell | `--fs-body` | 13px |
| Secondary label | `--fs-label` | 11px |
| Micro label | `--fs-micro` | 10px |
| Row height | `--row-h` | 44px |
| Dense row height | `--row-h-dense` | 38px |

- **Page title** (600, `--fs-page-title`, -0.01em): The page name in the header, one per page. It sets size, weight, and tracking only, and leaves line-height at the browser default.
- **Primary datum** (600, `--fs-datum`, 1.15, -0.01em): The total on a summary strip, the largest number on the page.
- **Section title** (600, `--fs-section`, 1.3): The heading above a list or a block of rows.
- **Body / table cell** (400, `--fs-body`): Row text, values, and prose.
- **Secondary label** (500, `--fs-label`): Column heads, chip text, and captions.
- **Micro label** (500, `--fs-micro`): Stat labels inside a strip, the smallest text in the system.

**The 1.15x Rule.** Within the hierarchy levels (page title, primary datum, section title, body), no two adjacent levels may sit within 1.15x of each other. A step smaller than 1.15x reads as a rounding error, not a level: drop it or move it. The compact scale satisfies it: 22/19 = 1.16, 19/16 = 1.19, 16/13 = 1.23. The label sizes are a context-bound pair, not a hierarchy step: they are chosen by what the text labels (column head or chip versus stat label inside a strip), not by depth in the scale.

### Named Rules

**The One-Family Rule.** All text uses Sora. No serif, no mono, no secondary display face. Hierarchy is carried by weight (300 to 800), size (10px to 48px), and letter-spacing, not by font switching.

**The No-All-Caps Rule.** No dashboard text is set in uppercase or with added letter-spacing. Labels are sentence case at `--fs-label`/500 (11px) in `--color-slate`; a tracked all-caps kicker above every block is a template tell, and the ledger's own column heads are sentence case.

## 4. Elevation

Flat by default, depth through tonal layering. The system uses **zero ambient shadows on containers at rest**. Surfaces are distinguished through background color shifts:
- Page body: Surface (`#f7f8fa`)
- Card/container: Canvas (`#ffffff`)
- Tinted container: One of the light variant backgrounds

Interaction states and overlays (modals, dropdowns, sticky nav) use the three-step shadow vocabulary for structural hierarchy, not decorative depth. This keeps the financial data on a single visual plane where nothing "floats" above the content.

### Shadow Vocabulary
- **Sm** (`0 1px 2px rgba(0,0,0,0.05)`): Subtle separation on legacy pages only (for example `frontend/src/pages/TransactionsPage.tsx:154`). Card hover uses Md, not Sm.
- **Md** (`0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)`): Dropdowns, modal containers, sticky elements.
- **Lg** (`0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)`): Modals, popovers, large overlays.

### Named Rules

**The Flat-By-Default Rule.** Containers are flat at rest. Shadows appear only as a structural cue (dropdown lifted above the page) or as a response to interaction: card hover adds `--shadow-md` plus a 1px lift (`index.css:162-165`), which is the interaction grade, not a decorative drop shadow.

## 5. Components

### Buttons
- **Shape:** Full pill (9999px radius).
- **Primary (ink):** `bg-primary text-on-primary` — the default call to action, the black pill on every page (`Refresh`, `Create order`, `Create Portfolio`). Hover is `color-mix(in srgb, var(--color-primary) 88%, var(--color-on-primary))`; press is `color-mix(in srgb, var(--color-primary) 85%, black)`; disabled keeps the system `opacity-50`. The label is `--color-on-primary`, not white, so on the pale dark-mode pill it flips to ink instead of printing white on pale gray. Measured: white on `#1c1c1e` 17.01:1, the hover step 11.88:1, and the dark-mode pill (`#e8e8e8` with a `#1c1c1e` label) 13.89:1.
- **Accent (teal):** `bg-[var(--color-brand-teal-strong)] text-white` — the teal confirmation fill, carried as its own variant with hover `--color-brand-teal-strong-hover` (`#087068`) and press `--color-brand-teal-strong-active` (`#075f5a`); no screen uses it yet. Teal now serves accent, outline, and link affordances only (section 2, Brand Teal Strong), never the default CTA.
- **Secondary:** `bg-canvas text-ink border hairline` — outlined with white fill. Hover gets `bg-surface`.
- **Outline:** `border-[color:var(--color-teal-chip-text)] text-[color:var(--color-teal-chip-text)]` — transparent fill, border and label from the same text-safe teal. Hover gets `bg-teal-light`.
- **Danger:** `bg-red-600 text-white` — destructive actions. Hover darkens.
- **Ghost:** `bg-transparent text-slate border hairline` — lowest emphasis.
- **Icon action (`IconButton`):** a 20px full circle with the 1px hairline, canvas fill and a 12px / stroke-width 2 icon at `--color-slate`. Hover takes ink text and an outline-coloured border; `danger` hovers `--color-danger-text`, `success` hovers `--color-success`, `aria-pressed` is brand-teal, disabled drops to 0.5. It is the only shape for a pencil, refresh, trash, tick or close inside a row or table cell — `AllAssets`, `AssetGroupModal`, `ZoneGroupModal`, `PortfolioMutualFund` and the ladder's hover overlay all use it.
- **States:** Hover is per variant (`color-mix` on `--color-primary` for primary, `--color-brand-teal-strong-hover` for accent, `hover:bg-surface`, `hover:bg-teal-light`, `hover:bg-red-700`, `hover:bg-surface`) at `frontend/src/screens/components/Button.tsx:21-28`. Press scales the button to 0.97 (`active:scale-[0.97]`, `Button.tsx:50`). Disabled renders at `opacity-50` with `cursor-not-allowed` and cancels the press scale (`disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100`, `Button.tsx:50`). The transition is `transition-all duration-150` (`Button.tsx:50`).
- **Focus:** not set by the component. It inherits the global `:focus-visible` outline at 2px brand-teal with 2px offset (`index.css:585-596`).
- **Sizes:** sm `px-3 py-1.5 text-[10px]` renders 11.25px horizontal, 5.625px vertical, 10px type; md `px-4 py-2 text-xs` renders 15px, 7.5px, 11.25px; lg `px-6 py-3 text-sm` renders 22.5px, 11.25px, 13.125px (`Button.tsx:21-25`). The rem-based utilities scale down because the root is 15px (`index.css:84`).
- **Loading:** not implemented. The `loading` prop is declared (`Button.tsx:6`) and only feeds `disabled` (`Button.tsx:39`); no spinner, label change, or width reservation renders.

### Cards / Containers
- **Corner Style:** Generous 16px radius (`rounded-xl`).
- **Background:** Canvas (`#ffffff`). A canvas container on the `surface` page body needs no hairline, because the tonal step already draws the boundary; the 1px hairline exists for canvas-on-canvas separation (a card inside a canvas area) and for the legacy `.card` helper (`index.css:152`).
- **Shadow Strategy:** Flat by default; `.card-hover` adds `box-shadow: var(--shadow-md)` and `transform: translateY(-1px)` over 150ms on hover (`index.css:159-165`).
- **Internal Padding:** 24px is the default for a card holding one block; a summary strip with two columns uses `--strip-pad-y` / `--strip-pad-x` (14px/18px) so the block stays compact (see Overview Totals Strip).
- **Tinted variants:** Background shifts to teal-light, coral-light, or yellow-light for status cards.
- **Page body:** The page body is `surface`, so a container that must read as a block takes `canvas`; a container filled with `surface` is invisible on the body and must not be used as a section boundary.

### Ladder Table

The order-detail ladder (`screens/components/OrderDetailLadder.tsx`, CSS `.at-*`) is the one table whose tracks are set inline, per view. Geometry: card padding 9px / 14px / 8px, `.at-dh` 26px, `.at-lhead` 47px (band row 22px + column row 21px), `.at-row` 31px = `--row-h-ladder` 30px plus the 1px separator, row padding 0 8px, column gap 6px. At 1280 the card is 735 wide and the row content 689.

- **Header strip.** The title, `+ New zone` and `+ New order` sit left in `.at-dh-new` (6px between pills); the view tabs (All · EQ · Future · Options, 22px tall) own the right edge in `.at-dh-right`. Actions and the view switch never share one cluster.
- **Tracks.** All: 63 · 56 · 47 · 62 · 62 · 69 · 49 · 48 · 58 · 47 · `minmax(48px, 1fr)`. EQ · Future: 63 · 56 · 56 · 70 · 56 · 50 · 66 · 66 · 68 · `minmax(48px, 1fr)`. Options: 63 · 60 · 50 · 62 · 44 · 40 · 48 · 36 · 50 · 50 · 58 · `minmax(48px, 1fr)`. Every fixed track is its measured content (or column head) plus the same padding, so no column reads bloated beside another; the last track flexes so a narrower card cannot overflow. The two single-product views carry a Symbol column (the order's `asset_type`) directly after the price level, so several strikes or futures series on one level stay distinguishable.
- **Alignment.** Words — Mark, Symbol, Side, Status, Date, Remark — are left-aligned in head and cell (`LEFT_HEADS`); numbers are right-aligned (`at-num`); the option chip right-aligns inside its track (`justify-self: end`). The Side cell is a one-letter chip (L · S · B · S) whose hue carries the direction, so a long and a short at the same price level separate at a glance.
- **Bands.** The `.at-groups` band row renders in every view — two bands in All (EQ · Future over tracks 2–6, Options over 7–11), one full-width band in a single-product view — so `.at-lhead` stays 47px and the card never jumps when the tab changes. Band colour follows the instrument key. Spans come from a BANDS start-index table, so a new column cannot strand a band under the wrong columns.
- **Empty cells** print `—` at `--color-tier-2` (`.at-dash`), never slate, so only populated legs read.
- **Remark** is the table's only editable cell: it prints the order's own `remark` and stays blank when there is none — the empty cell is still a click target, so the table never shows a placeholder word and clicking it swaps in a one-line input — Enter or blur saves through `PUT /orders/{id}`, Escape cancels, and saving empty text clears the value to `null`. Long text truncates with an ellipsis; the All view has no remark column, so a leg's remark is edited in its own view.
- **Row actions.** Each leg's four actions (drag · link · edit · close, all `IconButton`) live in that leg's own Net P&L cell — `.at-net` is the positioning context — so a row holding an EQ leg and an option leg shows two clusters, each anchored to its block, and a single-product view shows one. A legless zoned row shows a single `+` at the row's right edge that opens Add order with that level's zone and mark price preset. Clusters appear on row hover or `focus-within` only.
- **Narrow** (below 900px) collapses to three tracks — Mark · Leg · Net P&L — with one cluster.

### Order History Card

The card under the ladder (`screens/components/OrderHistoryCard.tsx`, `.at-hist`) is a disclosure that becomes a table. Collapsed it is a 32px bar carrying the whole surface; open it is 138px with 9px / 14px padding, leaving 98px for a 20px heading, a 4px gap and a 95px body — a 17px column-head row plus the three most recent rows at 26px each. Rows sit on one grid with an 8px gap over 705px of content: `58 / 90 / 50 / 40 / 54 / 54 / 64 / 40 / 56 / 40 / minmax(48px, 1fr)`.

- **Columns.** Date (exit, `dd/mm/yy`), Symbol (the traded asset), Order (the shared `SideChip` letter), Qty, In, Out, Net P&L, Held, Status, By, Remark. Date, Symbol, Order, Status, By and Remark are left-aligned; the four numbers are right-aligned.
- **Row facts.** Held counts whole days from `entry_date` to `exit_date` and prints `<1d` for a same-day trade; Status reads `Close` or `Canceled` from the trade-history `remark` JSON note; By title-cases `executed_by`; Remark prints the order's own remark, copied into `trade_history.order_remark` when the order closed.
- **Below 900px** the grid drops to `56 / minmax(0, 1fr) / 64` and keeps only Date, Symbol and Net P&L, head and rows together.
- **Empty.** With nothing closed the body is one sentence — never a head row over no data — and the count beside the title reads zero.

### Risk Card

The right column's second card (`screens/components/RiskCard.tsx`, `.at-risk`) is the statement of the risk model, not a summary of it: it prints every input behind the band so a leg can be traced to the number that moved. Measured 408 wide at 1280.

- **Header.** A 26px line: `Risk` on the left, the model's context on the right — `X 0 · TDEX · DF`, i.e. the strike amount `x_amount`, the product ticker and the broker code, each falling back to `—` while the risk block is absent.
- **EQ · Future group** (7 rows): active orders, total size, average price, size @ 0, size @ X (mark), size @ X (entry), sum P/L.
- **Options group:** the four buckets — short call, short put, long call, long put — each carrying its own `orders · lots · avg premium` triplet in the middle track and a signed P/L on the right, then net premium. A bucket with no orders prints `—` rather than a zero triplet; unclassified option legs get their own row only when the count is non-zero.
- **Total group:** sum P/L and margin locked.
- **Size @ X twice.** The mark and the entry size are both shown because they answer different questions: the mark gives what the leg would cost to buy back at X (it is the price the band charges against available cash), the entry gives what was actually paid. Collapsing them into one line would hide whichever the reader was not expecting.
- **Band.** Three segments sized by `size @ X` (mark), `available_at_x` and `max(0, pl_total)`, with the caption `risk = available + P/L`; a negative P/L drops the profit segment instead of rendering a negative width. Colours follow the segment kind, not the sign.
- **Height is content-driven by design.** The card sits under the payoff in the right column and pushes the page down as it grows — it is never clipped or internally scrolled, and it is not sized to the ladder. 408×500 measured with the full model, rows at 24px and a 26px header.
- **Footer.** Unchanged: Strategy / Notes state plus Edit.
- **Data source.** Every figure comes from `risk_calc.compute_risk` on the portfolio detail response (`backend/app/risk_calc.py`, exposed as `risk` on `GET /analytics/portfolio/{id}`); the card performs no arithmetic of its own beyond `max(0, …)` for the segment.

The pool rail above the workspace is fed by the same block. `Total value` = `available_cash + margin_locked + Σ unrealised P/L` — realised P/L is already inside the cash balance, and notional is exposure rather than equity, so neither is added. Buffer coverage is `available_at_x / max(cash_buffer_limit, 1)`, and the rail's `of which profit` figure is realised P/L (Σ `trade_history.realized_pl`, the performance endpoint's `total_pl`) plus open P/L (`risk.pl_total`), expressed over `initial_capital` to one decimal — e.g. `+$6.00 (0.1% of initial)`. The parenthetical is dropped once that ratio rounds to `0.0%`, since a few dollars on a large base says nothing.

The All-assets table is the place the contract spec is maintained: Broker (fixed after creation), Multiplier and Margin rate are columns, and the last two edit in place like Price.

### Overview Totals Strip

The summary block a dashboard page starts with: a canvas card sitting on the surface page body.

- **Shape:** 12px radius. Padding is `--strip-pad-y` / `--strip-pad-x`: 14px vertical and 18px horizontal at every width. Bottom margin is `--strip-mb`: 24px.
- **Grid:** three tracks, `minmax(0,300px) 1px minmax(0,1fr)`, 20px gaps (`--ledger-gap`), items vertically centred. The 1px track is a hairline divider and exists only at 1024px and up; below 1024px the tracks stack with the same 20px gap and the divider is removed.
- **Left column:** an 11px slate label, then the primary datum at 19px with the cents at 0.6em in slate, then a P/L percent chip, then micro stats (10px label over a 13px value) for P/L and Deployed.
- **Right column:** an 11px slate label plus a 28px liquidity bar whose segments carry their own name and value, dropping both lines under 104px of segment width. 28px clears the 26px the two stacked lines need at line-height 1.15.
- **Threshold data:** data that used to live in a legend under the bar belongs in the `title` and `aria-label` of the status dot that reports it.

### Inputs & Fields
- **Fields are built from `Field.tsx`, not hand-rolled label/control pairs.** `Field` renders the `CONTROL_LABEL` label (with the app's ` *` required marker), the control, and optional `CONTROL_HELPER` hint / danger error line with the matching `aria-describedby`; `TextInput`, `NumberInput`, and `SelectInput` are the only field controls. The guard is the scoped `no-restricted-syntax` override in `frontend/eslint.config.js`, which errors on a literal `fontSize` in today's migrated files: `src/screens/ZoneGroupModal.tsx`, `src/screens/AssetGroupModal.tsx`, `src/screens/AddAssetModal.tsx`, and `src/screens/components/Field.tsx`.
- **Single source: `frontend/src/screens/components/controlStyles.ts`.** The control scale is one module, not per-screen literals. It exports `CONTROL_LABEL`, `CONTROL_INPUT`, `CONTROL_INPUT_TEXT`, `CONTROL_HELPER`, `CONTROL_BUTTON_PRIMARY`, `CONTROL_BUTTON_SECONDARY`, `CONTROL_VALUE`, and `CONTROL_TITLE` (`controlStyles.ts:16-104`). The element scale it reproduces is the reference implementation in `AddOrderModal.tsx:10-60` (`fieldLabel`, `fieldInput`, `primaryButton`, `secondaryButton`).
- **Reference surface: `/analytics/portfolio/1`.** Main Pool Overview / Active Trading detail (`frontend/src/pages/PortfolioAnalyticsDetail.tsx`, rendering `PortfolioGrid` / `PortfolioMutualFund`) is the accepted model for proportions and type. Its measured scale: page title 22/600, section title 16/600, content/data text 15px (`--fs-content`, `index.css:95`), control chrome 11/500 at `3px 10px` (22px tall), small inline buttons 11/400 at `1px 9px`, breadcrumb 11/400, header band 44px, card padding `9px 14px 8px`. The control module follows that ladder; it does not shrink data text to fit.
- **Type table.** The accepted reference proportions, as shipped:

| Role | Size / weight | Source |
|---|---|---|
| Page title | 22 / 600 | `--fs-page-title`, `index.css:90` |
| Section title | 16 / 600 | `--fs-section`, `index.css:92` |
| Content / data text | 15 | `--fs-content`, `index.css:95` |
| Control value (read-only From/To) | 13 / 500 | `--fs-body`, `index.css:93` |
| Control label | 11 / 500 | `--control-fs-label`, `index.css:110` |
| Control text, helper, button | 11 / 500, 11 / 400, 11 / 500 | `--fs-label`, `index.css:96` |
| Table head | 11 / 500 | `AllAssets.tsx:27` |
| Caption — portfolio-type card description only | 9 | `--fs-caption`, `index.css:99` |
- **Every control value is a token.** The module reads the type ladder and control geometry from `:root` (`index.css:90-110`): control label/field/button `var(--fs-label)` = 11px (`--control-fs-label` is the alias token), the read-only value `var(--fs-body)` = 13px; field padding `var(--control-pad-y) var(--control-pad-x)` = 4px 8px, radius `var(--control-radius)` = 8px, min height `var(--control-h)` = 26px; pill buttons `var(--control-btn-pad-y) var(--control-btn-pad-x)` = 3px 10px at `var(--rounded-full)`. One edit in `:root` changes every control; no screen or module re-derives a number. The `@media (pointer: coarse)` 44px floor (`index.css:520-524`) is untouched — density tokens never scale below it.
- **Screens bind the module.** `TransferModal.tsx:5-7` rebuilds the cash-transfer modal (title `CONTROL_TITLE` 15px, From/To `CONTROL_VALUE` 13px `var(--fs-body)` — one step above control text, below content, so the value reads as the datum and not as its own label; amount `CONTROL_INPUT`; Max/Cancel/Confirm `CONTROL_BUTTON_SECONDARY` / `CONTROL_BUTTON_PRIMARY`). `CreateNewPortfolio.tsx:7-10` binds it for every label, field, helper, and action (`CreateNewPortfolio.tsx:366`, `:376`, `:450`, `:539`). `AllAssets.tsx:13` binds `CONTROL_INPUT` for the in-place price and spec editors (`AllAssets.tsx:112-133`); the table head is 11px/500 (`var(--fs-label)`, `AllAssets.tsx:27`) and every body cell — ticker/name/price/change and the Broker/Mult/Margin cells — is the reference content size, `var(--fs-content)` 15px on `py-3` rows (`AllAssets.tsx:124-164`).
- **Numeric fields carry no native stepper.** Every `input[type="number"]` renders as a plain field: `index.css` sets `appearance: textfield` and hides `::-webkit-inner/outer-spin-button`, so nothing is nudged by 15px of browser chrome on a 26px box. Screens never re-declare this per element.
- **Focus is one indicator: no teal stroke.** Teal is a fill token, never a field stroke. On these surfaces an input or select never sets `border-brand-teal`, `focus:border-brand-teal`, or `outline-none`; the only focus signal is the global `:focus-visible` 2px `--color-brand-accent` ring at 2px offset (`index.css:533-543`). A focused field therefore shows one accent ring, not a green border inside an orange ring.
- **No `.input` component class.** Earlier revisions of this document referenced one at `index.css:238-248`; it no longer exists. Shipped fields bind `controlStyles.ts`, and the `--color-outline` placeholder rule went with the class, so placeholders render the browser default.
- **Disabled/error are per screen, not shared.** `TransferModal` renders a coral error notice (`TransferModal.tsx:102-110`); `CreateNewPortfolio` renders an error banner and a disabled submit variant (`CreateNewPortfolio.tsx:307-314`, `:349-358`). Neither is a control-scale concern.

### Navigation
- **Style:** Horizontal pill links in the top bar. Inactive: slate text. Active: ink background with white text.
- **Hover:** Surface background tint with ink text.
- **Mobile:** Full-width vertical drawer below the nav bar, same pill styling.
- **Logo:** Yellow "M" square with "InvestDesk Dashboard" stacked label.
- **Icons:** Feather-style SVGs at 20px, with scale hover animation (1.12x).

### Chips / Badges
- **Style:** Pill shape (9999px), 2px/10px padding, 12px font, 500 weight. Dashboard pages set it from `--fs-label` (11px).
- **Case:** badge and chip text is sentence case at 500 weight; uppercase tracking is not used.
- **Colors match accent roles:** teal, yellow, coral, blue, each with a 12-18% opacity tinted background.
- **Neutral variant:** Surface background, slate text.
- **Dark mode:** Background opacity increases to 25%.
- **Option chip (\(.at-type\)):** 15px tall, 4px radius, 10px/600 tabular code; hue is the option direction, fill is the position side.
- **Side chip (`SideChip`, `.at-side`):** one letter — `L` Long, `S` Short, `B` Buy, `S` Sell — in an 18px-wide, 15px-tall chip with a 4px radius and a 1px border at 35% of the hue, no fill. The hue carries the direction: long and buy take `--color-positive-text`, short and sell take `--color-danger-text`. The letter sits on the canvas rather than on a tint of its own hue, because a 10% tint measures 4.15 and 3.92:1 while the canvas measures 4.75 / 4.53 light and 7.11 / 8.11 dark. The ladder's Side column and the order-history Order column both use it.

**States.** Every chip that can be interacted with needs resting, hover, pressed, and focus-visible. Pressed and hover backgrounds are expressed with `color-mix` on the status token: 18% at rest, 30% on hover, 100% when pressed, 85% when pressed and hovered. Text on a tinted background is `--color-ink`; text on a solid `--color-status-warning` fill is `--color-on-brand-yellow` (#1c1c1e in both themes), because ink flips to a pale grey in dark mode and collapses to 1.20:1 there, while on-brand-yellow measures 11.60:1. Measured text contrast for the chips that ship: P/L sign chip 13.33:1 light and 11.33:1 dark; attention chip 13.22:1 light and 9.02:1 dark at rest, 4.86:1 and 11.60:1 pressed, 5.99:1 and 8.56:1 pressed and hovered.

### Status Dot
- **Style:** 8px circle, filled with the matching accent color (teal, yellow, coral, blue).
- **Use:** Inline with status labels in cards, dropdowns, and row indicators.

### Select / Dropdown
- **Trigger:** Matches input styling (1px hairline, 8px radius, canvas fill). Min-width 160px.
- **Dropdown Panel:** Positioned absolute below trigger. Canvas background, hairline border, 12px radius, `shadow-lg`. 4px internal padding around options.
- **Options:** 8px/12px padding, 6px radius. Hover gets surface background. Active gets `surface-container-low` background with 500 font-weight.

## 6. Page Composition (Overview is the reference)

The Overview page is the reference standard. A dashboard page reads top to bottom as one sequence:

```
page header              22px title left, status dots right, 11.25px below (mb-3)
  -> totals strip        canvas card
  -> 24px
  -> section heading row 16px title, filter chip and count right
  -> list                hairline rows, sticky head
```

**The No-Repeated-Rule Rule.** A section boundary is never drawn with the separator the group itself uses for its rows. The Portfolios ledger keeps a hairline under its sticky head and between rows, and has no rule above it; two same-width blocks are separated by space plus a container step, not by another hairline.

**The Above-The-Fold Rule.** The app shell reserves the 60px nav (`main` is `min-h-[calc(100vh-60px)]`); a dashboard page at a 1258x575 viewport must show header, strip, heading, and its rows with no page scroll, which is what the Overview measures today (`scrollHeight` 575 = `clientHeight`).

**The Row Anatomy Rule.** Table rows are 44px minimum at every width (`--row-h`), with a dense variant at 38px (`--row-h-dense`); 44px is also the interactive floor. A row's second line exists only to carry a `status_message` — the tag row above already states the portfolio type and bot management, so repeating them there is not allowed. The head is sticky, and both keep their hover and focus-visible states.

**The Converge-On-Overview Rule.** Pages converge on Overview; a new page that needs a summary block uses the totals strip before inventing a new layout.

**The Detail-Grows-With-Its-Rows Rule.** The Active Trading portfolio detail (`screens/PortfolioGrid.tsx`, route `/analytics/portfolio/:id`) is a workstation, not a page of stacked cards: `.at-page` sets `min-height: calc(100dvh - 60px)` with `margin-block: -16px`, `-20px` at `md` and leaves the overflow visible, so it is exactly one screen while the ladder is short and grows downward as rows are added — 12 rows measure a page 1078 tall with document `scrollHeight` 1137 against a 720 viewport, so the scroll is on the document, never inside the ladder. The composition is a 44px header band, an 84px pool rail, then a `minmax(0, 808px) 408px` workspace with a 12px gap: left, order detail (height 26 + 4 + 47 + N×31 + 17 of padding) above order history (32px collapsed disclosure, 138px open); right, payoff (min-height 396px) above a content-driven risk card (408×500 at these numbers), with `.at-col.at-right { align-self: start }` so the chart never stretches to the ladder's height. The ladder is one row per price level at `--row-h-ladder`, built from `orders_groups` ranges (`max_price` down to `min_price` by `range`); orders whose `entry_price` falls between levels take the nearest level at or above it, and a level holding several legs emits one row per leg with the mark printed once. At 1280×720 the detail card is 735×468 with a 705-wide ladder inside 9/14/8 padding.

## 7. Do's and Don'ts

### Do:
- **Do** use Brand Yellow as the single bold surface — it carries signal weight because nothing else competes at that saturation.
- **Do** use pastel tints (teal-light, coral-light, yellow-light) for status backgrounds instead of the raw saturated accent.
- **Do** use full-pill buttons for all actions — it's the system's most recognizable shape pattern.
- **Do** use flat containers with hairline borders at rest and tonal surface shifts for depth.
- **Do** keep body text at `--fs-body` (13px) with a max line length of 75ch.
- **Do** use `text-wrap: balance` on heading elements and `text-wrap: pretty` on long prose.
- **Do** write labels in sentence case at `--fs-label` (11px, 500 weight) in `--color-slate`, 4 words max.
- **Do** use Sora across the entire interface — one family, weight contrast for hierarchy.
- **Do** keep a dashboard page's primary datum at 19px and its page title at 22px, with a fixed px scale that does not shrink on narrow screens.
- **Do** separate same-width blocks with a surface step plus `--strip-mb` (24px).

### Don't:
- **Don't** use gradient text (`background-clip: text` + gradient). Solid color or nothing.
- **Don't** use glassmorphism (backdrop blur on cards) as a default pattern.
- **Don't** use side-stripe borders (border-left >1px as a colored accent on cards or callouts).
- **Don't** use the hero-metric template (big number + small label + gradient accent) — a SaaS cliché.
- **Don't** use numbered section markers (01 / 02 / 03) as default scaffolding above sections.
- **Don't** use all-caps or tracked labels anywhere on a dashboard page, including column heads, chips and stat labels.
- **Don't** use navy-and-gold fintech aesthetics, dark-mode-terminal-only looks, or SaaS-cream minimalism.
- **Don't** stack nested cards — cards are flat by default and should not contain other cards.
- **Don't** use fonts outside the Sora family — no serif, mono, or competing sans-serif.
- **Don't** place uppercase tracked eyebrows ("OVERVIEW", "RISK") above every section as a default pattern.
- **Don't** draw a section boundary with the same 1px hairline the group uses between its own rows.
- **Don't** render a static threshold scale as a legend block under a table; put it in the status dot's `title`/`aria-label`.
- **Don't** fill a section container with the page body colour.

## 8. Responsive Behavior

Width is handled in two places: Tailwind variants inside components, and media or container queries in `index.css`. The root font size is 15px, not the 16px Tailwind assumes (`index.css:84`, inside `:root` at `index.css:10-90`), so every rem-based utility renders at 0.9375x its nominal value: `px-4` is 15px, `h-16` is 60px, and `text-sm` is 13.125px. Every px value in this document is that computed value measured in the browser, and class names are given alongside it so the source stays traceable. `frontend/tailwind.config.js` declares no custom `screens`, so `md` and `lg` are the Tailwind defaults. `sm` (640px) and `xl` (1280px) utilities never appear in `frontend/src`; the one 1280px reaction is a plain media query in CSS. The page shell uses `px-4 md:px-6` (`PageLayout.tsx:5`), so content never sits on a 64px gutter: the horizontal padding is 15px at rest and 22.5px from `md` up, and only the totals strip's own 24px padding is literal (`PortfolioOverview.tsx:312`).

| Name | Width | What changes |
|---|---|---|
| `md` | 768px (Tailwind default) | 39 lines carry a `md:` utility. Page shell padding (`px-4 md:px-6 py-4 md:py-5`) steps from 15px horizontal and 15px vertical to 22.5px and 18.75px (`PageLayout.tsx:11`). Card grids go from one column to two, three, or four (`PortfolioAnalyticsDetail.tsx:36`, `CreateNewPortfolio.tsx:171`, `CreateNewPortfolio.tsx:232`, `CreateNewPortfolio.tsx:321`, `PortfolioMutualFund.tsx:219`). Table columns start appearing (`TransactionsPage.tsx:215-249`, `TradeHistoryTable.tsx:95-130`). |
| `lg` | 1024px (Tailwind default) | 16 lines carry an `lg:` utility. The inline nav appears and the hamburger disappears (`Navigation.tsx:94`, `Navigation.tsx:175`). Remaining table columns appear (`TransactionsPage.tsx:218`, `TradeHistoryTable.tsx:102`). The chart side panel appears (`PayoffChart.tsx:355`). |
| `min-[1024px]` | 1024px, as an arbitrary variant | The strip changes from a stacked column to a three-track grid with items vertically centred (`PortfolioOverview.tsx:315-321`), and the 1px divider becomes visible (`PortfolioOverview.tsx:386`). Padding, gap, and bottom margin are the same compact values at every width. |
| `max-width: 899px` | below 900px | The Active Trading detail drops its right column and the ladder reduces to three tracks, Mark · Leg · Net P&L (`.at-workspace`, `.at-right`, `OrderDetailLadder.tsx`). The pool rail drops to `150px minmax(0,1fr)` and hides its coverage block, and the history card shrinks to 96px (`index.css`, `.at-page` block). |
| `max-width: 1023px` | below 1024px | Layout only: `.ledger-head` is hidden and `.ledger-row` collapses to two tracks, `minmax(0,1fr) auto`, with the 20px column gap and a 10px row gap. Name, allocation, and status cells span the full width, value cells align left, and the numbers stay right-aligned (`index.css:325-343`). The dashboard scale tokens do not change. |
| `min-width: 1280px` | 1280px | `.portfolio-grid` becomes two equal columns (`index.css:477-485`). No component binds `.portfolio-grid`, so the rule currently renders nothing. |
| `@container` | 104px of the segment's own inline size | A liquidity segment reveals its label and value (`index.css:459-462`). Below 104px both stay `display: none` through `.liquidity-seg-text` (`index.css:442-443`, `LiquidityStack.tsx:71-72`). |
| `pointer: coarse` | input modality, not width | Buttons, links, inputs, selects, textareas, and `[role="button"]` get `min-height: 44px`; `.nav-link` gets 36px (`index.css:569-575`). |
| `prefers-reduced-motion` | user preference | Every animation and transition collapses to 0.01ms with one iteration (`index.css:598-604`). |

### Touch Targets

- **Ledger rows:** 44px minimum height at every width with 8px vertical and 8px horizontal padding (`index.css:296-304`). The dense variant drops to 38px with 6px padding (`index.css:316-319`).
- **Interactive floor:** 44px is a floor, not a separate size: ledger rows already rest at 44px, so under `(pointer: coarse)` their height is unchanged. The floor still raises buttons, links, inputs, selects, textareas, and `[role="button"]` to 44px and `.nav-link` to 36px (`index.css:569-575`). On a fine pointer no floor is applied.
- **Buttons:** sm `px-3 py-1.5 text-[10px]` renders 11.25px horizontal, 5.625px vertical, 10px type; md `px-4 py-2 text-xs` renders 15px, 7.5px, 11.25px; lg `px-6 py-3 text-sm` renders 22.5px, 11.25px, 13.125px (`Button.tsx:21-25`, computed at the 15px root). No size sets an explicit height.
- **Toolbar controls:** the search input and sort select use 6px vertical padding with 13px type (`PortfolioOverview.tsx:460-464`, `PortfolioOverview.tsx:475-479`). Only the search sets widths: 200px minimum, 280px maximum (`PortfolioOverview.tsx:465-466`).
- **Navigation:** desktop pills are `px-4 py-2`, which renders 15px horizontal and 7.5px vertical padding (`Navigation.tsx:103`); drawer rows are `px-4 py-3`, rendering 15px and 11.25px, with `text-[15px]` giving literal 15px type (`Navigation.tsx:192`). The unbound `.nav-link` rule would set 8px and 16px (`index.css:310`).

### Collapsing Strategy

Width is handled by collapse, not by scaling, and the type/geometry scale stays compact at every width. Below 1024px the ledger loses its column head and its five-track grid. Each row becomes a two-track grid (`minmax(0,1fr) auto`) with 20px between columns and 10px between rows; name, allocation, and status span the full width, and value cells align left while numbers stay right-aligned (`index.css:325-343`). The Overview ledger does not gain horizontal scroll; `.table-responsive` is bound only by `OptionsStrategyTable.tsx:84` (`index.css:579-581`).

Filtering is data-driven rather than responsive. The toolbar (search plus sort) renders only when the portfolio count exceeds `DENSE_THRESHOLD = 8` (`PortfolioOverview.tsx:30`, `PortfolioOverview.tsx:267`, `PortfolioOverview.tsx:443`), and the same flag switches rows to `.ledger-row-compact` (`PortfolioOverview.tsx:550`). Nine portfolios is the point where a narrow viewport gains a search box it did not have at eight.

Navigation collapses at `lg`. Below 1024px the inline nav is removed (`Navigation.tsx:94`) and a hamburger appears (`Navigation.tsx:175`). It toggles a full-width drawer positioned absolutely at `top-16` under the bar, which renders 60px (`h-16` at the 15px root) (`Navigation.tsx:76`, `Navigation.tsx:182`), animated over 200ms (`index.css:619-620`). The drawer lists nav items and portfolios as rows rather than pills (`Navigation.tsx:192-212`).

## 9. Interaction States

States ship per component, not per token. A state that the code does not implement is named as not implemented, so it cannot be mistaken for a target that is already met.

### Buttons

| State | Visual change | Where |
|---|---|---|
| Resting | Variant fill, full pill, bold text, 150ms transition on all properties | `Button.tsx:14-20`, `Button.tsx:40` |
| Hover | Primary mixes 88% `--color-primary` with `--color-on-primary`; accent `--color-brand-teal-strong-hover` (#087068), secondary `surface`, outline `teal-light`, danger `red-700`, ghost `surface` | `Button.tsx:21-28` |
| Pressed | Primary mixes 85% `--color-primary` with black; accent `--color-brand-teal-strong-active` (#075f5a); pressed buttons scale to 0.97 | `Button.tsx:21-24`, `Button.tsx:50` |
| Focus-visible | 2px brand-teal outline at 2px offset, inherited from the global rule | `index.css:585-596` |
| Disabled | Opacity 0.5, `cursor-not-allowed`, press scale cancelled | `Button.tsx:40` |
| Loading | Not implemented: the prop only feeds `disabled` | `Button.tsx:6`, `Button.tsx:39` |

### Inputs and Selects

| State | Visual change | Where |
|---|---|---|
| Resting | 1px hairline border, `var(--control-radius)` 8px radius, canvas fill, 11px/500 ink, `var(--control-pad-y) var(--control-pad-x)` 4px 8px padding, `var(--control-h)` 26px minimum height — all from `:root`, consumed through `controlStyles.ts` | `index.css:90-107`, `controlStyles.ts:25-36` |
| Focus-visible | one indicator: 2px `--color-brand-accent` outline at 2px offset, from the global rule; the border colour does not change and no second ring is added | `index.css:530-540` |
| Focus (border shift) | not part of the contract: teal is a fill token, never a stroke. No shipped field binds a teal border class, and adding one would double the focus signal | `controlStyles.ts:9-12` |
| Hover | not implemented | none |
| Placeholder | browser default; the old `.input::placeholder` rule no longer exists | `index.css` (no `.input` rule) |
| Error | per screen, not shared: a coral error notice inside the transfer modal, an error banner on the create page | `TransferModal.tsx:102-110`, `CreateNewPortfolio.tsx:349-358` |
| Disabled | per screen: the submit button switches to surface/slate with `cursor: not-allowed`; no shared disabled input state | `CreateNewPortfolio.tsx:307-314` |
| Loading | per screen label swap only; no shared loading input state | `CreateNewPortfolio.tsx:307` |

### Chips

| State | Visual change | Where |
|---|---|---|
| Attention chip, resting | Ink on warning at 18% via `color-mix`, 120ms background transition | `index.css:255-259` |
| Attention chip, hover | Warning at 30% | `index.css:264-266` |
| Attention chip, pressed | `aria-pressed="true"`: solid warning fill with `--color-on-brand-yellow` text | `index.css:260-263` |
| Attention chip, pressed and hovered | Warning at 85% over canvas | `index.css:267-269` |
| Attention chip, focus-visible | 2px brand-teal outline at 2px offset | `index.css:270-273` |
| Attention chip, disabled or loading | Not implemented | none |
| P/L percent chip | Static tint only: 18% positive or danger, or `surface-soft` when flat; a `<span>`, so no hover, pressed, or focus state exists | `PortfolioOverview.tsx:342-351` |
| Tag chip | Static `surface` fill, `--fs-micro` (10px), full pill, 2px/8px padding | `PortfolioOverview.tsx:112-126` |

### Table Rows

| State | Visual change | Where |
|---|---|---|
| Resting | 44px minimum height at every width, 8px/8px padding, hairline bottom, 4px radius, 120ms background transition | `index.css:296-304` |
| Hover | Surface background | `index.css:305-307` |
| Focus-visible | 2px brand-teal outline at 2px offset; rows are `<Link>` elements, so they receive focus | `index.css:308-311`, `PortfolioOverview.tsx:101-106` |
| Compact | 38px height and 6px padding, same grid | `index.css:316-319`, `PortfolioOverview.tsx:548` |
| Drop target | 8% brand-teal wash while a dragged amount is over the row | `index.css:312-314`, `PortfolioOverview.tsx:107` |
| Pressed | Not implemented: no active style on the row | none |
| Selected | Not implemented | none |
| Disabled | Not implemented | none |
| Loading | Not implemented | none |

### Ladder Row Actions

| State | Visual change | Where |
|---|---|---|
| Resting | cluster hidden: `opacity: 0`, `pointer-events: none` | `index.css` `.at-actions` |
| Row hover / focus-within | cluster fades in over a 18px gradient of `--color-row-hover` | `index.css` `.at-row:hover .at-actions` |
| Link armed | `aria-pressed="true"` turns the icon and border brand-teal | `index.css` `.icon-btn[aria-pressed="true"]` |
| Remark edit | click swaps the cell for `.at-remark-input` (surface-soft fill, teal focus border); Enter or blur saves, Escape restores the old text, empty clears to `null` | `OrderDetailLadder.tsx`, `PortfolioGrid.tsx` `handleUpdateRemark` |
| Close hover | danger red icon and border | `index.css` `.icon-btn[data-danger="true"]:hover` |
| Empty level hover | one `+` at the row's right edge (`at-actions-row`); opens Add order with the level's zone and mark preset | `OrderDetailLadder.tsx`, `PortfolioGrid.tsx` `handleAddOrder` |
| Keyboard | buttons stay in the tab order; `:focus-within` reveals the cluster; the global 2px brand-teal outline is the only focus ring | `index.css` |
| Drag | the handle carries `draggable`, `role="button"`, `tabIndex={-1}`; dropping on a row calls `onAssignGroup([id], zoneId)` | `OrderDetailLadder.tsx` |

### Order History Rows

| State | Visual change | Where |
|---|---|---|
| Collapsed | a 32px bar with the title, the closed-trade count, a chevron and View all; the body is `hidden` | `index.css` `.at-hist` |
| Expanded | 138px with a 17px head row and the three newest rows, 26px each, hairline-soft between | `.at-hist.is-open` |
| Row hover | not implemented: rows are records, not controls | none |
| Drag-over | an 8% `--color-brand-teal` wash while a dragged ladder leg is over the card; dropping closes that order | `index.css` `.at-hist.is-drop` |
| Chevron | rotates 180° while `aria-expanded` is true | `index.css` `.at-chev svg` |
| Focus-visible | the chevron and View all are buttons, so they inherit the global 2px brand-teal outline | `index.css` |
| Empty | one sentence in the body, no head row | `.at-hist-empty` |

### All-assets Contract Spec Cells

| State | Visual change | Where |
|---|---|---|
| Resting | `Mult` and `Margin` print 15px (`--fs-content`) tabular numbers right-aligned in a hairline-free cell; `Broker` prints the code in 15px slate and cannot be edited | `AllAssets.tsx` `DraggableRow` |
| Hover | the cell is a click target with no background change, matching the Price cell beside it | same |
| Editing | the cell swaps to a number input derived from the shared `CONTROL_INPUT` — 11px ink on canvas, 1px hairline, `var(--control-radius)` — autofocused, value selected; focus is the global accent ring, never a teal border | `AllAssets.tsx:112-119` |
| Commit | Enter or blur saves through `PUT /assets/{id}`; `multiplier > 0` and `0 <= margin <= 1` are enforced, and an invalid or empty entry leaves the stored value untouched | `AllAssets.tsx` `commitSpec` |
| Cancel | Escape closes the input without saving | same |
| Failure | a warning toast names the ticker and the API message; the old value stays | `AllAssets.tsx` `handleSaveSpec` |
| Heads | never wrap: explicit widths per column, the Name column alone takes the slack | `AllAssets.tsx` thead |

### Nav Links

| State | Visual change | Where |
|---|---|---|
| Resting | Transparent background, slate text, `w-5 h-5` icon rendering 18.75px, `transition-colors` | `Navigation.tsx:97-107` |
| Active | `--color-primary` background with `--color-on-primary` text | `Navigation.tsx:100-101` |
| Hover | Not implemented on the shipped pill: the link carries no hover class | `Navigation.tsx:103` |
| Hover (unused rule) | `.nav-link:hover` would set ink text on surface, but no element binds `.nav-link` | `index.css:305-319` |
| Focus-visible | 2px brand-teal outline at 2px offset, from the global rule | `index.css:585-596` |
| Icon hover | Icon scales to 1.12 over 200ms | `index.css:561-566` |
| Drawer row | Primary background and on-primary text when active, `text-[15px]` (literal), `px-4 py-3` rendering 15px horizontal and 11.25px vertical | `Navigation.tsx:192-197` |
| Pressed | Not implemented | none |
| Disabled | Not implemented | none |

## 10. Surface Contracts

A contract is a property the surface must hold at every viewport, not a style choice each page makes again. These rules come from the 2026-11-20 review of the running app at `http://localhost:8080` in Chromium; each number is the measured failure that produced the rule, so a regression is recognisable as the same number returning.

### Named Rules

**The Always-Visible Action Rule.** A modal's primary action is never below the fold at any supported viewport. The panel is `max-height: calc(100dvh - 48px)` with a fixed header and a footer pinned to the card bottom; the body between them is the only scroll region. The overlay is never the scroll mechanism, and `body` stays locked while the internal body scrolls — an overlay that scrolls hides the action with no visible affordance. Measured at 1258x555: the add-order panel stood 579px tall and its `Create order` button sat at y=568..589, entirely below the viewport, while the overlay was the only scroll container and rendered no scrollbar; edit portfolio hid its footer even at 700px. The cause was `screens/components/ModalShell.tsx`'s panel wrapper carrying no max-height and each modal card owning no internal scroll region, so the rule is enforced once in the shell: every modal inherits it, and no card sets its own height. Floor to verify: 1258x555.

**The Measured-Contrast Rule.** Every text/background pairing ships with a computed ratio written beside the token: 4.5:1 for body text at 11–13px, 3:1 for large text. Four pairs failed the 2026-11-20 pass: white on `#0fbcb0` at 2.38:1 (the then-teal primary buttons), `#0fbcb0` on `#c3faf5` at 2.07:1 (managed-fund chip), white on the grey liquidity segment at 2.54:1, and the dark-mode logo mark (`text-ink` on yellow) at 1.2:1 — 1.4:1 once the user picked a light accent, which was lilac in the stored profile. Resolutions: the teal stays a fill and its label token must measure 4.5; a chip on teal-light takes a darker teal text token; liquidity segment labels take per-segment ink instead of one white. Measure on the composited background, as section 11 item 5 requires, not on the raw token.

**The Fixed-Anchor Rule.** Brand Yellow is fixed, and no user setting repaints it. `components/AccentMenu.tsx` writes `--color-brand-accent`, and the alias `--color-brand-yellow: var(--color-brand-accent)` let a chosen accent repaint the semantic available-liquidity fill and the logo mark — the anchor the rest of the palette reads against. A user accent repaints chrome only: active pills, links, and the focus ring; never a semantic fill and never the mark. Accent-backed text uses `--color-on-brand-accent`, derived from the accent's own luminance, so every palette option stays at or above 4.5:1 in both themes; a fixed white label cannot satisfy that across palettes.

**The One-Number Rule.** One formatter module, `frontend/src/utils/format.ts`, owns `formatMoney`, `formatPct`, and `formatDateTime`; a page calls it and formats nothing itself. The locale is explicit `en-US`, never `toLocaleString(undefined, …)`, so grouping does not follow the browser and a Thai browser cannot render Buddhist-era digits inside an English UI. A delta is always signed — `+` or `-` — and exact zero is unsigned; `$+0` is not a value. A timestamp carries its date and its timezone, because `Updated 21:54:15` says nothing outside the machine that rendered it. The drift in one pass: `$+0` on the managed-fund summary, `+0.0%` in one portfolio row against `0.0%` in the next, `Updated 21:54:15` with no date or timezone, and Thai Buddhist date digits inside an English UI. Page-local `toLocaleString` formatting is forbidden.

**The Never-The-Exception Rule.** No rendered text contains a raw `err.message`, an HTTP status, or a stack fragment. A failed page shows a card: one sentence naming what failed, a `Retry` that re-runs the same fetch, and an escape hatch — a link back to a known-good page. The raw status goes to the console only. `/analytics/detail` rendered the entire document as `Error: HTTP error! status: 500`, with no chrome, no retry, and no way out; a page whose only exit is the browser's back button is a dead end, not an error state.

**The Skeleton-Not-Text Rule.** Every page's loading state is a pulse skeleton shaped like the content it replaces; a bare `Loading…` line is a violation. On the same build, Overview and Transactions rendered bare `Loading…` text while Risk Analytics and Managed Fund already used pulse skeletons — the rule is conformance, not a new pattern, and the skeleton stands in for the block (strip, rows, chart) rather than a generic spinner.

**The Compact-Empty Rule.** An empty region is one block no taller than 120px, carrying one primary action and one sentence that teaches the next step. Three stacked full-width empty cards are forbidden: `/managed-fund` with no data rendered three, roughly 420px of chrome at a 720px viewport for a page with nothing to show. An unpopulated ladder level renders blank, never a dash — a dash means "known value, missing" — so the 97 low-contrast `—` nodes painted into every empty price level on one dark-mode page made an empty column read as broken data.

**The Filled-Width Rule.** Content fills the `max-w-[1200px]` shell. A form page is either centred or a two-column layout with a summary rail, and a left-anchored card may never leave a dead column wider than roughly 15% of the content width. On `/create-portfolio` at 1258x700 a `max-w-3xl` card (720px) sat in a 1258px main, leaving 486px empty while the document grew to 1283px and pushed the submit to y=1190..1241 — two screens below the fold. The dead column is what forced the height.

**The English-UI Rule.** All UI copy is English, whatever the user's locale or the author's language — helper text, labels, and empty states included. Developer strings never ship: `yfinance symbol patterns` and `1 asset in 2 groups, manual refresh` describe the implementation, so a user reading them learns the schema instead of the task. A string the user cannot act on is not UI copy.

**The Verified-Viewport Rule.** Supported viewports are 1258x555 (the real-user floor: 1920x1080 scaled 1.5 inside a window), 1258x700, 1024x768, and 1440x900. Every page and every modal ships screenshot-verified at all four, with no horizontal overflow, the primary action reachable without scrolling the overlay, and the page's first actionable row above the fold. Desktop is the primary surface; a phone layout must not break but is not a target, which is why section 8 collapses the tables rather than fitting them.

## 11. Iteration Guide

1. Change the token or the component in code first, then update this document in the same commit. `6c1760b` is that pair: it changed `DESIGN.md`, `frontend/src/index.css`, and `frontend/src/pages/PortfolioOverview.tsx` together.
2. Never document a value the code does not set. When a value is a target rather than an implementation, mark it as a target: the 44px floor is a coarse-pointer rule (`index.css:569-575`), not a universal one.
3. Every interactive element ships resting, hover, pressed, and focus-visible, or says "not implemented" in section 9. Today the nav pill itself has no hover (background and colour are inline styles with no hover variant), while its icon scales to 1.12 (`index.css:561-566`, `Navigation.tsx:106`); no input has an error state, and no button renders a loading spinner.
4. New pages converge on the Overview composition before adding a new layout (section 6). The totals strip is the first block of a dashboard page, and its geometry is set at `PortfolioOverview.tsx:311-400`.
5. Measure contrast on the composited background, not on the raw token. A chip's fill is a `color-mix` result over its container (`index.css:257`); pale ink `#e8e8e8` (`index.css:110`) on the solid warning fill measures 1.20:1 (measured from the token values), which is why the pressed state switches to `--color-on-brand-yellow` (`index.css:342-345`).
6. Keep the frontmatter machine-readable: a new token goes into the frontmatter and into `frontend/src/index.css` in the same change. The frontmatter `colors` and `components` blocks mirror the `:root` variables (`index.css:10-90`).

## 12. Known Gaps

- **Dark mode is not enumerated per token.** `.dark` redefines 31 properties (`index.css:110-148`), including canvas `#13131f`, ink `#e8e8e8`, and all three pastel tints. Section 2 describes the intent and names three examples; the full mapping exists only in CSS.
- **Data visualisation has no spec.** `PayoffChart.tsx` and `PerformanceChart.tsx` render SVG (`PayoffChart.tsx:253`) with local margins, gridline colours, and stroke widths, and nothing documents axis, tick, or series treatment. The chart animations `donutDraw`, `lineDraw`, and `barGrow` (`index.css:510-527`) are undocumented.
- **Motion has no duration scale.** Easing is tokenised (`index.css:488-492`), but durations are literals at the call sites: 120ms (`index.css:340`, `index.css:385`), 150ms (`index.css:160`), and 200ms, 250ms, 300ms for the animation classes (`index.css:607-620`). A new component has no duration token to reach for.
- **Several states are not implemented.** No input has an error, disabled, or loading state; no button renders a spinner (`Button.tsx:6`, `Button.tsx:39`); no ledger row has a selected or disabled state; the nav pill itself has no hover, since its background and colour are inline styles with no hover variant, though the icon inside it scales to 1.12 (`index.css:561-566`, `Navigation.tsx:106`).
- **Dead CSS outnumbers live CSS in places.** `.input` (`index.css:238-248`), `.nav-link` (`index.css:305-319`), `.badge` and its variants (`index.css:170-188`), `.select-trigger`, `.select-dropdown`, and `.select-option` (`index.css:191-235`), and `.portfolio-grid` (`index.css:477-485`) are bound by no component. There is no shared input component at all: 87 `<input>` elements are styled per screen.
- **Components outside Overview are undocumented.** `PerformanceSection`, `TradeHistoryTable`, `ZoneGroupModal`, `OptionsStrategyTable`, and the chart components ship their own padding, type sizes, and states; section 5 covers the Overview set and the detail-page components, and section 6 records the detail page's geometry rules.
- **Three places hardcode 60px for the nav while the bar derives its height from a rem class.** `main` reserves 60px (`GlobalLayout.tsx:8`), `.ledger-head` sticks at `top: 60px` (`index.css:286`), and `h-16` renders 60px only because the root is 15px (`Navigation.tsx:76`, `index.css:102`). They agree today, but a change to the root font size or to the bar class silently desyncs the sticky offset and the shell reserve.
- **Portfolio rows lose their column labels below 1024px.** The ledger head is hidden at `max-width: 1023px` and each row collapses to `minmax(0,1fr) auto` (`index.css:325-343`). The numbers keep their alignment but no label, so a row read at tablet width is a name followed by four unlabelled figures; the collapse is deliberate (section 8), the missing labels are not.
- **The all-assets table hides five of its eight columns behind an unmarked horizontal scroll at 390px.** The table keeps every column and scrolls sideways inside its container; five sit outside the initial view and nothing marks the region as scrollable, so a narrow reader does not know the contract spec columns exist (see section 8 on collapsing by collapse, not scroll).
- **Sora is loaded from `fonts.googleapis.com` in a self-hosted LAN app.** The font request leaves the network the app is built to run inside, so a machine without internet renders the fallback stack and the whole measured scale changes its metrics at once. The fix is a self-hosted subset served from the frontend, in the same change as the `@font-face` declaration.
- **`pointer: coarse` is the only trigger for the 44px floor.** Buttons, links, inputs, and `[role="button"]` reach 44px only under `(pointer: coarse)` (`index.css:569-575`); a touch laptop or pen reporting a fine pointer keeps the button's computed height, which is 22.5–30px by size. The floor is a target rather than a universal rule (section 11 item 2), and the modality query is why.
- **The payoff chart's strike line and break-even marker are unlabelled.** `PayoffChart.tsx` draws both verticals but names neither, so the reader has to infer which line is the strike and where the position turns profitable. This is the concrete instance of the unwritten data-visualisation spec above; labelling the two markers belongs in that spec, not in a one-off annotation.
- **Header risk status is inert.** On Overview the header prints `Pool health 67%` and `Reserve inefficient` as plain text beside a coloured dot; neither links to `/risk-analytics` and `Reserve inefficient` explains nothing. Measured at 1258x539 (`pages/PortfolioOverview.tsx:335-350`).
- **No keyboard path for cash transfer.** The drag handle on a portfolio row is a `div` with `aria-label` and `title` but no `role` or `tabIndex` (`pages/PortfolioOverview.tsx:141-155`), so the transfer gesture exists only for pointer users.
- **Overview ends in dead space.** At 1258x539 the content stops around 520px with the ledger's last row and the remaining ~280px of the workbench carries nothing; the row is a link but has no visible open affordance — no chevron, no hover cue.
- **Money inputs show raw values beside formatted read-only fields.** `Edit portfolio` and `MF edit portfolio` render `Initial capital` and `Cash buffer limit` as bare numbers (`7000`) while `Available cash` beside them reads `$7,006.00`, and the rule for typed inputs versus read-only money is unwritten, so the next screen will guess (`screens/EditPortfolioModal.tsx:317-330`, `screens/MFEditPortfolioModal.tsx:267`).
- **The zone table has an empty band under its head.** `ZoneGroupModal` leaves a blank row-height gap between the column heads and the first zone row; the shared grid is aligned (0px head/cell centre delta) but the spacing between them is not (`screens/ZoneGroupModal.tsx` `GRID_ROW` / `HEAD_CELL`).
