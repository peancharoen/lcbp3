# 📚 LCBP3-DMS Specifications Directory

**Version:** 1.8.0
**Last Updated:** 2026-02-24
**Project:** LCBP3-DMS (Laem Chabang Port Phase 3 - Document Management System)

---

เอกสารในโฟลเดอร์ `specs/` ทั้งหมดเป็น **Source of Truth** หรือคัมภีร์หลักสำหรับการพัฒนาระบบ LCBP3-DMS ข้อมูลทั้งหมดถูกอัปเดตและปรับให้มีความสอดคล้องกัน (Modular) ตามมาตรฐานของโปรเจกต์ โครงสร้างด้านล่างคือสารบัญ (Index) ของเอกสารทั้งหมดในระบบ

## 📂 Directory Structure

```text
specs/
├── 00-Overview/                 # ภาพรวมระบบ
│   ├── 00-01-quick-start.md     # คู่มือเริ่มต้นสำหรับนักพัฒนา
│   ├── 00-02-glossary.md        # คำศัพท์และตัวย่อในระบบ DMS
│   └── README.md                # แนะนำโครงสร้างธุรกิจและบริบทระบบ
│
├── 01-Requirements/             # Business Requirements & Modularity (Core)
│   ├── 01-01-objectives.md      # วัตถุประสงค์และการประเมินความสำเร็จของระบบ
│   ├── 01-02-business-rules/    # กฎเหล็กของ DMS (ห้ามละเมิด)
│   ├── 01-03-modules/           # สเปคของแต่ละระบบย่อย (Correspondences, Drawings, RFAs)
│   └── README.md                # สารบัญและรายละเอียดขอบเขตแต่ละ Module
│
├── 02-Architecture/             # สถาปัตยกรรมระบบ (System & Network)
│   ├── 02-01-system-context.md  # System overview
│   ├── 02-02-software-architecture.md # โครงสร้างซอฟต์แวร์ฝั่ง Frontend & Backend
│   ├── 02-03-network-design.md  # Network Segmentation (VLAN, VPN, QNAP/ASUSTOR)
│   ├── 02-04-api-design.md      # API specifications & Error Handling
│   └── README.md                # สรุปรูปแบบโครงสร้างของ Architecture
│
├── 03-Data-and-Storage/         # โครงสร้างฐานข้อมูลและการจัดการไฟล์
│   ├── 03-01-data-dictionary.md # รวมและอธิบายทุก Field ในฐานข้อมูล
│   ├── 03-02-db-indexing.md     # Index recommendations, Soft-delete strategy
│   ├── 03-03-file-storage.md    # Secure File Handling (Outside webroot, QNAP Mounts)
│   ├── lcbp3-v1.7.0-schema.sql  # Database SQL Schema
│   └── README.md                # ภาพรวม Data Strategy
│
├── 04-Infrastructure-OPS/       # โครงสร้างพื้นฐานและการปฏิบัติการ
│   ├── 04-00-docker-compose/    # Docker compose source files
│   ├── 04-01-docker-compose.md  # DEV/PROD Docker configuration
│   ├── 04-02-backup-recovery.md # Disaster Recovery & DB Backup
│   ├── 04-03-monitoring.md      # KPI, Audit Logging, Grafana/Prometheus
│   ├── 04-04-deployment-guide.md# ขั้นตอน Deploy ด้วย Blue-Green (Gitea Actions)
│   ├── 04-05-maintenance-procedures.md # วิธีดูแลรักษาระบบเบื้องต้น
│   ├── 04-06-security-operations.md # การจัดการความปลอดภัยและใบรับรอง
│   ├── 04-07-incident-response.md # วิธีรับมือเหตุฉุกเฉิน
│   └── README.md                # Infrastructure & Operations Guide
│
├── 05-Engineering-Guidelines/   # มาตรฐานการพัฒนาและการเขียนโค้ด
│   ├── 05-01-fullstack-js-guidelines.md # JS/TS Guidelines รวมๆ
│   ├── 05-02-backend-guidelines.md      # NestJS Backend, Error Handling
│   ├── 05-03-frontend-guidelines.md     # UI/UX, React Hook Form, State Strategy
│   ├── 05-04-testing-strategy.md        # Unit/E2E Testing ยุทธศาสตร์
│   ├── 05-05-git-cheatsheet.md          # การใช้ Git สำหรับทีมงาน
│   └── README.md                        # ภาพรวมเป้าหมายงาน Engineering
│
├── 06-Decision-Records/         # Architecture Decision Records (เหตุผลการติดสินใจ)
│   ├── ADR-XXX...               # ไฟล์อธิบายสถาปัตยกรรม (ADR)
│   └── README.md                # รายชื่อ ADR ทั้งหมดพร้อมสถานะและวันที่
│
└── 99-archives/                 # ประวัติการทำงานและ Tasks เก่า
    ├── history/                 # ประวัติเก่า
    ├── tasks/                   # Task ที่อดีตเคยถูกใช้งาน
    └── obsolete-specs/          # เอกสารสเปคเวอร์ชันเก่า (V1.4.2 ฯลฯ)
```

---

## 🎯 Important Rules สำหรับนักพัฒนา (Must Follow)

1. **The Specs are the Source of Truth:** ก่อนเริ่มงานเสมอ ให้อ่าน Requirement, Architecture และ ADR ถ้าเจอประโยคไหนที่คุณคิดไว้แล้วขัดแย้งกับ Specs ให้ยึดจากใน `specs/` เป็นคำตอบสุดท้าย
2. **Never Invent Tables / Columns:** ห้ามสร้างคอลัมน์ใหม่ในหัวเอง ให้ดู File Database schema ใน `03-Data-and-Storage` สำหรับโครงสร้าง Table ทั้งตัวหลักและ Reference
3. **Double-Lock Numbering:** ระบบออกเลขเอกสารของโปรเจกต์มีความอ่อนไหวสูงมาก เนื่องจากมีหลาย User พร้อมกัน ต้องใช้ "Redis Redlock" ควบคู่กับ "DB Optimistic Lock" เพื่อแก้ Race Condition
4. **Follow Blue-Green Deployment:** โปรเจกต์พึ่งพาการทำ Blue-Green Environment เพื่อ Downtime ขั้นต่ำ ฉะนั้นห้ามแก้ Config โดยไม่เข้าใจผลกระทบต่อ Environment ของ Container Station
5. **No `any` Types:** ไม่อนุญาตให้ใช้ `any` ในโค้ด พยายามใช้ Validation ผ่าน DTO / Zod แบบ Strongly-typed เสมอ
