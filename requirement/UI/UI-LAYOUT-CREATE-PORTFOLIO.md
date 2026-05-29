---
tags:
  - ui-layout
  - modal
  - onboarding
  - investment-dashboard
---
# ➕ UI Detail: Create New Portfolio (Refined Miro Style)

อ้างอิง: `UI/model_new_port/code.html`
เชื่อมโยงกับ: [[Detailed-Functional-Requirements#1.4 Create New Portfolio]], [[UI-VISUAL-LAYOUT]]

## 1. The Onboarding Experience
เน้นความรู้สึกเหมือนการ "ร่างแผน" ลงบน Whiteboard ที่ทั้งรวดเร็วและสวยงาม:

### 1.1 Strategy Blueprint (The Essentials)
- **Port Name & Identity:** ชื่อพอร์ตและไอคอนสัญลักษณ์ (Minimal Icons เช่น ₿, 📈, 💱).
- **Interactive Type Selection:** เลือกประเภทพอร์ตผ่านแผ่นการ์ดขนาดเล็ก (ไม่ใช่ Dropdown) เพื่อความชัดเจนในการแยก Logic (Managed / Active / Spread).
- **Initial Funding:** ยอดเงินตั้งต้นพร้อมระบบเลือกสกุลเงินหลัก.

### 1.2 The "Strategy Sticky" (Optional Note)
- **Visual:** ช่องกรอก Markdown สั้นๆ ที่ดีไซน์มาในรูปแบบ **Sticky Note (Canary Yellow)** แปะอยู่ข้างๆ ฟอร์มหลัก.
- **Purpose:** สำหรับจด "กฎเหล็ก" หรือ "ความตั้งใจแรก" ของพอร์ตนี้ (e.g., "ห้ามถือเกิน 30 วัน", "เน้นกิน Premium").

### 1.3 Live Card Preview
- **Interactive Feedback:** ขณะที่ผู้ใช้เลือกสี (Color Palette) หรือพิมพ์ชื่อ ระบบจะแสดง **"Mini Portfolio Card"** จำลองขึ้นมาใน Modal เพื่อให้เห็นภาพทันทีว่าจะไปปรากฏบนหน้า Overview อย่างไร.

## 2. Visual Theme & Customization
- **Color Palette:** ใช้ชุดสี Miro Pastel (Coral, Peach, Cream, Teal, Blue, Lavender).
- **Rounded Aesthetics:** ทุกองค์ประกอบใช้ความมนระดับ `rounded-xl` เพื่อความสมูท.

---
## 📝 Future Details & Scalability
- [x] *Visual Style: Live card preview and Sticky Note strategy.*
- [x] *User Experience: Card-based type selection over dropdowns.*
- [ ] *Templates: Quick-start blueprints for standard risk setups.*
---
[[UI-VISUAL-LAYOUT|⬅️ กลับสู่ Master Layout]]

