---
tags:
  - logic
  - liquidity
  - risk-management
  - investment-dashboard
---
# 🛡️ Business Logic: Portfolio & Liquidity

เอกสารรายละเอียดตรรกะการคุมสภาพคล่องและความปลอดภัยรายพอร์ต.
เชื่อมโยงกับ: [[Detailed-Functional-Requirements|⬅️ Master Hub]], [[UI/UI-LAYOUT-OVERVIEW|📊 Overview Layout]]

## 1. Portfolio Types
ระบบจำแนกประเภทพอร์ตเพื่อกำหนด Logic การทำงานที่แตกต่างกัน:
- **Managed Fund:** เน้นการ Rebalance ตามสัดส่วนเป้าหมาย (Target Ratio). ดูเพิ่มเติมที่ [[LOGIC-REBALANCING-ENGINE]].
- **Active Trading:** จัดการราย Order (Stock, Future, Option) และระบบ Grid/Zone.
- **Spread Strategy:** จับคู่เทรดแบบ 1:1 และติดตามค่า Spread (ไม่รวมในการ Rebalance).

## 2. Liquidity & Risk Framework
เน้นการตรวจสอบความปลอดภัยรายพอร์ต (Individual Portfolio Safety) เป็นหัวใจสำคัญ.

### 2.1 Core Formulas
- **Global Total Cash:** `Margin + Buffer + Available Cash + Money Market`.
- **Portfolio Available Liquidity:** `Port Cash = Available Cash + Money Market` (ภายในพอร์ตนั้น).

### 2.2 Safety Thresholds (Port-Level)
ระบบตรวจสอบสถานะความปลอดภัยของแต่ละพอร์ตแยกกัน:
1. **Danger State (🔴):**
    - **Trigger:** เมื่อ `Port Cash == 0`.
    - **Action:** **Hard Block!** ระงับการเปิดออเดอร์ใหม่ทุกกรณีภายในพอร์ตนี้.
2. **Warning State (🟡):**
    - **Trigger:** เมื่อ `Port Cash < 20% ของ (Port Margin + Port Buffer)`.
    - **Action:** แสดง Caution Badge และแจ้งเตือนผ่าน UI. อ้างอิง [[UI/UI-LAYOUT-OVERVIEW#4. Active Portfolios Grid|Visual Spec]].
3. **Safe State (🟢):**
    - **Trigger:** เมื่อ `Port Cash >= 20% ของ (Port Margin + Port Buffer)`.
    - **Action:** สถานะปกติ (Healthy).

## 3. Cash Operations
- **Cash Pool Transfer:** การโยกย้ายเงินระหว่างพอร์ตต้องมีการยืนยัน (Manual Confirmation). รายการจะไปปรากฏที่ [[UI/UI-LAYOUT-TRANSACTIONS#1. Top Summary Section|Approval Hub]].

---
[[Detailed-Functional-Requirements|⬅️ กลับสู่ Master Hub]]
