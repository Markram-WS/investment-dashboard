# Frontend Handoff — 2026-11-20

**Scope:** the design-system / conformance pass on the portfolio dashboard frontend plus one backend analytics fix.
**Written:** 2026-11-20, against the working tree at `git log -1` = `9b12288`.

## Where things stand

The local kind cluster is up and serving the app (checked at write time: `GET http://localhost:8080/` → **200**, `GET http://localhost:8080/api/v1/analytics/portfolio-grid` → **200**). The visual contract work is done and recorded in `DESIGN.md`: 15 modals moved onto a shared footer contract, contrast tokens reworked, the primary CTA unified on the ink pill, `/create-portfolio` rebuilt as a two-column page, and number/date formatting centralised in `frontend/src/utils/format.ts`. A follow-up conformance pass over the last nine screens has landed too — there are now **zero** private `toLocaleString` calls and **zero** raw `err.message` renders under `frontend/src` (tsx), and **one** bare loading line remains (`PortfolioGrid.tsx:313`). Nothing is committed: 44 changed files (+1324/−759), the deletion of `frontend/public/vite.svg`, and one untracked file, `frontend/src/screens/components/modalLayout.ts`.

## Completed work

| Area | Change | Verification |
|---|---|---|
| Backend analytics | `/api/v1/analytics/portfolio-grid` no longer 500s (`sqlalchemy MissingGreenlet` from lazy loads); `selectinload(ActiveOrder.group/option)` added in `backend/app/routers/analytics.py` (lines 220-221, 477) | Endpoint returns **200** against the live cluster; pod on the rebuilt image |
| Modal footer contract | New `frontend/src/screens/components/modalLayout.ts` (`MODAL_CARD`/`MODAL_HEADER`/`MODAL_BODY`/`MODAL_FOOTER`); panel capped at `max-h-[calc(100dvh-48px)]` in `ModalShell.tsx:99`; body is the only scroller | `grep -rl MODAL_CARD frontend/src --include=*.tsx` → **15** files; every one is a modal with a footer. Measured at 1258x539 and 1258x555: each primary button inside the viewport |
| Contrast tokens | `frontend/src/index.css` reworked: teal separated fill vs. text, `--color-on-brand-accent` derived from accent luminance, per-segment ink in the liquidity stack | In-page audit at 1258x555 over `/`, `/all-assets`, `/transactions`, `/managed-fund`, `/risk-analytics`, `/analytics/detail`, light + dark → **0 failures** |
| Primary CTA | `Button.tsx` primary is the ink pill; new `accent` variant keeps teal at `Button.tsx:24`; nav active pill back to ink, accent limited to focus ring / links / swatch | Code inspection of `Button.tsx`, `Navigation.tsx`; DESIGN §2/§5/§9 reconciled |
| Theme init | `ThemeToggle.tsx:16` seeds state from the `html` class instead of assuming light, so system-dark no longer flashes/loads light | Code inspection; `localStorage` write only on toggle (line 8) |
| `/create-portfolio` | Rebuilt as two-column page with a summary rail; no type preselected, selection state visible | Document height 1283px → 895px (session measurement) |
| Formatting | `frontend/src/utils/format.ts` owns `formatMoney`, `formatPct`, `formatQty`, `formatDate`, `formatDateTime`, `priceLabel`, `currency`, all explicit `en-US` | `grep toLocaleString frontend/src --include=*.tsx` (excluding format.ts) → **no matches**; `grep err.message` → **no matches** |
| Loading states | Pulse skeletons in `PortfolioOverview.tsx:225`, `TransactionsPage.tsx:139,164`, `AssetGroupModal.tsx:152`, `ZoneGroupModal.tsx:172`, `PortfolioMutualFund.tsx:233` | `grep ">Loading" frontend/src` → only `PortfolioGrid.tsx:313` left |
| Chrome | Title `InvestDesk — Portfolio Dashboard`, `favicon.svg` replaces `vite.svg` (`frontend/index.html:5,7`) | File contents |
| Docs | `DESIGN.md` gained §10 Surface Contracts (**10** named rules with the measured failure numbers) and a refreshed §12 Known Gaps (**19** entries) | Section headings + bullet counts |

## How to run and verify

Cluster (already running; `podman ps` shows `investment-dashboard-control-plane`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/v1/analytics/portfolio-grid   # expect 200 200
```

Frontend build — `node` is not on PATH, and `bun run build` fails because `frontend/node_modules/.bin` cannot hold symlinks on this exFAT mount. Use the alias script:

```bash
cd frontend && bun run build:bun          # same vite build, no .bin symlinks
```

Dev server against the cluster (`vite.config.ts` proxies `/api` to `BACKEND_API_BASE_URL`, default `http://localhost:8000`):

```bash
cd frontend && BACKEND_API_BASE_URL=http://localhost:8080 bun x vite --port 5199 --host 127.0.0.1
```

Conformance greps (all three are the acceptance checks for the pass):

```bash
grep -rn "toLocaleString" frontend/src --include=*.tsx | grep -v format.ts    # expect empty
grep -rn "err.message" frontend/src --include=*.tsx                            # expect empty
grep -rn ">Loading" frontend/src                                              # expect PortfolioGrid.tsx:313 only
```

## Open items

- [ ] `PortfolioGrid.tsx:313` still renders `Loading portfolio analytics...`; needs a skeleton like the other pages.
- [ ] `TransferModal.tsx` is the 16th `ModalShell` user and the only modal **not** on `modalLayout` (own `max-w-[400px]` card, no `MODAL_BODY`/`MODAL_FOOTER`), so its action is visible only because its content is short.
- [ ] `PortfolioOverview.tsx:216-218` swallows fetch failures (`.catch(() => {})` then `if (!data) return null`) — a failed load is a blank page with no sentence and no Retry, which violates §10 Never-The-Exception.
- [ ] `PortfolioOverview.test.tsx:85,96` is stale: it asserts `Loading Overview...` and `Error Loading Overview`, strings that no longer exist in the page.
- [ ] §12 gaps not fixed (UI, actionable): no column labels on portfolio rows below 1024px; all-assets hides 5 of 8 columns behind unmarked scroll at 390px; Sora loaded from Google Fonts in a LAN app; `pointer: coarse` is the only 44px trigger; payoff strike/break-even unlabelled; header risk status inert (not a link); no keyboard path for the cash-transfer drag; Overview ends in ~280px dead space at 1258x539; raw money inputs beside formatted read-only fields in `EditPortfolioModal.tsx:317-330` / `MFEditPortfolioModal.tsx:267`; empty band under the zone-table head.
- [ ] §12 gaps that are documentation-level: dark-mode token enumeration, three pages predating the shell, no data-viz spec, no motion duration scale, unimplemented input/loading states, dead CSS, undocumented non-Overview components, hardcoded 60px nav offset.
- [ ] Nothing committed; the whole pass is one working-tree change set.

## Decisions taken

- **Ink pill is the primary CTA**; teal is an accent (`accent` variant), not the default action colour.
- **Brand Yellow is a fixed anchor** — a user accent repaints chrome only (pills, links, focus ring), never the semantic available-liquidity fill and never the logo mark.
- **Desktop-first, phone not a target.** The floor is the owner's real viewport, **1258x539** CSS (1920x1080 at 1.5 inside a non-maximized window); earlier 555–700 guesses were wrong. Phone layouts must not break, not be fitted.
- **Modal footer contract:** panel `max-height: calc(100dvh - 48px)`, fixed header, body is the only scroll region, footer pinned — the overlay never scrolls.
- **One formatter module** (`utils/format.ts`), explicit `en-US`, never `toLocaleString(undefined, …)`.

## If you resume here

1. Re-run the three conformance greps above to confirm the tree still matches this note, then start the dev server on 5199 and re-measure one modal at 1258x539.
2. Fix the two cheapest violations: the `PortfolioGrid.tsx:313` loading line (copy the `TransactionsPage.tsx` skeleton) and Overview's swallowed error (`PortfolioOverview.tsx:216`) with the §10 failure card, updating `PortfolioOverview.test.tsx` in the same change.
3. Migrate `TransferModal` onto `modalLayout`, then commit the pass as one change set (44 files + `modalLayout.ts`, minus the stale test strings).
