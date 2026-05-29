---
version: 1.0
name: TRANSACTIONS
description: The consolidated ledger for all financial movements within the system, including funding, transfers between portfolios, and trade executions.
tags:
  - ui-layout
  - ledger
  - audit-trail
---

# 📑 UI Detail: Transactions (The Master Ledger & Optimal Control Hub)

อ้างอิง: `UI/transactions/screen.png` | `UI/transactions/code.html`
เชื่อมโยงกับ: [[Detailed-Functional-Requirements#1.2 Transactions Screen]], [[UI-LAYOUT-OVERVIEW]]

## 1. Optimal Control: Quick Cash Flow (New)
เซกชันสำหรับ "โยกเงินให้เกิดประสิทธิภาพสูงสุด" (Rebalancing Flow):
- **Quick Transfer Panel:** ปุ่มลัดสำหรับโอนเงินระหว่างพอร์ตที่วางไว้ด้านบนสุดของหน้า.
    - **UI:** ใช้ Miro-style "Sticky Form" (เล็ก กะทัดรัด).
    - **Logic:** เลือก `Source` -> `Destination` -> `Amount`.
    - **Real-time Performance Impact:** เมื่อระบุจำนวนเงิน ระบบจะคำนวณทันทีว่า `Money Reserve Bar` ในหน้า Overview จะขยับไปอยู่ที่ตำแหน่งไหน (เส้นประคาดการณ์) เพื่อให้รู้ว่าโอนแล้ว "เข้าโซน Optimal 🟢" หรือไม่.
- **Auto-Record:** ทุกรายการโอนผ่าน Panel นี้จะถูกบันทึกเป็น "Internal Transfer" ในตารางหลักทันทีโดยอัตโนมัติ.

## 2. Page Header & Global Controls
- **Page Title:** "Transactions" (`display-xl`).
- **Global Actions:**
    - **Currency Toggle (USD/THB):** สลับหน่วยเงินที่แสดง.
    - **Refresh Data:** ปุ่ม Manual Refresh พร้อม Timestamp.

## 3. Master Filter Bar (Miro Style)
- **Date Range Picker:** เลือกช่วงเวลา.
- **Type Filter:** กรองรายการ (`Funding`, `Transfer`, `Trade`).
- **Optimal Control Filter:** กรองเฉพาะรายการที่ส่งผลต่อการปรับสมดุลพอร์ต (Rebalancing/Transfer).

## 4. Consolidated Transaction Table
ตารางที่รวมทุก Flow ของเงิน:
- **Columns:** Date, Type, Asset/Detail, **Amount & Balance Delta**, **Flow (Source -> Destination)**, Executed By, Status.
- **Internal Transfer Logic:** รายการโอนระหว่างพอร์ตแสดงเป็น **"1 บรรทัด"** โดยแสดงลูกศร `Source → Destination` เพื่อความสะอาดตา.

## 5. Interaction & Visuals
- **AI Reasoning / Note Peak:** หากเป็นรายการจาก AI/Bot ให้มีไอคอนฟองคำพูด Hover เพื่อดูเหตุผลการโอน (Reasoning).
- **Audit Drawer:** คลิกที่แถวเพื่อดู Before/After ของ Balance ในแต่ละพอร์ต (เพื่อยืนยันว่าการโอนเงินทำให้พอร์ตเข้าสู่สถานะ Optimal จริง).
- **Visual Receipt:** แนบไฟล์สลิป/หลักฐาน (Sticky Image) สำหรับรายการ Manual.

    - **Step-by-step Audit:** แสดงสถานะก่อนทำรายการและหลังทำรายการ (Before vs After) ของทุกพอร์ตที่เกี่ยวข้อง.
    - **Log Traceability:** ลิงก์ไปยังประวัติออเดอร์ต้นทางในหน้า Analytics.

## 4. Responsive Behavior
- **Desktop:** แสดงผลเป็นตารางเต็มรูปแบบ.
- **Tablet/Mobile:** ปรับจากตารางเป็น **"List Cards"** โดยแต่ละการ์ดจะสรุปข้อมูลสำคัญ (Type, Amount, Source -> Dest) ในแนวตั้งเพื่อให้อ่านง่ายบนจอเล็ก.

## 5. System States
- **Loading:** ใช้ Skeleton Screen สำหรับแถวตาราง.
- **Empty State:** แสดงภาพประกอบสไตล์ลายเส้น Miro พร้อมข้อความ "No transactions found in this period."
- **Error State:** แสดง **Red Sticky Note** แจ้งเตือนบริเวณด้านบนของตารางหากการดึงข้อมูลผิดพลาด.

---
## 📝 Future Details & Scalability
- [ ] *Advanced Search: Full-text search for transaction remarks.*
- [ ] *Batch Editing: Capability to tag multiple transactions at once.*

---
[[UI-VISUAL-LAYOUT|⬅️ กลับสู่ Master Layout]]
