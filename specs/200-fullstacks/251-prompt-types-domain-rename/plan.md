// File: specs/200-fullstacks/251-prompt-types-domain-rename/plan.md
// Change Log:
// - 2026-09-01: Initial implementation plan for Feature 251

# Implementation Plan: Prompt Types Master Table + Domain Term Rename

**Branch**: `251-prompt-types-domain-rename` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/251-prompt-types-domain-rename/spec.md`

## Summary

สร้างตาราง master `ai_prompt_types` ใหม่พร้อม FK จาก `ai_prompts.prompt_type` รวมหน้าจัดการ prompt 2 หน้าเป็นหน้าเดียว (dropdown จาก master table) และเปลี่ยนชื่อ `category` → `correspondenceType` ทั้งระบบ (DB column, entity, DTO, types, frontend, i18n, ADR-050, prompt template) เพื่อให้ตรง domain glossary ที่ใช้ `correspondence_types.typeCode` — deploy เป็น atomic release เดียว (backend+frontend+DB schema delta)

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), NestJS 11, Next.js 16 App Router
**Primary Dependencies**: TypeORM (no migrations per ADR-044), MariaDB 11.8, Redis, BullMQ, TanStack Query, React Hook Form + Zod, shadcn/ui
**Storage**: MariaDB 11.8 — ตารางใหม่ `ai_prompt_types` + แก้ `migration_review_queue.ai_suggested_category` → `ai_suggested_correspondence_type` (physical rename via SQL delta)
**Testing**: Jest (backend), Vitest (frontend), ts-jest
**Target Platform**: Linux server (Docker Compose), on-premises
**Project Type**: web (backend + frontend monorepo, pnpm workspace)
**Performance Goals**: prompt type dropdown load < 200ms (Redis cache TTL 60s เหมือน ADR-029)
**Constraints**: Atomic deploy (FR-015), zero downtime, no dual-accept transition period, ADR-019 UUID, ADR-044 SQL delta (no TypeORM migrations), ADR-016 RBAC, ADR-007 error handling
**Scale/Scope**: ~30 backend files, ~15 frontend files, ~10 spec/doc files, 1 SQL delta file, 2 ADR updates

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Gate | Status | Notes |
|---|---|---|
| ADR-019 UUID | PASS | ตารางใหม่ `ai_prompt_types` ใช้ `public_id UUID` + `id INT` เหมือน `ai_prompts` |
| ADR-044 (amends ADR-009) | PASS | Schema change ผ่าน SQL delta file ไม่ใช้ TypeORM migration |
| ADR-016 Security | PASS | RBAC แยกระดับ: `system.manage_all` สำหรับ prompt type CRUD, admin ทั่วไปอ่านได้ |
| ADR-029 Dynamic Prompts | PASS | ขยาย ADR-029 mechanism — เพิ่ม master table ไม่ได้ละเมิด |
| ADR-007 Error Handling | PASS | `BusinessException` เมื่อ prompt type ไม่มีใน master table (FR-014) |
| ADR-023/023A AI Boundary | PASS | ไม่กระทบ AI boundary — เป็น metadata management |
| Domain Glossary | PASS | เปลี่ยน `category` → `correspondenceType` ตรง glossary |
| TypeScript Strict | PASS | No `any`, no `console.log`, explicit types, JSDoc ภาษาไทย |
| i18n | PASS | อัปเดต i18n keys ไม่ใช้ hardcoded text |

### Post-Design Re-check (Phase 1 complete)

| Gate | Status | Notes |
|---|---|---|
| ADR-019 UUID | PASS | `ai_prompt_types` entity ใช้ `publicId: string` + `@Exclude() id` |
| ADR-044 | PASS | SQL delta file `2026-09-01-ai-prompt-types-and-category-rename.sql` — CREATE TABLE + INSERT seed + ALTER TABLE + CHANGE COLUMN ใน file เดียว |
| ADR-016 | PASS | Controller ใช้ `@UseGuards(JwtAuthGuard, RbacGuard)` + `@RequirePermission('system.manage_all')` |
| ADR-029 | PASS | ไม่ลบ `ai_prompts` version/activation mechanism — เพิ่ม master table และ dynamic validation |
| ADR-007 | PASS | `BusinessException` สำหรับ missing prompt type + `ValidationException` สำหรับ placeholder validation |
| ADR-023/023A | PASS | ไม่กระทบ AI runtime — เป็น metadata layer |
| Domain Glossary | PASS | `correspondenceType` ตรง glossary (Correspondence) |
| TypeScript Strict | PASS | `PromptType` เปลี่ยนจาก union เป็น `string` แต่มี runtime validation จาก API |
| i18n | PASS | i18n keys `category_*` → `correspondence_type_*` ใน `en/ai.json` + `th/ai.json` |
| Atomic Deploy | PASS | SQL delta + backend + frontend ใน release เดียว (FR-015) |

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/251-prompt-types-domain-rename/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI)
├── tasks.md             # Phase 2 output
└── ai-ledger.md         # Cross-session assurance ledger
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── modules/
│   │   ├── ai/
│   │   │   ├── prompts/
│   │   │   │   ├── ai-prompts.entity.ts          # แก้: FK reference
│   │   │   │   ├── ai-prompts.service.ts          # แก้: validation จาก master table
│   │   │   │   ├── ai-prompts.controller.ts       # แก้: เพิ่ม type CRUD endpoints
│   │   │   │   ├── ai-prompt-types.entity.ts      # ใหม่: master table entity
│   │   │   │   ├── ai-prompt-types.service.ts     # ใหม่: type CRUD + RBAC
│   │   │   │   ├── ai-prompt-types.controller.ts  # ใหม่: type CRUD API
│   │   │   │   └── dto/
│   │   │   │       ├── create-ai-prompt-type.dto.ts  # ใหม่
│   │   │   │       └── ai-prompt-type-response.dto.ts # ใหม่
│   │   │   └── processors/
│   │   │       └── ai-batch.processor.ts          # แก้: placeholder rename
│   │   └── migration/
│   │       ├── entities/migration-review-queue.entity.ts  # แก้: column rename
│   │       ├── dto/commit-migration-review.dto.ts         # แก้: field rename
│   │       ├── types/ai-extraction-details.type.ts        # แก้: field rename
│   │       ├── migration-review.service.ts                # แก้: field rename
│   │       ├── migration-review.service.spec.ts           # แก้: test update
│   │       └── migration.service.ts                      # แก้: field rename
│   └── ...
└── tests/

frontend/
├── types/
│   └── migration.ts                               # แก้: field rename
├── types/dto/migration/
│   └── migration-review.dto.ts                    # แก้: field rename
├── lib/
│   ├── types/ai-prompts.ts                        # แก้: dynamic PromptType
│   └── services/admin-ai.service.ts               # แก้: type CRUD API
├── components/admin/ai/
│   ├── PromptTypeDropdown.tsx                     # แก้: dynamic from API
│   ├── PromptManagementTabs.tsx                   # ลบ/รวม: single page
│   └── VersionHistory.tsx                         # แก้: dynamic labels
├── app/(admin)/admin/ai/
│   ├── prompts/page.tsx                           # แก้: redirect 308
│   └── prompt-management/page.tsx                 # แก้: unified single page
├── components/migration/
│   └── review-queue-table.tsx                     # แก้: field rename
├── app/(admin)/admin/migration/
│   └── review/[id]/page.tsx                       # แก้: field rename
└── public/locales/
    ├── en/ai.json                                 # แก้: i18n keys
    └── th/ai.json                                 # แก้: i18n keys

specs/03-Data-and-Storage/
├── deltas/
│   └── 2026-09-01-ai-prompt-types-and-category-rename.sql  # ใหม่: schema delta
└── lcbp3-v1.9.0-schema-02-tables.sql              # แก้: canonical schema

specs/06-Decision-Records/
└── ADR-050-ai-metadata-extraction-output-contract.md  # แก้: §9 rename
```

**Structure Decision**: Web application (backend + frontend monorepo) — ใช้โครงสร้างที่มีอยู่ ไม่สร้าง project ใหม่

## Complexity Tracking

ไม่มี Constitution Check violations — ทุก gate ผ่าน

## Ledger Decision

**ต้องมี ledger** — เหตุผล:
- Tier 3 specialized work (ADR-029 dynamic prompt management + ADR-050 AI metadata contract)
- Expected to span multiple chat sessions (งานใหญ่: schema + backend + frontend + specs)
- Work affects protected boundaries (public API contract, DB schema, AI prompt management)
- Breaking change ที่ต้อง deploy atomic (FR-015)

**Ledger path**: `specs/200-fullstacks/251-prompt-types-domain-rename/ai-ledger.md`
**Template**: `templates/ai-pipeline-ledger-template.md` (ADR-023/029 AI pipeline)
**ASSURANCE_UNIT_ID**: `lcbp3/ai/prompt-types-domain-rename`
