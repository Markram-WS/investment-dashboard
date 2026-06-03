---
tags:
  - logic
  - rebalancing
  - engine
  - investment-dashboard
---
# ⚙️ Business Logic: Rebalancing Engine

เอกสารรายละเอียดกลไกการปรับสมดุลพอร์ตอัตโนมัติ (Rebalancing).
เชื่อมโยงกับ: [[Detailed-Functional-Requirements|⬅️ Master Hub]], [[LOGIC-PORTFOLIO-LIQUIDITY|🛡️ Liquidity Rules]]

## 1. Dual-Mode Operation
ระบบรองรับการคำนวณเป้าหมาย 2 รูปแบบ:
- **Standard Mode:** ปรับตามสัดส่วนเปอร์เซ็นต์คงที่ (Fixed Ratio) ที่กำหนดตอนสร้างพอร์ต.
- **Sigma-Weighted (Volatility-Based):** คำนวณน้ำหนักการลงทุนตามค่าความผันผวนของสินทรัพย์ (Sigma). 
    - *Default:* ใช้ข้อมูลย้อนหลัง 30 วัน.
    - *Override:* ผู้ใช้สามารถปรับค่า Sigma ได้ด้วยมือ.

## 2. Rebalancing Workflow
กระบวนการทำงานแบบ Semi-Autonomous เพื่อความปลอดภัย:
1. **Calculation:** ระบบคำนวณส่วนต่างระหว่าง Asset Allocation ปัจจุบันกับเป้าหมาย.
2. **Recommendation:** แสดงรายการ Trade ที่ต้องทำ (Buy/Sell) เพื่อปรับพอร์ต.
3. **User Confirmation:** ผู้ใช้ตรวจสอบความถูกต้องและกดยืนยัน. ดูหน้ากดยืนยันได้ที่ [[UI/UI-LAYOUT-TRANSACTIONS#1. Top Summary Section|Approval Hub]].
4. **Execution:** ระบบเปลี่ยนคำแนะนำเป็น `active_orders` เพื่อรอคีย์หรือส่งเข้า API.
5. **NAV History:** บันทึกค่า NAV รวมหลังปรับพอร์ตลงในตาราง `portfolio_nav_history` (1 วัน 1 Record - Upsert).

## 3. Safety Constraints
- **Cash Check:** ระบบจะไม่แนะนำให้เปิดออเดอร์ใหม่หากพอร์ตอยู่ในสถานะ Warning หรือ Danger ตามเกณฑ์ใน [[LOGIC-PORTFOLIO-LIQUIDITY#2.2 Safety Thresholds|Safety Thresholds]].

---
[[Detailed-Functional-Requirements|⬅️ กลับสู่ Master Hub]]
