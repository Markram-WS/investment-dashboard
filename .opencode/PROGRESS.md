# Investment Dashboard — Progress

## Fix: Frontend ERR_CONNECTION_REFUSED (2026-06-06)

### Root Cause
The frontend Docker container was upgraded to **Vite 8** (`^8.0.16`) which has a known optimizer hanging bug on Linux/Docker (confirmed by [sveltejs/kit#15554](https://github.com/sveltejs/kit/issues/15554)). The dev server optimizer (`esbuild`) would stall indefinitely on "bundling dependencies...", never accepting connections.

### Changes Made (matched working branch `investment-dashboard-main`)

| File | Change | Reason |
|------|--------|--------|
| `frontend/package.json` | `vite` ^8.0.16 → ^5.0.10 | Vite 8 optimizer hangs on Linux |
| `frontend/package.json` | `@vitejs/plugin-react` ^6.0.2 → ^4.2.1 | Match Vite 5 |
| `frontend/vite.config.ts` | `manualChunks` function → object syntax | Match working branch pattern |
| `frontend/vite.config.ts` | Removed `allowedHosts` | Not needed with host networking |
| `docker-compose.yml` | Uncommented `network_mode: "host"` | Required for container-to-host networking |
| `frontend/Dockerfile` | `npm ci` → `npm install` | Lockfile was out of sync with new deps |

### Key Lessons
- **Vite 8** (rolldown-based) has regressions in the dev optimizer on Linux. Stick with Vite 5/7 for Docker dev.
- `network_mode: "host"` is essential when the frontend needs to access `localhost:8000` (backend) from inside the container.
- The `warmup` + `optimizeDeps.force` configs from the working branch are safe — the hanging was caused by Vite 8, not these settings.

---

## Fix 2: WSL2 Windows localhost not reachable (2026-06-06)

### Root Cause
Windows browser could reach `http://172.27.249.21:5173/` (WSL2 VM IP) but **not** `http://localhost:5173/`.

Docker runs **inside a WSL2 VM** with its own IP (e.g., `172.27.249.21`). Two problems interacted:

1. **`network_mode: "host"`** — binds port inside the WSL2 VM only. Docker's port mapping (`ports: "5173:5173"`) is **ignored** under host networking. Port forwarding from Windows → WSL2 depends on `localhostForwarding` in `.wslconfig`, which is unreliable.
2. **Bridge networking + port mapping** (`ports: "5173:5173"`) works correctly across WSL2, but then the frontend can't reach `localhost:8000` for the backend — it needs Docker DNS (`http://backend:8000`) instead.

### Resolution
| Change | Before | After |
|--------|--------|-------|
| docker-compose.yml | `network_mode: "host"` | Remove, use `networks: - investment-network` |
| docker-compose.yml | `BACKEND_API_BASE_URL=http://localhost:8000` | `http://backend:8000` (Docker internal DNS) |

### Why this works
- **Bridge networking** + `ports: "5173:5173"` → Docker explicitly forwards port 5173 from the WSL2 VM to Windows localhost. Windows browser sees `localhost:5173` and Docker routes it to the container.
- **Docker DNS** → container resolves `backend` to the backend container's internal IP on the `investment-network` bridge, bypassing `localhost` entirely.

### Fallback if port forwarding still fails
```powershell
# PowerShell (Admin) — manual port proxy
netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=172.27.249.21
```
## Feature: GamifiedDashboard — Hero Card & Layout Refinement (2026-06-22)

### Overview
Iterative UI refinement of the `/game` route (GamifiedDashboard.tsx) to match the `example-card.md` reference and overview page layout.

### Changes Made

| File | Change |
|------|--------|
| `frontend/src/pages/GamifiedDashboard.tsx` | Hero card layout restructured to match example-card.md: image on top with badges, content with `-mt-16` overlap, `.card-fade-top` gradient fade, 2×2 ledger grid without boxes |
| `frontend/src/pages/GamifiedDashboard.tsx` | Steam Pressure + Reserve cards restyled to match overview page (`bg-ml-ledger-paper border border-ml-surface-container-high p-8 rounded-xl shadow-sm card-hover animate-fade-up`) |
| `frontend/src/pages/GamifiedDashboard.tsx` | System Integrity renamed to Steam Pressure with `settings` icon (gear), layout matches overview Pool Health card |
| `frontend/src/pages/GamifiedDashboard.tsx` | Central Foundry hero card: `h-64` image, `p-6 space-y-8` content, `card-fade-top` with `shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.15)]` |
| `frontend/src/pages/GamifiedDashboard.tsx` | ResourceBento stripped of box styling (no `p-4`, no `rounded-xl`, no `border`) — matches example-card.md ledger grid |
| `frontend/src/pages/GamifiedDashboard.tsx` | Main content padding matched to PageLayout: `px-4 md:px-6 max-w-[1200px]` |
| `frontend/src/index.css` | `.card-fade-top::before`: `top: -20px, height: 20px, linear-gradient(transparent 0%, rgba(253,251,247,.8) 20%, #FDFBF7 90%)` |
| `frontend/src/index.css` | `.card-fade-top::after`: `height: 0` (removed groove line) |
| `frontend/src/index.css` | Added `@keyframes spin` for gear icon animation |

### Hero Card Structure (final)
```tsx
<section className="bg-ml-ledger-paper border border-ml-surface-container-high overflow-hidden vintage-shadow relative rounded-xl">
  <div className="relative h-64 w-full overflow-hidden" style={{ zIndex: 0 }}>
    <img ... />
    <!-- badges: ID (left), profit % (right) -->
  </div>
  <div className="relative p-6 space-y-8 bg-ml-ledger-paper z-20 -mt-16 card-fade-top shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.15)] border-t border-ml-surface-container-high">
    <!-- Primary metric: Aggregate Capital -->
    <!-- 2×2 ledger grid: Lock, Buffer, Market, Avail -->
  </div>
</section>
```

### Card Badge Style
- Background: `bg-ledger-paper/90` with `backdrop-blur-sm border border-ml-outline/20`
- ID text: `text-ml-ink-black`
- Profit %: `#4ade80` (positive) / `#f87171` (negative) — bright/vivid colors

### Color Tokens Used
- `--ml-ledger-paper: #FDFBF7` (card backgrounds)
- `--ml-surface-container-high: #ede7de` (borders)
- `--ml-ink-black: #2D3436` (text)
- `--ml-ink-grey: #636E72` (secondary text)
- `--ml-primary: #181f21` (headings)
- `--ml-secondary: #675c54` (subheadings)
- `--ml-success: #2D5A27` (positive values / Avail)

---

## Fix 3: Body overlaps sticky navbar (2026-06-06)

### Root Cause
`<Navigation />` has `sticky top-0 h-16` but `<Routes>` renders directly after it with no padding-top. Content scrolls behind the 64px navbar.

### Change
| File | Before | After |
|------|--------|-------|
| `frontend/src/App.tsx` | `<Navigation /><Routes>...` | `<Navigation /><main className="pt-16"><Routes>...</Routes></main>` |

`pt-16` = 4rem = navbar height. Content now starts below the sticky navbar.

---

## Feature: Machine Ledger Gamified Dashboard (2026-06-22)

### Overview
Applied "Industrial Antiquarian" design system from `requirement/UI-game-v2` to the `/game` route (`GamifiedDashboard.tsx`). Parchment/ink-on-paper aesthetic with CCG-style card overlap.

### Design Reference
- `requirement/UI-game-v2/DESIGN.md` — Machine Ledger design tokens
- `requirement/UI-game-v2/example-card.md` — CCG card HTML reference
- `requirement/UI-game-v2/example-detail.md` — Detail page HTML reference
- `requirement/UI-game-v2/stitch_algorithmic_portfolio_dashboard/` — Extracted art assets (both zips)

### Files Changed

| File | Change |
|------|--------|
| `frontend/index.html` | Added Crimson Pro, JetBrains Mono, Inter, Material Symbols Outlined fonts |
| `frontend/tailwind.config.js` | Added all ML color tokens (`ml-*`), ML border radii, ML font families |
| `frontend/src/index.css` | Added `.machine-ledger` theme, typography utilities, `.card-fade-top`, `.card-overlap-shadow`, animations |
| `frontend/src/pages/GamifiedDashboard.tsx` | Complete retheme: parchment cards, bento grid, CCG factory cards with image/content overlap, bottom nav |
| `frontend/public/foundry-art/` | 14 Victorian industrial artwork images copied from extracted zips |

### Card Overlap Pattern
- Image on top (full-bleed, sepia filter), content below with `-mt-16` negative margin overlap
- `.card-fade-top::before` pseudo-element: `linear-gradient(transparent → #FDFBF7)` creates smooth 48px fade at top of content
- Content div has **no solid background** — image shows through at overlap zone
- `.card-overlap-shadow` provides soft depth at the junction

### Icon Mapping (Material Symbols Outlined)
| Label | Icon | Meaning |
|-------|------|---------|
| Lock | `inventory_2` | กล่องสินค้า (box) |
| Buffer | `local_fire_department` | ถ่านหิน (coal/fire) |
| Market | `trending_up` | ตลาด (market) |
| Avail | `monetization_on` | เหรียญเงิน (coin) |

### Key CSS Classes
- `.machine-ledger` — theme wrapper, overrides CSS variables
- `.card-fade-top` — gradient fade pseudo-element for overlap transition
- `.card-overlap-shadow` — soft shadow at image/content junction
- `.label-caps` — `font-size: 10px, letter-spacing: 0.2em, text-transform: uppercase`
- `.label-mono` — JetBrains Mono, `font-size: 9px, letter-spacing: 0.1em`
- `.data-display` — JetBrains Mono, `font-size: 48px, letter-spacing: -0.05em`
- `.headline-lg` — Crimson Pro italic, `font-size: 24px`

### HMR Note
Vite HMR does not detect file changes on Windows mounts (`/mnt/d/`) inside WSL. Must `docker compose restart frontend` after edits. Same applies to CSS changes — `index.css` edits require a restart.
