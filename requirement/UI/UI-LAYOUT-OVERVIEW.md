---
version: alpha
name: OVERVIEW
description: A high-fidelity investment management interface built on the Miro visual workspace aesthetic. The system prioritizes clarity, generous whitespace, and a playful yet professional tone, anchored by the signature Miro black-pill primary actions and canary-yellow wordmark.

tags:
  - ui-layout
  - overview
  - design-blueprint
  - investment-dashboard

colors:
  primary: "#1c1c1e"
  on-primary: "#ffffff"
  brand-yellow: "#ffd02f"
  brand-teal: "#0fbcb0"
  teal-light: "#e0f7f6"
  brand-coral: "#ff9999"
  coral-light: "#fdeced"
  brand-blue: "#4262ff"
  canvas: "#ffffff"
  surface: "#f7f8fa"
  surface-soft: "#fafbfc"
  hairline: "#e0e2e8"
  ink: "#1c1c1e"
  slate: "#555a6a"
  success: "#00b473"
  warning: "#f4d03f"
  error: "#e74c3c"

typography:
  display-xl:
    fontFamily: "Roobert PRO, Plus Jakarta Sans, sans-serif"
    fontSize: 64px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: -1.5px
  display-lg:
    fontFamily: "Roobert PRO, Plus Jakarta Sans, sans-serif"
    fontSize: 48px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -1px
  heading-1:
    fontFamily: "Roobert PRO, Plus Jakarta Sans, sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
  heading-2:
    fontFamily: "Roobert PRO, Plus Jakarta Sans, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
  body-md:
    fontFamily: "Roobert PRO, Plus Jakarta Sans, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5

rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px

spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

components:
  top-nav:
    backgroundColor: "{colors.canvas}"
    height: 64px
    padding: "0 32px"
    borderBottom: "1px solid {colors.hairline}"
  
  nav-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "8px 16px"

  global-alert:
    backgroundColor: "{colors.coral-light}"
    borderColor: "{colors.brand-coral}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    display: "hidden (Visible when (Margin+Buffer)/TotalCash > 85%)"

  hero-summary-card:
    backgroundColor: "{colors.teal-light}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"

  portfolio-card:
    backgroundColor: "{colors.surface-soft}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
    border: "1px solid {colors.hairline}"

  portfolio-card-ai:
    backgroundColor: "#eef2ff" # Light brand-blue tint
    borderColor: "{colors.brand-blue}"
    borderWidth: "2px"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
---

# 📊 UI Detail: Overview Screen

อ้างอิง: `UI/overview/screen.png` | `UI/overview/code.html`
เชื่อมโยงกับ: [[Architecture-Overview]], [[Detailed-Functional-Requirements#1.1 Overview Screen]], [[UI-VISUAL-LAYOUT]]

## 1. Page Header & Global Risk Alert
- **Global Navigation:** อ้างอิงโครงสร้างจาก [[UI-LAYOUT-Navigation]] (Horizontal Top-Nav).
- **Currency Toggle (USD/THB):** เพิ่มปุ่มสลับสกุลเงินหลักที่มุมขวาบนของ Header หรือ Top-Nav เพื่อให้ผู้ใช้สามารถเลือกดูภาพรวมมูลค่าพอร์ตทั้งหมดในหน่วย **USD** หรือ **THB** ได้ทันที (ระบบจะคำนวณอัตราแลกเปลี่ยนเบื้องต้นให้).
- **Page Title:** แสดงผล "Overview" ขนาดใหญ่ (`display-xl`).
- **Global Risk Alert (`global-alert`):**
    - **Position:** แสดงผลทันทีใต้หัวข้อ "Overview".
    - **Logic:** แสดงผลอัตโนมัติเมื่อ `(Total Margin + Total Buffer) / Total Cash > 85%`.
    - **Interaction:** ไม่มีปุ่ม Action (เน้นการแจ้งเตือนเพื่อให้ผู้ใช้ตัดสินใจผ่าน Nav Bar เอง).
- **Note:** ตัดส่วน Search และ Action Buttons เดิมออกเพื่อความคลีนตามสไตล์ Miro.

## 2. Hero Summary Card (Global Cash Breakdown)
- **HTML:** `<section class="hero-summary-card">`
- **Visual Display:** แยกการ์ดย่อยเป็น 4 ก้อน (Macro View):
    - **Margin:** เงินประกันรวมทั้งระบบ.
    - **Buffer:** เงินสำรองความเสี่ยงรวม.
    - **Available Cash:** เงินสดพร้อมใช้รวม.
    - **Money Market:** เงินในตลาดเงิน/รอเคลียร์รวม.

## 3. Analysis Widgets (Global Metrics)
ส่วนแสดงการวิเคราะห์ภาพรวมระบบอ้างอิง [[Detailed-Functional-Requirements#📊 Global Analysis Metrics]].

### 3.1 Pool Health Index
- **Visual:** Circular SVG Gauge (`#health-gauge-path`).
- **Logic:** แสดงสุขภาพรวมโดยรวม (Aggregate Health) ที่ไม่ Bias จากกำไรรายพอร์ต. อาจคำนวณถ่วงน้ำหนัก

### 3.2 Money Reserve Status
- **Visual:** Linear progress bar พร้อมตัวชี้ตำแหน่ง (Indicator).
- **Threshold Visuals:**
    - **Zone 🔴 (Left):** < 120% ของ (Margin+Buffer).
    - **Zone 🟢 (Center):** 120% - 200% (Optimal Zone).
    - **Zone 🟡 (Right):** > 200% (Inefficient - เงินสดมากเกินไป).
- **Function:** เป็นทั้งตัวคุมความเสี่ยง (Risk) และประสิทธิภาพการลงทุน (Performance).

## 4. Active Portfolios Grid
- **HTML:** `<div class="grid grid-cols-1 xl:grid-cols-2 gap-gutter">`
- **Standardized Portfolio Card Layout:**
    - **Management Badges:** ระบุที่มาของการจัดการอย่างเด่นชัด:
        - `Badge-Manual`: สำหรับพอร์ตคีย์มือ.
        - `Badge-Bot`: สำหรับพอร์ตดึงข้อมูลบอต.
        - `Badge-AI`: สำหรับพอร์ต AI Full-loop.
    - **Market Tags:** จำกัดเฉพาะประเภทตลาด/สินทรัพย์ (e.g., `Crypto`, `US-Stock`, `Option`, `Future`).
    - **Cash Metrics:** แสดงผล 3 ก้อน (Margin, Buffer, Available).
    - **Risk Status Indicators (Subtle):**
        - เปลี่ยนจากการใช้กราฟหรือพื้นที่ใหญ่ เป็น **แถบสีขนาดเล็ก (Color Bar)** หรือ **Indicator Light** ที่ขอบการ์ดหรือใต้ชื่อพอร์ต:
            - **Safe (🟢):** แถบสีเขียว (Healthy).
            - **Warning (🟡):** แถบสีเหลือง (`Available < 20%`).
            - **Danger (🔴):** แถบสีแดงกะพริบ (`Available == 0`).
- **AI-Managed Portfolio Integration:**
    - ใช้ Layout พื้นฐานแบบเดียวกับการ์ดอื่น (Consistency) เพื่อความคลีน.


## 5. Interactivity & Micro-interactions
ตามสไตล์ Miro ที่เน้นความลื่นไหลและมีชีวิตชีวา:
- **Card Hover Effect:** เมื่อวางเมาส์เหนือ Portfolio Card ให้มีการยกตัว (Subtle Lift) พร้อมเปลี่ยนขอบเป็นสี `brand-blue` บางๆ.
- **Gauge Interaction:** เมื่อคลิกที่ Health Gauge ให้แสดง Modal "Math Breakdown" อธิบายที่มาของคะแนน (Logic Traceability).
- **Currency Tooltips:** ตัวเลขจำนวนเงินทั้งหมด เมื่อ Hover จะแสดงเวลาที่อัปเดตล่าสุด (Timestamp) และค่าเงินสกุลเดิม (หากมีการ Convert).
- **Smooth Transitions:** การเปลี่ยนผ่านระหว่างหน้าหรือการโหลดข้อมูลใหม่ให้ใช้ Fade-in หรือ Slide-up สั้นๆ (200ms).

## 6. Responsive & System States
- **Responsive Layout:**
    - **Desktop (1440px+):** Layout ตามปกติ (2-column grid สำหรับพอร์ต).
    - **Tablet (768px - 1024px):** Grid ปรับเป็น 1-column. Navigation ย่อขนาดลง.
    - **Mobile (<768px):** Hero Card เรียงต่อกันแนวตั้ง. Navigation เปลี่ยนเป็น Bottom Bar หรือ Hamburger Menu.
- **Empty State:** หากไม่มีพอร์ตการลงทุน ให้แสดงปุ่ม "Create your first portfolio" ขนาดใหญ่ในสไตล์ Sticky Note (Canary Yellow) กลางหน้าจอ Grid.
- **Error State:** หากการ Refresh ข้อมูลล้มเหลว ให้แสดง **Red Sticky Note** (brand-coral) แจ้งเตือนบริเวณมุมจอพร้อมข้อความ "Oops! Connection failed. Try again?" ในโทนที่เป็นกันเอง.
- **Loading State:** ใช้ Skeleton Screen ที่เลียนแบบโครงสร้างการ์ดจริงเพื่อรักษา Visual Stability.

## 8. Portfolio Grid Interactions
- **Add Portfolio Card:** ในหน้า Grid นอกจากพอร์ตที่มีอยู่แล้ว ให้แสดงการ์ดใบสุดท้ายเป็น **Dotted Border Card** (เส้นประ) พร้อมไอคอนเครื่องหมายบวก (+) ขนาดใหญ่ เพื่อเป็นทางลัดในการเพิ่มพอร์ตใหม่ (Secondary Action).
- **Single User Focus:** ระบบออกแบบมาเพื่อใช้งานคนเดียว จึงไม่มีส่วน User Profile หรือ Account Switching ในส่วน Top-Nav เพื่อความคลีนสูงสุด.

## 7. Data Refresh Policy
- **Manual Refresh Only:** ระบบจะไม่มีการดึงข้อมูลอัตโนมัติ (No Auto-polling).
- **Refresh Methods:**
    - **Manual Trigger:** กดปุ่ม Refresh (Icon + Text "Refresh Data") ที่มุมขวาบนของ Top-Nav.
    - **Page Reload:** ข้อมูลจะอัปเดตใหม่ทุกครั้งที่มีการ Refresh Browser หรือ Hard Reload.
- **Last Updated Timestamp:** แสดงเวลาที่อัปเดตข้อมูลล่าสุด (e.g., "Last updated: 2 mins ago") เพื่อความชัดเจน.
- **Visual Pulse on Update:** เมื่อข้อมูลเปลี่ยนหลังการกด Refresh ให้มีแอนิเมชั่นกะพริบ (Pulse) สีเขียว/แดงสั้นๆ ที่ตัวเลข.


---
## 📝 Future Details & Scalability
- [x] *Component Specs: Define reusable card components for diverse assets.*
- [x] *Interactivity: Define hover states for gauge details.*
- [ ] *Accessibility: Ensure color contrast ratios meet WCAG 2.1 AA standards.*
- [ ] *Multi-currency: Layout for secondary currency display.*
---
[[UI-VISUAL-LAYOUT|⬅️ กลับสู่ Master Layout]]



----------


