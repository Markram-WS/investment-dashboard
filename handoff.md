# Handoff — Managed Fund allocation (neutral underlying-group model)

เอกสารนี้สรุปสถานะงาน Managed Fund allocation ณ สิ้นสุด session นี้ เพื่อให้ session
ถัดไป (คนหรือ agent) ทำงานต่อได้ทันทีโดยไม่ต้องไล่ derive ใหม่ ทุกตัวเลขและ path
ในนี้ถูกตรวจสอบแล้วใน session นี้

## 1. สถานะปัจจุบัน (State)

- Branch `feature/custom-port`, HEAD `684d0e9`, working tree สะอาด
- Commit ที่เกี่ยวข้อง เรียงตามลำดับ:
  - `008b4bd` — neutral underlying-group allocation แทน per-symbol target
  - `87a9bc4` — allocation base เปลี่ยนเป็น NAV ของกอง (รวม cash)
  - `684d0e9` — docs (DESIGN + API table)
- Deploy อยู่บน kind cluster: context `kind-investment-dashboard`, namespace
  `investment-dashboard`, เปิด UI ที่ http://localhost:8080
- โมเดลใหม่นี้เป็น "neutral mode only" — โหมดอื่นยังไม่ถูกสร้าง (ดูข้อ 5)

## 2. กติกาการจัดสรรตอนนี้ (The rule now)

- **Grouping by underlying, ไม่ใช่ symbol และไม่ใช่ broker**
  holdings ถูกจัดกลุ่มด้วย registry underlying: `asset_symbols.price_symbol` ->
  `asset_products.ticker`; broker ถูกเมินโดยเจตนา holdings ที่ไม่มี registry row
  จะตกไปอยู่กลุ่ม `Unassigned`
  หลักฐาน: `backend/app/routers/managed_funds.py` ฟังก์ชัน
  `_group_holdings_by_underlying` (ประมาณบรรทัด 819)
- **มูลค่า holding** = `qty * current_price` (คือ Current NAV ต่อหน่วย)
  ใช้ `avg_entry_price` ไม่ได้ — นั่นเป็นต้นทุน ไม่ใช่มูลค่าตลาด
- **Allocation base = `portfolios.current_nav`** (cash + มูลค่าตลาดของ holdings)
  ถ้า NAV เป็น null/0 จะ fallback เป็น `sum(holdings market value) +
  available_cash` หลักฐาน: `managed_funds.py` ฟังก์ชัน `calculate_rebalance`
  (บรรทัด ~607-609)
- **Neutral mode:** ทุกกลุ่มได้ target เท่ากัน คือ
  `current_nav * (100/N) / 100`; current share = มูลค่ากลุ่ม / `current_nav`;
  diff value = `current_nav * |target% - current%|`; การแบ่ง buy/sell ภายในกลุ่ม
  เป็นสัดส่วนตามมูลค่าตลาดของแต่ละ holding; กลุ่มที่มูลค่าเป็น 0 จะไม่ได้ order
- คอลัมน์ `allocation_mode` รับค่าได้เพียง `'neutral'` (ค่าอื่นตอบ 400)
  ถูกเพิ่มโดย `_retained_portfolio_migrations` ใน
  `backend/app/asset_registry_migration.py` (บรรทัด ~400)
- **Profit threshold ระดับ global ถูกหาร N ทาง:** threshold ของกลุ่ม =
  global/N, และ threshold ที่ใช้เตือนจริง =
  `max(holding.profit_threshold, group threshold)`
  หลักฐาน: `managed_funds.py` ฟังก์ชัน `check_alerts` (บรรทัด ~1111-1136)

## 3. ตัวเลขจริงบน fund 2 (วัดจาก API และ UI ที่ render จริง)

ที่มา: เรียก API และเทียบกับหน้าจอที่ deploy อยู่

- NAV 4,230 = cash 2,260 + holdings 1,970
  - VOO: 20 x 26 = 520
  - ABC: 22 x 25 = 550
  - SCBCHAE: 50 x 18 = 900
- กลุ่มและ drift:
  - S&P500 (VOO + ABC) current 25.30% -> target 50%, drift 24.70
  - CHA (SCBCHAE) current 21.28% -> target 50%, drift 28.72
  - total drift 53.43 (ผลรวมของ drift รายกลุ่ม)
- Orders ที่คำนวณได้:
  - VOO Buy 19.5327 @ 26
  - ABC Buy 21.4860 @ 25
  - SCBCHAE Buy 67.5 @ 18
  - มูลค่า buy รวมกันเท่ากับ cash 2,260 พอดี (เพราะ cash อยู่ใน base)
- Alerts: VOO (P/L 30%) และ ABC (25%) ยิงที่ threshold 25.0; SCBCHAE ไม่ยิง

## 4. API ที่ถูกแตะ (API surface touched)

- `POST /api/v1/managed-funds/{id}/rebalance/calculate`
  ตอบ `target_allocations` / `current_allocations` แบบ group-keyed และแต่ละ
  recommendation มี field `underlying`
- `GET /api/v1/managed-funds/{id}/alerts`
- `GET` / `PUT /api/v1/managed-funds/{id}/settings` (field `allocation_mode`)
- `GET /api/v1/managed-funds/{id}/holdings`
  แต่ละ row มี `broker_id`, `broker_code` และ `underlying` ที่ derive มาให้แล้ว

## 5. งานที่ยังค้าง และ decision ที่ยังเป็นของผู้ใช้

1. **Mode 2 "Target allocation fix %" ยังไม่ถูกสร้าง** — เป็นการกำหนด % ตายตัว
   ต่อกลุ่ม และ exclusive กับ neutral ปัจจุบัน API reject ทุกค่าที่ไม่ใช่
   `'neutral'` ส่วน `target_ratio` ที่เก็บอยู่ `{"VOO":0,"ABC":0}` ตอนนี้เป็น
   dead data ที่ key ด้วย symbol จึงจะต้องมี migration symbol -> underlying
   เมื่อ mode 2 ถูกทำจริง
2. **cash อยู่ใน base ทำให้ neutral mode ดูด cash เข้า holdings ทั้งหมด**
   (buy รวม = 2,260 ทั้งก้อน) ถ้าไม่ต้องการ deploy เต็มจำนวน ต้องนิยาม
   cash-reserve rule ขึ้นมาก่อน
3. **Asset list แสดงเฉพาะ target share (50.0%)** ส่วน current share
   (25.3% / 21.3%) เห็นได้แค่ใน rebalance modal เท่านั้น
4. **ความเสี่ยง NAV ค้าง (stale NAV):** `portfolios.current_nav` ถูกคำนวณใหม่
   เฉพาะตอน confirm order / sell (`managed_funds.py` ~บรรทัด 524) การเขียน quote
   จาก registry จะ reprice holdings (`reprice_holdings_for_symbols` ~บรรทัด 919)
   แต่ **ไม่** recompute portfolio NAV ดังนั้น allocation base อาจ lag กว่ามูลค่า
   holdings หลังการอัปเดตราคา
5. **UI แก้ target ราย symbol ถูกลบไปแล้ว** พร้อมกับ dropdown filter แบบ
   mutual_fund-only ที่เพิ่งเพิ่มเข้าไปวันเดียวกัน — หายจาก
   `MFEditPortfolioModal.tsx` โดยเจตนา เพราะโมเดลเก่าไม่มีแล้ว

## 6. บันทึกการทำงาน (Working notes)

- Frontend tests: `cd frontend && bun x vitest run` (ผ่าน 109 tests)
  build: `cd frontend && bun x vite build`
  เครื่องนี้มีแค่ `bun` (ไม่มี npm/node)
- Backend tests ต้องใช้ Python 3.12:
  `cd backend && ~/.cache/investment-dashboard-venv/bin/python -m pytest -q`
  (ผ่าน 237 tests, skipped 1) — `/mnt/storage` เป็น exFAT จึงวาง venv ใน repo ไม่ได้
- Deploy: `./scripts/kind-up.sh` (post-import check ของ script ใช้
  `crictl inspecti`; ส่วน `crictl images --quiet <ref>` คืนค่าว่างเสมอและทำให้
  deploy abort ทุกครั้ง — ถ้าเจออีกให้แก้ที่ check นี้)
- Total drift ที่แสดงบน UI คือผลรวมของ drift รายกลุ่ม (เคส 8.6% / 53.4%)
  แต่ field จาก API ใช้ค่าที่ยังไม่ปัด (8.63 / 53.43) จึงคาดการณ์ผลต่าง
  0.01-0.03 ได้ตามปกติ ไม่ใช่ bug
- Related knowledge: K-000619 (group allocation), K-000620 (NAV base),
  sessions S-000540 / S-000541, observation 0037 (client-side aggregate
  double count)

## 7. จุดเริ่มต้นสำหรับ session ถัดไป

- อ่าน `managed_funds.py`: `_group_holdings_by_underlying`, `calculate_rebalance`,
  `check_alerts`, `reprice_holdings_for_symbols` ก่อนแก้อะไรทั้งสิ้น
- ถ้าจะทำ mode 2 ให้เริ่มจาก migrate `target_ratio` (symbol -> underlying) และ
  ปลดล็อก validation ของ `allocation_mode`
- ถ้าจะแตะ NAV freshness ให้ตัดสินใจว่าการ reprice ควร recompute
  `portfolios.current_nav` ด้วยหรือไม่ (ข้อ 5.4) — นี่เป็นการตัดสินใจเชิงธุรกิจ
  ไม่ใช่แค่ bug fix
