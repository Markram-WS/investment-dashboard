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
## Fix 3: Body overlaps sticky navbar (2026-06-06)

### Root Cause
`<Navigation />` has `sticky top-0 h-16` but `<Routes>` renders directly after it with no padding-top. Content scrolls behind the 64px navbar.

### Change
| File | Before | After |
|------|--------|-------|
| `frontend/src/App.tsx` | `<Navigation /><Routes>...` | `<Navigation /><main className="pt-16"><Routes>...</Routes></main>` |

`pt-16` = 4rem = navbar height. Content now starts below the sticky navbar.
