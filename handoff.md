# Handoff — Managed Fund allocation สองโหมด (neutral / weight)

เอกสารนี้สรุปงาน Managed Fund allocation รอบล่าสุด (two-mode) เพื่อให้ session ถัดไป
ทำงานต่อได้ทันที ทุก path, field และตัวเลขในนี้ตรวจกับ code ที่ commit แล้ว
(`b4103e3`)

## 1. สถานะปัจจุบัน (State)

- Branch `feature/custom-port` — งาน allocation ถูก commit ในเครื่องแล้ว
  (`b8e6a6a` two-mode allocation, `b4103e3` grouped editor) แต่ **ยังไม่ push**
  (branch ahead 14 commits); worktree มี `ExampleFundAllocationCal.xlsx` ที่
  untracked และการแก้ drop คอลัมน์ threshold (models, startup migration,
  schema, tests — ดูข้อ 9) ที่ยังไม่ commit
- Code ที่แก้ (8 ไฟล์):
  - `backend/app/routers/managed_funds.py` — two-mode allocation, target_ratio
    label contract, ถอด alerts
  - `backend/app/services/asset_registry.py` — `resolve_allocation_labels`
  - `backend/tests/test_managed_fund_rebalance_api.py`
  - `frontend/src/types/index.ts` — `MFAllocationMode`, ถอด `MFAlert`/threshold
  - `frontend/src/lib/api.ts` — `allocation_mode: 'neutral' | 'weight'`,
    ถอด `mfAlerts`
  - `frontend/src/screens/PortfolioMutualFund.tsx` — per-group `% target share`;
    ถอด header toggle และ `modeSaving`/`modeError`
  - `frontend/src/screens/MFEditPortfolioModal.tsx` — grouped allocation editor
    + in-modal mode toggle + equal-split prefill
  - `frontend/src/screens/PortfolioMutualFund.test.tsx`
- Docs ที่อัปเดตรอบนี้: `DESIGN.md`, `.opencode/AGENT.md`, `handoff.md`,
  `README.md`, `backend/README.md`, `frontend/README.md`, `database/README.md`
- ไฟล์ untracked เดิม: `ExampleFundAllocationCal.xlsx` (ไม่เกี่ยวกับงานนี้)
- **Deploy รอบ two-mode + `b4103e3`**: deploy ขึ้น kind cluster เดิมด้วย
  `./scripts/kind-up.sh`; backend + frontend rollout ใหม่ (รวม grouped editor
  และ toggle ใน edit modal จาก `b4103e3`) ส่วน `postgres-main` ไม่ถูกแตะ
  ข้อมูลเดิมคงอยู่ — UI ที่ http://localhost:8080 เป็น build จาก `b4103e3`
  - ก่อน deploy node container ค้างเป็น `Exited` มาแล้ว ~13 ชั่วโมง
    (`podman ps` แสดง `investment-dashboard-control-plane Exited (0)`)
    ทำให้ kind-up fail ที่ขั้น image-load ด้วย
    `can only create exec sessions on running containers: container state improper`
  - วิธีแก้: `podman start investment-dashboard-control-plane` แล้วรอ API
    พร้อม จากนั้นรัน `./scripts/kind-up.sh` ซ้ำ -> ผ่าน
- **Live verify บน fund 2 หลัง deploy `b4103e3`** (allocation base 4,330 =
  cash 2,260 + holdings 2,070):
  - หน้าเพจไม่มี toggle Neutral/Weight แล้ว — toggle อยู่ใน Edit managed fund
    modal ส่วน Allocation
  - ใน modal: S&P500 แสดงสอง holding (VOO, ABC) เยื้องใต้กลุ่ม น้ำหนัก
    prefill 50 / 50; CHA แสดง SCBCHAE ที่ 100 (ทั้งสามตัวมี weight เป็น null
    มาก่อน จึงใช้ equal split)
  - สลับ toggle ใน modal เป็น Neutral: ทั้งสองกลุ่มแสดง "50.0% share" และช่อง
    weight ยังแก้ได้; sum helper อ่าน
    "sum 100 / 100 — partial targets are saved for a later switch to weight mode"
  - บันทึกด้วย target 50 / 50 ใน weight mode: persist `allocation_mode=weight`,
    `target_ratio {"S&P500":50,"CHA":50}` และ `rebalance_weight` 50 / 50 / 100
    ของสาม holding
  - `POST rebalance/calculate`: `target_allocations {"S&P500":50,"CHA":50}`,
    `total_drift` 52.19, buys `VOO 21.0577 = 547.50`,
    `ABC 21.9000 = 547.50`, `SCBCHAE 58.2500 = 1165.00`
    (รวม 2,260 = available cash)
  - fund 2 ถูกทิ้งไว้ที่ `allocation_mode=weight` target 50 / 50 และ weight
    50 / 50 / 100
- ผล automated checks รอบนี้ (session นี้):
  - `cd backend && ~/.cache/investment-dashboard-venv/bin/python -m pytest -q tests/test_managed_fund_rebalance_api.py tests/test_asset_registry_migration.py`
    -> **44 passed, 1 skipped**
  - `cd backend && ~/.cache/investment-dashboard-venv/bin/python -m pytest -q tests/test_managed_fund_prices.py`
    -> **10 passed**
  - `cd frontend && bun x vitest run` -> **137 passed (12 files)**
  - `cd frontend && bun x vite build` -> ผ่าน
  - `cd frontend && bun x tsc --noEmit` -> rc 0

## 2. กติกาการจัดสรรสองโหมด (The rule now)

- **Grouping by underlying** — holdings จัดกลุ่มด้วย registry underlying:
  `asset_symbols.price_symbol` -> `asset_products.ticker`; broker ถูกเมิน
  holdings ที่ไม่มี registry row อยู่กลุ่ม `Unassigned`
  หลักฐาน: `_group_holdings_by_underlying` ใน
  `backend/app/routers/managed_funds.py`
- **Allocation base คำนวณสด** —
  `allocation_base = sum(qty × current_price) + portfolios.available_cash + cash_top_up`
  ไม่อ่าน `portfolios.current_nav` ในเส้นทางนี้
- **สองโหมดจาก `managed_fund_settings.allocation_mode`**
  - `neutral` (ค่า default เมื่อ column ว่าง): ทุกกลุ่มได้ `100 / N` เปอร์เซ็นต์
  - `weight`: แต่ละกลุ่มได้ `target_ratio[label]` เปอร์เซ็นต์ที่เก็บไว้
- **target_ratio contract**: key = allocation-group label (`asset_products.ticker`
  หรือ `Unassigned`), value = `0..100` ทศนิยมไม่เกิน 4 ตำแหน่ง;
  โหมด weight ต้องรวมได้ `100` ภายใน `1e-6`
  - `PUT /api/v1/managed-funds/{portfolio_id}/settings`: ค่าที่ส่งต้องรวม 100
    อยู่แล้ว ไม่งั้น `400`; ค่า mode อื่นที่ไม่ใช่ `neutral`/`weight` -> `400
    Unsupported allocation mode`; ค่า target นอกช่วง/เกิน 4 ตำแหน่ง -> `400`
  - `POST .../rebalance/calculate`: resolve row ที่เก็บไว้เป็น label ก่อน แล้ว
    ถ้ารวมไม่ 100 หรือกลุ่มที่ถืออยู่ไม่มี key -> `422`
  - key ที่ resolve ไม่ได้และไม่ใช่ label ของกลุ่มปัจจุบันจะถูก **drop**
    (ไม่ถูกนับ) — `Unassigned` เก็บไว้ได้เพราะเป็น label ที่ไม่มี registry row
- **Legacy migration on read**: row เก่าที่ key ด้วย `asset_symbols.price_symbol`
  ยังใช้ได้ — `resolve_allocation_labels` map เป็น product ticker
  (`UPPER(TRIM())`, ชนกันเลือก `symbol_id` ต่ำสุด) และถ้าค่าทั้งชุด ≤ `1.0`
  จะคูณ 100 ก่อน map; key ที่ยุบเป็น label เดียวกันจะถูก sum; write เก็บ label
- **Per-holding weight**: `managed_fund_holdings.rebalance_weight` (`0..100`,
  4 ตำแหน่ง) เป็นส่วนแบ่งของ **drift ของกลุ่มตัวเองเท่านั้น** ทั้งสองโหมด
  normalize ด้วย `weight / sum(weights)` ภายในกลุ่ม; ถ้าทุกตัวเป็น null/0
  fallback เป็นสัดส่วน market value ของ holding ในกลุ่ม
  weight เป็นค่าสัมพัทธ์ ไม่ต้องรวม 100
- **Drift/order**: group drift = `|target% - current%|`; target value =
  `allocation_base × pct / 100` (neutral `pct = 100/N`); ไม่มี drift
  suppression แล้ว — กลุ่มที่ balance พอดีเท่านั้นที่ไม่ emit order
- **Thresholds/alerts ถูกถอด**: `GET /managed-funds/{id}/alerts`, `MFAlertItem`,
  `MFAlertsResponse`, global/per-holding threshold หายจาก API และ UI แล้ว;
  คอลัมน์ `managed_fund_settings.global_profit_threshold` และ
  `managed_fund_holdings.profit_threshold` ถูก **drop** ออกจาก DB แล้วโดย
  startup migration (ดูข้อ 9) — models ไม่ประกาศ field เหล่านี้แล้ว
- **Frontend**
  - `PortfolioMutualFund.tsx`: ไม่มี toggle แล้ว — แต่ละกลุ่มแสดง
    `<pct>% target share` จาก stored mode (`neutral` = `100 / N`, `weight` =
    `target_ratio[label]`) และไม่มี `modeSaving`/`modeError`; การสลับโหมดย้าย
    เข้า edit modal
  - `MFEditPortfolioModal.tsx`: ไม่มีช่อง threshold แล้ว; Allocation section
    เป็นเจ้าของ toggle (`role="group"` `aria-label="Allocation mode"`,
    `Neutral` | `Weight (%)`, `aria-pressed`) และ grouped editor — หนึ่ง block
    ต่อ allocation group (registry underlying, `Unassigned` สุดท้าย): แถวกลุ่มมี
    ช่อง target percent ใน weight mode หรืออ่านอย่างเดียว `100 / N % share`
    ใน neutral, holdings ของกลุ่มเยื้องใต้แถวกลุ่มพร้อมช่อง `Rebalance weight (%)`
    ต่อ holding; ไม่มี section "Rebalance weights" แยกแล้ว; save ส่ง
    `allocation_mode` + `target_ratio` + `rebalance_weight` ของทุก holding

## 3. สัญญา API และตัวเลขที่ตรึงไว้ (API + numbers)

- `GET /api/v1/managed-funds/{portfolio_id}/settings`
  -> `MFSettingResponse`: `id`, `portfolio_id`, `target_ratio`
  (label -> percent หรือ `null`), `allocation_mode` (`neutral`|`weight`),
  `total_invested`, `last_rebalance_date`; ไม่มี field threshold
  (สร้าง row อัตโนมัติ และ backfill `target_ratio` จาก `portfolios.target_ratio`)
- `PUT /api/v1/managed-funds/{portfolio_id}/settings`
  body: `target_ratio?: Record<string, number>` (ส่ง `null` เพื่อล้าง),
  `allocation_mode?: "neutral" | "weight"`; ตอบกลับรูปเดียวกับ GET
- `POST /api/v1/managed-funds/{portfolio_id}/rebalance/calculate`
  body ไม่บังคับ `{"cash_top_up": number}` (default 0, ห้ามติดลบ/เกิน 8 ตำแหน่ง)
  response: `current_nav` (holdings + cash, ไม่รวม top-up), `allocation_base`
  (รวม top-up), `target_allocations` / `current_allocations` (group-keyed),
  `total_drift`, `recommendations[]` (`symbol`, `underlying`, `side`, `qty`,
  `estimated_price`, `estimated_value` ค่าบวกเสมอ, `reason`,
  `current_allocation`, `target_allocation`, `drift`)
- `PUT /api/v1/managed-funds/{portfolio_id}/holdings/{holding_id}`
  รับ `qty`, `price`, `rebalance_weight` (`0..100`, ≤4 ตำแหน่ง; ไม่ส่ง = คงค่า,
  `null` = ล้าง, `0` = ศูนย์)
- `GET /api/v1/managed-funds/{portfolio_id}/alerts` — **ถูกลบแล้ว**
- ตัวเลขที่ตรึง: 2 โหมด; neutral `100/N`; weight sum `100 ± 1e-6`;
  target `0..100`; legacy ≤`1.0` คูณ 100; per-holding weight `0..100`;
  router 13 endpoints; frontend `mf*` 12 methods

## 4. งานที่ยังค้าง (Open items)

1. **Mode-2 UI สร้าง target ให้ label ที่ยังไม่มี holding ไม่ได้**
   `MFEditPortfolioModal.groupLabelsOf()` สร้างรายการ label จาก holdings
   เท่านั้น และ `_effective_target_ratio()` ฝั่ง backend จะ drop key ที่ไม่ใช่
   registry label หรือ label ของกลุ่มปัจจุบัน ดังนั้น target ของ underlying
   ที่ยังไม่ถือจะไม่แสดงและไม่รอดผ่าน GET; ต้องตัดสินใจว่าจะเพิ่ม label
   จาก registry (ให้เลือกได้) หรือยอมให้ตั้ง target ได้เฉพาะกลุ่มที่ถืออยู่
2. **Node container ต้อง start ก่อน deploy**
   เจอ `investment-dashboard-control-plane` เป็น `Exited (0)` (ค้างมา ~13 ชม.)
   ทำให้ `scripts/kind-up.sh` fail ที่ขั้น image-load ด้วย
   `can only create exec sessions on running containers: container state improper`;
   แก้ด้วย `podman start investment-dashboard-control-plane` แล้วรอ API พร้อม
   จึงรัน `./scripts/kind-up.sh` ซ้ำ (ดูข้อ 1) ถ้าเจออีกให้เช็ค `podman ps`
   ก่อนเป็นอันดับแรก

## 5. จุดเริ่มต้นสำหรับ session ถัดไป (Next session)

- อ่าน `backend/app/routers/managed_funds.py`: `_effective_target_ratio`,
  `update_settings`, `calculate_rebalance`,
  `_group_holdings_by_underlying` และ `backend/app/services/asset_registry.py`:
  `resolve_allocation_labels` ก่อนแก้
- อ่าน frontend: `PortfolioMutualFund.tsx` (`activeMode`, `holdingGroups`)
  และ `MFEditPortfolioModal.tsx` (`groupLabelsOf`, `initialAssetWeights`,
  `handleSave`)
- ถ้าจะปิด open item 1: เปลี่ยนแหล่ง label ของ modal จาก holdings เป็น registry
  products (mutual fund) แล้วตรวจว่า GET settings คืน target ของ label ที่ยัง
  ไม่ถือหรือไม่ (ปัจจุบัน drop)
- ก่อน commit docs รอบนี้: `git status` ต้องเห็นเฉพาะไฟล์ Markdown ที่ตั้งใจ;
  ห้าม commit `ExampleFundAllocationCal.xlsx`
- Deploy รอบ two-mode + `b4103e3` เสร็จแล้ว (ข้อ 1) และทดสอบ grouped editor
  กับ toggle ใน modal บน fund 2 ผ่านแล้ว (ตัวเลขตามข้อ 1); fund ถูกทิ้งไว้ที่
  `allocation_mode=weight` target `{"S&P500":50,"CHA":50}` และ weight 50/50/100
  - ถ้าจะ deploy ซ้ำหลังแก้ open item: เช็ค `podman ps` ว่า
    `investment-dashboard-control-plane` ไม่ใช่ `Exited` (ถ้าใช่ให้
    `podman start` ก่อน) แล้วรัน `./scripts/kind-up.sh`
  - เคสที่ยังไม่ได้ปิดคือ label ที่ยังไม่มี holding (open item 1) ซึ่งปัจจุบัน
    ถูก drop จาก GET settings

## 6. Follow-up commit `b4103e3` — grouped allocation editor

`b4103e3` ต่อจาก `b8e6a6a`: ย้ายเจ้าของโหมดจาก header เข้า edit modal และเปลี่ยน
Allocation section เป็น grouped editor (แตะ frontend 3 ไฟล์:
`MFEditPortfolioModal.tsx`, `PortfolioMutualFund.tsx`, `PortfolioMutualFund.test.tsx`)

- **Toggle ใน modal** — `MFEditPortfolioModal.tsx` ถือ `activeMode`
  (`useState<MFAllocationMode>` จาก `settings?.allocation_mode`) และ render
  segmented `Neutral` | `Weight (%)` ใน `role="group"` `aria-label="Allocation mode"`
  (`aria-pressed` ต่อปุ่ม) ใต้หัวข้อ `Allocation`; `handleSave` ส่ง
  `allocation_mode` + `target_ratio` ผ่าน `mfUpdateSettings` แล้วตามด้วย
  `mfUpdateHolding` ต่อ holding เพื่อเขียน `rebalance_weight`
- **หน้าเพจ** — `PortfolioMutualFund.tsx` ไม่มี toggle, `modeSaving`,
  `modeError` แล้ว; แต่ละกลุ่มแสดง `{targetPct.toFixed(1)}% target share`
  จาก `activeMode` (`weight` = `settings?.target_ratio?.[group.label] ?? 0`,
  `neutral` = `100 / groupCount`)
- **Grouped Allocation layout** — หนึ่ง block ต่อ group จาก `groupLabelsOf()`
  (registry underlying, `Unassigned` ท้ายสุด): แถวกลุ่มมี target input ใน
  weight mode (`aria-label` "`<label>` target weight") หรือ read-only
  `(100 / N).toFixed(1)% share` ใน neutral; holdings เยื้องใต้แถวกลุ่ม
  (`paddingLeft: 16`) พร้อม `aria-label` "`<asset>` rebalance weight";
  section "Rebalance weights" แยกถูกถอดแล้ว
- **Equal-split default** (`initialAssetWeights`) — กลุ่มที่ทุก holding มี
  `rebalance_weight == null` ถูก prefill `100 / n` (ทศนิยม 2 ตำแหน่ง, เศษปัด
  ไปตัวสุดท้าย, `n = 1` → `100`); ถ้ามี stored weight อย่างน้อยหนึ่งตัว ค่าที่
  เหลือเว้นว่างและช่องว่างยัง save เป็น `null` (server fallback เป็น market
  value); weight ยังสัมพัทธ์ ไม่บังคับรวม 100
- **Validation เท่าเดิม** — group targets ต้องรวม 100 ใน weight mode
  (client `Math.abs(targetSum - 100) > 1e-6` + server `400`); neutral ไม่มี
  input target จึง round-trip ค่าที่มีอยู่ และหน้าแสดง `sum <X> / 100`
- **Tests** — `PortfolioMutualFund.test.tsx` เพิ่มเคส grouped rows,
  equal-split prefill, partial group ที่เหลือ blank และ neutral read-only share
- **Deploy แล้ว** — `b4103e3` ถูก deploy ขึ้น kind cluster (backend + frontend
  rollout ใหม่, `postgres-main` ไม่ถูกแตะ) และ verify grouped editor/toggle
  ใน modal บน fund 2 ผ่าน; ตัวเลขดูข้อ 1

## 7. Follow-up commit `137856e` — collapsible allocation groups

`137856e` ต่อจาก `b4103e3`: ทุก allocation group ย่อ/ขยายได้ทั้งใน Asset list และ
Allocation editor โดยใช้ Chevron ตัวเดียวร่วมกัน (แตะ frontend 5 ไฟล์:
`components/Chevron.tsx` ใหม่, `pages/AllAssets.tsx`, `screens/PortfolioMutualFund.tsx`,
`screens/MFEditPortfolioModal.tsx`, `screens/PortfolioMutualFund.test.tsx`)

- **Shared `Chevron`** — ย้าย `Chevron({open, size})` ออกจาก `AllAssets.tsx` ไปเป็น
  `frontend/src/components/Chevron.tsx` (chevron ลงเมื่อ `open`, หมุน -90° เมื่อยุบ);
  `AllAssets.tsx` import ตัวใหม่และพฤติกรรมเดิมไม่เปลี่ยน
- **หน้าเพจ (`PortfolioMutualFund.tsx`)** — group header เดิมเป็น static row
  กลายเป็น `<button type="button" className="mf-row mf-group-row">` ที่คงแถบ
  `--color-surface-soft` + hairline เดิม พร้อม `Chevron`, `aria-expanded` และ
  `aria-label` `Collapse <label>` / `Expand <label>`; การยุบซ่อนเฉพาะ
  `mf-split-row` (`data-testid="group-split-<label>"`) และ holding rows ของกลุ่มนั้น
  ส่วน header และ `<pct>% target share` ยังแสดงอยู่
- **Modal (`MFEditPortfolioModal.tsx`)** — group row ของ Allocation section ใช้
  toggle เดียวกัน (`aria-expanded`, `aria-label` `Collapse <label>` / `Expand <label>`);
  การยุบซ่อนเฉพาะ weight input ของ holding ในกลุ่มนั้น ส่วน group target input
  (weight mode) หรือข้อความ `% share` (neutral) และ helper `sum <X> / 100`
  ยังมองเห็นและแก้ได้
- **State model** — `useState<Set<string>>(() => new Set())` ที่ระดับ component
  ของทั้งสอง surface; Set ว่าง = ขยายทุกกลุ่ม (default expanded) และการ toggle
  สร้าง Set ใหม่ต่อครั้ง จึงไม่กระทบกลุ่มอื่น
- **ไม่เพิ่ม shadcn `Trace`** — `Trace` เป็น step list ของ AI agent ไม่ใช่ table
  primitive repo จึงใช้ `Chevron` + `aria-expanded` ที่มีอยู่แทน
- **Tests/Deploy** — commit message ระบุ frontend tests 146 ตัวผ่าน, `vite build`
  และ `tsc` clean; build นี้ถูก deploy ขึ้น kind cluster และเช็คใน browser แล้ว:
  ยุบ `S&P500` บนหน้าเพจทำให้เหลือ 5 → 3 rows และใน modal ยังเห็น target input
  `50`% อยู่ขณะที่ holding `VOO`/`ABC` ถูกซ่อน

## 8. Follow-up commit `db4991c6` — compact holding rows + allocation groups collapsed by default

`db4991c6` ต่อจาก `137856e` โดยไม่แตะ logic/สัญญา API — เป็นการปรับขนาดตัวอักษร
และค่าเริ่มต้นของการยุบกลุ่มเท่านั้น (แตะ 3 ไฟล์: `frontend/src/index.css`,
`frontend/src/screens/MFEditPortfolioModal.tsx`,
`frontend/src/screens/PortfolioMutualFund.test.tsx`)

- **ขนาดตัวอักษรฝั่งหน้าเพจ** — เพิ่มกฎ `.mf-holdings .mf-row { font-size:
  var(--fs-micro); }` (`--fs-micro` = 10px, เทียบ `--fs-label` = 11px) ทำให้
  holding row ใน Asset list เล็กลงหนึ่งขั้น; card header (`.mf-card-h h2` ยังเป็น
  `--fs-label`) และ `mf-split-row` ไม่เปลี่ยน
- **ขนาดตัวอักษรใน modal** — `ASSET_NAME` (ชื่อ asset ของ holding) เปลี่ยนจาก
  `var(--fs-label)` เป็น `var(--fs-micro)` และ suffix `%` ใช้
  `text-[length:var(--fs-micro)]`; group label และ input ของ group target
  คงขนาดเดิม
- **Default-collapse ของ modal** — ตอน modal เปิด `collapsedGroups` ถูก seed
  ด้วย `new Set(groupLabelsOf(holdings))` คือทุก label ของกลุ่มปัจจุบัน จึงเริ่ม
  แบบยุบทุกกลุ่ม (เดิม `new Set()` = ขยายทุกกลุ่ม); group label, chevron,
  target input / `% share`, running sum และ help text ยังมองเห็น ส่วนการกด
  `Expand <label>` เผย weight input ของ holding ในกลุ่มนั้น
- **ค่า default ของหน้าเพจไม่ถูกแตะ** — `PortfolioMutualFund.tsx` ยังใช้
  `useState<Set<string>>(() => new Set())` และ Asset list จึงยังขยายทุกกลุ่ม
  เหมือนเดิม; เฉพาะ modal ที่เริ่มแบบยุบ
- **ค่าที่ซ่อนยังถูกบันทึก** — weight input ที่ถูกซ่อนยังมีค่าอยู่ใน state
  `perAssetWeight` (prefill เดิม) ดังนั้นกด Save โดยไม่ขยายกลุ่มก็ยังเขียนค่า
  เหล่านั้นครบ; tests เพิ่มเคส "saves prefilled weights for every holding without
  expanding a group" และเคสเดิมที่ต้องอ่าน holding ต้องกด `Expand <label>` ก่อน
- **Browser check** — holding rows วัดได้ 10px เทียบ card header 11px; เปิด modal
  แล้วเห็น 0 weight input ขณะที่ target `50`/`50` ของสองกลุ่มยังแสดง; กดขยาย
  `S&P500` แล้วเห็น `VOO`/`ABC` ที่ 10px
- **Tests** — commit message ระบุ frontend tests 147 ตัวผ่าน, `vite build` และ
  `tsc` clean

## 9. Threshold column drop — คอลัมน์ threshold ออกจาก DB จริงแล้ว

ต่อจาก `db4991c6` (worktree ยังไม่ commit): เลิกเก็บคอลัมน์ threshold ที่ค้างจาก
ฟีเจอร์ alerts ที่ถูกถอดไปแล้ว ไม่แตะ API/UI/สัญญา allocation

- **Models** — `backend/app/managed_fund_models.py` ไม่ประกาศ
  `ManagedFundHolding.profit_threshold` และ
  `ManagedFundSetting.global_profit_threshold` อีกแล้ว (ไม่มี default 0 ค้างอยู่)
- **Startup migration** — `backend/app/asset_registry_migration.py` เพิ่ม
  `_drop_column(conn, table, column)` (guard ด้วย `_column_exists`, เป็น
  `ALTER TABLE ... DROP COLUMN` ตรง ๆ ไม่มี index/backfill) และเรียกใน
  `_retained_portfolio_migrations` สำหรับ
  `managed_fund_holdings.profit_threshold` และ
  `managed_fund_settings.global_profit_threshold`; รันใน transaction เดียวกับ
  startup migration อื่น จึง idempotent — DB เก่าที่ยังมีคอลัมน์จะเสียคอลัมน์
  ทั้งสองตอน backend boot ครั้งถัดไป
- **Schema** — `database/main_db_schema.sql` ไม่มีคอลัมน์ทั้งสองแล้ว
- **Live verify บน kind cluster หลัง deploy** — `information_schema.columns`
  ไม่มี `profit_threshold` บน `managed_fund_holdings` และไม่มี
  `global_profit_threshold` บน `managed_fund_settings`; ข้อมูลเดิมอยู่ครบ:
  holdings `VOO`/`ABC` qty 50 และ `SCBCHAE` qty 100, settings ยังเป็น
  `allocation_mode=weight` target `S&P500` 50 / `CHA` 50
- **Docs** — `database/README.md`, `DESIGN.md`, `.opencode/AGENT.md`,
  `handoff.md` เปลี่ยนคำอธิบายคอลัมน์จาก "ยังเก็บไว้แต่ไม่ใช้" เป็น
  "dropped by the startup migration"; `README.md`/`backend/README.md`/
  `frontend/README.md` ไม่มีคำกล่าวอ้างว่าคอลัมน์ยังอยู่ จึงไม่ต้องแก้
- **Tests** — `backend/tests/test_asset_registry_migration.py` เพิ่มเคส drop
  (คอลัมน์หาย, แถวและค่าอื่นคงอยู่, รันซ้ำได้)

## 10. Follow-up commit `1029f60` — grouped rebalance table + Rebalance entry point เดียว

`1029f60` ต่อจาก `940b1ee`: ทำตาราง rebalance ให้จัดกลุ่มตาม underlying และเหลือ
ปุ่ม Rebalance ปุ่มเดียวบนหน้า (แตะ backend router + types + modal + page + tests;
docs รอบนี้แก้ `DESIGN.md`, `.opencode/AGENT.md`, `backend/README.md`,
`frontend/README.md`, `handoff.md`)

- **Response field ใหม่** — `MFRebalanceResponse.groups: List[MFRebalanceGroup] = []`
  โดย `MFRebalanceGroup` มี `label`, `current_value`, `target_value`,
  `current_pct`, `target_pct`, `drift`, `order_value`; `calculate_rebalance`
  เติมหนึ่ง entry ต่อ allocation group ตามลำดับที่เจอก่อน (first-seen) และ group
  ที่ `order_value` เป็น 0 ก็ยังถูกส่งมา; path ที่ไม่มี group คืน `groups=[]`
  พร้อม `recommendations=[]` (group ยังสรุปจาก `recommendations` ฝั่ง client ไม่ได้)
- **ตารางใน modal จัดกลุ่มแล้ว** — `MFRebalanceRecommendModal.tsx` เรนเดอร์แถว
  กลุ่มก่อน (Current = `current_value`, Target = `target_value`, Allocation
  `<current_pct>% → <target_pct>%` หนึ่งตำแหน่ง, Drift, Order value ที่มีเครื่องหมาย)
  แล้วจึงเป็น holding ของกลุ่มนั้นเยื้องเข้าไป (Current = `holding.market_value`,
  Qty พร้อม chip Buy/Sell, Price, Order value ตาม side) — ทุกหัวตารางและทุก cell
  อยู่ที่ `--fs-micro` (10px) คอลัมน์คือ
  `Asset | Current | Target | Allocation | Drift | Qty | Price | Order value`;
  holding ที่ไม่มี recommendation ไม่แสดง Qty/Price/Order value;
  `Total drift` รวม `groups[].drift` กลุ่มละครั้ง (ไม่ใช่ต่อ holding) จึงตรงกับ
  แถวกลุ่มที่เห็น; modal รับ `groups` + `holdings` จากหน้าเพิ่ม
- **Header เหลือชุด action เดียว** — `PortfolioMutualFund.tsx` ไม่ส่ง
  `extraActions` ให้ `PortfolioHeader` แล้ว จึงเหลือปุ่ม `Edit portfolio` และ
  `Refresh` เท่านั้น; ปุ่ม `Rebalance` ใน card Rebalance (`.mf-rebalance-btn`)
  เป็นทางเข้า modal เพียงทางเดียว; ปิด modal ล้างทั้ง `rebalanceRecs` และ
  `rebalanceGroups`
- **Live check หลัง deploy (fund 2, allocation base `$4,330.00`)**:
  - header มีปุ่ม `Edit portfolio` + `Refresh` เท่านั้น และทั้งหน้าเหลือปุ่ม
    `Rebalance` ปุ่มเดียว (ใน card Rebalance)
  - modal แสดงแถวกลุ่ม `CHA` `23.1% → 50.0%` (`$1,000.00 → $2,165.00`,
    order `$1,165.00`) เหนือ holding ของกลุ่ม และแถวกลุ่ม `S&P500`
    `24.7% → 50.0%` (`$1,070.00 → $2,165.00`, order `$1,095.00`) เหนือ
    `VOO $547.50` / `ABC $547.50`
  - footer: Allocation base `$4,330.00`, Total drift `52.2%`
- **Tests** — commit message ระบุ backend rebalance 42 passed, frontend 154
  passed, `vite build` และ `tsc` clean; เคสใหม่ใน
  `MFRebalanceRecommendModal.test.tsx` ตรวจแถวกลุ่ม/`data-testid`
  `rebalance-group-<label>` และ `rebalance-holding-<id>`, และ
  `PortfolioMutualFund.test.tsx` ตรวจว่า header ไม่มีปุ่ม Rebalance

## 11. Follow-up commit `ce58ce07` — Top-up cash เปิดมาเป็นค่าว่าง แสดง 0 เป็น placeholder

- `MFRebalanceRecommendModal.tsx`: ช่อง `Top-up cash ($)` เปิดมาเป็นค่าว่าง
  (`useState("")` และรีเซ็ตเป็น `""` ทุกครั้งที่เปิด modal) โดยแสดง `0` เป็น
  `placeholder="0"` ในสี placeholder — ค่าเริ่มต้นยังเห็นได้แต่ไม่ใช่ค่าจริงในช่อง
  จึงพิมพ์ตัวเลขได้ทันทีโดยไม่ต้องลบ 0 ก่อน; ค่าว่างยังถือว่าถูกต้องและหมายถึง 0
  โดยจำนวนที่ใช้คำนวณคือ
  `topUp.trim() === "" ? 0 : parseTopUpAmount(topUp)` (`parseTopUpAmount` ใน
  `utils/mfWeights.ts` ไม่เปลี่ยน — ค่าว่างยังคืน `null`) การเปิด modal จึงตั้ง
  `lastApplied.current = 0` ควบคู่กับการล้างช่อง ทำให้ไม่ยิง recalculate
  ด้วย 0 ซ้ำ แต่การลบค่าที่ไม่ใช่ศูนย์จนว่างจะคำนวณใหม่ด้วย 0; อินพุตที่ไม่ใช่
  ตัวเลขหรือติดลบยังขึ้น "Enter a non-negative amount." และไม่คำนวณใหม่
- **Live check (fund 2)**: เปิด modal แล้วช่อง top-up ว่างและมี `0` สีเทาเป็น
  placeholder, Allocation base `$4,330.00`; พิมพ์ `100` ลงไปได้เลย base เปลี่ยนเป็น
  `$4,430.00`; ล้างช่อง base กลับมา `$4,330.00` โดยไม่มี error
- Tests: commit ระบุ frontend 157 passed, `vite build` และ `tsc` clean; เคสใน
  `MFRebalanceRecommendModal.test.tsx` ตรวจว่า input ว่างและ `placeholder` เป็น
  `"0"` ตอนเปิด, ไม่มี recalculate ตอนเปิด, พิมพ์ `100` ตรงๆ แล้วเรียก
  `onRecalculate(100)`, ล้างช่องแล้วเรียก `onRecalculate(0)` โดยไม่มี error, และ
  อินพุตติดลบยังขึ้น error
