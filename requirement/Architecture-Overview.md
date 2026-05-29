---
tags:
  - architecture
  - system-design
  - tech-stack
  - investment-dashboard
---
# 🏗️ Architecture Overview

ระบบออกแบบเป็น Web Application แบบ Full-stack โดยเน้นความเบา (Lean) และความปลอดภัยสูง เพื่อรองรับการบริหารจัดการพอร์ตการลงทุนแบบ Unified Dashboard (Manual + Bot Trade).

## 1. System Components
1. **Frontend (Dashboard Interface):** พัฒนาด้วย **React + TypeScript** รันบน **Node.js + Vite** เพื่อความเสถียรและ compatibility เน้นการแสดงผลแบบ Data-dense (Anthropic Style). อ้างอิงข้อกำหนด UI ใน [[Detailed-Functional-Requirements]]
2. **Backend (API Server):** ใช้ **FastAPI (Python)** สำหรับจัดการ Financial Logic, การคำนวณ Greeks, Rebalancing และเป็นท่อส่งข้อมูลหลัก.
3. **Databases (Multi-Instance):**
    - **Main DB (PostgreSQL):** เก็บข้อมูลหลัก (Orders, Portfolios, Plans). ดู [[Database-Schema]].
    - **AI Agent DB (Isolated PostgreSQL):** เก็บข้อมูลบอตและการตัดสินใจ (Logs, Reasoning). ดู [[AI-Agent-Database-Schema]].
    *การแยก DB เพื่อจำกัดสิทธิ์ (Access Control) และความปลอดภัยของระบบอัตโนมัติ.*
4. **Intelligence Layer (Hermes):**
 ใช้ Python + **Mem0 + Qdrant** สำหรับระบบความจำระยะยาวและการวิเคราะห์ความเสี่ยง (Risk Framework).
5. **Data ETL Layer:** ทำหน้าที่ดึงข้อมูลจาก Bot DB มาปรับ Format และ Sync เข้าสู่ Centralized DB (ทุก 2 ชม. หรือสั่ง Manual).

## 2. Technical Stack (POC & Production)
ระบบออกแบบมาให้ยืดหยุ่น โดยเริ่มพัฒนาแบบ POC เพื่อความรวดเร็ว ก่อนจะย้ายไปรันบน Cluster จริงที่มีความปลอดภัยสูง. ข้อมูลเชิงลึกดูได้ที่ [[INFRASTRUCTURE]].

### 🏗️ Environment Strategy
- **POC:** **Windows 11 + Podman Desktop** (เน้นความเร็วในการพัฒนาและทดสอบ).
- **Production:** **Talos Linux Cluster** (Master: x86 / Worker: Pi 4) - รันแบบ Immutable, ไม่มี SSH.
- **Storage Layer:** **Garage (GarageHQ)** - Distributed S3 storage สำหรับเก็บไฟล์และ Backup (Production).

### 💻 Application Stack & Roles
| **Component** | **Technology** | **Logic Role** |
| :--- | :--- | :--- |
| **Backend** | FastAPI (Python) | ท่อส่งข้อมูลกลาง และจุดคำนวณ Financial Logic |
|| **Frontend** | React (Node.js + Vite) | UI Dashboard (Lean & Data-dense) |
| **Database** | PostgreSQL | เก็บ Transaction/Order แม่นยำระดับทศนิยม |
| **Agent Logic** | **Hermes (Python)** | หัวใจการตัดสินใจเทรดและคุมความเสี่ยง (Risk Framework) |
| **Agent Memory** | **Mem0 + Qdrant** | ระบบความจำระยะยาวแบบ Vector Search (ประหยัด RAM) |

---

## 🛠️ 3. Implementation Roadmap (3-Phase Guide)

Gemmy แบ่งการสร้างเป็น 3 เฟสเพื่อความปลอดภัยและความมั่นคงของระบบ (Risk Framework):

### เฟสที่ 1: เตรียมคลังข้อมูล (The Foundation) 🟢
**เป้าหมาย:** รัน Database และระบบ Storage พร้อมท่อ Backup.
- **POC:** ใช้ `docker-compose` รัน PostgreSQL และ Qdrant บนเครื่อง Windows.
- **Production:** เตรียม K8s Manifests สำหรับ Deploy PostgreSQL และ **Garage S3** ใน Cluster.

### เฟสที่ 2: ติดตั้งสมองกล (The Intelligence) 🧠
**เป้าหมาย:** ให้ Hermes เริ่มจำได้และคุมความเสี่ยงได้จริง.
1. **Config Mem0/Qdrant:** เชื่อมต่อระบบความจำกับ Vector DB.
2. **Risk Logic:** เขียนฟังก์ชันบันทึก Log การตัดสินใจเสี่ยงๆ (Risk Veto) ลงใน Qdrant.

### เฟสที่ 3: ปล่อยหน้าจอเบาหวิว (The Lean UI) 🌐
**เป้าหมาย:** รัน Dashboard ด้วย Node.js + Vite และเชื่อมต่อข้อมูล Real-time.
1. **UI Deployment:** สร้าง Dockerfile (Node.js-based) สำหรับรันหน้าจอ.
2. **WebSocket Integration:** เชื่อมต่อ FastAPI WebSocket เพื่อผลักข้อมูลออกหน้าจอแบบ Real-time.

---

## 4. High-Level Data Flow & Backup
1. **Incoming Data:** ข้อมูลจาก Bot/Manual เข้าสู่ **FastAPI** -> บันทึกลง **PostgreSQL**.
2. **Memory Storage:** Hermes สกัดสาระสำคัญบันทึกลง **Qdrant**.
3. **Storage:** (Production) ไฟล์และ Snapshot ต่างๆ ถูกส่งไปเก็บที่ **Garage S3**.
4. **Backup Workflow:** ใช้ **Kubernetes CronJob** สั่ง Dump DB และยิงเข้า S3 (Garage) พร้อมระบบลบไฟล์เก่าอัตโนมัติ (ILM).
5. **Visualizer:** ข้อมูล Real-time ส่งผ่าน **WebSockets** ไปยัง Dashboard.
6. **User Access:** จัดการ Cluster ผ่าน **OpenLens** และเข้าถึงระบบผ่าน **Tailscale**.


---
*Last Updated: 2026-05-17 (Consolidated from Blueprint & Summary)*
