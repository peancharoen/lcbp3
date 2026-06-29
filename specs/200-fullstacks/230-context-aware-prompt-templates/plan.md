# Implementation Plan: Context-Aware Prompt Templates & Database Typo Cleanup

**Branch**: `main` | **Date**: 2026-05-27 | **Spec**: [spec.md](file:///e:/np-dms/lcbp3/specs/200-fullstacks/230-context-aware-prompt-templates/spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/230-context-aware-prompt-templates/spec.md`

---

## Summary

ระบบประมวลผล OCR Metadata Extraction จำเป็นต้องเพิ่มประสิทธิภาพและความถูกต้องในระดับโครงงานและการสกัดชื่อ Tags/ผู้รับเอกสาร (Recipients) 
เราจะนำเสนอการใช้ `context_config` ร่วมกับการปรับแต่ง JSON Schema บน Prompts และดำเนินการแก้ไขความสะอาดของข้อมูลโดยการแปลงตัวแปรประเภทผู้รับจาก `'CC '` เป็น `'CC'` ตั้งแต่ระดับโครงสร้างฐานข้อมูล

---

## Technical Context

**Language/Version**: NestJS 11 + Next.js 16 + TypeScript  
**Primary Dependencies**: class-validator, class-transformer, pg-query/mariadb native  
**Storage**: MariaDB 11.8 + Redis  
**Testing**: Jest (Unit & Integration tests)  
**Target Platform**: QNAP Container Station / Windows Dev OS (WSL2)  
**Project Type**: Web Application (Backend & Frontend integration)  
**Performance Goals**: AI master data resolution < 50ms, data-isolation check < 5ms  
**Constraints**: < 200ms API response time, zero-bypass rate limit on cross-project overrides  
**Scale/Scope**: 11 Metadata Fields Extraction, database cleanup affects `correspondence_recipients`

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **UUID Strategy (ADR-019)**: บังคับใช้ `publicId` และแปลงคีย์จาก UUID -> INT id ภายในระบบหลังรับค่า API ห้าม `parseInt()`
- [x] **No Migration Drift (ADR-009)**: อัปเดต Schema ตรงๆ ผ่าน SQL Delta
- [x] **Data Isolation (ADR-023)**: AI ดึงข้อมูลผ่าน DMS API เท่านั้น และมี Gatekeeper ตรวจสอบความสอดคล้องความถูกต้องระดับโครงการ

---

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/230-context-aware-prompt-templates/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (created by speckit-tasks)
```

### Source Code

```text
backend/
├── src/
│   ├── modules/
│   │   ├── ai/
│   │   │   ├── entities/ai-prompt.entity.ts
│   │   │   ├── dto/ocr-extract.dto.ts
│   │   │   ├── services/ai-prompts.service.ts
│   │   │   └── processors/ai-batch.processor.ts
│   │   └── correspondence/
│   └── common/
└── tests/

specs/03-Data-and-Storage/
├── lcbp3-v1.9.0-schema-02-tables.sql
└── deltas/
    ├── 2026-05-27-add-context-aware-prompts-and-cleanup.sql
    └── 2026-05-27-add-context-aware-prompts-and-cleanup.rollback.sql
```

**Structure Decision**: ใช้โครงสร้าง Web Application (Option 2) โดยหลักๆ เปลี่ยนแปลงในส่วน backend modules และ specs folder.
