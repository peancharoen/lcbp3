# Data and Storage Specifications

เอกสารและสคริปต์ที่เกี่ยวข้องกับการจัดการข้อมูลและการจัดเก็บสำหรับระบบ NAP-DMS (LCBP3)

## 📁 โครงสร้างไดเรกทอรี

### Schema Files (สคริปต์ฐานข้อมูล)

| ไฟล์ | คำอธิบาย |
|------|-----------|
| `lcbp3-v1.9.0-schema-01-drop.sql` | สคริปต์ลบตารางทั้งหมด (ใช้สำหรับ reset schema) |
| `lcbp3-v1.9.0-schema-02-tables.sql` | สคริปต์สร้างตารางทั้งหมด (CREATE TABLE) |
| `lcbp3-v1.9.0-schema-03-views-indexes.sql` | สคริปต์สร้าง Views และ Indexes |
| `lcbp3-v1.9.0-migration.sql` | สคริปต์ migration support tables สำหรับ n8n Migration Workflow (temporary - ลบได้หลัง migration เสร็จ) |

### Seed Files (ข้อมูลเริ่มต้น)

| ไฟล์ | คำอธิบาย |
|------|-----------|
| `lcbp3-v1.9.0-seed-basic.sql` | ข้อมูลเริ่มต้นพื้นฐาน (Organizations, Users, Roles, Permissions, Intent Classification, Workflow Definitions) |
| `lcbp3-v1.9.0-seed-permissions.sql` | ข้อมูล RBAC Permissions ตาม ADR-016 |
| `lcbp3-v1.9.0-seed-contractdrawing.sql` | ข้อมูล Contract Drawings ตัวอย่าง |
| `lcbp3-v1.9.0-seed-shopdrawing.sql` | ข้อมูล Shop Drawings ตัวอย่าง |

### Documentation

| ไฟล์ | คำอธิบาย |
|------|-----------|
| `0.md` | ภาพรวมและแนวทางการจัดการข้อมูล |
| `03-01-data-dictionary.md` | Data Dictionary คำอธิบายฟิลด์ทั้งหมด |
| `03-02-db-indexing.md` | กลยุทธ์การสร้าง Indexes |
| `03-03-file-storage.md` | กลยุทธ์การจัดเก็บไฟล์ (Two-Phase Upload) |
| `03-04-legacy-data-migration.md` | แผนการนำเข้าข้อมูลเก่า (Legacy Migration) |
| `03-05-n8n-migration-setup-guide.md` | คู่มือติดตั้ง n8n สำหรับ Migration Phase |
| `03-06-migration-business-scope.md` | ขอบเขตการทำ Migration ตาม ADR-009 |
| `03-07-OpenRAG.md` | เอกสาร RAG Implementation Guide |

### Configuration Files

| ไฟล์ | คำอธิบาย |
|------|-----------|
| `n8n.workflow.json` | Workflow n8n สำหรับ Legacy Document Migration |
| `permissions-verification.sql` | สคริปต์ตรวจสอบ Permissions ที่กำหนดไว้ |

## 🚀 การใช้งาน

### การ Setup ฐานข้อมูลใหม่ (Fresh Install)

```bash
# 1. ลบตารางทั้งหมด (ถ้ามี)
mysql < lcbp3-v1.9.0-schema-01-drop.sql

# 2. สร้างตารางทั้งหมด
mysql < lcbp3-v1.9.0-schema-02-tables.sql

# 3. สร้าง Views และ Indexes
mysql < lcbp3-v1.9.0-schema-03-views-indexes.sql

# 4. เพิ่มข้อมูลเริ่มต้นพื้นฐาน
mysql < lcbp3-v1.9.0-seed-basic.sql

# 5. เพิ่ม Permissions
mysql < lcbp3-v1.9.0-seed-permissions.sql

# 6. เพิ่มข้อมูลตัวอย่าง (Optional)
mysql < lcbp3-v1.9.0-seed-contractdrawing.sql
mysql < lcbp3-v1.9.0-seed-shopdrawing.sql
```

### การอัปเกรดจากเวอร์ชันก่อนหน้า

```bash
# รัน migration script (สำหรับ n8n Migration Workflow เท่านั้น)
mysql < lcbp3-v1.9.0-migration.sql

# หมายเหตุ: ทุกการเปลี่ยนแปลง schema ได้ถูกรวมเข้า schema-02-tables.sql และ seed files แล้ว
# ไม่มี delta files ที่ต้องรันแยกตาม ADR-009
```

## 🔗 เอกสารที่เกี่ยวข้อง

### ADRs (Architecture Decision Records)

- **ADR-009**: Database Migration Strategy - ใช้ SQL delta โดยตรง ห้ามใช้ TypeORM migrations
- **ADR-016**: Security & Authentication - RBAC Matrix
- **ADR-019**: Hybrid Identifier Strategy - UUID Strategy
- **ADR-023**: Unified AI Architecture - สถาปัตยกรรม AI หลัก
- **ADR-023A**: Unified AI Architecture (Model Revision) - อัปเดตโมเดล AI
- **ADR-024**: Intent Classification Strategy - Hybrid Intent Classifier (Pattern Match + LLM Fallback)

### Engineering Guidelines

- `specs/05-Engineering-Guidelines/05-02-backend-guidelines.md` - Backend patterns
- `specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md` - Frontend patterns

## ⚠️ ข้อควรระวัง

1. **ADR-009**: ห้ามใช้ TypeORM migrations - ต้องแก้ SQL schema โดยตรงและสร้าง delta file
2. **UUID Handling**: ใช้ UUIDv7 (MariaDB native) ตาม ADR-019 - ห้ามใช้ `parseInt()` บน UUID
3. **AI Boundary**: ตาราง AI (migration_review_queue, ai_audit_logs) ต้องถูกจัดการผ่าน DMS API เท่านั้น (ADR-023)
4. **File Upload**: ต้องใช้ Two-Phase Storage (Temp → Commit) ตาม ADR-016
5. **Schema Changes**: ทุกการเปลี่ยนแปลงต้องอัปเดต Data Dictionary พร้อมกัน

## 📝 Change Log

- **2026-05-19**:
  - เพิ่ม Intent Classification tables (ai_intent_definitions, ai_intent_patterns) ตาม ADR-024
  - รวม delta files (16-add-intent-classification.sql, 17-seed-intent-patterns.sql) เข้า schema-02-tables.sql และ seed-basic.sql
  - ลบ rfa-approval-schema.sql (ตารางทั้งหมดถูกรวมเข้า schema-02-tables.sql แล้ว)
  - ลบ redundant delta files (12, 14, 15) - ตารางและคอลัมน์ทั้งหมดถูกรวมเข้า schema-02-tables.sql แล้ว
  - รวม delta files ที่เหลือ (13 ไฟล์) เข้า schema-02-tables.sql, seed-permissions.sql, และ seed-basic.sql:
    - Schema: rag_status, rag_last_error (attachments), document_chunks table
    - Seed: RAG permissions, RBAC bulk permission, CIRCULATION_FLOW_V1 workflow definition
  - อัปเดต Data Dictionary ด้วย document_chunks table
  - ลบ deltas/ directory ทั้งหมด (ตาม ADR-009 - รวมเข้า main schema/seed เสร็จแล้ว)
- **2026-05-15**: เพิ่ม AI-related tables (migration_review_queue, ai_audit_logs) และ ai_processing_status column ตาม ADR-023A
- **2026-05-14**: อัปเดต schema เป็น v1.9.0 เพื่อรองรับ RFA Approval System และ Unified AI Architecture

## 👥 ผู้รับผิดชอบ

- Database Schema: System Architect
- Data Dictionary: Business Analyst
- Migration Scripts: Backend Team
- AI Integration: AI Integration Lead
