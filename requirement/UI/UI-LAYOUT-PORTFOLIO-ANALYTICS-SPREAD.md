---
tags:
  - ui-layout
  - analytics
  - order-management
  - investment-dashboard
---
# ⚙️ UI Detail: Portfolio Analytics & Spread

อ้างอิง: `UI/portfolio_analytics_grid/screen.png` | `UI/portfolio_analytics_grid/code.html`
เชื่อมโยงกับ: [[Detailed-Functional-Requirements#1.3 Portfolio Analytics & Grid]], [[UI-VISUAL-LAYOUT]]

## 1. Layout Structure (Split View - Spread Focus)
- **Main Command (Left):** ตารางจัดการ **Order Pairs (Spreads)** และกราฟ Payoff ของคู่กลยุทธ์.
- **Strategy & Notes (Right):** พื้นที่สำหรับ **Fixed Sticky Note Style** (Canary Yellow) สำหรับจดแผนกลยุทธ์ Spread และบันทึกกันลืม.
- **Risk Status Header:** แสดงแถบสถานะความเสี่ยง (Safe/Warning/Danger) พร้อม **ไอคอน "i"** ที่เมื่อ Hover จะแสดง Calculation Box ของพอร์ต Spread นั้นๆ.
- **Responsive Behavior:** ปรับเป็น **Stack (บน-ลงล่าง)** ในหน้าจอขนาดเล็ก.

## 2. Spread-Specific Features & Interactions
- **Side-by-Side Pair Layout:** การแสดงผลออเดอร์ที่เป็นขาคู่กันจะวางในระนาบเดียวกัน (หรือบรรทัดติดกันที่มีเส้นเชื่อมชัดเจน) เพื่อให้เปรียบเทียบขา Long/Short ได้ทันที.
- **Consolidated P/L Column:** เพิ่ม Column พิเศษด้านขวาสุดของรายการคู่ เพื่อแสดงผล **Net P/L รวมของทั้งคู่** (รวมค่าธรรมเนียมและ Spread Diff) โดยใช้สี `brand-teal` สำหรับกำไร และ `brand-coral` สำหรับขาดทุน.
- **Visual Bracket Linking:** ระบบจะวาดเส้นปีกกา (Brackets) เชื่อมต่อออเดอร์ขาคู่กันเพื่อเน้นความสัมพันธ์เชิงกลยุทธ์.
- **Manual Re-grouping (Basic Logic):** ใช้การเลือกจาก Dropdown เพื่อย้ายคู่ Spread เข้าไปใน Zone ต่างๆ.
- **Decision Journal (Historical Post-its):** ประวัติการปิดคู่ Spread (Completed Cycles) จะถูกเก็บเป็น Mini Post-it Notes ฝั่งขวา.
- **Data Refresh Policy:** **Manual Refresh Only** พร้อมแสดง Timestamp และ Visual Pulse เมื่อข้อมูลเปลี่ยน.

---
## 3. Historical Spread System (Completed Cycles)
ระบบสำหรับดูออเดอร์คู่ที่จบไปแล้ว (Audit Trail):
- **Cycle Grouping:** จัดกลุ่มออเดอร์ที่จบแล้วตามโซนเดิมที่เคยอยู่ โดยใช้สีพื้นหลัง `surface-soft`.
- **Hierarchical Rows:** แสดงขา Buy/Sell เยื้องเข้าไป (Indent) ภายใต้หัวข้อกลยุทธ์ เพื่อให้อ่านง่าย.
- **Quick View:** ไอคอนรูปตาที่ท้ายแถวเพื่อเปิดดูรายละเอียดกราฟ Payoff ณ วันที่ปิดออเดอร์.

---
## 📝 Future Details & Scalability
- [ ] *Pair Wizard: Step-by-step UI for creating new spreads.*
- [ ] *Historical Export: Export completed spread cycles to CSV.*

---
[[UI-VISUAL-LAYOUT|⬅️ กลับสู่ Master Layout]]
---
name: Miro Portfolio - Historical Spread System
version: 1.0
description: Design documentation for the "Historical Orders" section within the Portfolio Analytics view, specifically focusing on the visualization of complex Spread Orders (completed cycles). This system establishes the visual language for grouping multi-leg positions and presenting consolidated net performance.

components:
  historical-group-header:
    backgroundColor: "{colors.surface-soft}"
    layout: "flex items-center px-4 py-2"
    typography: "{typography.micro-uppercase}"
    color: "{colors.brand-teal}"
    borderTop: "1px solid {colors.hairline}"
    borderBottom: "1px solid {colors.hairline}"
    content: "ZONE A: $180-$185 | COMPLETED CYCLE"

  spread-leg-row:
    layout: "flex items-center px-8 py-3"
    typography: "{typography.body-sm}"
    borderBottom: "1px solid {colors.hairline-soft}"
    indentation: "32px (tabbed 1 step from parent)"
    elements:
      asset:
        typography: "{typography.body-sm-medium}"
        color: "{colors.primary}"
      strategy-tag:
        typography: "{typography.caption}"
        color: "{colors.slate}"
      p-l-indicator:
        positive: "{colors.success}"
        negative: "{colors.error}"

  consolidated-performance-row:
    backgroundColor: "{colors.canvas}"
    layout: "flex justify-between items-center px-8 py-4"
    borderTop: "1px dashed {colors.hairline-strong}"
    typography: "{typography.body-md-medium}"
    brand-element:
      icon: "Miro spread-link icon"
      color: "{colors.primary}"
    metrics:
      label: "BULL CALL SPREAD | Consolidated Spread Performance"
      value-typography: "{typography.heading-5}"
      value-color: "{colors.brand-teal}"

  action-utility:
    type: "icon-button-ghost"
    icon: "visibility (eye)"
    size: "20px"
    color: "{colors.stone}"

---

## Design Principles

The Historical Spread System is designed to resolve the complexity of multi-leg trades into a single, legible "cycle" of performance.

### Visual Hierarchy
- **Zone Grouping**: Historical data is segmented by price zones (e.g., Zone A, Zone B) using a `{colors.surface-soft}` header. This provides a clear anchor for long-scroll data tables.
- **Hierarchical Rows**: Individual trade legs (Buy/Sell) are tabbed 32px to indicate they are part of a larger strategy. Typography is slightly reduced to `{typography.body-sm}` to maintain focus on the consolidated result.
- **Consolidated Focus**: The "Net P/L" of the entire spread is the primary takeaway. It uses `{typography.heading-5}` and a dashed-line separation to distinguish itself from individual transaction rows.

### Semantic Color Coding
- **Performance**: Positive net performance uses `{colors.brand-teal}` (the "Healthy" signal). Cautionary or negative performance uses `{colors.brand-coral}`.
- **Strategy Indicators**: Labels like "Long Leg A" or "Short Leg B" use `{colors.slate}` to provide context without adding visual noise.

### Interaction Patterns
- **Quick View**: Every spread group features a "Quick View" eye icon at the far right, allowing users to jump into the specific transaction details or charts for that cycle.
- **Horizontal Precision**: The table columns (Asset, Type, Strategy, P/L, Volume) align perfectly with the "Order Management" section above to maintain a consistent scanning path.

## Usage Context
In the **Historical Spread Redesign (SCREEN_75)**, this system is applied to the bottom section of the portfolio view, providing a clean audit trail of completed grid strategies and spread cycles.