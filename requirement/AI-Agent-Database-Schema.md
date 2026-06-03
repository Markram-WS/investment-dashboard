---
tags:
  - database
  - ai-agent
  - security
  - schema
  - investment-dashboard
---
# 🤖 AI Agent Database Schema (Isolated)

โครงสร้างฐานข้อมูลแยกส่วน (Isolated) สำหรับ AI Agent เพื่อความปลอดภัยและเก็บข้อมูลการตัดสินใจ (Reasoning) อ้างอิงตรรกะใน [[LOGIC-AI-AUTONOMOUS]].

---

## 1. Agent Profiles & Config
*เก็บข้อมูลพื้นฐานและการตั้งค่าระดับสมองของบอทแต่ละตัว*

- **Table:** `ai_agents`
    - `agent_id` (PK): ID ประจำตัว Agent.
    - `agent_name`: ชื่อบอท (e.g., Hermes-Grid-Master).
    - `model_name`: ชื่อโมเดล AI (e.g., Claude-3.5-Sonnet).
    - `target_portfolio_id`: ID ของพอร์ตที่ AI ตัวนี้คุมอยู่ (เชื่อมไปยัง Main DB).
    - `strategy_config` (JSONB): เก็บค่าพารามิเตอร์ Indicator และขีดจำกัดความเสี่ยง (Risk Limits).
    - `status`: สถานะการทำงาน (Active, Paused, Emergency_Stop).

---

## 2. Execution & Audit Logs (The Brain Logs)
*เก็บ "ความคิด" และ "เหตุผล" เบื้องหลังทุกการกระทำ เพื่อการตรวจสอบ (Audit)*

- **Table:** `ai_action_logs`
    - `log_id` (PK), `agent_id` (FK).
    - `action_type`: ขั้นตอนใน Loop (SCAN, PLAN, EXECUTE, ADJUST).
    - **`reasoning`**: คำอธิบายเหตุผลในรูปแบบ Markdown (จะถูกดึงไปแสดงใน UI Portfolio Detail).
    - `confidence_score`: ระดับความเชื่อมั่น (0.0 - 1.0).
    - `raw_data_snapshot` (JSONB): สแนปชอตราคาตลาดและค่า Indicator ณ วินาทีที่ตัดสินใจ.
    - `linked_plan_id`, `linked_order_id`: ID อ้างอิงใน Main DB เพื่อดูความเชื่อมโยง.
    - `created_at`: วันเวลาที่บันทึก Log.

---

## 3. Runtime State & Errors
*เก็บสถานะการทำงานปัจจุบันเพื่อป้องกันการทำงานซ้ำซ้อน*

- **Table:** `ai_agent_state`
    - `agent_id` (PK): เชื่อมกับ ai_agents.
    - `last_run_timestamp`: เวลาที่รัน Loop ล่าสุด.
    - `current_task`: งานที่กำลังทำอยู่ (e.g., "Analyzing BTC/USDT Support").
    - `is_busy` (Boolean): ป้องกันการรัน Loop ซ้อนกัน.
    - `error_logs` (Text): เก็บ Runtime Errors ล่าสุดเพื่อการ Debug.

---
### 🛡️ Security Implementation Note
- **Separation:** ฐานข้อมูลนี้รันแยกก้อนจาก Main DB เพื่อป้องกันไม่ให้ AI เข้าถึงข้อมูลพอร์ต Manual ได้โดยตรง.
- **Access Control:** AI Agent จะมีสิทธิ์ Write เฉพาะใน Schema ของตัวเอง และ Read ข้อมูลที่จำเป็นจาก Main DB ผ่าน API Layer ที่จำกัดสิทธิ์เท่านั้น.
