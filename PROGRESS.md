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
