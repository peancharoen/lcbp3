# 🛠️ Section 2: System Architecture (สถาปัตยกรรมและเทคโนโลยี)

---

title: 'System Architecture'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related: -
specs/01-objectives.md

---

ชื่อกำหนด สถาปัตยกรรมแบบ Headless/API-First ที่ทันสมัย ทำงานทั้งหมดบน QNAP Server ผ่าน Container Station เพื่อความสะดวกในการจัดการและบำรุงรักษา

## **2.1 Infrastructure & Environment:**

- Domain: `np-dms.work`, `www.np-dms.work`
- IP: 159.192.126.103
- Server: QNAP (Model: TS-473A, RAM: 32GB, CPU: AMD Ryzen V1500B)
- Containerization: Container Station (Docker & Docker Compose) ใช้ UI ของ Container Station เป็นหลัก ในการ configuration และการรัน docker command
- Development Environment: VS Code/Cursor on Windows 11
- Data Storage: /share/dms-data บน QNAP
- ข้อจำกัด: ไม่สามารถใช้ .env ในการกำหนดตัวแปรภายนอกได้ ต้องกำหนดใน docker-compose.yml เท่านั้น

## **2.2 การจัดการ Configuration (ปรับปรุง):**

- ใช้ docker-compose.yml สำหรับ environment variables ตามข้อจำกัดของ QNAP
- Secrets Management:
  - ห้ามระบุ Sensitive Secrets (Password, Keys) ใน docker-compose.yml หลัก
  - ต้องใช้ไฟล์ docker-compose.override.yml (ที่ถูก gitignore) สำหรับ Inject Environment Variables ที่เป็นความลับในแต่ละ Environment (Dev/Prod)
  - ไฟล์ docker-compose.yml หลักให้ใส่ค่า Dummy หรือว่างไว้
- แต่ต้องมี mechanism สำหรับจัดการ sensitive secrets อย่างปลอดภัย โดยใช้:
  - Docker secrets (ถ้ารองรับ)
  - External secret management (Hashicorp Vault) หรือ
  - Encrypted environment variables
- Development environment ยังใช้ .env ได้ แต่ต้องไม่ commit เข้า version control
- ต้องมี configuration validation during application startup
- ต้องแยก configuration ตาม environment (development, staging, production)
- Docker Network: ทุก Service จะเชื่อมต่อผ่านเครือข่ายกลางชื่อ lcbp3 เพื่อให้สามารถสื่อสารกันได้

## **2.3 Core Services:**

- Code Hosting: Gitea (Self-hosted on QNAP)

  - Application name: git
  - Service name: gitea
  - Domain: git.np-dms.work
  - หน้าที่: เป็นศูนย์กลางในการเก็บและจัดการเวอร์ชันของโค้ด (Source Code) สำหรับทุกส่วน

- Backend / Data Platform: NestJS

  - Application name: lcbp3-backend
  - Service name: backend
  - Domain: backend.np-dms.work
  - Framework: NestJS (Node.js, TypeScript, ESM)
  - หน้าที่: จัดการโครงสร้างข้อมูล (Data Models), สร้าง API, จัดการสิทธิ์ผู้ใช้ (Roles & Permissions), และสร้าง Workflow ทั้งหมดของระบบ

- Database: MariaDB 11.8

  - Application name: lcbp3-db
  - Service name: mariadb
  - Domain: db.np-dms.work
  - หน้าที่: ฐานข้อมูลหลักสำหรับเก็บข้อมูลทั้งหมด
  - Tooling: DBeaver (Community Edition), phpmyadmin สำหรับการออกแบบและจัดการฐานข้อมูล

- Database Management: phpMyAdmin

  - Application name: lcbp3-db
  - Service: phpmyadmin:5-apache
  - Service name: pma
  - Domain: pma.np-dms.work
  - หน้าที่: จัดการฐานข้อมูล mariadb ผ่าน Web UI

- Frontend: Next.js

  - Application name: lcbp3-frontend
  - Service name: frontend
  - Domain: lcbp3.np-dms.work
  - Framework: Next.js (App Router, React, TypeScript, ESM)
  - Styling: Tailwind CSS + PostCSS
  - Component Library: shadcn/ui
  - หน้าที่: สร้างหน้าตาเว็บแอปพลิเคชันสำหรับให้ผู้ใช้งานเข้ามาดู Dashboard, จัดการเอกสาร, และติดตามงาน โดยจะสื่อสารกับ Backend ผ่าน API

- Workflow Automation: n8n

  - Application name: lcbp3-n8n
  - Service: n8nio/n8n:latest
  - Service name: n8n
  - Domain: n8n.np-dms.work
  - หน้าที่: จัดการ workflow ระหว่าง Backend และ Line

- Reverse Proxy: Nginx Proxy Manager

  - Application name: lcbp3-npm
  - Service: Nginx Proxy Manager (nginx-proxy-manage: latest)
  - Service name: npm
  - Domain: npm.np-dms.work
  - หน้าที่: เป็นด่านหน้าในการรับ-ส่งข้อมูล จัดการโดเมนทั้งหมด, ทำหน้าที่เป็น Proxy ชี้ไปยัง Service ที่ถูกต้อง, และจัดการ SSL Certificate (HTTPS) ให้อัตโนมัติ

- Search Engine: Elasticsearch
- Cache: Redis

## **2.4 Business Logic & Consistency (ปรับปรุง):**

- 2.4.1 Unified Workflow Engine (หลัก):

  - ระบบการเดินเอกสารทั้งหมด (Correspondence, RFA, Circulation) ต้อง ใช้ Engine กลางเดียวกัน โดยกำหนด Logic ผ่าน Workflow DSL (JSON Configuration) แทนการเขียน Hard-coded ลงในตาราง
  - Workflow Versioning (เพิ่ม): ระบบต้องรองรับการกำหนด Version ของ Workflow Definition โดยเอกสารที่เริ่มกระบวนการไปแล้ว (In-progress instances) จะต้องใช้ Workflow Version เดิม จนกว่าจะสิ้นสุดกระบวนการ หรือได้รับคำสั่ง Migrate จาก Admin เพื่อป้องกันความขัดแย้งของ State

- 2.4.2 Separation of Concerns:

  - Module ต่างๆ (Correspondence, RFA, Circulation) จะเก็บเฉพาะข้อมูลของเอกสาร (Data) ส่วนสถานะและการเปลี่ยนสถานะ (State Transition) จะถูกจัดการโดย Workflow Engine

- 2.4.3 Idempotency & Locking:

  - ใช้กลไกเดิมในการป้องกันการทำรายการซ้ำ

- 2.4.4 Optimistic Locking:

  - ใช้ Version Column ใน Database ควบคู่กับ Redis Lock สำหรับการสร้างเลขที่เอกสาร เพื่อเป็น Safety Net ชั้นสุดท้าย

- 2.4.5 จะไม่มีการใช้ SQL Triggers
  - เพื่อป้องกันตรรกะซ่อนเร้น (Hidden Logic) และความซับซ้อนในการดีบัก

## **2.5 Data Migration และ Schema Versioning:**

- ต้องมี database migration scripts สำหรับทุก schema change โดยใช้ TypeORM migrations
- ต้องรองรับ rollback ของ migration ได้
- ต้องมี data seeding strategy สำหรับ environment ต่างๆ (development, staging, production)
- ต้องมี version compatibility between schema versions
- Migration scripts ต้องผ่านการทดสอบใน staging environment ก่อน production
- ต้องมี database backup ก่อนทำ migration ใน production

## **2.6 กลยุทธ์ความทนทานและการจัดการข้อผิดพลาด (Resilience & Error Handling Strategy)**

- 2.6.1 Circuit Breaker Pattern: ใช้สำหรับ external service calls (Email, LINE, Elasticsearch)
- 2.6.2 Retry Mechanism: ด้วย exponential backoff สำหรับ transient failures
- 2.6.3 Fallback Strategies: Graceful degradation เมื่อบริการภายนอกล้มเหลว
- 2.6.4 Error Handling: Error messages ต้องไม่เปิดเผยข้อมูล sensitive
- 2.6.5 Monitoring: Centralized error monitoring และ alerting system
