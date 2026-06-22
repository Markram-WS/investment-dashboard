---
version: alpha
name: MANAGED-FUND
description: Managed Fund detail screen for portfolio rebalancing based on target allocation ratios.

tags:
  - ui-layout
  - managed-fund
  - rebalancing
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
  heading-1:
    fontFamily: "Roobert PRO, Plus Jakarta Sans, sans-serif"
    fontSize: 32px
    fontWeight: 600
  heading-2:
    fontFamily: "Roobert PRO, Plus Jakarta Sans, sans-serif"
    fontSize: 24px
    fontWeight: 600
  body-md:
    fontFamily: "Roobert PRO, Plus Jakarta Sans, sans-serif"
    fontSize: 16px

rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px

spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
---

# 📊 UI Detail: Managed Fund Detail Screen

อ้างอิง: [[Detailed-Functional-Requirements#2.1 Portfolio Types]]
เชื่อมโยงกับ: [[UI-LAYOUT-OVERVIEW]], [[Detailed-Functional-Requirements#3.2 Workflow]]

## 1. Managed Fund Information
- **Header:** แสดงชื่อพอร์ต "Managed Fund" พร้อมประเภท (Badge)
- **Key Metrics:**
  - Current NAV
  - Margin Locked
  - Available Cash
  - Last Rebalance Date

## 2. Asset Allocation (Target vs Current)
### 2.1 Target Ratio Display
- **Visual:** Bar chart หรือ progress bars สำหรับแต่ละสินทรัพย์
- **Data:** ดึงจาก `target_ratio` field ของ portfolio

### 2.2 Current Allocation
- **Visual:** แสดงเป็น bar chart ที่สัมพันธ์กับ Target (Side-by-side comparison)
- **Logic:** คำนวณจาก holdings จริง (จำลองจาก current_nav distribution)

### 2.3 Drift Indicator
- **Visual:** แสดงสีสำคัญเมื่อความแตกต่าง > 5%
  - 🟢 Safe: drift <= 5%
  - 🟡 Warning: drift 5-15%
  - 🔴 Danger: drift > 15%

## 3. Trade Plan
- **Display:** Markdown format จาก `trade_plan_md` field
- **Edit:** ปุ่มแก้ไข inline
- **Visual Style:** Sticky note style (Canary Yellow background)

## 4. Rebalance Section
- **Trigger Button:** "Calculate Rebalance" - เรียก `/api/v1/rebalance/recommend`
- **Recommendations Display:** ตารางแสดง:
  - Symbol
  - Side (Buy/Sell)
  - Quantity
  - Estimated Price
  - Reason
- **Execute Button:** "Execute Trades" - ส่งไป `/api/v1/rebalance/execute`

## 5. NAV History
- **Visual:** Line chart แสดงยอด NAV ย้อนหลัง
- **API:** `/api/v1/rebalance/nav-history/{portfolio_id}`
- **Frequency:** 1 record per day

## 6. Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Managed Fund Name + Type Badge                      │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────┬───────────────────────────────────────┐   │
│ │ Key Metrics   │ Asset Allocation (Target vs Current)  │   │
│ │ - NAV         │ ┌────────────┬────────────┐           │   │
│ │ - Margin      │ │ Asset A    │ ████░░░░ 40%│           │   │
│ │ - Available   │ │ Asset B    │ ██████░░░ 60%│           │   │
│ └───────────────┴─┴────────────┴────────────┴───────────┘   │
├─────────────────────────────────────────────────────────────┤
│ Trade Plan (Markdown Editor)                                │
│                                                             │
│ # Rebalance Strategy                                         │
│ - Target: 60% BTC, 40% ETH                                   │
│ - Tolerance: ±5%                                             │
├─────────────────────────────────────────────────────────────┤
│ Rebalance Actions                                          │
│ [Calculate] → Show recommendations table                   │
│ [Execute] → Confirm trades                                 │
├─────────────────────────────────────────────────────────────┤
│ NAV History (Line Chart)                                    │
└─────────────────────────────────────────────────────────────┘
```

## 7. API Integration
- GET `/api/v1/portfolios/{portfolio_id}` - Portfolio details
- GET `/api/v1/rebalance/nav-history/{portfolio_id}` - NAV history
- POST `/api/v1/rebalance/recommend` - Get trade recommendations
- POST `/api/v1/rebalance/execute` - Execute recommended trades

---
[[UI-VISUAL-LAYOUT|⬅️ กลับสู่ Master Layout]]