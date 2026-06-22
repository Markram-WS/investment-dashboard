---
name: Machine Ledger
colors:
  surface: '#fff9ef'
  surface-dim: '#dfd9d0'
  surface-bright: '#fff9ef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f9f3e9'
  surface-container: '#f3ede3'
  surface-container-high: '#ede7de'
  surface-container-highest: '#e7e2d8'
  on-surface: '#1d1b16'
  on-surface-variant: '#434749'
  inverse-surface: '#32302a'
  inverse-on-surface: '#f6f0e6'
  outline: '#747879'
  outline-variant: '#c3c7c8'
  surface-tint: '#586062'
  primary: '#010506'
  on-primary: '#ffffff'
  primary-container: '#181f21'
  on-primary-container: '#808789'
  inverse-primary: '#c0c8ca'
  secondary: '#675c54'
  on-secondary: '#ffffff'
  secondary-container: '#ecddd2'
  on-secondary-container: '#6c6058'
  tertiary: '#010506'
  on-tertiary: '#ffffff'
  tertiary-container: '#181f21'
  on-tertiary-container: '#7f8789'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde4e6'
  primary-fixed-dim: '#c0c8ca'
  on-primary-fixed: '#161d1f'
  on-primary-fixed-variant: '#41484a'
  secondary-fixed: '#efe0d5'
  secondary-fixed-dim: '#d3c4ba'
  on-secondary-fixed: '#221a14'
  on-secondary-fixed-variant: '#4f453d'
  tertiary-fixed: '#dce4e6'
  tertiary-fixed-dim: '#c0c8ca'
  on-tertiary-fixed: '#151d1f'
  on-tertiary-fixed-variant: '#40484a'
  background: '#fff9ef'
  on-background: '#1d1b16'
  surface-variant: '#e7e2d8'
  ink-black: '#2D3436'
  ink-grey: '#636E72'
  ledger-paper: '#FDFBF7'
  parchment-base: '#FCF8F3'
  surface-highlight: '#E8DFD0'
  faded-border: '#B2A59B'
typography:
  headline-xl:
    fontFamily: Crimson Pro
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Crimson Pro
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Crimson Pro
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.2'
  data-display:
    fontFamily: JetBrains Mono
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.0'
    letterSpacing: -0.05em
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.4'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '800'
    lineHeight: '1.0'
    letterSpacing: 0.2em
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 9px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  headline-xl-mobile:
    fontFamily: Crimson Pro
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1440px
---

## Brand & Style
Machine Ledger is a "Industrial Antiquarian" design system that blends the aesthetic of 19th-century mechanical documentation with modern functional UI. It evokes a sense of physical permanence, precision engineering, and historical authority.

The style is a hybrid of **Tactile/Skeuomorphism** and **Brutalism**. It utilizes paper-like textures (felt, parchment), high-contrast "ink-on-paper" typography, and rigid structural grids. The emotional response should be one of meticulous record-keeping, industrial weight, and reliable craftsmanship. Visual interest is driven by serif italics, monospaced data points, and subtle "oxidized" metallic accents.

## Colors
The palette is rooted in natural, aged materials. The background uses a warm "Parchment" white (#fff9ef) with a felt-like texture overlay. Interactive elements and primary text utilize "Ink Black" (#181f21), providing maximum contrast reminiscent of letterpress printing.

Secondary elements use "Dusty Bronze" and "Oxidized Charcoal" tones to differentiate metadata from primary figures. A "Surface Highlight" tan is used for active states and selections, reinforcing the physical paper metaphor. Borders should remain subtle, mimicking faint graphite lines or embossed paper edges.

## Typography
The typographic system uses a tripartite font strategy:
1.  **Crimson Pro (Serif):** Used for headlines and titles. Italic variants are preferred for a "hand-notated" ledger feel.
2.  **JetBrains Mono (Monospace):** Reserved strictly for data, timestamps, and technical labels. It conveys mechanical precision and tabular alignment.
3.  **Inter (Sans Serif):** Used for functional UI labels and body text to ensure legibility and a touch of modern utility.

Key figures (Aggregate Capital) should use `data-display` for high impact. Labels use aggressive letter-spacing (`label-caps`) to mimic industrial stamping.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy within a maximum container width of 1440px. A 12-column grid is used for desktop, while mobile collapses to a single column with 16px margins.

Spacing is generous but rigid, utilizing a 4px base unit. Visual hierarchy is established through clear horizontal demarcations using thin borders rather than large gaps. Side navigation is fixed to the left at 256px (w-64) to maintain the "ledger book" structure.

## Elevation & Depth
Depth is created through **Tonal Layers** and **Vintage Shadows**. Surfaces do not "float" high above the background; instead, they appear as stacked sheets of heavy cardstock.

-   **Cards:** Use a `vintage-shadow` (0 10px 30px -5px rgba(0, 0, 0, 0.08)) which is soft and diffused.
-   **Active States:** Rather than lifting, active states often involve a slight scale-down (active:scale-95) to mimic a physical button being pressed into a console.
-   **Borders:** Fine 1px borders (#ede7de) are the primary tool for separation, mimicking the ruled lines of an accounting ledger.

## Shapes
While the brand is industrial, it avoids "sharp" brutality. A `rounded-xl` (1.5rem) corner radius is applied to primary containers and cards to give them the feel of die-cut cardstock. Interactive buttons use a tighter `rounded-lg` (0.25rem to 0.5rem) to feel more like machined parts. Small badges or "Live" indicators use a near-sharp `rounded-sm` (2px).

## Components
-   **Buttons:** Primary buttons are high-contrast (Ink Black background, White text) with heavy tracking on `label-caps`. Secondary buttons use the `ledger-paper` background with a visible border.
-   **Cards:** "Ledger Cards" feature a 1px border and the `vintage-shadow`. They often contain internal header rows separated by horizontal rules.
-   **Navigation:** Side nav links use a "stamped" effect for the active state—full background color fill with an icon and bold caps.
-   **Data Metrics:** Displayed in a "Bento" style grid. These should always include a small monospaced label at the top-left and a Material Symbol icon at the top-right to maintain the "technical instrument" look.
-   **Graphs:** Use "Oxidized" line styles (dark charcoal) with low-opacity area fills. Grid lines must be visible but faint (opacity 20%).