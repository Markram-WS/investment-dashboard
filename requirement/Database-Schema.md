---
tags:
  - database
  - schema
  - postgresql
  - investment-dashboard
  - data-model
---
# 🗄️ Database Schema: Main Portfolio (Master)

โครงสร้างฐานข้อมูลหลัก (PostgreSQL) สำหรับบริหารจัดการพอร์ตการลงทุน (Manual & Bot) 
อ้างอิงตรรกะใน [[LOGIC-PORTFOLIO-LIQUIDITY]] และ [[LOGIC-REBALANCING-ENGINE]].

---

## 1. Portfolio & Cash Management
*ทำหน้าที่เก็บสถานะเงินทุนและสัดส่วนสินทรัพย์ของแต่ละพอร์ต*

- **Table:** `portfolios`
    - `portfolio_id` (PK): ID ประจำพอร์ต.
    - `portfolio_name`: ชื่อพอร์ต (e.g., Binance Grid, Global Macro).
    - `port_type`: ประเภทพอร์ต (Managed Fund, Active Trading, Spread Strategy).
    - `target_ratio` (JSONB): สัดส่วนเป้าหมายสำหรับการ Rebalancing.
    - `current_nav`: มูลค่าสินทรัพย์สุทธิปัจจุบัน.
    - **Cash Breakdown:**
        - `margin_locked`: เงินประกันที่วางไว้ (Margin) - *ถอนไม่ได้ชั่วคราว*.
        - `cash_buffer_limit`: เงินสำรองความเสี่ยงตามกฎความปลอดภัย.
        - `available_cash`: เงินสดที่พร้อมเทรดทันที.
    - `trade_plan_md`: แผนกลยุทธ์แบบ Markdown (ArgoCD Style).
    - `risk_status`: สถานะความเสี่ยงปัจจุบัน (Safe, Warning, Danger).
    - `tags` (JSONB): แท็กประเภทตลาด (e.g., Crypto, US-Stock).
    - `last_rebalance_date`: วันที่ปรับพอร์ตล่าสุด.
    - **Risk model (Phase 1):**
        - `broker_id` (FK `brokers.id`, nullable): โบรกที่พอร์ตนี้เทรด.
        - `product_ticker` (nullable): product เดียวของพอร์ต (1 พอร์ต = 1 product = broker + ticker).
        - `x_amount` (default 0): ระยะที่ประเมินว่าราคาไม่น่าลงไปถึง หน่วยเป็นจุด/ราคาของ product.
        - `initial_capital` (default 0): ทุนตั้งต้น ใช้เป็นฐานบอกกำไรใน `available_cash` เท่านั้น (ไม่ใช่สูตรสร้าง cash).
        - `margin_locked`: **ค่าคำนวณ ไม่ใช่ค่าที่กรอก** สำหรับ Active Trading — คิดจาก order ที่ยังเปิด (ไม่รวม option) ด้วย `Σ COALESCE(current_price, entry_price) × multiplier × qty × margin_rate` โดยดึง `multiplier`/`margin_rate` จากแถว asset ที่ตรงกับ `(broker_id, product_ticker)`; ถ้า `product_ticker` เป็น NULL จะคืนค่าคอลัมน์ที่เก็บไว้. ค่าที่ส่งมาใน payload ของ Active Trading ถูกยอมรับแต่ไม่บันทึก.

- **Table:** `portfolio_nav_history`
    - `nav_id` (PK), `portfolio_id` (FK), `nav_date`, `nav_value`.
    - *Note:* บันทึกแบบ "1 วัน 1 Record" เพื่อวาดกราฟ Performance.

---

## 2. Planning & Active Orders
*ทำหน้าที่จัดการแผนการเทรดและคำสั่งซื้อขายที่ยังเปิดอยู่ (Live Status)*

- **Table:** `trade_plans`
    - `plan_id` (PK), `portfolio_id` (FK).
    - `entry_zone`, `exit_zone`: ขอบเขตราคาสำหรับกลยุทธ์ Grid.
    - `tp_levels` (JSONB), `sl_level`: จุดทำกำไรและตัดขาดทุน.
    - `entry_reason`: เหตุผลการเข้าเทรด (Manual Journal).

- **Table:** `active_orders`
    - `order_id` (PK), `plan_id` (FK), `portfolio_id` (FK).
    - `asset_type` (Stock, Future, Option).
    - `side` (Buy/Sell).
    - `qty`, `entry_price`, `current_price`, `tp_price`.
    - `leverage`, `margin_rate`.
    - `order_status`: (pending_sync, filled, cancel_pending).
    - `grid_group_id`: ID สำหรับจัดกลุ่มออเดอร์ในโซนเดียวกัน (Zone Consolidation).
    - `linked_order_id`: ID เชื่อมโยงคู่ขา 1:1 สำหรับ Spread Strategy.
    - **`executed_by`**: บ่งบอกที่มา (Manual, Bot, AI).
    - **`remark`**: ข้อความอิสระต่อออเดอร์ (free-text note).
    - `option_id` (FK, nullable): เชื่อมโยงรายละเอียด Option.

---

## 3. Specialized Data
- **Table:** `option_details`
    - `option_id` (PK), `strike_price`, `option_type` (Call/Put), `expiry_date`.
    - `premium_entry`, `premium_exit`, `delta_at_entry`, `IV_at_entry`.

- **Table:** `simulation_models` (Wizard Mode)
    - `sim_id` (PK), `portfolio_id` (FK), `model_name`, `draft_data` (JSONB).
    - *Note:* เก็บแผนจำลองล่าสุด 1 แผนต่อพอร์ต.

---

## 4. History & Audit (Consolidated Ledger)
*ทำหน้าที่เป็นสมุดบัญชีรวมเล่ม (Historical Log) สำหรับการตรวจสอบย้อนหลัง*

- **Table:** `trade_history`
    - `history_id` (PK), `portfolio_id` (FK), `order_id` (FK).
    - `type` (Buy, Sell, Deposit, Withdraw, Transfer).
    - `asset`: ชื่อสินทรัพย์หรือสกุลเงิน.
    - `exit_price`, `realized_pl`: ราคาปิดและกำไรขาดทุนที่เกิดขึ้นจริง.
    - **`executed_by`**: ใครเป็นคนสั่งรายการนี้ (Manual, Bot, AI).
    - **`decision_note`**: (Decision Journal) บันทึกความคิดเห็นย้อนหลัง (Mini Post-it style).
    - `entry_date`, `exit_date`, `remark` (JSONB เก็บข้อมูลเสริม เช่น ค่าธรรมเนียม/หมายเหตุ).
    - **`order_remark`** (VARCHAR): ข้อความอิสระที่ติดมากับออเดอร์ (คัดลอกจาก `active_orders.remark` ตอนปิด/ยกเลิก) — ใช้แสดงบนการ์ดประวัติ.

---

## 5. Monitoring
- **Table:** `whitelist_assets`: รายการสินทรัพย์ที่อนุญาตให้เทรด + contract spec ของสินทรัพย์นั้น.
    - `asset_id` (PK), `ticker`, `asset_type` (instrument class เช่น `crypto`, `stock`).
    - `broker_id` (FK `brokers.id`): โบรกเจ้าของ spec; default `1` (`DF` = Unassigned).
    - `multiplier` (default 1): ตัวคูณ notional ของ product (เช่น S50 = 200 บาท/จุด).
    - `margin_rate` (default 0): อัตราหลักประกัน (0–1) ที่โบรกเรียกเก็บ.
    - `updated_at`: ใช้โชว์ว่า spec ถูกแก้ล่าสุดเมื่อไร (reveal ใน All-assets).
    - Identity: `UNIQUE (broker_id, ticker)` — 1 แถวต่อ instrument เพื่อให้ price feed (`batchUpdatePrices`) เขียนราคาได้ที่เดียว.
    - **Known limitation (Phase 1):** spot กับ future บน underlying เดียวกันใช้ spec (multiplier/margin_rate) ร่วมกันแถวเดียว เพราะ key ยังไม่มี `contract_type`; options ใช้ premium อย่างเดียวจึงไม่ใช้ multiplier/margin ในโมเดลนี้. ถ้าต้องแยกจริงต้องเพิ่ม contract type เข้า key.
- **Table:** `watchlist`: รายการเฝ้าติดตามราคาพร้อม Alert Price.

---

## 6. Brokers (Risk Model Phase 1)
- **Table:** `brokers`: เจ้าของ contract spec ที่ `whitelist_assets` อ้างถึง.
    - `id` (PK), `code` (unique, ตัวพิมพ์ใหญ่ เช่น `DF`, `PI`, `CAF`), `name`.
    - `default_margin_rate`: ค่า margin เริ่มต้นของโบรก (ใช้เป็น default ตอนสร้าง spec).
    - `currency` (default `USD`), `created_at`.
    - Seed: `('DF', 'Unassigned')` — โบรก placeholder สำหรับข้อมูลเดิมและพอร์ตที่ยังไม่ระบุโบรก.
- **API:** `GET /api/v1/brokers` (เรียงตาม `code`), `POST /api/v1/brokers` (`code` ถูก upper-case, ซ้ำ → 409).

---
*Last Updated: 2026-11-18 (Risk Model Phase 1: brokers + contract specs)*
