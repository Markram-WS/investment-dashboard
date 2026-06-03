---
name: Miro Horizontal Navigation System
version: 1.0
description: A specialized documentation for the horizontal top-navigation system used in high-density analytics views. This system maximizes vertical workspace by anchoring global navigation to a 64px header, utilizing the Miro "Black Pill" for clear contextual signaling.

components:
  nav-bar-horizontal:
    backgroundColor: "{colors.canvas}"
    height: 64px
    borderBottom: "1px solid {colors.hairline}"
    layout: "flex justify-between items-center px-8"
    
  brand-anchor:
    layout: "flex items-center gap-2"
    logo: "Miro square canary yellow wordmark (IMAGE_23)"
    text: "INVESTDESK"
    typography: "{typography.heading-4}"
    color: "{colors.primary}"

  nav-links-group:
    layout: "flex items-center gap-8"
    typography: "{typography.body-md-medium}"
    items: ["Overview", "All Assets", "Transactions", "Risk Analytics"]
    active-state:
      backgroundColor: "{colors.primary}"
      textColor: "{colors.on-primary}"
      rounded: "{rounded.full}"
      padding: "8px 16px"
    inactive-state:
      textColor: "{colors.slate}"
      hover: "{colors.primary}"

  portfolio-selector:
    type: "dropdown-pill"
    backgroundColor: "{colors.surface-soft}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
    icon: "folder_open"
    text: "Portfolios: Binance"
    chevron: "expand_more"
    active-context:
      border: "1px solid {colors.hairline-strong}"
      fontWeight: 600

  utility-actions:
    layout: "flex items-center gap-4"
    icons: ["notifications", "more_vert"]
    style: "ghost circular"
    size: "36px"

---

## Design Principles

The horizontal navigation system is built for depth-first financial analytics, prioritizing data surface area while maintaining global orientation.

### Interaction States
- **The Black Pill**: The active navigation link is encased in a high-contrast black pill shape, following Miro's core "You are here" pattern.
- **Contextual Switching**: The "Portfolios" dropdown allows users to toggle between Binance, Finnomena, or other accounts without leaving the analytics context.
- **Visual Hygiene**: A single hairline border separates navigation from content, favoring flat surface shifts over heavy drop shadows.

### Typography & Color
- **Typeface**: Uses **Roobert PRO** at `{typography.body-md-medium}` for navigation links to ensure a modern, geometric character.
- **Palette**: Anchored on `{colors.canvas}` (#ffffff) with `{colors.primary}` (#1c1c1e) as the dominant action color.

## Usage Context
This system is implemented in the **Portfolio Analytics (SCREEN_79)** and **Transactions Log (SCREEN_41)** to provide a consistent header experience across the InvestDesk platform.
