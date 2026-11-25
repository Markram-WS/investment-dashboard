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
- **Icon action (`IconButton`):** a 20px full circle with the 1px hairline, canvas fill and a 12px / stroke-width 2 icon at `--color-slate`. Hover takes ink text and an outline-coloured border; `danger` hovers `--color-danger-text`, `success` hovers `--color-success`, `aria-pressed` is brand-teal, disabled drops to 0.5. It is the only shape for a pencil, refresh, trash, tick or close inside a row or table cell — `AllAssets`, `ZoneGroupModal`, `PortfolioMutualFund` and the ladder's hover overlay all use it.
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

### All Assets Registry

The asset registry (`pages/AllAssets.tsx`, CSS `.at-head` / `.at-card` / `.at-tab` / `.at-znew`) is one page of one table, not a stack of group cards, and it is **two levels**: product identity rows inside broker sections that expand into their contract-symbol/quote rows. At 1258px it is a 44px `.at-head` band carrying the `Assets` title (`--fs-page-title`), the counts summary (`N identities · M contracts`), and, at the right edge, only the Auto toggle plus the manual-refresh circle (22.5px, rendered in manual mode); below it a toolbar with the type tabs (`All` / `Stock` / `Future` / `Option` / `Crypto`, `.at-tab` at the same 22px height and 11px type as the Active Trading view tabs) on the left and two `.at-znew` pills (`Sync from orders`, `+ New symbol`) on the right; then one `.at-card` holding the table.

- **One head, one table, two levels.** A single sticky column head (`top: 60px`, canvas fill, hairline foot) serves the whole page. Broker sections are rows inside the same `<tbody>`; a section row is 32px, surface-tinted, carries the collapse chevron, the broker code and its identity count (`DF · 6`), and is ordered by broker code with `Unassigned` last and rendered only when non-empty. There is no drag-and-drop. Product identity rows are 32px at 11px (`--fs-label`) with an expand chevron. Expanding a product fetches `/assets/symbols?product_id=` and renders its symbol sub-rows inside the same tbody, indented under the product (30px, seven columns: price symbol, sync symbol, contract kind/terms, price, change, updated, actions). A product with no symbols states that orders cannot resolve a contract spec.
- **Rows and identity.** The product row is the **underlying**: its identity column is the product ticker (11px/600 ink) plus an optional display `name` in slate when it differs. The contract sub-row is keyed by its own ticker, `price_symbol`. Name is edited only in the identity modal. `Edit identity` on a product opens the identity modal; `New contract for {ticker}` on a product opens the contract modal, and `Edit contract` on a symbol reopens it.
- **Tracks.** Product columns: Underlying 24%, Type 11%, Multiplier 12%, Margin 11%, Mode 11%, Source 11%, Contracts 10%, Actions 10% — the first column is the **Underlying** head (title: the product that owns these contracts), and Multiplier/Margin are the underlying's defaults, inherited by every contract that does not override them (their head titles say so). There is no Broker column; the broker is the section header. Type and Mode hide below `md`; Source hides below `sm`. Symbol sub-rows use their own seven columns (Price symbol, Sync symbol, Contract, Price, Change, Updated, Actions), with Contract and Updated hidden below `md`; the Contract cell shows the contract's effective `mult · rate` values with a `(default)` marker when either comes from the underlying. A hidden column leaves no blank track, so the page never gains horizontal scroll (verified at 1258px).
- **Feed actions.** A symbol row shows the refresh `IconButton` only when its product `source` is in `PRICE_SOURCES` (`yfinance`, `tfex`); `manual` (`-`) products have no feed action. The header's manual refresh calls `POST /assets/symbols/batch-update-prices`, and Auto repeats it every 10 minutes.
- **Contract spec.** Broker code, type, multiplier, margin rate, margin mode and source are **identity** values (underlying + broker + type); they are edited through the product modal, not in place, and a contract cannot override multiplier or margin rate. The symbol payload therefore always reports the identity values in `multiplier_effective` / `margin_rate_effective` with `multiplier_inherited` / `margin_rate_inherited` always `true` (a product without a value resolves to multiplier 1 / rate 0). The one contract-level margin value is `margin_per_contract`, used only by the `span` mode. The symbol row's Price is the one in-place cell: a 26px input through the shared `CONTROL_INPUT` saved by `PUT /assets/symbols/{id}/quote` (manual quote). `PUT /assets/products/{id}` and `PUT /assets/symbols/{id}` own everything else, and sending a non-null `multiplier_override` or `margin_rate_override` is `400 multiplier is set on the underlying + broker + type, not on the contract` / `400 margin_rate is set on the underlying + broker + type, not on the contract`.

### Asset Identity and Rename

The **product ticker** is the editable registry key, labelled **Underlying** — the product that owns the contracts; `name` is an optional display label edited in the same modal. Product Add/Edit (`+ New symbol` / `Edit identity`) is a 560px modal with compact rows and 26px controls: identity (Underlying | Name), classification (Broker | Default type), contract defaults (Default multiplier | Default margin rate | Default margin mode), and source; there is no Group field, because asset groups are retired from the UI. These are the identity values every contract uses — multiplier and margin rate cannot be overridden per contract. **Symbol Add/Edit** (`Add symbol` / `Edit contract`) is its own modal: identity (Ticker | Sync symbol), contract terms (Contract kind | Option type | Expiry date | Strike price), and Margin per contract (span) — multiplier and margin rate are not contract fields, because they belong to the identity. `sync_symbol` is required; `price_symbol` (labelled Ticker) may be blank for an option identified by its terms.

- **Key semantics.** The product ticker is the **underlying** — the registry's identity column and the value an order exposes as `underlying` (resolved through the order's own broker-scoped contract spec). `price_symbol` is the dashboard/order key an order's `asset_type` must match, so a contract row is keyed by its own ticker; `sync_symbol` is the case-preserving provider key used for quotes. The two may differ (`PTT` vs `PTT.BK`). The broker mirror on a symbol is internal and never rendered.
- **The identity owns the numbers.** The identity — underlying + broker + type — owns multiplier, margin rate, margin mode and source; a contract only owns its key (`price_symbol`), provider key, option terms and its `margin_per_contract` span value. There is no per-contract multiplier or rate override: the columns remain in the table for history, but they are never read for computation, and writing one through the API is refused. Every effective value therefore comes from the identity, and the payload's `*_inherited` flags are always `true`.
- **Empty is valid while scoped, and the default identity is a real owner.** An unassigned underlying (blank ticker) is a legitimate product whenever it is scoped by a broker or a type — Add accepts it, and create/update store `ticker: NULL`. The globally-unassigned triple (`NULL` ticker, `NULL` broker, `NULL` type) is the single internal default identity, with the documented values multiplier 1, margin rate 0, margin mode `notional`, source `-`. Product CRUD keeps it protected — creating or clearing a product to that identity is `400 Ticker is required`, and editing/deleting the row is `400 The default product is not editable` — but **the sync apply path may attach a contract to it**: a pair with no underlying, no broker and no type resolves to the default identity (reused when it exists, never duplicated), and a symbol may also be attached to it directly through the product's symbols route. Default-identity symbols deliberately carry no broker-scoped spec, so the Active Trading order guard still blocks orders for them while mapped portfolios keep working. The table renders an unassigned Underlying cell as an em dash (the row is not the default and stays editable); a product with no broker, a contract with no `price_symbol`, and an order whose symbol has no contract spec are likewise valid, and the order payload carries `underlying: ""`.
- **Validation.** `PUT /api/v1/assets/products/{id}` trims and uppercases the ticker; a blank ticker is accepted while the product keeps a broker or a type and is `400 Ticker is required` when that would leave the all-NULL default identity, and a duplicate product identity or broker-scoped normalized symbol collision is `400 An asset with this ticker already exists`. Margin fields are `400 multiplier must be greater than 0`, `400 margin_rate must be between 0 and 1`, `400 margin_mode must be one of notional, premium, span`; the default product is `400 The default product is not editable`. A blank symbol sync key is `400 sync_symbol is required`; a duplicate is `400 Symbol already exists`; a normalized dashboard-key collision names the owning product/broker; an option-identity conflict is `400 Option identity already exists` or `400 Option contract already exists on product {ticker} (product_id={id})`.
- **The rename moves the product ticker and its own symbols in the same transaction.** Scalar references keep the historical case-sensitive comparison — `active_orders.asset_type`, `trade_history.asset`, `transactions.asset`, `managed_fund_holdings.asset`, `managed_fund_orders.asset`, `managed_fund_order_history.asset`, `portfolios.product_ticker` — while `portfolios.product_tickers` uses normalized matching and preserves list order. Only this product's `asset_symbols.price_symbol` rows whose normalized value equalled the old ticker are rewritten; `sync_symbol` and quote keys are never touched. The cascade is main-DB only: a custom database's own orders/transactions are updated by a custom asset rename through the custom `/assets` route, not by a product rename. Mapped (foreign-schema) orders keep their own symbol and are not reconciled by the UI. Assigning or clearing the ticker is not a key-to-key rename: a blank side skips the cascade entirely, so order/ledger symbols are never nulled (clearing) and never claimed (assigning), and the product's own `price_symbol` rows keep their keys.
- **`name` follows only when it never diverged.** A rename rewrites `name` only while it was empty or identical to the old ticker; a custom name is preserved. The product row shows it only when it differs from the ticker, and the product modal edits it.
- **Broker is editable only while no symbols are attached.** Attached symbols make a broker change `400 Cannot change broker_id for product {ticker} (product_id={id}) while {n} symbols are attached`; ticker, type, source, multiplier, margin rate and margin mode remain mutable.

### Asset Groups (retired)

Asset groups are retired from the product. `screens/AssetGroupModal.tsx` no longer exists: there is no `+ New group` pill, no group rows, no drag-and-drop between groups, and no Group field in the identity modal — All Assets sections by broker instead. The `/api/v1/asset-groups` endpoints and the `asset_groups` / `asset_products.group_id` storage remain for compatibility only, but nothing in the UI reads or writes them: listing no longer seeds the `Ungrouped`/`Watchlist` defaults, and `asset_products.group_id` is no longer written.

### Price Sources (yfinance / TFEX)

A product's `source` picks the feed. Each symbol's `sync_symbol` is the provider key sent to that feed — stored trimmed, never uppercased, because provider symbols are case-sensitive (`PTT.BK`) — while `price_symbol` is the dashboard/order key orders match. Quotes are stored once per `(source, sync_symbol)`, so two symbols sharing a provider key share the quote row. `manual` (`-`) products are never fetched; `update-price` only refreshes `updated_at`. The `PRICE_SOURCES` allow-list (`yfinance`, `tfex`) gates both the symbol refresh buttons and the batch endpoint.

- **yfinance** — Yahoo Finance over direct HTTP (`services/yfinance_service.py`, no `yfinance` library) to avoid rate limiting.
- **TFEX** — the public quotation API (`services/tfex_service.py`). `sync_symbol` accepts a plain series code (`S50Z26`, `USDX26C34.00`) or a product-page URL; the URL parser takes the segment before `/intraday`. The quotation page is warmed once so Incapsula issues its cookies, and a blocked or non-JSON answer is retried once after a forced re-warm. Quotes are delayed (roughly 15 minutes), not live ticks.
- **Quote fallback.** `parse_quote` takes `last` when positive, then the bid/offer mid, then `settlementPrice`, then `priorSettlementPrice`; `percentChange` is used when present, otherwise computed against the prior settlement. A series with none of those is "no usable quote".
- **Failures are fixed sentences.** Unknown or expired series, no usable quote, and a blocked request are raised as fixed messages and surfaced by `update-price` as HTTP 502; batch refresh skips the symbol. The All Assets symbol-row refresh shows the server `detail` for that row, not a generic message. `POST /assets/apply` provider fetches are best effort and leave an existing/null quote when they fail.
- **Sync from orders is a proposal, never a write.** `GET /assets/proposal` lists order symbols (main, owned-custom, mapped; never Managed Fund) with same-broker product choices or a create default, and marks `resolved: true` when a symbol in that broker scope already owns the normalized dashboard key (`price_symbol` normalized like the pair key; brokerless pairs compare against products with no broker). `resolved` is informational — the row stays assignable. The create default carries only the normalized order **symbol** (`create: {symbol}`) — that is the contract key, never an underlying: an order stores only the symbol, so the dashboard never infers the price source or provider key; the user supplies the source and the provider symbol, and optionally the underlying (`create_underlying`, trimmed/uppercased like every ticker; blank stores `NULL`) and the asset type (`create_asset_type`, a blank/absent value means the identity has no type — not a guess), and `order_asset_types` is a read-only hint from the orders behind the pair, never a default. A create writes the product with `ticker = create_underlying` (identity values: multiplier 1, margin rate 0, mode `notional`, source = the explicit source) and the contract row with `price_symbol = <order symbol>`, `sync_symbol` = the explicit provider key and `contract_kind` = the explicit asset type (`future` when the identity has no type); the duplicate-identity precheck is the underlying + broker + asset type (`400 An asset with this ticker already exists`) for a scoped identity, while symbol-owner collisions are still checked against the order symbol. A pair with no underlying, no broker and no type resolves to the reserved **default identity** instead of erroring: the seeded default row is reused (or recreated with multiplier 1 / margin rate 0 / mode `notional` / source `-`), never duplicated, and a contract may attach there. A wrong provider key still saves the row but its price never loads; `manual` marks a no-feed product. `POST /assets/apply` writes only the explicit per-row choices, one of `product_id` or `create_product=true`; an existing-product choice takes the new symbol's `contract_kind` from that product's asset type (`stock`/`future`/`crypto`), while an option product (`400 Add the option contract in All-assets — a sync row has no expiry, strike or type`) and a product without an asset type (`400 Set the asset type of product {ticker} in All-assets before syncing`) are refused unguessed before any write and must be completed in All Assets; brokerless Active Trading pairs stay blocked until a broker is set. A mapped portfolio's dashboard-local option orders are ordinary main `active_orders` rows, so the main-order source already sees their symbols — the proposal itself never creates the option spec; that broker-scoped spec must be added in All Assets before the hybrid option path accepts a create (see **The Hybrid-Mapped-Options Rule**). The removed `sync-from-orders`/`sync-from-all` routes answer 404.

### Performance Charts

`PerformanceSection` toggles the equity line (`PerformanceChart.tsx`) and the payoff view (`PayoffChart.tsx`). The payoff chart uses the equity surface's canvas and hairline grid, with 10.5–11px slate axis labels and the 11px `--fs-label` heading/tab chrome. It enters with mount-only CSS motion: the line draws over 700ms (`payoffLineDraw`), the area, IV line and break-even group fade in at 220–250ms with 120–180ms delays, all `cubic-bezier(.22,.9,.3,1)` with `backwards` fill. The break-even group is one always-rendered `<g>`, so a range change re-renders its markers without replaying the fade; `prefers-reduced-motion` removes all four.

### Transaction Ledger

The ledger page (`pages/TransactionsPage.tsx`) keeps the shared table shell, but every column head and data cell is 11px (`--fs-label`); amounts use tabular figures. From/To appear at `md` and Executed by at `lg`. It is a record table, so it keeps its page padding rather than the registry's 32px row.

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

### Pool Rail

The pool rail above the workspace is fed by the risk block on the portfolio detail response (`backend/app/risk_calc.py`, exposed as `risk` on `GET /analytics/portfolio/{id}`). `Total value` = `available_cash + margin_locked + Σ unrealised P/L` — realised P/L is already inside the cash balance, and notional is exposure rather than equity, so neither is added. Buffer coverage is `available_at_x / max(cash_buffer_limit, 1)`, and the rail's `of which profit` figure is realised P/L (Σ `trade_history.realized_pl`, the performance endpoint's `total_pl`) plus open P/L (`risk.pl_total`), expressed over `initial_capital` to one decimal — e.g. `+$6.00 (0.1% of initial)`. The parenthetical is dropped once that ratio rounds to `0.0%`, since a few dollars on a large base says nothing.

### Overview Totals Strip

The summary block a dashboard page starts with: a canvas card sitting on the surface page body.

- **Shape:** 12px radius. Padding is `--strip-pad-y` / `--strip-pad-x`: 14px vertical and 18px horizontal at every width. Bottom margin is `--strip-mb`: 24px.
- **Grid:** three tracks, `minmax(0,300px) 1px minmax(0,1fr)`, 20px gaps (`--ledger-gap`), items vertically centred. The 1px track is a hairline divider and exists only at 1024px and up; below 1024px the tracks stack with the same 20px gap and the divider is removed.
- **Left column:** an 11px slate label, then the primary datum at 19px with the cents at 0.6em in slate, then a P/L percent chip, then micro stats (10px label over a 13px value) for P/L and Deployed.
- **Right column:** an 11px slate label plus a 28px liquidity bar whose segments carry their own name and value, dropping both lines under 104px of segment width. 28px clears the 26px the two stacked lines need at line-height 1.15. The labelled bar reveals left-to-right once on mount with a 650ms `clip-path` (`cubic-bezier(.22,.9,.3,1)`, `backwards` fill); later data changes only transition the segments' `flex-grow` over 450ms and never replay the reveal, because React keeps the same node. The 6px bars in the portfolio ledger rows are unlabelled and never reveal. `prefers-reduced-motion` disables both the reveal and the segment transition.
- **Threshold data:** data that used to live in a legend under the bar belongs in the `title` and `aria-label` of the status dot that reports it.

### Inputs & Fields
- **Fields are built from `Field.tsx`, not hand-rolled label/control pairs.** `Field` renders the `CONTROL_LABEL` label (with the app's ` *` required marker), the control, and optional `CONTROL_HELPER` hint / danger error line with the matching `aria-describedby`; `TextInput`, `NumberInput`, and `SelectInput` are the only field controls. The guard is the `no-restricted-syntax` override in `frontend/eslint.config.js`, which errors on a numeric `fontSize` (a number or numeric string such as `15`, `'15px'`, `` `15px` ``) while token references such as `var(--fs-label)` pass; the guard applies to `src/**`.
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
| Table head | 11 / 500 | `AllAssets.tsx` `headCell` |
| Caption — portfolio-type card description only | 9 | `--fs-caption`, `index.css:99` |
- **Every control value is a token.** The module reads the type ladder and control geometry from `:root` (`index.css:90-110`): control label/field/button `var(--fs-label)` = 11px (`--control-fs-label` is the alias token), the read-only value `var(--fs-body)` = 13px; field padding `var(--control-pad-y) var(--control-pad-x)` = 4px 8px, radius `var(--control-radius)` = 8px, min height `var(--control-h)` = 26px; pill buttons `var(--control-btn-pad-y) var(--control-btn-pad-x)` = 3px 10px at `var(--rounded-full)`. One edit in `:root` changes every control; no screen or module re-derives a number. The `@media (pointer: coarse)` 44px floor (`index.css:520-524`) is untouched — density tokens never scale below it.
- **Screens bind the module.** `TransferModal.tsx:5-7` rebuilds the cash-transfer modal (title `CONTROL_TITLE` 15px, From/To `CONTROL_VALUE` 13px `var(--fs-body)` — one step above control text, below content, so the value reads as the datum and not as its own label; amount `CONTROL_INPUT`; Max/Cancel/Confirm `CONTROL_BUTTON_SECONDARY` / `CONTROL_BUTTON_PRIMARY`). `CreateNewPortfolio.tsx:7-10` binds it for every label, field, helper, and action (`CreateNewPortfolio.tsx:366`, `:376`, `:450`, `:539`). `AllAssets.tsx` binds `CONTROL_INPUT` for the in-place price and spec editors; the table head and every body cell are 11px/500 (`var(--fs-label)`) on 32px rows (`headTh` / `cell`), and the numeric cells use tabular figures.
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

### Select Input (in-page combobox)

`SelectInput` (`screens/components/Field.tsx`) is an in-page combobox, not a native `<select>` control: the native popup does not open in this environment. The trigger is a 26px button at the shared control scale (hairline, 8px radius, canvas, 11px label) with a trailing chevron; the listbox is portalled to `document.body` with `position: fixed` and `z-index: 10000`, so it paints above a modal instead of being clipped by it. Width is clamped to 160–320px, option rows are 26px, and the menu opens downward or flips up when the space below is insufficient.

- **Keyboard.** Arrow keys move the active option (opening the list when closed), Home/End jump, Enter/Space select, Escape closes only the list (the modal stays open), Tab closes and moves on, and printable characters run a 600ms typeahead.
- **ARIA.** The trigger is `role="combobox"` with `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`; options are `role="option"` with `aria-selected`/`aria-disabled`.
- **Pointer and viewport.** An outside mousedown closes the list; scroll and resize reposition it (flipping when needed) rather than closing it, and a press commits a value exactly once. Selection returns focus to the trigger.
- **API.** `value` / `defaultValue` / `onChange({ target: { value } })` and `<option>` children are preserved, so existing call sites did not change.

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

**The One-Registry Rule.** The All Assets page is one `.at-card` table with one sticky head and two levels. Broker sections are 32px section rows inside the same `<tbody>` — each a collapse control — never a card or a second table per broker, so the head and its column tracks appear once. Product identity rows are 32px and expand in place to their symbol/quote sub-rows, also inside the same tbody; the symbol rows are not a second table. A broker with no identities renders no section at all. Column tracks are percentages on the `th`; a column hidden at `md`/`sm` leaves no blank track, and the page never scrolls sideways.

**The Above-The-Fold Rule.** The app shell reserves the 60px nav (`main` is `min-h-[calc(100vh-60px)]`); a dashboard page at a 1258x575 viewport must show header, strip, heading, and its rows with no page scroll, which is what the Overview measures today (`scrollHeight` 575 = `clientHeight`).

**The Row Anatomy Rule.** Table rows are 44px minimum at every width (`--row-h`), with a dense variant at 38px (`--row-h-dense`); 44px is also the interactive floor. A row's second line exists only to carry a `status_message` — the tag row above already states the portfolio type and bot management, so repeating them there is not allowed. The head is sticky, and both keep their hover and focus-visible states.

**The Converge-On-Overview Rule.** Pages converge on Overview; a new page that needs a summary block uses the totals strip before inventing a new layout.

**The Detail-Grows-With-Its-Rows Rule.** The Active Trading portfolio detail (`screens/PortfolioGrid.tsx`, route `/analytics/portfolio/:id`) is a workstation, not a page of stacked cards: `.at-page` sets `min-height: calc(100dvh - 60px)` with `margin-block: -16px`, `-20px` at `md` and leaves the overflow visible, so it is exactly one screen while the ladder is short and grows downward as rows are added — 12 rows measure a page 1078 tall with document `scrollHeight` 1137 against a 720 viewport, so the scroll is on the document, never inside the ladder. The composition is a 44px header band, an 84px pool rail, then a `minmax(0, 808px) 408px` workspace with a 12px gap: left, order detail (height 26 + 4 + 47 + N×31 + 17 of padding) above order history (32px collapsed disclosure, 138px open); right, payoff (min-height 396px), with `.at-col.at-right { align-self: start }` so the chart never stretches to the ladder's height. The ladder is one row per price level at `--row-h-ladder`, built from `orders_groups` ranges (`max_price` down to `min_price` by `range`); orders whose `entry_price` falls between levels take the nearest level at or above it, and a level holding several legs emits one row per leg with the mark printed once. At 1280×720 the detail card is 735×468 with a 705-wide ladder inside 9/14/8 padding.

**The Managed-Fund-Workstation Rule.** The Managed Fund detail (`screens/PortfolioMutualFund.tsx`, route `/managed-fund/:portfolioId`) reuses that shell instead of inventing a page of cards: the same 44px `PortfolioHeader` band and an 84px four-KPI rail (NAV, available cash, total invested, unrealized P/L; 11px labels, 19px tabular values, 10px foot lines), then a `minmax(0, 808px) minmax(0, 408px)` workspace with a 12px gap. Left is holdings above order in progress; right is rebalance, alerts, and order history. Every card is `.at-card`, values are 11px (`--fs-label`) and rows a compact 32px, and the scroll is on the document, never inside a card. The rail stays four cells above 1023px; at 1023px or below it becomes a 2×2 grid and the workspace collapses to one column. The alerts card renders only when the fund reports an alert; it is not an empty placeholder.

**The Shared-Header Rule.** Reusing `PortfolioHeader` carries one quirk: it prints the title as `<portfolioName> Overview`, so a Managed Fund page reads "<name> Overview" too. A detail page adds its primary action through the optional `extraActions` slot rather than forking the header — the Managed Fund passes its Rebalance button there, so both workstations keep the same band actions and metrics.

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
| Disabled | per screen; `SelectInput` has a real disabled state (opacity 0.55, `cursor: not-allowed`, list cannot open); text/number inputs still rely on the screen | `Field.tsx` `SelectInput`, `CreateNewPortfolio.tsx:307-314` |
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

### All-assets Product and Symbol Rows

| State | Visual change | Where |
|---|---|---|
| Resting product | ticker 11px/600 ink with optional slate `name`, broker code, type, multiplier, margin rate, margin mode, source and symbol count in 32px hairline-footed cells; none of the spec cells is editable in place | `AllAssets.tsx` `ProductRow` |
| Expanded product | the chevron rotates; `/assets/symbols?product_id=` loads indented 30px sub-rows (price symbol, sync symbol, contract, price, change, updated, actions); an empty product states orders cannot resolve a spec | `AllAssets.tsx` `SymbolRows` |
| Resting symbol price | numeric quote at 11px (`--fs-label`) tabular figures; clicking swaps to the edit input | `AllAssets.tsx` `SymbolRows` |
| Editing symbol quote | the cell becomes a number input derived from the shared `CONTROL_INPUT` — 11px ink on canvas, 1px hairline, `var(--control-radius)` — autofocused; focus is the global accent ring, never a teal border | same |
| Commit quote | Enter or blur saves through `PUT /assets/symbols/{id}/quote`; an invalid or empty entry leaves the stored value untouched | same |
| Cancel | Escape closes the input without saving | same |
| Refresh symbol | the refresh icon appears only when the product `source` is in `PRICE_SOURCES`; clicking calls `POST /assets/symbols/{id}/update-price` and spins during the request | same |
| Failure | a warning toast names the symbol/ticker and shows the server `detail`; the old value stays | `AllAssets.tsx` `handleRefreshSymbol` / `handleSaveQuote` |
| Product edit | opens the product modal; a ticker rename submits and the backend cascades it. Changing broker while symbols are attached shows the inline warning and the API returns the symbol-count 400 | `EditAssetModal.tsx` |
| Heads | never wrap: fixed percentage tracks on every `th`, with hidden columns leaving no blank track | `AllAssets.tsx` thead |

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

**The Skeleton-Not-Text Rule.** Every page's loading state is a pulse skeleton shaped like the content it replaces; a bare `Loading…` line is a violation. On the same build, Overview and Transactions rendered bare `Loading…` text while Managed Fund already used pulse skeletons — the rule is conformance, not a new pattern, and the skeleton stands in for the block (strip, rows, chart) rather than a generic spinner.

**The Compact-Empty Rule.** An empty region is one block no taller than 120px, carrying one primary action and one sentence that teaches the next step. Three stacked full-width empty cards are forbidden: `/managed-fund` with no data rendered three, roughly 420px of chrome at a 720px viewport for a page with nothing to show. An unpopulated ladder level renders blank, never a dash — a dash means "known value, missing" — so the 97 low-contrast `—` nodes painted into every empty price level on one dark-mode page made an empty column read as broken data.

**The Filled-Width Rule.** Content fills the `max-w-[1200px]` shell. A form page is either centred or a two-column layout with a summary rail, and a left-anchored card may never leave a dead column wider than roughly 15% of the content width. On `/create-portfolio` at 1258x700 a `max-w-3xl` card (720px) sat in a 1258px main, leaving 486px empty while the document grew to 1283px and pushed the submit to y=1190..1241 — two screens below the fold. The dead column is what forced the height.

**The English-UI Rule.** All UI copy is English, whatever the user's locale or the author's language — helper text, labels, and empty states included. Developer strings never ship: `yfinance symbol patterns` and `1 asset in 2 groups, manual refresh` describe the implementation, so a user reading them learns the schema instead of the task. A string the user cannot act on is not UI copy.

**The Verified-Viewport Rule.** Supported viewports are 1258x555 (the real-user floor: 1920x1080 scaled 1.5 inside a window), 1258x700, 1024x768, and 1440x900. Every page and every modal ships screenshot-verified at all four, with no horizontal overflow, the primary action reachable without scrolling the overlay, and the page's first actionable row above the fold. Desktop is the primary surface; a phone layout must not break but is not a target, which is why section 8 collapses the tables rather than fitting them.

**The Read-Through Rule.** A Custom Portfolio whose `custom_portfolio_connections.mapping_config` is non-null is a view over the foreign rows, not a store of ours: the mapping JSON is the whole contract between the two schemas — `validate_mapping` refuses anything but version 1 with `orders` and `account` entities (`history` optional), valid SQL identifiers, and column-or-map column specs, and a quoted identifier in the config is the only way a column is ever named. Foreign active orders are the one writable foreign entity and only when `entities.orders.write` is present: `insert` maps canonical fields through `write.columns` (with literal `defaults` and `values` translations), `update` touches only mapped columns, and close / cancel insert a row into `write.history` and delete the open row in one transaction. The row key is the broker's uuid `id` (surfaced as `order_id`, with `orderno` as `order_ref`). Everything else — link/unlink, zone and group assignment, assets, trade plans, trade history, ledger transactions, cash transfers — still answers `409` through `raise_if_mapped_readonly`, and a config without a `write` block keeps the old read-only behaviour. The grid therefore reports `read_only`, `mapping_template`, and the store-scoped `order_writes` (`{mapped: <insert/update/delete/fields/key_generated> | null, dashboard_options: {insert, update, delete}}`), and the surface renders mapped order affordances only from `order_writes.mapped` while dashboard-local option affordances read `order_writes.dashboard_options`. A mapped portfolio that trades options is the one hybrid case — see **The Hybrid-Mapped-Options Rule**.

**The Hybrid-Mapped-Options Rule.** A mapped Custom Portfolio (`is_custom=true` and `mapping_config` non-null) is hybrid only for options; every other type keeps its current storage. An order is local when its own normalized `contract_type` (lowercase/trim) equals `option` — never `asset_type`, a registry field, or `AssetProduct.asset_type`. A mapped option `POST /orders` writes dashboard PostgreSQL `active_orders` + the main default `trade_plan` after the strict Active Trading precondition (portfolio `broker_id` and a broker-scoped `AssetSymbol.price_symbol` spec, with the existing `400 Assign a broker…` / `400 No contract spec…` messages); the portfolio remains `port_type="Custom Portfolio"`. Every non-option mapped create keeps the foreign writer and its `write.columns`/`_writable_values` checks, so an option payload never reaches mapped write capabilities even when the config is read-only. Reads never copy or cache: mapped order lists are the foreign rows plus dashboard rows whose normalized `contract_type` is `option`; history and performance are the foreign history plus dashboard `trade_history`; risk combines both. Active-order rows carry `order_source="dashboard"|"mapped"`, history rows carry `history_source` plus a string `history_key`, and identity is the pair `(source, id)` — never a bare id. Active rows sort by `created_at` descending (nulls last), dashboard before mapped, then `order_id` ascending; history sorts by `exit_date` descending (nulls last), dashboard before mapped, then `history_key` ascending, and `offset`/`limit` apply after the union. The local key is `str(history_id)`; a mapped key is `str(mapped history_id)` when the mapping supplies one, otherwise a deterministic fingerprint of normalized `order_id`, dates, asset, type, quantity, and exit price with a duplicate-occurrence ordinal assigned after the stable sort. Because ids are only unique inside one store, every mapped `GET /orders/{id}`, `PUT`, `PATCH /status`, and `POST /close` requires `?order_source=dashboard|mapped`: a missing/unknown value is `400 Order source is required for a mapped portfolio: dashboard or mapped`, an absent row in the named store is `404`, and no route ever probes or falls back to the other store. A key the foreign row-key column cannot encode (asyncpg/SQLAlchemy `DataError` or `StatementError` from binding a local-style id into a UUID column) is treated as absent in that store and therefore `404`; a genuine connection failure is never converted to `404`. Dashboard-source close/cancel deletes only its main `active_orders` row and inserts one main `trade_history` row in one transaction; mapped-source close/cancel keeps the foreign transaction. When the connected read fails, analytics still serves dashboard-local option orders/history, sets `load_error`, advertises `mapped: null` with `dashboard_options` still true, and computes margin from the stored portfolio value plus the local option margin; connected rows reappear on recovery. The local margin uses only dashboard option rows and the same broker-scoped notional/premium/span formula, summed once with the foreign account `margin_locked`; foreign rows are never recomputed and local non-options never contribute. No new table, column, migration, or row copy exists for this path.

**The Product-Ticker-Is-The-Key Rule.** The product ticker is the editable registry key the UI renames; `name` is an optional display label edited in the product modal. A rename stays inside the main DB: it moves the product, its own `asset_symbols.price_symbol` rows whose normalized value equalled the old ticker, and the main-DB tables that carry a copy of the symbol (`active_orders`, `trade_history`, `transactions`, the three `managed_fund_*` asset columns, and `portfolios.product_ticker`, plus normalized entries of `portfolios.product_tickers`); `sync_symbol` and quote keys never move. Custom-database orders/transactions are not touched by a product rename — they follow only a custom asset rename through the custom `/assets` route. Mapped rows live in the broker database and keep their own symbol. Because the scalar ledger tables have no `broker_id`, that part updates by ticker across every broker — see §12.

**The Two-Symbol Rule.** A symbol carries two distinct keys: `price_symbol` is the dashboard/order key an order's `asset_type` must match, while `sync_symbol` is the provider key sent to the quote feed and stored trimmed, never uppercased (provider symbols are case-sensitive, e.g. `PTT.BK`). Quotes are keyed by `(product.source, sync_symbol)`, so symbols sharing a provider key share one quote. `source` is the only switch that picks the feed (`yfinance`/`tfex`); both refresh endpoints read the same `PRICE_SOURCES` list, and `manual` (`-`) products are never fetched. A TFEX series that has no last trade falls back to the bid/offer mid, then settlement, then prior settlement, and computes the percent change against the prior settlement when the payload omits it.

**The Proposal-Not-Auto-Sync Rule.** Order symbols never enter the registry implicitly. `GET /assets/proposal` reads distinct normalized active-order symbols from main, owned-custom, and mapped portfolios (never Managed Fund holdings/history) and offers same-broker product choices or a create default; each item also reports `resolved: true` when a symbol in that broker scope already owns the normalized dashboard key, which the modal labels `has spec` without disabling the row (it can still be reassigned; brokerless pairs match products with no broker, the default identity included). Nothing is written until the user submits explicit choices to `POST /assets/apply`, exactly one of `product_id` or `create_product=true` per pair. The create default is the normalized order symbol only (`create: {symbol}` — the contract key, never an underlying): an order stores only the symbol, so the dashboard cannot infer whether it is a TFEX series or a Thai stock, and the user supplies the price source and the provider symbol because a wrong provider key would save a row whose price never loads. The underlying and the asset type are separate explicit choices: the product gets `ticker = create_underlying` (trimmed/uppercased; blank → `NULL`) and `asset_type = create_asset_type` (blank/absent → `NULL`, meaning no type, never a guess), while the contract row gets the order symbol as `price_symbol`. A pair with no underlying, no broker and no type is the reserved default identity: apply reuses the seeded default row (multiplier 1 / margin rate 0 / mode `notional` / source `-`), creating it only if missing and never a second one, and a contract may attach there — such symbols carry no broker-scoped spec, so Active Trading orders stay blocked while mapped portfolios work. Duplicate identity is checked on underlying + broker + asset type (`400 An asset with this ticker already exists`) for a scoped identity; symbol-owner collisions stay keyed on the order symbol. `manual` marks a no-feed product, and `order_asset_types` hints at the types recorded on the orders without ever defaulting them. A brokerless Active Trading pair is blocked until a broker is set. A mapped portfolio's dashboard-local option orders are ordinary main `active_orders` rows, so the main-order source already sees them; the proposal is not where the broker-scoped option spec is created — that setup happens in All Assets before the hybrid option path accepts a create. The old `sync-from-orders`/`sync-from-all` routes return 404, and no mount-time sync runs.

**The Product-Spec-Margin Rule.** Only a local `Active Trading` portfolio recomputes `margin_locked`, per order, from the broker-scoped symbol/product spec; every other portfolio type (and a DB-less calculation) returns the stored value unchanged, so registry edits never move their overview sums. The one additive exception is the hybrid mapped path: dashboard-local option rows contribute margin from the same broker-scoped formula, summed once with the foreign account `margin_locked` (or the stored fallback when the connected read is down); mapped foreign rows are never recomputed and local non-options never contribute. Missing broker/spec/mark/qty contributes zero, options are included, and the order's stored `margin_rate` is ignored. Exactly one product `margin_mode` formula applies: `notional` = mark × effective multiplier × qty × effective rate, `premium` = mark × effective multiplier × qty, and `span` = qty × `margin_per_contract` when set, else the premium value; effective multiplier/rate come from the identity (underlying + broker + type) only, because a contract cannot override them. The same registry is the order guard: a local non-custom Active Trading create (and an update that changes `asset_type`) requires a broker-scoped symbol, returning `400 Assign a broker in Edit portfolio before adding orders` for a NULL broker or `400 No contract spec for {SYMBOL} on broker {CODE} — add it in All-assets first`; updates resolve the portfolio from the loaded order's own `portfolio_id`, and custom/other-portfolio-type branches bypass the guard. A mapped portfolio's local option create and asset-changing edit apply the same broker/spec guard explicitly, without relabeling its `port_type`.

**The One-Time-Conversion Rule.** The legacy flat `whitelist_assets` table is never a runtime registry. On startup one transaction creates the three registry tables and the internal default product, converts legacy rows to exactly one product + one symbol plus quotes, asserts the invariants, and drops the legacy table; a database without the table skips the whole legacy branch, repeated starts are no-ops, and a failed preflight/assertion rolls back with the legacy table intact. `Base.metadata.create_all` excludes both the legacy and registry tables.

**The In-Page-Listbox Rule.** A select never relies on the native popup. `SelectInput` is a combobox button plus a body-portalled `position: fixed` listbox (z-index above modals), with the full keyboard/ARIA contract; scrolling or resizing repositions it rather than closing it, and Escape closes only the list, never the modal.

## 11. Iteration Guide

1. Change the token or the component in code first, then update this document in the same commit. `6c1760b` is that pair: it changed `DESIGN.md`, `frontend/src/index.css`, and `frontend/src/pages/PortfolioOverview.tsx` together.
2. Never document a value the code does not set. When a value is a target rather than an implementation, mark it as a target: the 44px floor is a coarse-pointer rule (`index.css:569-575`), not a universal one.
3. Every interactive element ships resting, hover, pressed, and focus-visible, or says "not implemented" in section 9. Today the nav pill itself has no hover (background and colour are inline styles with no hover variant), while its icon scales to 1.12 (`index.css:561-566`, `Navigation.tsx:106`); no input has an error state, and no button renders a loading spinner.
4. New pages converge on the Overview composition before adding a new layout (section 6). The totals strip is the first block of a dashboard page, and its geometry is set at `PortfolioOverview.tsx:311-400`.
5. Measure contrast on the composited background, not on the raw token. A chip's fill is a `color-mix` result over its container (`index.css:257`); pale ink `#e8e8e8` (`index.css:110`) on the solid warning fill measures 1.20:1 (measured from the token values), which is why the pressed state switches to `--color-on-brand-yellow` (`index.css:342-345`).
6. Keep the frontmatter machine-readable: a new token goes into the frontmatter and into `frontend/src/index.css` in the same change. The frontmatter `colors` and `components` blocks mirror the `:root` variables (`index.css:10-90`).

## 12. Known Gaps

- **Dark mode is not enumerated per token.** `.dark` redefines 31 properties (`index.css:110-148`), including canvas `#13131f`, ink `#e8e8e8`, and all three pastel tints. Section 2 describes the intent and names three examples; the full mapping exists only in CSS.
- **Data visualisation has no spec.** `PayoffChart.tsx` renders hand-rolled SVG with local margins, gridline colours and stroke widths; the equity curve delegates to `ztd-charts` (`PerformanceChart.tsx`) through `useChartTheme`. Nothing documents axis, tick or series treatment, and the `donutDraw`, `lineDraw`, `barGrow` keyframes (`index.css:464-482`) are dead CSS that no component binds. The payoff entry motion is documented in §5 (Performance Charts).
- **Motion has no duration scale.** Easing is tokenised (`index.css:488-492`), but durations are literals at the call sites: 120ms (`index.css:340`, `index.css:385`), 150ms (`index.css:160`), and 200ms, 250ms, 300ms for the animation classes (`index.css:607-620`). A new component has no duration token to reach for.
- **Several states are not implemented.** `TextInput` and `NumberInput` have no error, disabled, or loading state (only `SelectInput` and the per-screen submit buttons have a disabled state); no button renders a spinner (`Button.tsx:6`, `Button.tsx:39`); no ledger row has a selected or disabled state; the nav pill itself has no hover, since its background and colour are inline styles with no hover variant, though the icon inside it scales to 1.12 (`index.css:561-566`, `Navigation.tsx:106`).
- **Dead CSS outnumbers live CSS in places.** `.input` (`index.css:238-248`), `.nav-link` (`index.css:305-319`), `.badge` and its variants (`index.css:170-188`), and `.portfolio-grid` (`index.css:477-485`) are bound by no component. The shared fields in `Field.tsx` now cover the modals, but 21 raw `<input>` elements remain across six screens, so the control scale still has a per-screen tail.
- **Components outside Overview are undocumented.** `TradeHistoryTable`, `ZoneGroupModal`, and `OptionsStrategyTable` ship their own padding, type sizes, and states; section 5 covers the Overview set and the detail-page components, and section 6 records the detail page's geometry rules.
- **Three places hardcode 60px for the nav while the bar derives its height from a rem class.** `main` reserves 60px (`GlobalLayout.tsx:8`), `.ledger-head` sticks at `top: 60px` (`index.css:286`), and `h-16` renders 60px only because the root is 15px (`Navigation.tsx:76`, `index.css:102`). They agree today, but a change to the root font size or to the bar class silently desyncs the sticky offset and the shell reserve.
- **Portfolio rows lose their column labels below 1024px.** The ledger head is hidden at `max-width: 1023px` and each row collapses to `minmax(0,1fr) auto` (`index.css:325-343`). The numbers keep their alignment but no label, so a row read at tablet width is a name followed by four unlabelled figures; the collapse is deliberate (section 8), the missing labels are not.
- **Sora is loaded from `fonts.googleapis.com` in a self-hosted LAN app.** The font request leaves the network the app is built to run inside, so a machine without internet renders the fallback stack and the whole measured scale changes its metrics at once. The fix is a self-hosted subset served from the frontend, in the same change as the `@font-face` declaration.
- **`pointer: coarse` is the only trigger for the 44px floor.** Buttons, links, inputs, and `[role="button"]` reach 44px only under `(pointer: coarse)` (`index.css:569-575`); a touch laptop or pen reporting a fine pointer keeps the button's computed height, which is 22.5–30px by size. The floor is a target rather than a universal rule (section 11 item 2), and the modality query is why.
- **The payoff chart's strike line and break-even marker are unlabelled.** `PayoffChart.tsx` draws both verticals but names neither, so the reader has to infer which line is the strike and where the position turns profitable. This is the concrete instance of the unwritten data-visualisation spec above; labelling the two markers belongs in that spec, not in a one-off annotation.
- **Header risk status is inert.** On Overview the header prints `Pool health 67%` and `Reserve inefficient` as plain text beside a coloured dot; neither links to `/risk-analytics` and `Reserve inefficient` explains nothing. Measured at 1258x539 (`pages/PortfolioOverview.tsx:335-350`).
- **No keyboard path for cash transfer.** The drag handle on a portfolio row is a `div` with `aria-label` and `title` but no `role` or `tabIndex` (`pages/PortfolioOverview.tsx:141-155`), so the transfer gesture exists only for pointer users.
- **Overview ends in dead space.** At 1258x539 the content stops around 520px with the ledger's last row and the remaining ~280px of the workbench carries nothing; the row is a link but has no visible open affordance — no chevron, no hover cue.
- **Money inputs show raw values beside formatted read-only fields.** `Edit portfolio` and `MF edit portfolio` render `Initial capital` and `Cash buffer limit` as bare numbers (`7000`) while `Available cash` beside them reads `$7,006.00`, and the rule for typed inputs versus read-only money is unwritten, so the next screen will guess (`screens/EditPortfolioModal.tsx:317-330`, `screens/MFEditPortfolioModal.tsx:267`).
- **The zone table has an empty band under its head.** `ZoneGroupModal` leaves a blank row-height gap between the column heads and the first zone row; the shared grid is aligned (0px head/cell centre delta) but the spacing between them is not (`screens/ZoneGroupModal.tsx` `GRID_ROW` / `HEAD_CELL`).
- **A mapped portfolio's foreign orders keep their own ticker during a local rename.** The cascade in `registry.rename_product_references` touches only the local tables and the renamed product's own `price_symbol` rows; a mapped portfolio's connected orders live in the foreign broker schema and are never rewritten, so after renaming the product ticker that portfolio still displays the broker's symbol and no longer matches the registry row by ticker. Dashboard-local option rows on the same portfolio are ordinary main `active_orders` and do follow the local rename. No UI surface reconciles the two symbols.
- **A rename cascades by ticker across every broker.** The local ledger tables that carry a copy of the symbol — `active_orders.asset_type`, `trade_history.asset`, `transactions.asset`, and the three `managed_fund_*` asset columns — have no `broker_id`, so a rename updates every row with the old ticker rather than only the rows belonging to the renamed product's broker. Two brokers holding the same ticker therefore move together.
- **The header Total P/L tile is realised-only, and a mapped portfolio's tile is now the union's realised total.** The tile takes `performanceData.total_pl` (`PortfolioGrid` → `PoolRail`), and the performance endpoint sums realized rows from dashboard `trade_history` plus the connected mapped history (`backend/app/routers/performance.py`). A foreign read failure falls back to dashboard-local rows only; the analytics banner, not the performance payload, carries the degraded state. Open P&L — summed from local prices, not the foreign mark — remains outside this tile.
- **Mapped money is formatted as USD although the values are THB.** `formatMoney` defaults to `currency = "USD"` (`frontend/src/utils/format.ts:23`) and every call site passes the amount alone, so a TFEX equity of 248,000 THB renders `$248,000.00`. The account mapping (`equity`, `excessequity`, `initialmargin` from `usd_pct_abc.account_history`) has no currency column to read, so nothing on the mapped path can correct the symbol.
- **A stored mapping config is a snapshot, not a link to the template.** `custom_portfolio_connections.mapping_config` holds the JSON as selected at create or PATCH time; when a built-in template in `app/mapping_templates.py` changes afterwards, existing portfolios keep the old config. Re-selecting the template on create, or PATCHing `mapping_config` on `/{id}/connection`, is how a portfolio picks up a new revision.
