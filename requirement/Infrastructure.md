---
tags:
  - infrastructure
  - talos-linux
  - k8s
  - storage
  - garagehq
  - raspberry-pi
  - investment-dashboard
---
# 🏗️ INFRASTRUCTURE

รายละเอียดโครงสร้างพื้นฐานเชิงลึก (Hardware & Cluster Layer). อ้างอิงภาพรวมระบบที่ [[Architecture-Overview]].

### 🏗️ 1. Infrastructure Layer (The Foundation)

* **OS:** **Talos Linux** (x86 เป็น Master / Pi 4 เป็น Worker)
* *จุดเด่น:* ไม่มี SSH, จัดการผ่าน API 100%, ปลอดภัยและเบามาก


* **Container Runtime:** **containerd** (มากับ Talos)
* **Networking:** **Flannel** (Default ของ Talos) หรือจะปล่อยเป็นมาตรฐานเพื่อความคลีนจ้า

### 📦 2. Storage Layer (The Vault)

* **Software:** **Garage (GarageHQ)**
* *การทำงาน:* รันเป็น **DaemonSet** กระจายตัวทั้ง 2 เครื่อง
* *Storage:* ให้ Pi 4 เป็นตัวแบก (Weight สูง) เก็บข้อมูลลง SSD จริงผ่าน **HostPath**
* *Interface:* คุยผ่าน **S3 API** (ใช้จัดการ Retention / Versioning)



### 🛡️ 3. Connectivity & VPN

* **VPN:** **Tailscale**
* *รูปแบบ:* รันเป็น Extension หรือ Sidecar ใน Cluster
* *หน้าที่:* รีโมทเข้า Cluster จาก Windows 11 ได้ทุกที่โดยไม่ต้องเปิด Port ที่ Router จ้า



### 📊 4. Management & UI (The Cockpit)

* **Main Dashboard:** **OpenLens** (รันบน Windows 11)
* *หน้าที่:* ดูสุขภาพเครื่อง (CPU/RAM), ดู Log ของ Pod, จัดการ Config ทั้งหมดที่เดียวจบ


* **File Management:** **S3 Browser** (หรือ MinIO Client) บน Windows 11
* *หน้าที่:* เข้าไปดูไฟล์ใน SSD ของ Pi 4 เหมือนใช้ File Explorer จ้า



### 💾 5. Backup Workflow

* **Task:** **Kubernetes CronJob**
* *Logic:* สั่ง Dump DB -> ยิงเข้า S3 ของ Garage -> ตั้ง **Lifecycle (ILM)** ให้ลบไฟล์เก่าอัตโนมัติ



---

### 💡 สรุปความคุ้มค่า (Logic First)

* **บน Pi 4:** รันแค่ระบบพื้นฐาน + Garage (RAM เหลือเฟือสำหรับแบก Disk I/O)
* **บน x86:** รัน Master Node + แอปทำงานจริง (Compute ได้เต็มที่)
* **บน Windows:** แบกงาน UI/Monitoring ทั้งหมด (ลดภาระเครื่องใน Cluster)

