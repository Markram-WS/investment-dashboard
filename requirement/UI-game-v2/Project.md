# Project PRD: Machine Ledger

## 1. Project Overview
**Machine Ledger** is a high-fidelity industrial financial portfolio management application. It blends 19th-century "Brass-age" aesthetics—inspired by board games like *Furnace* and *Brass: Birmingham*—with a clean, modern user interface for precision fiscal tracking.

The platform gamifies the experience of managing capital allocation across various industrial "foundries" (assets), using a collectible card game (CCG) visual metaphor.

---

## 2. Brand Identity: "Vintage Clean"
The visual language is defined by a juxtaposition of gritty historical textures and precise technical readouts.

-   **Atmosphere:** Gritty, mechanical, prestigious, and atmospheric.
-   **Core Palette:** 
    -   *Parchment:* Warm, textured off-whites (`#fff9ef`) for surfaces.
    -   *Ink:* Deep charcoal/obsidian for typography.
    -   *Oxidized Metals:* Bronze, brass, and patina teal accents for interactive elements.
    -   *Industrial Heat:* Glowing amber/orange for highlights and primary data focal points.
-   **Typography:**
    -   *Headings:* Bold, high-contrast Victorian serifs (Ledger style).
    -   *Data:* Sharp, technical Monospace fonts for numerical precision.
-   **Geometry:** Rounded card layouts (8px-12px radius) with layered overlapping headers to create depth.

---

## 3. Core Features & Screen Flows

### 3.1 Asset Dashboard (Main View)
-   **Function:** Overview of aggregate capital and active foundry performance.
-   **Key Elements:** 
    -   Layered header with atmospheric industrial artwork.
    -   Large-scale display of Aggregate Capital.
    -   Quick-stats for Lock, Buffer, Market, and Available funds.
    -   System health monitor (Foundry Status).

### 3.2 Asset Detail (Card View)
-   **Function:** Deep dive into a specific industrial investment.
-   **Key Elements:**
    -   CCG-style card interface.
    -   Historical production trend graphs.
    -   Specific metrics: Yield %, Load %, and Asset-specific ID tracking.
    -   Primary Action: "Engage Allocation."

### 3.3 Foundry Management
-   **Function:** Creating and updating industrial entries.
-   **Key Elements:**
    -   "Create New Foundry" module with step-by-step technical inputs.
    -   Success states ("Foundry Forged") for completed allocations.

---

## 4. Design System Tokens (Design.md Summary)
-   **Surface-Level:** `bg-parchment-base`, `bg-ledger-paper`.
-   **Interactive:** `bg-primary` (charcoal), `text-accent` (patina teal).
-   **Shape:** `rounded-xl` for cards, `rounded-full` for specialized status badges.
-   **Effects:** Subtle document-style shadows and double-border "ledger" separators.

---

## 5. Technical Requirements
-   **Responsive Design:** Optimized for both Mobile (iOS/Android) and Desktop (Web).
-   **Motion:** High-fidelity micro-interactions (fade-ups, smooth transitions between details and imagery).
-   **Assets:** Standardized 512x512 full-bleed industrial artwork for all asset cards.
