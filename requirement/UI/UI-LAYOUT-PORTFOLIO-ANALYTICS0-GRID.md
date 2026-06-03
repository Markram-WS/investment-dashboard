---
tags:
  - ui-layout
  - analytics
  - order-management
  - investment-dashboard
---
# ⚙️ UI Detail: Portfolio Analytics & Grid (Master Spec)

อ้างอิง: `UI/portfolio_analytics_grid/screen.png` | `UI/portfolio_analytics_grid/code.html`
เชื่อมโยงกับ: [[Detailed-Functional-Requirements#1.3 Portfolio Analytics & Grid]], [[UI-VISUAL-LAYOUT]]

## 1. Layout Structure (Split View)
- **Main Command (Left Panel):** ประกอบด้วย กราฟ Payoff (ส่วนบน) และ ตารางจัดการ Order (ส่วนล่าง).
- **Strategy & Notes (Right Panel):** พื้นที่สำหรับ **Fixed Sticky Note Style** กว้าง 350px สำหรับจดสัดส่วนสินทรัพย์และแผนเทรด (Trade Plan).
- **Risk Status Header:** แสดงแถบสถานะความเสี่ยง (Safe/Warning/Danger) ที่ส่วนหัว:
    - **Interactivity:** มีไอคอน **"i"** เล็กๆ เมื่อ Hover จะแสดง **Calculation Box** บอกที่มาของตัวเลขทันที.
- **Responsive Behavior:** ในหน้าจอเล็กจะปรับจาก Split View เป็น **Stack (บน-ลงล่าง)**.
- **Data Refresh Policy:** **Manual Refresh Only** ผ่านปุ่ม "Refresh Data" พร้อม Timestamp และ Visual Pulse.

## 2. Features & Interactions
- **Markdown Viewer (Sticky Note Panel):** 
    - **Visual:** พื้นหลัง Canary Yellow (#FFFCE0) พร้อมฟอนต์สไตล์ Miro.
    - **AI Reasoning Integration:** สำหรับพอร์ต AI จะแสดง Log ความคิดของ AI Agent ใน Panel นี้ด้วย.
    - **Decision Journal (Historical Post-its):** พื้นที่ด้านล่างสุดจะแสดงประวัติการปิดออเดอร์ในรูปแบบ **Mini Post-it Notes** เรียงตามลำดับเวลา.
- **Payoff Chart Interaction:** 
    - **Combined Curve:** กราฟผลรวมระหว่างสินทรัพย์หลัก (Linear) และ Option (Intrinsic) ณ วันสิ้นอายุ.
    - **What-if Scenario Plotting:** เมื่อใช้ Payoff Wizard ระบบจะพล็อต **เส้นกราฟที่สอง (Dashed Line)** เพื่อเปรียบเทียบ.

## 3. Order Management - Zone & Grouping System
เปลี่ยนจากตารางธรรมดาเป็นระบบ **Group-based Management** ที่ยืดหยุ่น:
- **Zone-First Creation:** สร้าง "Zone" (หรือ Group) ขึ้นมาก่อนได้ โดยกำหนดชื่อ หรือช่วงราคา.
- **Order Nesting & Indentation:**
    - **Level 1 (Main Asset):** ออเดอร์ที่ถือครองจริง (Active Position).
    - **Level 2 (Coupling):** ออเดอร์รอปิด (TP/SL) เยื้องลงมาภายใต้ออเดอร์ที่ Active.
    - **Level 2 (Hybrid Option):** หากมีการใช้ Option คู่กับสินทรัพย์แม่ ให้แสดงแบบเยื้องภายใต้ตัวแม่นั้นๆ.
- **Mandatory Asset Selection:** ตอนกด Add Order ต้องเลือกประเภท **F (Future)** หรือ **O (Option)** ทันที.
- **Empty Zones Support:** อนุญาตให้มีโซนที่ยังไม่มีออเดอร์ได้เพื่อการวางแผนล่วงหน้า.
- **Manual Re-grouping (Basic Logic):** ใช้ปุ่ม **"Move"** หรือ **Dropdown เลือกโซน** ในแต่ละรายการออเดอร์เพื่อย้ายกลุ่ม (ไม่มี Drag & Drop ในเฟสแรก).
- **Visual Grouping:** ใช้หัวข้อแถบสี (Zone Header) สี Teal-light (#e0f7f6) และสรุป Performance รวมรายโซนที่ท้ายกลุ่ม.

## 4. Payoff Wizard (Sandbox Simulation)
เซกชันพิเศษวางอยู่ระหว่าง Active Orders และ History:
- **Independent Simulation Table:** ตารางแยกจากพอร์ตจริงสำหรับกรอกออเดอร์เทียม (Simulated F/O).
- **Toggle Controlled:** ตารางนี้จะปรากฏขึ้นเฉพาะเมื่อผู้ใช้เปิดโหมด Sandbox เท่านั้น (ซ่อนไว้ตอนเริ่ม).

## 5. Historical Grid System (Audit Trail)
ระบบสำหรับดูประวัติออเดอร์ที่จบไปแล้ว วางอยู่ส่วนล่างสุดของหน้า:
- **Collapsible Groups:** ประวัติออเดอร์ในแต่ละโซนพับเก็บได้เพื่อประหยัดพื้นที่.
- **On-Demand Loading (Lazy Load):** ระบบจะไม่ดึงข้อมูลประวัติทั้งหมดออกมาในคราวเดียว จะโหลดเมื่อมีการกางกลุ่มออกเท่านั้น.
- **Completed Cycle Grouping:** จัดกลุ่มประวัติออเดอร์ตามโซนเดิมที่เคยอยู่.
- **Hierarchical History Rows:** แสดงรายการที่จบแล้วแบบเยื้อง (Indent) พร้อมเส้นประ (Dashed Line) คั่นระหว่างรอบ.

---
## 6. Component Specs (Miro Style)

name: Miro Order Management - Zone System
version: 1.0

components:
  order-management-header:
    layout: "flex justify-between items-center px-6 py-4"
    typography: "{typography.micro-uppercase}"
    color: "{colors.slate}"
    elements:
      title: "ORDER MANAGEMENT"
      badge: { type: "badge-pill", text: "SPREAD ACTIVE", backgroundColor: "{colors.primary}" }

  zone-group-header:
    backgroundColor: "{colors.teal-light}"
    layout: "flex items-center px-6 py-3"
    typography: "{typography.caption-bold}"
    color: "{colors.brand-teal}"
    borderBottom: "1px solid {colors.hairline}"

  order-leg-row:
    backgroundColor: "{colors.canvas}"
    layout: "flex items-center px-6 py-4"
    borderBottom: "1px solid {colors.hairline-soft}"
    elements:
      side-badge: { buy: "{colors.brand-teal}", sell: "{colors.brand-coral}", rounded: "{rounded.full}" }

  consolidated-performance-footer:
    backgroundColor: "{colors.surface-soft}"
    layout: "flex justify-between items-center px-6 py-4"
    borderTop: "1px solid {colors.hairline}"
    metrics:
      label: "CONSOLIDATED PERFORMANCE"
      value-color: "{colors.brand-teal}"

---

## Design Principles
- **Visual Hierarchy:** การใช้โซนเป็นคอนเทนเนอร์หลักของออเดอร์.
- **Contrast & Scanning:** ออเดอร์ ID ใช้สีจาง Asset และ Side ใช้สีเข้มเพื่อความเร็วในการกวาดสายตา.
- **The Black Pill Action:** ปุ่มหลัก "ADD ORDER" ใช้ทรงแคปซูลดำอันเป็นเอกลักษณ์.

---
[[UI-VISUAL-LAYOUT|⬅️ กลับสู่ Master Layout]]
