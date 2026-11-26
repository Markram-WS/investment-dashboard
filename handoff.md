# Handoff — Managed Fund allocation (live allocation base + per-holding weights)

เอกสารนี้สรุปสถานะงาน Managed Fund allocation ณ สิ้นสุด session นี้ เพื่อให้ session
ถัดไป (คนหรือ agent) ทำงานต่อได้ทันทีโดยไม่ต้องไล่ derive ใหม่ ทุกตัวเลขและ path
ในนี้ถูกตรวจสอบแล้วใน session นี้

## 1. สถานะปัจจุบัน (State)

- Branch `feature/custom-port`, HEAD `88d5495`, working tree สะอาด ยกเว้นไฟล์
  untracked `ExampleFundAllocationCal.xlsx`
- Commit ที่เกี่ยวข้อง เรียงตามลำดับ:
  - `575aaf0` — จัดกลุ่ม holding ตาม registry underlying, broker อ่านจาก registry
  - `008b4bd` — neutral underlying-group allocation แทน per-symbol target
  - `87a9bc4` — allocation base เปลี่ยนเป็น NAV ของกอง (รวม cash)
  - `684d0e9` — docs (DESIGN + API table)
  - `9f260d5` — docs (handoff notes ของโมเดล allocation)
  - `88d5495` — per-holding rebalance weight บน allocation base ที่คำนวณสด
- Deploy อยู่บน kind cluster: context `kind-investment-dashboard`, namespace
  `investment-dashboard`, เปิด UI ที่ http://localhost:8080
- โมเดลที่ ship อยู่: neutral underlying-group + per-holding weight
  ส่วน mode 2 ยังไม่ถูกสร้าง (ดูข้อ 5)

## 2. กติกาการจัดสรรตอนนี้ (The rule now)

- **Grouping by underlying, ไม่ใช่ symbol และไม่ใช่ broker**
  holdings ถูกจัดกลุ่มด้วย registry underlying: `asset_symbols.price_symbol` ->
  `asset_products.ticker`; broker ถูกเมินโดยเจตนา holdings ที่ไม่มี registry row
  จะตกไปอยู่กลุ่ม `Unassigned`
  หลักฐาน: `backend/app/routers/managed_funds.py` ฟังก์ชัน
  `_group_holdings_by_underlying`
- **มูลค่า holding** = `qty * current_price` (ไม่ใช่ `avg_entry_price` ซึ่งเป็นต้นทุน)
  มูลค่ากลุ่ม = ผลรวมมูลค่า holding ในกลุ่ม
- **Allocation base คำนวณสดทุกครั้ง ไม่ใช้ `portfolios.current_nav`:**
  `allocation_base = sum(group.value) + portfolios.available_cash + cash_top_up`
  โดย `cash_top_up` มาจาก body ของ request (ไม่ส่ง body = 0)
  `portfolios.current_nav` ไม่ถูกอ่านในเส้นทางนี้เลย
  หลักฐาน: `managed_funds.py` ฟังก์ชัน `calculate_rebalance` (`cash_top_up`,
  `live_nav`, `allocation_base` — ประมาณบรรทัด 670-674)
- **Neutral mode:** ทุกกลุ่มได้ target เท่ากัน คือ `allocation_base / N`
  (target % = `100/N`); current share = `group.value / allocation_base`;
  drift % = `|target% - current%|`; `total_drift` = ผลรวม drift รายกลุ่ม
  กลุ่มที่มูลค่าเป็น 0 และมี drift จะถูกปฏิเสธถ้าไม่มี positive weight (ข้อ 422)
- **การแบ่ง buy/sell ภายในกลุ่ม:** ใช้ `managed_fund_holdings.rebalance_weight`
  เป็น**ส่วนแบ่งของ drift ของกลุ่มนั้น** (ไม่ใช่ส่วนแบ่งของมูลค่ากลุ่ม)
  normalize ภายในกลุ่มด้วย `weight / sum(weights)`;
  ถ้าทุก weight ในกลุ่มเป็น null หรือ 0 จึง fallback เป็นสัดส่วนมูลค่าตลาด
  (`holding market value / group.value`)
  หลักฐาน: `calculate_rebalance` ส่วน `weights` / `shares` (บรรทัด ~739-760),
  และ frontend mirror ที่ `frontend/src/utils/mfWeights.ts`
- **คอลัมน์ weight:** `managed_fund_holdings.rebalance_weight NUMERIC(10,4)`
  nullable, ไม่มี default, ไม่มี backfill; เพิ่มโดย main-DB startup migration
  ใน `backend/app/asset_registry_migration.py` ฟังก์ชัน
  `_retained_portfolio_migrations` (บรรทัด ~406)
  `PUT .../holdings/{id}`: ไม่ส่ง field = คงค่าเดิม, ส่ง `null` = ล้างค่า,
  ส่ง `0` = เก็บเป็นศูนย์; ค่าที่รับต้องอยู่ 0-100 และไม่เกิน 4 ตำแหน่งทศนิยม
- **ไม่มี drift suppression แล้ว:** เดิมมีเกณฑ์ตัด drift ต่ำกว่า 0.5 percentage point
  ตอนนี้ถอดออกแล้ว ดังนั้นผลรวม `estimated_value` (ค่าบวก, `side` บอกทิศ)
  ของทุก recommendation เท่ากับ `available_cash + cash_top_up` ที่ความละเอียด 1e-8
  เศษจากการ quantize ถูกจัดสรรคืนแบบ deterministic ให้บรรทัดที่มีมูลค่าสูงสุด
  หลักฐาน: `_VALUE_QUANTUM = Decimal("0.00000001")` และบล็อก `net_residual`
- **Cash อยู่ใน base เสมอ:** neutral mode จึงดูด cash ที่มีอยู่เข้า holdings ทั้งก้อน
  (`cash_top_up` เป็นเพียง simulation ไม่ได้ฝากเงินจริง — ต้องเติม cash จริงก่อน
  confirm buy ที่ต้องใช้เงินนั้น)
- **Profit threshold ระดับ global ยังหาร N ทาง:** threshold ของกลุ่ม = global/N,
  และ threshold ที่ใช้เตือนจริง = `max(holding.profit_threshold, group threshold)`
  หลักฐาน: `managed_funds.py` ฟังก์ชัน `check_alerts` (บรรทัด ~1287-1304)
  (สูตรนี้ไม่เปลี่ยนใน commit นี้)

## 3. ตัวเลขจริงบน fund 2 (วัดจาก API และ UI ที่ render จริง)

ที่มา: เรียก API และเทียบกับหน้าจอที่ deploy อยู่

- Allocation base 4,230 = cash 2,260 + holdings 1,970
  - VOO: 20 x 26 = 520
  - ABC: 22 x 25 = 550
  - SCBCHAE: 50 x 18 = 900
- กลุ่มและ drift:
  - S&P500 (VOO + ABC) current 25.30% -> target 50%, drift 24.70
  - CHA (SCBCHAE) current 21.28% -> target 50%, drift 28.72
  - total drift 53.43 (ผลรวม drift รายกลุ่ม, ค่าที่ยังไม่ปัด)
- Orders เมื่อ weight ทุกตัวว่าง (fallback market-value):
  - VOO Buy 19.5327 @ 26
  - ABC Buy 21.4860 @ 25
  - SCBCHAE Buy 67.5 @ 18
  - มูลค่า buy รวมกันเท่ากับ cash 2,260 พอดี (เพราะ cash อยู่ใน base)
- Weight test: ตั้ง VOO = 100 ทำให้ VOO ได้ drift ทั้ง 1,045 ของกลุ่ม S&P500
  (ABC ได้ 0) ส่วน SCBCHAE ยังได้ 1,215 ตามเดิม
- Top-up test: พิมพ์ top-up 1,000 ทำให้ base 4,230 -> 5,230 และ buy รวมเป็น
  3,260 = cash 2,260 + top-up 1,000; response ยังรายงาน `current_nav` = 4,230
  (holdings + available_cash) แยกจาก `allocation_base` = 5,230
- Alerts: VOO (P/L 30%) และ ABC (25%) ยิงที่ threshold 25.0; SCBCHAE ไม่ยิง

## 4. API ที่ถูกแตะ (API surface)

- `POST /api/v1/managed-funds/{id}/rebalance/calculate`
  - body ไม่บังคับ: `{"cash_top_up": number}` (ไม่ส่ง body = 0; ต้องไม่ติดลบ
    และไม่เกิน 8 ตำแหน่งทศนิยม)
  - response: `current_nav` (= holdings market value + `available_cash`,
    ไม่รวม top-up), `allocation_base` (รวม top-up),
    `target_allocations` / `current_allocations` แบบ group-keyed,
    `total_drift`, และ `recommendations`
  - recommendation แต่ละแถวมี `symbol`, `underlying`, `side`, `qty`,
    `estimated_price`, `estimated_value` (ค่าบวกเสมอ; `side` เป็นตัวบอกทิศ),
    `reason`, `current_allocation`, `target_allocation`, `drift`
  - 422 (ก่อน emit recommendation ใด ๆ) เมื่อ: ขายแบบ weighted เกินมูลค่า holding
    ที่ mark ไว้, buy ที่มี weight แต่ไม่มีราคาที่ใช้ได้, order ที่ปัดแล้วเป็น 0,
    กลุ่มมูลค่า 0 ที่มี drift และไม่มี positive weight, allocation base <= 0,
    และมี cash/top-up แต่ไม่มี underlying group เลย
- `PUT /api/v1/managed-funds/{id}/holdings/{holding_id}`
  รับ `qty`, `price`, `rebalance_weight` (semantics ตามข้อ 2)
  หมายเหตุ: schema `MFHoldingUpdate` **ไม่ประกาศ** `profit_threshold`
  จึงเป็นบั๊กที่ยังค้าง (ข้อ 5.1)
- `GET /api/v1/managed-funds/{id}/holdings`
  แต่ละ row มี `rebalance_weight`, `broker_id`, `broker_code` และ `underlying`
  ที่ derive มาให้แล้ว
- `GET` / `PUT /api/v1/managed-funds/{id}/settings` (field `allocation_mode`,
  รับเฉพาะ `'neutral'`)
- `GET /api/v1/managed-funds/{id}/alerts` (ไม่เปลี่ยน)
- UI ที่เกี่ยวข้อง:
  - `MFEditPortfolioModal.tsx` — ช่อง Weight ต่อ holding (blank = null, 0 = zero;
    helper text อธิบายว่า weight แบ่ง drift ของ underlying)
  - `PortfolioMutualFund.tsx` — แถว split ต่อกลุ่ม: "Configured weights"
    (แสดง normalized share) หรือ "Market-value fallback"
  - `MFRebalanceRecommendModal.tsx` — ช่อง Top-up cash แบบข้อความธรรมดา
    recompute อัตโนมัติด้วย debounce 350ms (ไม่มีปุ่ม Recalculate),
    แสดง Allocation base และคอลัมน์ Order Value, ระบุชัดว่า top-up เป็น
    simulation-only และไม่ฝากเงิน, และแสดง detail ของ 422 จาก backend
    แทนข้อความ "already balanced"

## 5. งานที่ยังค้าง และ known issues

1. **บั๊กเดิมที่ยังไม่แก้: "Per-asset threshold" ไม่เคยถูกบันทึก**
   `MFEditPortfolioModal` ส่ง `profit_threshold` ไป แต่ backend schema
   `MFHoldingUpdate` (`backend/app/routers/managed_funds.py`) ไม่ได้ประกาศ field นี้
   FastAPI จึงทิ้งค่าไปเงียบ ๆ (frontend `api.ts` มี comment ระบุไว้แล้ว)
   แนวทางแก้: ประกาศ `profit_threshold` ใน schema + validate + persist
2. **KPI "Current NAV" ยังเป็นค่าที่เก็บไว้ (stale):** `PortfolioMutualFund.tsx`
   แสดง `portfolio.current_nav` ซึ่งอัปเดตเฉพาะตอน confirm order / sell
   การ reprice จาก registry (`reprice_holdings_for_symbols`) ไม่ recompute NAV
   ของ portfolio — การคำนวณ rebalance ไม่ขึ้นกับค่านี้แล้ว แต่ KPI ยังเหมือนเดิม
   (ตรงกับข้อ 5.4 ของ handoff ก่อนหน้า)
3. **Holding ที่ถูกขายจนเหลือ 0 จะถูกลบ** weight จึงหายไปด้วย
   holding ที่สร้างใหม่จะเริ่มที่ weight = null
4. **Mode 2 "fixed target % per group" ยังไม่ถูกสร้าง**
   API reject ทุกค่า `allocation_mode` ที่ไม่ใช่ `'neutral'`
   และ `managed_fund_settings.target_ratio` (`{"VOO":0,"ABC":0}`) ยังเป็น
   dead data ที่ key ด้วย symbol — ต้อง migrate symbol -> underlying
   เมื่อทำ mode 2 จริง
5. **Deploy ต้องให้ node container ของ kind รันอยู่:** หลัง reboot เครื่อง
   `kind get clusters` ยังรายงาน cluster แต่ node container เป็น `Exited`
   ทำให้ `kind load` ล้มด้วย "can only create exec sessions on running containers"
   วิธีแก้ที่ใช้: `podman start investment-dashboard-control-plane`

## 6. บันทึกการทำงาน (Working notes)

- Backend tests (Python 3.12 จาก venv นอก repo เพราะ `/mnt/storage` เป็น exFAT):
  - `cd backend && ~/.cache/investment-dashboard-venv/bin/python -m pytest -q tests/test_managed_fund_rebalance_api.py tests/test_asset_registry_migration.py`
    -> 32 passed, 1 skipped
  - `cd backend && ~/.cache/investment-dashboard-venv/bin/python -m pytest -q tests/test_managed_fund_prices.py`
    -> 10 passed
- Frontend (เครื่องนี้มีแค่ `bun` ไม่มี npm/node):
  - `cd frontend && bun x vitest run` -> 132 passed (12 files)
  - `cd frontend && bun x vite build` -> ผ่าน
- Live check บน kind (fund 2): weight VOO=100 ให้ VOO ได้ drift ทั้ง 1,045
  ของกลุ่ม; typing top-up 1,000 ขยับ base 4,230 -> 5,230 และ buy รวม 3,260
  = cash + top-up (ตามข้อ 3)
- Deploy: `./scripts/kind-up.sh` (post-import check ของ script ใช้
  `crictl inspecti`; ส่วน `crictl images --quiet <ref>` คืนค่าว่างเสมอและทำให้
  deploy abort ทุกครั้ง — ถ้าเจออีกให้แก้ที่ check นี้)
- Total drift ที่แสดงบน UI คือผลรวมของ drift รายกลุ่ม (นับหนึ่งครั้งต่อ underlying
  แม้กลุ่มจะมีหลาย holding) แต่ field จาก API ใช้ค่าที่ยังไม่ปัด จึงคาดการณ์
  ผลต่าง 0.01-0.03 ได้ตามปกติ ไม่ใช่ bug
- Related knowledge: K-000619 (group allocation), K-000620 (NAV base),
  K-000621 (live base + per-holding weights), sessions S-000540 / S-000541,
  observation 0037 (client-side aggregate double count)

## 7. จุดเริ่มต้นสำหรับ session ถัดไป

- อ่าน `backend/app/routers/managed_funds.py`: `calculate_rebalance`,
  `_group_holdings_by_underlying`, `update_holding` / `MFHoldingUpdate`,
  `check_alerts`, `reprice_holdings_for_symbols` และ
  `frontend/src/utils/mfWeights.ts` + `MFRebalanceRecommendModal.tsx`
  ก่อนแก้อะไรทั้งสิ้น
- **งานหลักถัดไปคือ mode 2:** เริ่มจาก migrate `target_ratio` (symbol -> underlying)
  แล้วปลดล็อก validation ของ `allocation_mode`; ต้องนิยามก่อนว่า target % ต่อกลุ่ม
  จะคิดจาก base เดียวกันและ weight ต่อ holding ยังแบ่งเฉพาะ drift ของกลุ่ม
  (ไม่ใช่แบ่ง target ทั้งก้อน)
- แก้บั๊ก `profit_threshold` ใน `MFHoldingUpdate` เป็นงานเล็กที่ควรทำก่อน
  เพราะปลดล็อกการแก้ threshold รายตัวจาก UI
- ถ้าจะแตะ NAV freshness (ข้อ 5.2) ต้องตัดสินใจเชิงธุรกิจว่า reprice ควร
  recompute `portfolios.current_nav` หรือเปลี่ยน KPI ให้คำนวณสดจาก holdings + cash
- ถ้าจะทำ mode 2 ต้องตัดสินใจเรื่อง weight lifecycle เมื่อ holding ถูกลบ
  (ข้อ 5.3) ว่าจะคงค่า weight ที่ผูกกับ symbol หรือปล่อยเป็น null ตามเดิม
