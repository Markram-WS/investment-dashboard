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
  page-title:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  datum:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Sora, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
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

The system sits at the intersection of playful and precise. Generous rounded corners (16px on cards, full pills on buttons) and soft pastel tints keep the tool approachable, while tight typography (Sora at 15px body, crisp sentence-case labels) and flat tonal layering keep the data authoritative. Depth is conveyed through background color shifts and hairline borders, not shadows — surfaces are flat at rest.

What this system explicitly rejects: fintech navy-and-gold, dark-mode-terminal aesthetics, SaaS-cream minimalism, gradient text, glassmorphism, and side-stripe borders.

### Key Characteristics:
- Flat tonal depth — no ambient shadows, depth via surface color shifts
- One bold accent (yellow) carries signal weight; all other colors are muted-to-accent
- Full-pill buttons with generous horizontal padding
- Pastel tints for status backgrounds (teal-light, coral-light, yellow-light)
- Sora geometric sans throughout — one family, weight contrast carries hierarchy
- 16px card corners as the dominant container radius
- Sentence-case labels at 12px/500 — no uppercase or tracked letterforms anywhere

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
- **Label** (500, 0.75rem / 12px, `--color-slate`, sentence case, no letter-spacing): Column heads, chip text, stat labels, and captions. Always sentence case, never uppercase — 4 words max, so it stays a label and not a sentence.

Uppercase and tracked letterforms are not used on dashboard pages: a tracked all-caps kicker above every block is a template tell, and the ledger's own column heads are sentence case.

### Dashboard Scale (Overview is the reference)

Dashboard pages use a fixed px scale, never `clamp`. This is a product register: users sit at a consistent DPI, and a number that shrinks with the viewport is harder to compare between visits. The clamp-based `display` and `heading` entries above stay documented for brand surfaces, but no dashboard page uses them.

- **Page title** (600, 26px, -0.01em): The page name in the header, one per page. It sets size, weight, and tracking only, and leaves line-height at the browser default.
- **Primary datum** (600, 22px, 1.15, -0.01em): The total on a summary strip, the largest number on the page.
- **Section title** (600, 1.25rem / 18.75px, 1.3): The heading above a list or a block of rows.
- **Body / table cell** (400, 15px): Row text, values, and prose.
- **Secondary label** (500, 12px): Column heads, chip text, and captions.
- **Micro label** (500, 11px): Stat labels inside a strip, the smallest text in the system.

**The 1.15x Rule.** Within the hierarchy levels (page title, primary datum, section title, body), no two adjacent levels may sit within 1.15x of each other. A step smaller than 1.15x reads as a rounding error, not a level: drop it or move it. The 12px and 11px sizes are a context-bound label pair, not a hierarchy step: they are chosen by what the text labels (column head or chip versus stat label inside a strip), not by depth in the scale.

### Named Rules

**The One-Family Rule.** All text uses Sora. No serif, no mono, no secondary display face. Hierarchy is carried by weight (300 to 800), size (12px to 48px), and letter-spacing, not by font switching.

**The No-All-Caps Rule.** No dashboard text is set in uppercase or with added letter-spacing. Labels are sentence case at 12px/500 in `--color-slate`; a tracked all-caps kicker above every block is a template tell, and the ledger's own column heads are sentence case.

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
- **Primary (teal):** `bg-brand-teal text-white` — the default call to action. Hover darkens to `teal-600`.
- **Secondary:** `bg-canvas text-ink border hairline` — outlined with white fill. Hover gets `bg-surface`.
- **Outline:** `border brand-teal text-brand-teal` — transparent fill. Hover gets `bg-teal-50`.
- **Danger:** `bg-red-600 text-white` — destructive actions. Hover darkens.
- **Ghost:** `bg-transparent text-slate border hairline` — lowest emphasis.
- **States:** Hover is per variant (`hover:bg-teal-600`, `hover:bg-surface`, `hover:bg-teal-50`, `hover:bg-red-700`, `hover:bg-surface`) at `frontend/src/screens/components/Button.tsx:14-18`. Press scales the button to 0.97 (`active:scale-[0.97]`, `Button.tsx:40`). Disabled renders at `opacity-50` with `cursor-not-allowed` and cancels the press scale (`disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100`, `Button.tsx:40`). The transition is `transition-all duration-150` (`Button.tsx:40`).
- **Focus:** not set by the component. It inherits the global `:focus-visible` outline at 2px brand-teal with 2px offset (`index.css:585-596`).
- **Sizes:** sm `px-3 py-1.5 text-[10px]` renders 11.25px horizontal, 5.625px vertical, 10px type; md `px-4 py-2 text-xs` renders 15px, 7.5px, 11.25px; lg `px-6 py-3 text-sm` renders 22.5px, 11.25px, 13.125px (`Button.tsx:21-25`). The rem-based utilities scale down because the root is 15px (`index.css:84`).
- **Loading:** not implemented. The `loading` prop is declared (`Button.tsx:6`) and only feeds `disabled` (`Button.tsx:39`); no spinner, label change, or width reservation renders.

### Cards / Containers
- **Corner Style:** Generous 16px radius (`rounded-xl`).
- **Background:** Canvas (`#ffffff`). A canvas container on the `surface` page body needs no hairline, because the tonal step already draws the boundary; the 1px hairline exists for canvas-on-canvas separation (a card inside a canvas area) and for the legacy `.card` helper (`index.css:152`).
- **Shadow Strategy:** Flat by default; `.card-hover` adds `box-shadow: var(--shadow-md)` and `transform: translateY(-1px)` over 150ms on hover (`index.css:159-165`).
- **Internal Padding:** 24px is the default for a card holding one block; a summary strip with two columns uses 20px vertical and 24px horizontal so the block stays compact (see Overview Totals Strip).
- **Tinted variants:** Background shifts to teal-light, coral-light, or yellow-light for status cards.
- **Page body:** The page body is `surface`, so a container that must read as a block takes `canvas`; a container filled with `surface` is invisible on the body and must not be used as a section boundary.

### Overview Totals Strip

The summary block a dashboard page starts with: a canvas card sitting on the surface page body.

- **Shape:** 16px radius, padding 20px vertical and 24px horizontal at 1024px and up (20px all round below that), 48px bottom margin (`--space-xxl`).
- **Grid:** three tracks, `minmax(0,340px) 1px minmax(0,1fr)`, 24px gaps, items vertically centred. The 1px track is a hairline divider and exists only at 1024px and up; below 1024px the tracks stack with a 20px gap and the divider is removed.
- **Left column:** a 12px slate label, then the primary datum at 22px with the cents at 0.6em in slate, then a P/L percent chip, then micro stats (11px label over a 15px value) for P/L and Deployed.
- **Right column:** a 12px slate label plus a 36px liquidity bar whose segments carry their own name and value, dropping both lines under 104px of segment width.
- **Threshold data:** data that used to live in a legend under the bar belongs in the `title` and `aria-label` of the status dot that reports it.

### Inputs & Fields
- **No shared component.** The `.input` class exists at `index.css:238-248` (8px 14px padding, 8px radius, hairline stroke, a teal border on `:focus` at `:247`, an `--color-outline` placeholder at `:248`), but no screen binds it: searching `frontend/src` for a `className` containing `input` returns nothing, against 87 `<input>` elements in the tree. Shipped inputs are styled per screen, either with Tailwind utility strings (for example `frontend/src/screens/ZoneGroupModal.tsx:142`) or with inline styles (the Overview dense toolbar).
- **Overview search and sort:** the search input is 13px text, 1px hairline, 8px radius, `6px 12px` padding, canvas fill, 200px minimum and 280px maximum width; the sort select is the same radius and text size with `6px 10px` padding (`frontend/src/pages/PortfolioOverview.tsx:459-483`).
- **Focus:** where a screen binds `.input`, `:focus` removes the outline and shifts the border to brand-teal (`index.css:247`); that is all it does, and no screen currently binds the class. The 2px brand-teal outline with 2px offset comes from the global `:focus-visible` rule, which applies to every element (`index.css:585-596`). The narrower `:focus-visible` outline with 1px offset exists only on `.select-trigger` (`index.css:208`).
- **Placeholder:** `--color-outline` (`#77767b`, `index.css:45`) is applied by `.input::placeholder` (`index.css:248`), which is unused; the Overview toolbar passes no placeholder colour and renders the browser default.
- **Disabled/Error:** not implemented. No shipped input renders an error, disabled, or loading state.

### Navigation
- **Style:** Horizontal pill links in the top bar. Inactive: slate text. Active: ink background with white text.
- **Hover:** Surface background tint with ink text.
- **Mobile:** Full-width vertical drawer below the nav bar, same pill styling.
- **Logo:** Yellow "M" square with "InvestDesk Dashboard" stacked label.
- **Icons:** Feather-style SVGs at 20px, with scale hover animation (1.12x).

### Chips / Badges
- **Style:** Pill shape (9999px), 2px/10px padding, 12px font, 500 weight.
- **Case:** badge and chip text is sentence case at 12px/500; uppercase tracking is not used.
- **Colors match accent roles:** teal, yellow, coral, blue, each with a 12-18% opacity tinted background.
- **Neutral variant:** Surface background, slate text.
- **Dark mode:** Background opacity increases to 25%.

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
page header              26px title left, status dots right, 15px below (mb-4)
  -> totals strip        canvas card
  -> 48px
  -> section heading row 18.75px title, filter chip and count right
  -> list                hairline rows, sticky head
```

**The No-Repeated-Rule Rule.** A section boundary is never drawn with the separator the group itself uses for its rows. The Portfolios ledger keeps a hairline under its sticky head and between rows, and has no rule above it; two same-width blocks are separated by space plus a container step, not by another hairline.

**The Above-The-Fold Rule.** The app shell reserves the 60px nav (`main` is `min-h-[calc(100vh-60px)]`); a dashboard page at a 1258x575 viewport must show header, strip, heading, and its rows with no page scroll, which is what the Overview measures today (`scrollHeight` 575 = `clientHeight`).

**The Row Anatomy Rule.** Table rows are 64px minimum with a 44px interactive floor, the head is sticky, and both keep their hover and focus-visible states.

**The Converge-On-Overview Rule.** Pages converge on Overview; a new page that needs a summary block uses the totals strip before inventing a new layout.

## 7. Do's and Don'ts

### Do:
- **Do** use Brand Yellow as the single bold surface — it carries signal weight because nothing else competes at that saturation.
- **Do** use pastel tints (teal-light, coral-light, yellow-light) for status backgrounds instead of the raw saturated accent.
- **Do** use full-pill buttons for all actions — it's the system's most recognizable shape pattern.
- **Do** use flat containers with hairline borders at rest and tonal surface shifts for depth.
- **Do** keep body text at 15px with a max line length of 75ch.
- **Do** use `text-wrap: balance` on heading elements and `text-wrap: pretty` on long prose.
- **Do** write labels in sentence case at 12px/500 `--color-slate`, 4 words max.
- **Do** use Sora across the entire interface — one family, weight contrast for hierarchy.
- **Do** keep a dashboard page's primary datum at 22px and its page title at 26px, with a fixed px scale.
- **Do** separate same-width blocks with a surface step plus at least 48px.

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
| `md` | 768px (Tailwind default) | 39 lines carry a `md:` utility. Page shell padding (`px-4 md:px-6 py-6 md:py-10`) steps from 15px horizontal and 22.5px vertical to 22.5px and 37.5px (`PageLayout.tsx:5`). Card grids go from one column to two, three, or four (`PortfolioAnalyticsDetail.tsx:36`, `CreateNewPortfolio.tsx:171`, `CreateNewPortfolio.tsx:232`, `CreateNewPortfolio.tsx:321`, `SummaryCard.tsx:90`, `PortfolioMutualFund.tsx:219`). Table columns start appearing (`TransactionsPage.tsx:215-249`, `OrderManagement.tsx:580-699`, `TradeHistoryTable.tsx:95-130`). |
| `lg` | 1024px (Tailwind default) | 16 lines carry an `lg:` utility. The inline nav appears and the hamburger disappears (`Navigation.tsx:94`, `Navigation.tsx:175`). Remaining table columns appear (`TransactionsPage.tsx:218`, `OrderManagement.tsx:586`, `TradeHistoryTable.tsx:102`). The chart side panel appears (`PayoffChart.tsx:355`) and card spans widen (`SummaryCard.tsx:33`). |
| `min-[1024px]` | 1024px, as an arbitrary variant | Totals strip padding becomes 20px vertical and 24px horizontal (`PortfolioOverview.tsx:312`). The strip changes from a stacked column with 20px gaps to a three-track grid with 24px gaps (`PortfolioOverview.tsx:320-321`), and the 1px divider becomes visible (`PortfolioOverview.tsx:387`). |
| `max-width: 1023px` | below 1024px | `.ledger-head` is hidden and `.ledger-row` collapses to two tracks, `minmax(0,1fr) auto`, with a 16px column gap and a 10px row gap. Name, allocation, and status cells span the full width and value cells align left (`index.css:407-424`). |
| `min-width: 1280px` | 1280px | `.portfolio-grid` becomes two equal columns (`index.css:477-485`). No component binds `.portfolio-grid`, so the rule currently renders nothing. |
| `@container` | 104px of the segment's own inline size | A liquidity segment reveals its label and value (`index.css:459-462`). Below 104px both stay `display: none` through `.liquidity-seg-text` (`index.css:442-443`, `LiquidityStack.tsx:71-72`). |
| `pointer: coarse` | input modality, not width | Buttons, links, inputs, selects, textareas, and `[role="button"]` get `min-height: 44px`; `.nav-link` gets 36px (`index.css:569-575`). |
| `prefers-reduced-motion` | user preference | Every animation and transition collapses to 0.01ms with one iteration (`index.css:598-604`). |

### Touch Targets

- **Ledger rows:** 64px minimum height with 14px vertical and 8px horizontal padding (`index.css:378-386`); the dense variant drops to 56px with 8px padding all round (`index.css:398-401`).
- **Interactive floor:** 44px is not a resting size. It applies only under `(pointer: coarse)`, where the min-height is forced to 44px and `.nav-link` to 36px (`index.css:569-575`). On a fine pointer no floor is applied.
- **Buttons:** sm `px-3 py-1.5 text-[10px]` renders 11.25px horizontal, 5.625px vertical, 10px type; md `px-4 py-2 text-xs` renders 15px, 7.5px, 11.25px; lg `px-6 py-3 text-sm` renders 22.5px, 11.25px, 13.125px (`Button.tsx:21-25`, computed at the 15px root). No size sets an explicit height.
- **Toolbar controls:** the search input and sort select use 6px vertical padding with 13px type (`PortfolioOverview.tsx:460-464`, `PortfolioOverview.tsx:475-479`). Only the search sets widths: 200px minimum, 280px maximum (`PortfolioOverview.tsx:465-466`).
- **Navigation:** desktop pills are `px-4 py-2`, which renders 15px horizontal and 7.5px vertical padding (`Navigation.tsx:103`); drawer rows are `px-4 py-3`, rendering 15px and 11.25px, with `text-[15px]` giving literal 15px type (`Navigation.tsx:192`). The unbound `.nav-link` rule would set 8px and 16px (`index.css:310`).

### Collapsing Strategy

Width is handled by collapse, not by scaling. Below 1024px the ledger keeps its 64px rows but loses its column head and its five-track grid. Each row becomes a two-track grid (`minmax(0,1fr) auto`) with 16px between columns and 10px between rows; name, allocation, and status span the full width, and value cells align left (`index.css:407-424`). The Overview ledger does not gain horizontal scroll; `.table-responsive` is bound only by `OptionsStrategyTable.tsx:84` (`index.css:579-581`).

Filtering is data-driven rather than responsive. The toolbar (search plus sort) renders only when the portfolio count exceeds `DENSE_THRESHOLD = 8` (`PortfolioOverview.tsx:30`, `PortfolioOverview.tsx:267`, `PortfolioOverview.tsx:443`), and the same flag switches rows to `.ledger-row-compact` (`PortfolioOverview.tsx:550`). Nine portfolios is the point where a narrow viewport gains a search box it did not have at eight.

Navigation collapses at `lg`. Below 1024px the inline nav is removed (`Navigation.tsx:94`) and a hamburger appears (`Navigation.tsx:175`). It toggles a full-width drawer positioned absolutely at `top-16` under the bar, which renders 60px (`h-16` at the 15px root) (`Navigation.tsx:76`, `Navigation.tsx:182`), animated over 200ms (`index.css:619-620`). The drawer lists nav items and portfolios as rows rather than pills (`Navigation.tsx:192-212`).

## 9. Interaction States

States ship per component, not per token. A state that the code does not implement is named as not implemented, so it cannot be mistaken for a target that is already met.

### Buttons

| State | Visual change | Where |
|---|---|---|
| Resting | Variant fill, full pill, bold text, 150ms transition on all properties | `Button.tsx:14-20`, `Button.tsx:40` |
| Hover | Teal-600 (primary), surface (secondary), teal-50 (outline), red-700 (danger), surface (ghost) | `Button.tsx:14-18` |
| Pressed | Scales to 0.97 | `Button.tsx:40` |
| Focus-visible | 2px brand-teal outline at 2px offset, inherited from the global rule | `index.css:585-596` |
| Disabled | Opacity 0.5, `cursor-not-allowed`, press scale cancelled | `Button.tsx:40` |
| Loading | Not implemented: the prop only feeds `disabled` | `Button.tsx:6`, `Button.tsx:39` |

### Inputs and Selects

| State | Visual change | Where |
|---|---|---|
| Resting | 1px hairline border, 8px radius, canvas fill, 13px text | `PortfolioOverview.tsx:459-467`, `PortfolioOverview.tsx:474-482` |
| Focus-visible | 2px brand-teal outline at 2px offset, from the global rule | `index.css:585-596` |
| Focus (border shift) | Not implemented for shipped inputs: `.input:focus` exists but no element binds `.input` | `index.css:247` |
| Hover | Not implemented | none |
| Placeholder | Browser default in the toolbar; `--color-outline` applies only through the unbound `.input::placeholder` | `PortfolioOverview.tsx:456`, `index.css:248` |
| Error | Not implemented | none |
| Disabled | Not implemented | none |
| Loading | Not implemented | none |

### Chips

| State | Visual change | Where |
|---|---|---|
| Attention chip, resting | Ink on warning at 18% via `color-mix`, 120ms background transition | `index.css:337-340` |
| Attention chip, hover | Warning at 30% | `index.css:346-348` |
| Attention chip, pressed | `aria-pressed="true"`: solid warning fill with `--color-on-brand-yellow` text | `index.css:342-345` |
| Attention chip, pressed and hovered | Warning at 85% over canvas | `index.css:349-351` |
| Attention chip, focus-visible | 2px brand-teal outline at 2px offset | `index.css:352-355` |
| Attention chip, disabled or loading | Not implemented | none |
| P/L percent chip | Static tint only: 18% positive or danger, or `surface-soft` when flat; a `<span>`, so no hover, pressed, or focus state exists | `PortfolioOverview.tsx:342-351` |
| Tag chip | Static `surface` fill, 11px, full pill, 2px/8px padding | `PortfolioOverview.tsx:115-129` |

### Table Rows

| State | Visual change | Where |
|---|---|---|
| Resting | 64px minimum height, 14px/8px padding, hairline bottom, 4px radius, 120ms background transition | `index.css:378-386` |
| Hover | Surface background | `index.css:387-389` |
| Focus-visible | 2px brand-teal outline at 2px offset; rows are `<Link>` elements, so they receive focus | `index.css:390-393`, `PortfolioOverview.tsx:101-108` |
| Compact | 56px height and 8px padding, same grid | `index.css:398-401`, `PortfolioOverview.tsx:550` |
| Drop target | 8% brand-teal wash while a dragged amount is over the row | `index.css:394-396`, `PortfolioOverview.tsx:107` |
| Pressed | Not implemented: no active style on the row | none |
| Selected | Not implemented | none |
| Disabled | Not implemented | none |
| Loading | Not implemented | none |

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

## 10. Iteration Guide

1. Change the token or the component in code first, then update this document in the same commit. `6c1760b` is that pair: it changed `DESIGN.md`, `frontend/src/index.css`, and `frontend/src/pages/PortfolioOverview.tsx` together.
2. Never document a value the code does not set. When a value is a target rather than an implementation, mark it as a target: the 44px floor is a coarse-pointer rule (`index.css:569-575`), not a universal one.
3. Every interactive element ships resting, hover, pressed, and focus-visible, or says "not implemented" in section 9. Today the nav pill itself has no hover (background and colour are inline styles with no hover variant), while its icon scales to 1.12 (`index.css:561-566`, `Navigation.tsx:106`); no input has an error state, and no button renders a loading spinner.
4. New pages converge on the Overview composition before adding a new layout (section 6). The totals strip is the first block of a dashboard page, and its geometry is set at `PortfolioOverview.tsx:311-400`.
5. Measure contrast on the composited background, not on the raw token. A chip's fill is a `color-mix` result over its container (`index.css:339`); pale ink `#e8e8e8` (`index.css:110`) on the solid warning fill measures 1.20:1 (measured from the token values), which is why the pressed state switches to `--color-on-brand-yellow` (`index.css:342-345`).
6. Keep the frontmatter machine-readable: a new token goes into the frontmatter and into `frontend/src/index.css` in the same change. The frontmatter `colors` and `components` blocks mirror the `:root` variables (`index.css:10-90`).

## 11. Known Gaps

- **Dark mode is not enumerated per token.** `.dark` redefines 31 properties (`index.css:92-130`), including canvas `#13131f`, ink `#e8e8e8`, and all three pastel tints. Section 2 describes the intent and names three examples; the full mapping exists only in CSS.
- **Three pages predate the standard.** `pages/CreateNewPortfolio.tsx:116` and `:131` use `min-h-screen` with `bg-gradient-to-br from-cream-to-peach`; `screens/PortfolioGrid.tsx:431` and `screens/PortfolioMutualFund.tsx:180` use `min-h-screen` and their own page padding. They break the no-gradient rule and the rule that the page body is `surface`. `cream` and `peach` are not colours in `tailwind.config.js`, so that gradient emits nothing, but the pages still bypass the shell.
- **Data visualisation has no spec.** `PayoffChart.tsx` and `PerformanceChart.tsx` render SVG (`PayoffChart.tsx:253`) with local margins, gridline colours, and stroke widths, and nothing documents axis, tick, or series treatment. The chart animations `donutDraw`, `lineDraw`, and `barGrow` (`index.css:510-527`) are undocumented.
- **Motion has no duration scale.** Easing is tokenised (`index.css:488-492`), but durations are literals at the call sites: 120ms (`index.css:340`, `index.css:385`), 150ms (`index.css:160`), and 200ms, 250ms, 300ms for the animation classes (`index.css:607-620`). A new component has no duration token to reach for.
- **Several states are not implemented.** No input has an error, disabled, or loading state; no button renders a spinner (`Button.tsx:6`, `Button.tsx:39`); no ledger row has a selected or disabled state; the nav pill itself has no hover, since its background and colour are inline styles with no hover variant, though the icon inside it scales to 1.12 (`index.css:561-566`, `Navigation.tsx:106`).
- **Dead CSS outnumbers live CSS in places.** `.input` (`index.css:238-248`), `.nav-link` (`index.css:305-319`), `.badge` and its variants (`index.css:170-188`), `.select-trigger`, `.select-dropdown`, and `.select-option` (`index.css:191-235`), and `.portfolio-grid` (`index.css:477-485`) are bound by no component. There is no shared input component at all: 87 `<input>` elements are styled per screen.
- **Components outside Overview are undocumented.** `SummaryCard`, `PerformanceSection`, `OrderManagement`, `TradeHistoryTable`, `ZoneGroupModal`, `OptionsStrategyTable`, and the chart components ship their own padding, type sizes, and states; section 5 covers the Overview set only.
- **Three places hardcode 60px for the nav while the bar derives its height from a rem class.** `main` reserves 60px (`GlobalLayout.tsx:8`), `.ledger-head` sticks at `top: 60px` (`index.css:368`), and `h-16` renders 60px only because the root is 15px (`Navigation.tsx:76`, `index.css:84`). They agree today, but a change to the root font size or to the bar class silently desyncs the sticky offset and the shell reserve.
