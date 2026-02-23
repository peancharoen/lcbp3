# 00.1 System Context & Architecture (สถาปัตยกรรมและบริบทของระบบ)

---

title: 'System Context & Architecture'
version: 1.8.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2026-02-23
related:
  - specs/01-requirements/01-objectives.md
  - specs/03-implementation/03-01-fullftack-js-v1.7.0.md

---

## 1. 📋 ภาพรวมระบบ (System Overview)
ระบบ LCBP3-DMS (Laem Chabang Port Phase 3 - Document Management System) ถูกออกแบบด้วยสถาปัตยกรรมแบบ **Headless/API-First Architecture** โดยทำงานแบบ **On-Premise 100%** บนเครื่องเซอร์ฟเวอร์ QNAP และ ASUSTOR
ระบบทั้งหมดทำงานอยู่ภายใต้สภาวะแวดล้อมแบบ **Container Isolation** (ผ่าน Container Station) เพื่อความปลอดภัย, ง่ายต่อการจัดการ, และไม่ยึดติดกับ Hardware (Hardware Agnostic)

### 1.1 Architecture Principles
1. **Data Integrity First:** ความถูกต้องของข้อมูลต้องมาก่อนทุกอย่าง
2. **Security by Design & Container Isolation:** รักษาความปลอดภัยที่ทุกชั้น และแยกส่วนการทำงานของแต่ละระบบอย่างชัดเจน (Network Segmentation & Containerization)
3. **On-Premise First:** ข้อมูลและระบบงานทั้งหมดต้องอยู่ภายในเครือข่ายของโครงการเท่านั้น
4. **Resilience:** ทนทานต่อ Failure และ Recovery ได้รวดเร็ว โดยมี Backup NAS
5. **Observability:** ติดตามและวิเคราะห์สถานะระบบได้ง่าย

## 2. 🏢 มาตรฐานการติดตั้ง On-Premise (QNAP/ASUSTOR Installation Standards)

### 2.1 Hardware Infrastructure
- **Primary Server (QNAP TS-473A):**
  - IP: 192.168.10.8 (VLAN 10)
  - Role: Primary NAS for DMS, Container Host
  - Storage: `/share/dms-data` (RAID 5 HDD + SSD Caching)
- **Backup Server (ASUSTOR AS5304T):**
  - IP: 192.168.10.9 (VLAN 10)
  - Role: Backup / Secondary NAS
- **Network Interface:** NAS ทั้งสองตัวใช้ LACP bonding แบบ IEEE 802.3ad เพื่อเพิ่ม bandwidth และ redundancy

### 2.2 Container Isolation & Environment
อ้างอิงข้อจำกัดและมาตรฐานของระบบ Container Station บน QNAP:
- **Containerization Engine:** Docker & Docker Compose
- **Network Isolation:** ทุกคอนเทนเนอร์ (Frontend, Backend, Database, Redis, Search) จะต้องเชื่อมต่อกันผ่าน Internal Docker Network ชื่อ `lcbp3` เท่านั้น ห้าม Expose Port ออกสู่ภายนอกโดยไม่จำเป็น
- **Reverse Proxy:** ใช้ Nginx Proxy Manager (`npm.np-dms.work`) เป็น Gateway (Load Balancer & SSL Termination) รับ Traffic เพียงจุดเดียวบน Port 80/443 และ Map เข้าสู่ Internal Docker Network
- **Configuration Defaults:**
  - **ห้ามใช้ `.env` แบบ bind mount สำหรับ secret บน Production** ตามข้อจำกัดของ Container Station
  - การกำหนดตัวแปรให้ใช้ผ่าน `docker-compose.yml` สำหรับค่าทั่วไปใน Container
  - Sensitive Secrets ต้องใช้ `docker-compose.override.yml` ที่ไม่ถูกนำขึ้น Git หรือผ่าน Docker Secrets

## 3. 🌐 Network Segmentation & Security

ระบบจัดแบ่งเครือข่ายออกเป็น VLANs ต่างๆ เพื่อการควบคุมการเข้าถึงตามหลักการ Zero Trust ย่อยๆ โดยใช้อุปกรณ์เครือข่าย (ER7206 Router & SG2428P Core Switch) ในการบังคับใช้ ACL:

### 3.1 VLAN Configuration
| VLAN ID | Name   | Purpose            | Subnet          | Gateway      | Notes                                     |
| ------- | ------ | ------------------ | --------------- | ------------ | ----------------------------------------- |
| 10      | SERVER | Server & Storage   | 192.168.10.0/24 | 192.168.10.1 | Servers (QNAP, ASUSTOR). Static IPs ONLY. |
| 20      | MGMT   | Management & Admin | 192.168.20.0/24 | 192.168.20.1 | Network devices, Admin PC.                |
| 30      | USER   | User Devices       | 192.168.30.0/24 | 192.168.30.1 | Staff PC, Printers.                       |
| 40      | CCTV   | Surveillance       | 192.168.40.0/24 | 192.168.40.1 | Cameras, NVR. Isolated.                   |
| 50      | VOICE  | IP Phones          | 192.168.50.0/24 | 192.168.50.1 | SIP traffic. Isolated.                    |
| 60      | DMZ    | Public Services    | 192.168.60.0/24 | 192.168.60.1 | DMZ. Isolated from Internal.              |
| 70      | GUEST  | Guest Wi-Fi        | 192.168.70.0/24 | 192.168.70.1 | Isolated Internet Access only.            |

### 3.2 Network ACL & Isolation Rules
- **SERVER Isolation:** `VLAN 30 (USER)` สามารถเข้าถึง `VLAN 10 (SERVER)` ได้เฉพาะพอร์ตที่จำเป็น (HTTP/HTTPS/SSH)
- **MGMT Restriction:** ไม่อนุญาตให้ `VLAN 30 (USER)` เข้าถึง `VLAN 20 (MGMT)` โดยเด็ดขาด
- **Device Isolation:** `CCTV`, `VOICE`, และ `GUEST` แยกขาดออกจากวงอื่นๆ (Deny-All to Internal)
- **Strict Default:** ใช้หลักการ Default Deny บน Gateway (ER7206)
- **Container Level ACL:** ภายในวง `SERVER` Docker Network จะแยกออกไปอีกชั้น ทำให้ Host ในเครือข่าย `VLAN 10` ไม่สามารถเข้าถึง Database หรือ Redis ได้โดยตรง หากไม่ผ่าน Nginx Proxy Manager

## 4. 🧩 Core Services Architecture

| Service      | Application Name | Domain              | Technology      | Purpose            |
| ------------ | ---------------- | ------------------- | --------------- | ------------------ |
| **Frontend** | lcbp3-frontend   | lcbp3.np-dms.work   | Next.js 14+     | Web UI             |
| **Backend**  | lcbp3-backend    | backend.np-dms.work | NestJS          | API Server & Logic |
| **Database** | lcbp3-db         | db.np-dms.work      | MariaDB 11.8    | Primary Data       |
| **DB Admin** | lcbp3-db         | pma.np-dms.work     | phpMyAdmin      | DB Administration  |
| **Proxy**    | lcbp3-npm        | npm.np-dms.work     | Nginx Proxy Mgr | Gateway & SSL      |
| **Workflow** | lcbp3-n8n        | n8n.np-dms.work     | n8n             | Process Automation |
| **Git**      | git              | git.np-dms.work     | Gitea           | Code Repository    |
| **Cache**    | -                | -                   | Redis           | Caching, Locking   |
| **Search**   | -                | -                   | Elasticsearch   | Full-text Indexing |

## 5. 📊 Data Flow & Interactions
1. **User Request:** ผู้ใช้งานส่ง Request ไปที่โดเมนผ่าน HTTP/HTTPS
2. **Reverse Proxy:** Nginx Proxy Manager รับ Request, ตรวจสอบ SSL, และ Forward ไปให้ Frontend หรือ Backend ในวง Docker Network
3. **API Processing:** Backend รัน Business Logic, ประมวลผล Authentication (JWT) และ Permissions (RBAC via Redis Cache)
4. **Data Persistence:** Backend ติดต่อ MariaDB (Database) และ Elasticsearch (Search) ที่ถูกซ่อนไว้ในระบบปิด (Isolations)
5. **Storage Process:** ไฟล์ถูกคัดกรองผ่าน ClamAV (ถ้ามี) และเก็บลง Storage `/share/dms-data` บน QNAP แบบ Two-Phase Storage (Temp -> Permanent) เพื่อป้องกัน Orphan Files

## 6. 💾 Backup & Disaster Recovery (DR)
- **Database Backup:** ทำ Automated Backup รายวันด้วย QNAP HBS 3 หรือ mysqldump
- **File Backup:** ทำ Snapshot หรือ rsync จาก `/share/dms-data` บนเครื่องหลัก (QNAP) ไปยังเครื่องสำรอง (ASUSTOR) อย่างสม่ำเสมอ
- **Recovery Standard:** หาก NAS พัง สามารถ Restore Config ย้ายข้อมูล และรัน `docker-compose up` ขึ้นใหม่บนเครื่อง Backup ได้ทันที เนื่องจาก Architecture ออกแบบแบบ Stateless สำหรับตัวแอพพลิเคชั่น และ Data แยกลง Volume Storage ชัดเจน
