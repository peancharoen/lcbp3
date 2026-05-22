# ADR-028: Migration Architecture Refactor (Staging Queue & Post-Migration Cleanup)

**Status:** Active
**Date:** 2026-05-22
**Decision Makers:** Senior Full Stack Developer, Lead Architect
**Related Documents:**
- [Feature Specification (spec.md)](file:///e:/np-dms/lcbp3/specs/200-fullstacks/228-migration-arch-refactor/spec.md)
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md)
- [ADR-023A: Unified AI Architecture (Model Revision)](./ADR-023A-unified-ai-architecture.md)

---

## 🎯 Gap Analysis & Purpose

### ปิด Gap จากเอกสาร:
- **03-04 legacy-data-migration.md** - ระบบการโอนย้ายข้อมูลจากระบบเดิม:
  - เหตุผล: การโอนย้ายข้อมูลขนาดใหญ่มีความเสี่ยงที่จะทำให้เกิดข้อมูลที่ผิดพลาด หรือข้อมูลซ้ำซ้อนในระบบฐานข้อมูลจริง (Production) การเพิ่มขั้นตอน Human-in-the-Loop ผ่าน Staging Review Queue และการนำ UuidResolverService มาแก้ปัญหาความขัดแย้งของ ID จะช่วยควบคุมความถูกต้องของข้อมูลก่อนนำเข้าระบบจัดเก็บถาวร

### แก้ไขความขัดแย้ง:
- **ADR-019** vs **Frontend DTO**: DTO บน Frontend ทั่วไปใช้ UUID (`publicId`) แต่การนำเข้าข้อมูลในระบบหลังบ้าน (Backend) จำเป็นต้องใช้ Internal AUTO_INCREMENT Primary Key ในการทำ Foreign Key Constraints
  - การตัดสินใจนี้ช่วยแก้ไขโดย: ออกแบบให้ DTO ของการยืนยันข้อมูล (`CommitMigrationReviewDto`) รองรับทั้ง `number | string` (Hybrid Type) และใช้ `UuidResolverService` ฝั่ง Backend เพื่อถอดรหัส UUID เป็น INT PK โดยไม่เปิดเผยค่า PK ภายในออกสู่ภายนอก

---

## Context and Problem Statement

ในการโอนย้ายข้อมูลจากระบบเดิมผ่านระบบอัตโนมัติ (n8n + PaddleOCR + Gemma4) พบความท้าทายหลัก 3 ประการ:
1. ข้อมูลบางส่วนอาจมีค่าความเชื่อมั่นต่ำ (Low Confidence) หรือมีข้อมูลโครงการและคู่สัญญาไม่ถูกต้อง ซึ่งระบบต้องการคนตรวจสอบแก้ไขก่อนบันทึกจริง (Human-in-the-Loop)
2. สิทธิ์ในการเข้าถึงและนำเข้าข้อมูลจริงต้องจำกัดให้เฉพาะผู้มีบทบาท `DOCUMENT_CONTROLLER` หรือ `ADMIN` และต้องได้รับการป้องกันการกดบันทึกซ้ำ (Double Commit / Race Condition)
3. ตารางประมวลผลการย้ายข้อมูล (Staging Tables) มีขนาดใหญ่และจำเป็นต้องลบออกหลังเสร็จสิ้นกระบวนการโอนย้ายข้อมูลเพื่อประหยัดพื้นที่ โดยยังคงต้องรักษาข้อมูลประวัติเพื่อทำ Idempotency Guard เสมอ

---

## Decision Drivers

- **Data Integrity & Security:** ต้องเป็นไปตามมาตรฐานการกรองสิทธิ์ CASL Guard และการแยก UUID (ADR-019)
- **Zero Race Condition:** ป้องกันการกดบันทึกซ้ำจากการเปิดแถวแก้ไขพร้อมกันด้วยระบบ Optimistic Locking (`version`) และ `SELECT FOR UPDATE` หรือ Pessimistic Writing
- **Resource Cleanup:** ลดภาระหน่วยความจำและพื้นที่เก็บข้อมูลหลังงาน Migration เสร็จสมบูรณ์

---

## Considered Options

### Option 1: Inline Direct Migration (นำเข้าทันทีไม่มี Staging Queue)
นำเข้าเอกสารทุกตัวเข้าสู่ระบบ Production ทันที โดยให้ AI ดำเนินการ 100%
- **Pros:** รวดเร็ว ไม่ต้องเขียนหน้าจอ Frontend Review
- **Cons:** ❌ ข้อมูลขยะจำนวนมากจะหลุดเข้าสู่ Production, ไม่สามารถแก้ไขค่า Tags หรือวิเคราะห์ข้อมูลโครงการที่ AI ดึงผิดได้

### Option 2: Human-in-the-Loop Review Queue with Post-Migration Cleanups (เลือกแนวทางนี้)
ออกแบบตาราง Staging 5 ตารางและ Review UI สำหรับตรวจสอบข้อมูล โดยกำหนดให้ผู้ตรวจแก้ Metadata ได้ และมีคำสั่งทำความสะอาดหลังจบโครงการ
- **Pros:** ✅ ข้อมูลถูกต้อง 100%, แก้ไข tag ภาษาไทยและ project ID ได้รวดเร็ว, รักษาความปลอดภัยตาม ADR-019 และป้องกันการบันทึกซ้ำด้วย `import_transactions`
- **Cons:** ❌ ต้องสร้าง Component และ SQL Delta เพิ่มเติม

---

## Decision Outcome

**Chosen Option:** Option 2

### Rationale
การเพิ่มชั้น Staging Queue ร่วมกับ UuidResolverService ป้องกันปัญหาเรื่องข้อมูลขยะหลุดเข้าระบบและการรั่วไหลของค่า INT PK ออกสู่ภายนอกได้อย่างสมบูรณ์

---

## 🔍 Impact Analysis

### Affected Components (ส่วนประกอบที่ได้รับผลกระทบ)

| Component | Level | Impact Description | Required Action |
|-----------|-------|-------------------|-----------------|
| **Backend** | 🔴 High | เพิ่ม Service และ Controller ในการถอดรหัส UUID เป็น ID ในระบบ และบันทึก Correspondence | ติดตั้ง `UuidResolverService` และควบคุม Transactional Commit |
| **Frontend** | 🟡 Medium | พัฒนาหน้าจอ `/migration/review` และ Custom Query Hooks | ออกแบบ Sheet Panel และ components ตาม standard UI |
| **Database** | 🔴 High | สร้าง SQL Delta ลบตารางและเตรียมโครงสร้างตาราง Tags | จัดทำ Delta และ Rollback SQL Script |

### Required Changes (การเปลี่ยนแปลงที่ต้องดำเนินการ)

#### 🔴 Critical Changes (ต้องทำทันที)
- [x] **Commit DTO Refactoring** - `backend/src/modules/migration/dto/commit-migration-review.dto.ts`: รองรับ Hybrid Types (`number | string`)
- [x] **Review Service Implementation** - `backend/src/modules/migration/migration-review.service.ts`: ใช้ UuidResolverService และจัดการ Recipients `TO` ใน transaction
- [x] **Review Queue UI Page** - `frontend/app/(dashboard)/migration/review/page.tsx`: พัฒนาส่วนควบคุมหน้าหลัก, แท็บกรองสถานะ และปุ่มดาวน์โหลดใหม่

#### 🟡 Important Changes (ควรทำภายใน 3 วัน)
- [x] **Drop Staging SQL Delta** - `specs/03-Data-and-Storage/deltas/2026-05-22-drop-migration-tables.sql`: สร้างคำสั่ง Drop ตาราง staging
- [x] **Drop Staging SQL Rollback** - `specs/03-Data-and-Storage/deltas/2026-05-22-drop-migration-tables.rollback.sql`: สคริปต์กู้คืนตารางย้ายข้อมูล

---

## 📋 Version Dependency Matrix

| ADR | Version | Dependency Type | Affected Version(s) | Implementation Status |
|-----|---------|-----------------|---------------------|----------------------|
| **ADR-019** | 1.0 | Required | v1.9.0+ | ✅ Implemented |
| **ADR-023A** | 2.0 | Required | v1.9.0+ | ✅ Implemented |
| **ADR-028** | 1.0 | Core | v1.9.5+ | ✅ Implemented |

### Version Compatibility Rules
- **Minimum Version:** v1.9.5 (ADR-028 มีผลสมบูรณ์)
- **Deprecation Timeline:** ตาราง staging ทั้ง 5 ตารางจะถูกดรอปออกภายใน 30 วันหลังสิ้นสุดช่วงระยะการนำเข้าข้อมูล (Gate #3) โดยตาราง `import_transactions` จะคงอยู่ตลอดไป

---

## References
- specs/03-Data-and-Storage/lcbp3-v1.9.0-migration.sql
- specs/03-Data-and-Storage/03-04-legacy-data-migration.md
