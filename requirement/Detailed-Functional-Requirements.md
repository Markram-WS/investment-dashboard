---
tags:
  - requirement
  - functional-spec
  - business-logic
  - investment-dashboard
  - rebalancing
  - risk-management
---
# 📜 Detailed Functional Requirements (Master)

เอกสารรวบรวมตรรกะทางธุรกิจ (Business Logic) และข้อกำหนดการทำงานทั้งหมดของระบบ Investment Dashboard.
โครงสร้างพื้นฐานดูได้ที่ [[Architecture-Overview]] และโครงสร้างฐานข้อมูลที่ [[Database-Schema]].

## 1. User Interface & Experience (Anthropic Style)
## 1. User Interface & Experience (Anthropic Style)
การออกแบบเน้นความสะอาดตา โทนสีพาสเทล (Pastel) และการแสดงข้อมูลที่หนาแน่นแต่ไม่รก (Data-dense) อ้างอิง [[Architecture-Overview#1. System Components|Tech Stack]].

### 1.1 Overview Screen (The Global Monitor)
- **Reference Files:** `UI/overview/code.html` | `UI/overview/screen.png`
- **Detailed Layout:** [[UI-LAYOUT-OVERVIEW]]
- **Cash Breakdown Logic:**
    - **Global Summary (4 Categories):** เพื่อความละเอียดสูงสุดในภาพรวมระบบ.
        - **Margin:** เงินประกันที่ถูกวางไว้ (Lock).
        - **Buffer:** เงินสำรองความเสี่ยง.
        - **Available Cash:** เงินสดพร้อมใช้ทันที.
        - **Money Market:** เงินในตลาดเงิน/รอเคลียร์ (T+3).
    - **Portfolio Cards (3 Categories):** เพื่อความเรียบง่ายในการดูรายพอร์ต.
        - **Margin** | **Buffer**
        - **Available:** (Available Cash + Money Market) สื่อถึงสภาพคล่องรวมที่พอร์ตนั้นสามารถโยกย้ายได้.
- **Global Risk Warning:** แสดงผลอัตโนมัติเมื่อ `(Margin + Buffer) / Total Cash > 85%`.
- **AI Portfolio Cards:** แสดงสถานะภาพรวมของ AI (Active, Scanning, Planning) และค่า Health Index.

### 1.2 Transactions Screen (The Consolidated Ledger)
- **Reference Files:** `UI/transactions/code.html` | `UI/transactions/screen.png`
- **Detailed Layout:** [[UI-LAYOUT-TRANSACTIONS]]
- **Log Integration:** รวมรายการ **Funding** (ฝาก/ถอน/โอน) และ **Trade Flow** (ซื้อ/ขายสินทรัพย์) ไว้ในตารางเดียว.
- **Audit Labels:** ระบุ **"Executed By"** (Manual, Bot, AI Agent) ในทุกรายการ.

### 1.3 Portfolio Analytics & Grid (The Command Center)
- **Reference Files:** `UI/portfolio_analytics_grid/code.html` | `UI/portfolio_analytics_grid/screen.png`
- **Detailed Layout:** [[UI-LAYOUT-PORTFOLIO-ANALYTICS]]
- **AI Reasoning & Risk Insight:** เฉพาะพอร์ต AI จะแสดงผล Reasoning และ Risk Metrics เจาะลึกในหน้านี้.
- **Trade Plan View:** พื้นที่แสดงแผนกลยุทธ์แบบ **Markdown Field** (ArgoCD Style) วางแบบ Side-by-Side.
- **Spread Visual Pairing:** ระบบจับคู่ขา 1:1 โดยใช้ ID เชื่อมโยง และคำนวณ Net Spread P/L.

### 1.4 Create New Portfolio
- **Reference Files:** `UI/model_new_port/code.html`
- **Detailed Layout:** [[UI-LAYOUT-CREATE-PORTFOLIO]]
- **Port Type Selection:** บังคับเลือกประเภทพอร์ต (Managed Fund, Active Trading, Spread Strategy).

- **Metadata Tags:** ช่องสำหรับระบุตลาดหรือโบรกเกอร์ (e.g., Crypto, Binance, TFEX).

## 2. Portfolio & Liquidity Logic

### 2.1 Portfolio Types
- **Managed Fund:** เน้นการ Rebalance ตามสัดส่วนเป้าหมาย.
- **Active Trading:** จัดการราย Order (Stock, Future, Option).
- **Spread Strategy:** จับคู่เทรดแบบ 1:1 และติดตามค่า Spread (ไม่รวมในการ Rebalance).
### 2.2 Liquidity Safety (The Risk Framework)
เน้นการตรวจสอบความปลอดภัยรายพอร์ต (Individual Portfolio Safety) และภาพรวมระบบ (Global Pool):
- **Core Formula (Global):** `Total Cash = Margin + Buffer + Available Cash + Money Market`.
- **Global Portfolio Liquidity:** `Global Cash = Available Cash + Money Market` (รวมทั้งระบบ).

#### 📊 Global Analysis Metrics
1. **Pool Health Index (Gauge):** 
    - ตัวชี้วัดสุขภาพพอร์ตรวม (ไม่ใช่ผลรวม Profit เพื่อลดความ Bias).
    - คำนวณจากความสอดคล้องของกลยุทธ์ (Strategy Alignment) และความเสี่ยงที่แท้จริง.
2. **Money Reserve Status (Risk vs Performance):** 
    - ใช้คุมทั้งความปลอดภัยและประสิทธิภาพการใช้เงินทุน (Efficiency).
    - **Danger (🔴):** เมื่อ `Global Cash < (Total Margin + Total Buffer) * 120%` (สภาพคล่องต่ำเกินไป).
    - **Optimal (🟢):** เมื่อ `Global Cash` อยู่ระหว่าง **120% - 200%** ของ `(Total Margin + Total Buffer)`.
    - **Inefficient (🟡):** เมื่อ `Global Cash > (Total Margin + Total Buffer) * 200%` (เงินสดล้นระบบ ประสิทธิภาพการทำกำไรลดลง).

#### 🛡️ Portfolio-Level Safety Thresholds
...
ระบบจะตรวจสอบสถานะความปลอดภัยของแต่ละพอร์ตแยกกันตามเกณฑ์ดังนี้:
1. **Danger State (🔴):**
    - **Trigger:** เมื่อ `Port Cash == 0`.
    - **Action:** **Hard Block!** ระงับการเปิดออเดอร์ใหม่ และ **เปลี่ยนสี Tab Browser (Favicon/Title Color)** เป็นสีแดงเพื่อแจ้งเตือนทางสายตา (ไม่มีการส่งเสียง Sound Alert).

### 2.3 Decision Journal (Optional Post-it Notes)
ฟีเจอร์สำหรับบันทึกความคิดเห็นเพื่อใช้รีวิวตัวเองในภายหลัง:
- **Optional Closure Note:** เมื่อปิดออเดอร์ ระบบจะแสดงช่องบันทึกเหตุผลสั้นๆ (Optional - ไม่บังคับกรอก สามารถกดข้ามได้).
- **Visual Style:** แสดงผลย้อนหลังในหน้า Analytics เป็น **Mini Post-it Notes** ขนาดเล็กจิ๋วเรียงตามลำดับเวลา.
- **Benefit:** ช่วยให้ผู้ใช้เห็นพัฒนาการและความคิดของตัวเองในพอร์ต Manual/Bot ให้มีความชัดเจนเทียบเท่ากับ AI Reasoning ในพอร์ต AI.
2. **Warning State (🟡):**
    - **Trigger:** เมื่อ `Port Cash < 20% ของ (Port Margin + Port Buffer)`.
    - **Action:** แสดง Caution Badge และแจ้งเตือนผ่าน UI.
3. **Safe State (🟢):**
    - **Trigger:** เมื่อ `Port Cash >= 20% ของ (Port Margin + Port Buffer)`.
    - **Action:** สถานะปกติ (Healthy).

- **Global Risk Alert:** (หัวข้อนี้รอการหารือเพิ่มเติมเพื่อกำหนดเกณฑ์รวมทั้งระบบ).
- **Cash Pool Transfer:** การโยกย้ายเงินระหว่างพอร์ตต้องมีการยืนยัน (Manual Confirmation).

## 3. Rebalancing Engine

### 3.1 Dual-Mode Operation
- **Standard Mode:** ปรับตาม % เป้าหมายที่กำหนด (Fixed Ratio).
- **Sigma-Weighted (Volatility-Based):** คำนวณตามค่าความผันผวน (Default 30 วัน, ปรับแก้ด้วยมือได้).

### 3.2 Workflow
1. **Calculation:** ระบบคำนวณส่วนต่างระหว่างปัจจุบันและเป้าหมาย.
2. **Recommendation:** แสดงรายการ Trade ที่ต้องทำเพื่อปรับพอร์ต.
3. **Execution:** ผู้ใช้งานตรวจสอบและกดยืนยัน (User Confirmation) เพื่อเปลี่ยน Recommendation เป็น `active_orders`.
4. **NAV History:** บันทึก NAV แบบ "1 วัน 1 Record" (Upsert ข้อมูลถ้าซ้ำวัน).

## 4. AI Autonomous Operations (Full-Loop)
*หมายเหตุ: ส่วนนี้ใช้สำหรับพอร์ตที่มอบหมายให้ AI คุมเท่านั้น (AI-Managed Portfolios)*

### 4.1 Log-Driven Intelligence
- **Reasoning & Risk Logs:** เฉพาะพอร์ต AI เท่านั้นที่จะมีการบันทึกเหตุผลและผลประเมินความเสี่ยงลงใน `ai_action_logs` แบบอัตโนมัติ.
- **Dynamic UI Display:** Dashboard จะดึง Log ล่าสุดมาแสดงผลเพื่อให้เห็น "ความคิด" ของ AI ในพอร์ตนั้นๆ.

### 4.2 Cycle & Safety
1. **Market Scanning:** วิเคราะห์ข้อมูลตลาดจาก Watchlist/Whitelist.
2. **Strategy Planning:** สร้าง `trade_plans` พร้อมบันทึกเหตุผลประกอบ.
3. **Autonomous Execution:** เปิดออเดอร์เข้าสู่ `active_orders` โดยอัตโนมัติ (ภายใต้ Risk Limits ที่กำหนด).
4. **Emergency Stop:** ผู้ใช้งานสั่ง Pause/Stop AI ได้ทันที และ Manual Override ได้ตลอดเวลา.

*สำหรับพอร์ต Manual และ Bot ให้ใช้ตรรกะการจัดการเดิมตามหัวข้อ 2 และ 3.*

## 5. Technical Rules
- **Data Precision:** ทุกการคำนวณตัวเลขและการบันทึกฐานข้อมูลต้องใช้ **Decimal (20, 8)** เพื่อป้องกันความคลาดเคลื่อนจากการปัดเศษ.
- **ETL Synchronization:** ข้อมูลจาก Bot DB จะถูก Sync เข้ามาทุก 2 ชม. โดยยึดกฎ "Read-Only" สำหรับข้อมูลบอต ดูรายละเอียดที่ [[LOGIC-ETL-SYNC]].
- **Manual Data Isolation:** ข้อมูลคีย์มือ (โดยเฉพาะ Option) จะถูกเก็บแยกก้อนไม่ปะปนกับฐานข้อมูลของบอต.
- **Manual First:** เน้นการกรอกข้อมูลมือและการยืนยันด้วยคนในเฟสแรก.
- **Greeks:** คำนวณผ่าน Library (เช่น mibian) โดยใช้ค่า IV จากตลาดหรือกรอกเอง.
- **Data Integrity:** การลบข้อมูลคือ Hard Delete (ถาวร).

---
*Last Updated: 2026-05-17 (Consolidated from Blueprint & Summary)*
