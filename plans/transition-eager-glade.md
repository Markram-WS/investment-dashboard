# Context
The user reports a UI transition issue on the **Central Foundry** page (GamifiedDashboard) where the image-to-content transition creates a visible groove or ridge and a white border at the seam. This indicates that the image overlaps the content wrapper, exposing the wrapper’s top border and causing a non‑smooth visual transition.

# Design
We will adjust the card layout to eliminate the overlap and smooth the transition:

1. **Increase the gradient overlay height** (`.card-fade-top`) so it fully covers the seam where the image meets the content.
2. **Reduce or remove the negative margin (`-mt-16`)** on the content wrapper to stop the image from overlapping the wrapper’s top border.
3. **Re‑balance the z‑index hierarchy** – place the gradient overlay above the image but below the content (`z-index: 1` for gradient, `z-index: 9` for content) to ensure a clean stack order.
4. **Tweak the hover shadow** on `.factory-card` if the “ridge” effect is undesirable, but this is optional.

These changes are read‑only (no new files, no API changes) and rely on existing CSS classes.

# Critical Files to Modify
- `frontend/src/index.css` – adjust `.card-fade-top` height and `z-index`, and optionally `.factory-card:hover` shadow.
- `frontend/src/pages/GamifiedDashboard.tsx` – modify the `-mt-16` margin on the content wrapper (line where the class `card-fade-top` is applied).

# Verification
1. Run `npm run dev` in the frontend directory to start the dev server.
2. Navigate to the Central Foundry page, observe the image‑content transition.
3. Confirm that:
   - The white border at the seam disappears.
   - The transition between image and content is smooth.
   - The hover effect on cards no longer creates an undesirable ridge.
4. Run `npm run test` (or `npm run test:ui`) to ensure no regressions in related UI components.