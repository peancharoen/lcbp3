// File: specs/200-fullstacks/252-excel-data-review-pipeline/plan.md
// Change Log:
// - 2026-09-05: Initial implementation plan for 4-Layer Excel Data Review Pipeline (ADR-052)
// - 2026-09-09: Added Frontend Source Code Components — original plan was
//   backend-only, leaving the feature with no menu entry (Phase 8, T028-T031)

# Implementation Plan: 4-Layer Excel Data Review & AI Suggestion Pipeline

**Branch**: `feature/252-excel-data-review-pipeline` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/200-fullstacks/252-excel-data-review-pipeline/spec.md`  
**ADR**: [ADR-052: 4-Layer Excel Data Review & AI Suggestion Pipeline](../../06-Decision-Records/ADR-052-excel-data-review-pipeline.md)

---

## Summary

ระบบนำเข้าข้อมูลแบบ 4 ชั้น สำหรับตรวจสอบความถูกต้องของไฟล์ Excel (.xlsx) ก่อนนำเข้าสู่ระบบ DMS ทั้งในโหมด Legacy Migration และ Routine Import ประจำวัน โดยมีหัวใจหลักคือการสร้างไฟล์ Excel ฉบับ Annotated ที่ AI ไฮไลต์สีและฝัง Cell Note แนะนำข้อแก้ไขส่งกลับให้ผู้ใช้ดาวน์โหลดไปตรวจเองในโปรแกรม Microsoft Excel พร้อมระบบ Re-validation ตอน Confirm และนโยบายความปลอดภัย On-premises Default ตาม ADR-023 และ ADR-052

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**:
- NestJS 10.x (`@nestjs/common`, `@nestjs/typeorm`, `@nestjs/bullmq`)
- `exceljs` (`^4.4.0`)
- `ioredis` (Redis 7.x)
- Local Ollama (`np-dms-ai`) + Adapter สำหรับ Google Gemini & Anthropic Claude
**Storage**:
- MariaDB 11.x (No schema change per ADR-044; reuses `import_transactions`, `correspondences`, `migration_review_queue`)
- Redis (Active Review Sessions with 24h TTL)
- Local Private Stash Directory (`uploads/staging/import-review/`)
**Testing**: Jest unit tests & e2e tests  
**Target Platform**: Linux (np-dms-lcbp3)  
**Performance Goals**:
- Schema + Business Rules validation $\le 1.5$s สำหรับ 200 แถว
- Annotated Excel generation $\le 5$s
**Constraints**:
- ADR-019: Public ID เป็น UUIDv7 string เสมอ ห้าม `parseInt()` / ห้าม expose internal INT id
- ADR-023: AI Isolation on-premises เป็นค่าเริ่มต้น ห้ามส่งข้อมูลรั่วไหลไปคลาวด์โดยไม่ได้รับอนุญาต
- ADR-044: ห้ามใช้ TypeORM migrations ห้ามแก้ schema โดยไม่จำเป็น
- ADR-016: CASL RBAC Matrix guards

---

## Constitution Check

- ✅ **ADR-019 UUID Compliance**: ทุก Entity และ DTO ใช้ `publicId` (string UUIDv7) เท่านั้น
- ✅ **ADR-023/043 AI Boundary**: Local LLM เป็น Default; Cloud LLM ปิดกั้นด้วย `ALLOW_EXTERNAL_AI_REVIEW` และ CASL Admin Guard
- ✅ **ADR-044 Schema Strategy**: Zero schema change — ใช้ Redis 24h TTL สำหรับ Session และใช้ `import_transactions` ที่มีอยู่เดิม
- ✅ **TypeScript Strict Mode**: Zero `any`, Zero `console.log`, NestJS `Logger` เท่านั้น

---

## Project Structure & Artifacts

```text
specs/200-fullstacks/252-excel-data-review-pipeline/
├── spec.md              # Feature specification (14 resolved decisions D1-D14)
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical research & decisions
├── data-model.md        # Entities, DTOs & data structures
├── quickstart.md        # API usage guide & cURL examples
├── contracts/
│   └── import-review-api.yaml # OpenAPI 3.0 Contract
├── checklists/
│   └── requirements.md  # Quality validation checklist
└── tasks.md             # Implementation tasks (generated next)
```

### Source Code Components

```text
backend/src/modules/migration/
├── services/
│   ├── excel-data-review.service.ts    # Main orchestrator for 4-layer review
│   ├── excel-row-builder.service.ts    # Single parser rule for both Review & Commit
│   ├── excel-date-parser.service.ts    # DMY parsing + BE auto-convert (-543)
│   ├── excel-annotator.service.ts      # ExcelJS styling & cell note generation
│   ├── ai-review-provider.factory.ts   # Multi-tier factory (Local, Gemini, Claude)
│   └── review-session-stash.service.ts # Redis TTL & Local Stash hygiene
├── dto/
│   ├── check-review.dto.ts             # Input validation for check request
│   └── confirm-review.dto.ts           # Input validation for confirm request
└── controllers/
    └── excel-import-review.controller.ts # REST API Endpoints
```

```text
frontend/
├── types/import-review.ts                       # Frontend mirror of excel-review.types.ts
├── lib/services/import-review.service.ts         # API client (check/confirm/cancel/download)
├── hooks/use-import-review.ts                    # TanStack Query mutations
└── app/(admin)/admin/import-review/page.tsx      # Review dashboard page
components/admin/sidebar.tsx                      # + "ตรวจสอบข้อมูลนำเข้า Excel" menu entry
```
