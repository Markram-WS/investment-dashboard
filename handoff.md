# Handoff — Managed Fund allocation สองโหมด (neutral / weight)

เอกสารนี้สรุปงาน Managed Fund allocation รอบล่าสุด (two-mode) เพื่อให้ session ถัดไป
ทำงานต่อได้ทันที ทุก path, field และตัวเลขในนี้ตรวจกับ code ใน worktree แล้ว
(ยังไม่ commit)

## 1. สถานะปัจจุบัน (State)

- Branch `feature/custom-port` — การเปลี่ยนแปลงทั้งหมดยังอยู่ใน worktree
  **ยังไม่ commit และยังไม่ push**
- Code ที่แก้ (8 ไฟล์):
  - `backend/app/routers/managed_funds.py` — two-mode allocation, target_ratio
    label contract, ถอด alerts
  - `backend/app/services/asset_registry.py` — `resolve_allocation_labels`
  - `backend/tests/test_managed_fund_rebalance_api.py`
  - `frontend/src/types/index.ts` — `MFAllocationMode`, ถอด `MFAlert`/threshold
  - `frontend/src/lib/api.ts` — `allocation_mode: 'neutral' | 'weight'`,
    ถอด `mfAlerts`
  - `frontend/src/screens/PortfolioMutualFund.tsx` — header toggle
  - `frontend/src/screens/MFEditPortfolioModal.tsx` — target inputs ต่อกลุ่ม
  - `frontend/src/screens/PortfolioMutualFund.test.tsx`
- Docs ที่อัปเดตรอบนี้: `DESIGN.md`, `.opencode/AGENT.md`, `handoff.md`,
  `README.md`, `backend/README.md`, `frontend/README.md`, `database/README.md`
- ไฟล์ untracked เดิม: `ExampleFundAllocationCal.xlsx` (ไม่เกี่ยวกับงานนี้)
- **Deploy แล้วใน session นี้**: build ใหม่จาก worktree แล้ว deploy ขึ้น kind
  cluster เดิมด้วย `./scripts/kind-up.sh`; backend + frontend rollout ใหม่
  ส่วน `postgres-main` ไม่ถูกแตะ ข้อมูลเดิมคงอยู่ — UI ใช้ได้ที่
  http://localhost:8080
  - ก่อน deploy node container ค้างเป็น `Exited` มาแล้ว ~13 ชั่วโมง
    (`podman ps` แสดง `investment-dashboard-control-plane Exited (0)`)
    ทำให้ kind-up fail ที่ขั้น image-load ด้วย
    `can only create exec sessions on running containers: container state improper`
  - วิธีแก้: `podman start investment-dashboard-control-plane` แล้วรอ API
    พร้อม จากนั้นรัน `./scripts/kind-up.sh` ซ้ำ -> ผ่าน
- **Live verify บน fund 2** (allocation base 4,330 = cash 2,260 + holdings 2,070):
  - `GET settings` คืน legacy symbol keys ที่ยุบเป็น label แล้ว
    `{"S&P500": 0.0}` โหมด `neutral`
  - กด `Weight (%)` ตอนยังไม่มี target -> ถูก reject ด้วย
    `Target weights must sum to 100` และ edit modal เปิดขึ้นเองให้แก้ตัวเลข
  - ใส่ 70 / 30 ให้ S&P500 / CHA ในโหมด neutral -> บันทึกผ่าน (neutral ไม่มี
    กติกาผลรวม) และ `GET settings` คืน `{"S&P500": 70.0, "CHA": 30.0}`
  - สลับเป็น `Weight (%)` -> persist `allocation_mode=weight` และหน้าแสดง
    target share 70.0% / 30.0%
  - `POST rebalance/calculate` โหมด weight: `target_allocations`
    `{"S&P500":70,"CHA":30}`, current 24.71% / 23.09%, `total_drift` 52.19,
    recommendations `ABC Buy 40.3196 @25 = 1,007.99`,
    `VOO Buy 36.6542 @26 = 953.01`, `SCBCHAE Buy 14.9500 @20 = 299.00`
    — ยอด buy รวมเท่ากับ cash 2,260
  - ตั้ง `rebalance_weight` ของ ABC = 100 -> drift ของ S&P500 ทั้งก้อน 1,961
    ย้ายไป ABC; ล้างค่า -> กลับมาแบ่งตาม market value
    (ABC 1,007.99 / VOO 953.01)
  - ทิ้ง fund ไว้ที่ `allocation_mode=neutral` พร้อม target
    `{"S&P500":70,"CHA":30}` เก็บไว้สำหรับสลับโหมดภายหลัง
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
  `managed_fund_holdings.profit_threshold` ยังอยู่ใน DB แต่ไม่มีใครอ่าน/เขียน
- **Frontend**
  - `PortfolioMutualFund.tsx`: header มี segmented `Neutral` | `Weight (%)`;
    กดแล้ว `PUT .../settings` ด้วย `allocation_mode` แล้ว recalculate;
    ถ้า server reject จะเปิด edit modal ให้แก้ target ทันที
  - `MFEditPortfolioModal.tsx`: ไม่มีช่อง threshold แล้ว; มี target input
    ต่อ held group (แสดง `sum X / 100`) และช่อง `Rebalance weight (%)`
    ต่อ holding; บันทึก neutral อนุญาต partial target, บันทึก weight
    บังคับ sum 100

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
2. **คอลัมน์ threshold ที่เลิกใช้ยังอยู่ใน DB**
   `managed_fund_settings.global_profit_threshold` และ
   `managed_fund_holdings.profit_threshold` (models ยังประกาศ default 0)
   ยังไม่ drop — ต้องตัดสินใจว่าจะเก็บไว้เฉย ๆ หรือทำ migration ลบคอลัมน์
3. **Node container ต้อง start ก่อน deploy**
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
- อ่าน frontend: `PortfolioMutualFund.tsx` (`handleAllocationModeChange`,
  `activeMode`) และ `MFEditPortfolioModal.tsx` (`groupLabelsOf`, `handleSave`)
- ถ้าจะปิด open item 1: เปลี่ยนแหล่ง label ของ modal จาก holdings เป็น registry
  products (mutual fund) แล้วตรวจว่า GET settings คืน target ของ label ที่ยัง
  ไม่ถือหรือไม่ (ปัจจุบัน drop)
- ก่อน commit: รันชุด verify ในข้อ 1 ซ้ำ แล้ว `git status` ต้องเห็นเฉพาะไฟล์
  code/test/docs ที่ตั้งใจ; ห้าม commit `ExampleFundAllocationCal.xlsx`
- Deploy รอบนี้ทำเสร็จแล้ว (ข้อ 1) และทดสอบ toggle สองโหมดบน fund 2 ผ่านแล้ว
  (fund ถูกทิ้งไว้ที่ `neutral` พร้อม target `{"S&P500":70,"CHA":30}`)
  - ถ้าจะ deploy ซ้ำหลังแก้ open item: เช็ค `podman ps` ว่า
    `investment-dashboard-control-plane` ไม่ใช่ `Exited` (ถ้าใช่ให้
    `podman start` ก่อน) แล้วรัน `./scripts/kind-up.sh`
  - หลัง deploy ให้ทดสอบ toggle บน fund 2 อีกครั้ง; เคสที่ยังไม่ได้ปิดคือ
    label ที่ยังไม่มี holding (open item 1) ซึ่งปัจจุบันถูก drop จาก GET settings
