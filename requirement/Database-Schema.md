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
        - `money_market`: เงินในตลาดเงินหรือรอเคลียร์ (T+3) - *โยกย้ายได้แต่ต้องรอ Settlement*.
    - `trade_plan_md`: แผนกลยุทธ์แบบ Markdown (ArgoCD Style).
    - `risk_status`: สถานะความเสี่ยงปัจจุบัน (Safe, Warning, Danger).
    - `tags` (JSONB): แท็กประเภทตลาด (e.g., Crypto, US-Stock).
    - `last_rebalance_date`: วันที่ปรับพอร์ตล่าสุด.

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
    - `spread_pair_id`: ID เชื่อมโยงคู่ขา 1:1 สำหรับ Spread Strategy.
    - **`executed_by`**: บ่งบอกที่มา (Manual, Bot, AI).
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
    - `entry_date`, `exit_date`, `comments` (JSONB).

---

## 5. Monitoring
- **Table:** `whitelist_assets`: รายการสินทรัพย์ที่อนุญาตให้เทรด.
- **Table:** `watchlist`: รายการเฝ้าติดตามราคาพร้อม Alert Price.

---
*Last Updated: 2026-05-17 (Refined for Multi-DB & Risk Framework)*
