# Implementation Plan: Intent Classification System

**Branch**: `224-intent-classification` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)
**Input**: ADR-024 Intent Classification Strategy + CONTEXT.md AI Runtime Layer

---

## Summary

สร้าง Intent Classification System สำหรับ AI Runtime Layer ตามกลยุทธ์ Hybrid (Pattern First → LLM Fallback) ที่กำหนดใน ADR-024 ระบบจะแปลงคำถามธรรมชาติ (ภาษาไทย/อังกฤษปน) จาก User เป็น Server-side Intent enum ก่อน Route ไปยัง AI Tool Layer (ADR-025)

**แนวทางเทคนิค**:
- Backend: NestJS Module (IntentClassifierModule) พร้อม Service สำหรับ Pattern Matching และ LLM Fallback
- Database: ตาราง `ai_intent_definitions` และ `ai_intent_patterns` (SQL Delta ตาม ADR-009)
- Caching: Redis (TTL 5 นาที) สำหรับ Patterns
- AI: Ollama gemma4:e4b Q8_0 บน Admin Desktop (Desk-5439) สำหรับ LLM Fallback
- Frontend: Admin UI สำหรับจัดการ Intent และ Patterns + Test Console

---

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 11) + Next.js 16  
**Primary Dependencies**: 
- Backend: NestJS, TypeORM, ioredis (Redis), axios (Ollama HTTP)
- Frontend: React, TanStack Query, shadcn/ui components  
**Storage**: MariaDB 11.8 (Intent Definitions/Patterns), Redis (Cache), Ollama (LLM)  
**Testing**: Jest (Backend Unit/Integration), Vitest (Frontend Unit), Playwright (E2E)  
**Target Platform**: QNAP NAS (Docker), Admin Desktop (Ollama)  
**Project Type**: Web application (Backend + Frontend)  
**Performance Goals**: 
- Pattern Match: < 10ms (cache hit), < 50ms (cache miss)
- LLM Fallback: < 2000ms (รวม Pattern Check)
**Constraints**: 
- GPU Budget: RTX 2060 Super 8GB (ใช้ร่วมกับ RAG, OCR, Embedding)
- LLM Semaphore: Max 3 concurrent calls
- Bilingual Input: ไทย/อังกฤษปน + typo tolerance
**Scale/Scope**: 
- 12 Intent Definitions (v1)
- 50+ concurrent users
- 70-80% Pattern Hit Rate target

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Rule | Status | Notes |
|------|--------|-------|
| ADR-019 UUID | ✅ | ใช้ `publicId` (UUIDv7 string) ทุก API — ไม่มี `parseInt` |
| ADR-009 Schema | ✅ | SQL Delta file สำหรับตารางใหม่ — ไม่ใช้ TypeORM migration |
| ADR-016 Security | ✅ | CASL Guard บน Admin API, JWT Auth, Rate Limiting |
| ADR-023A AI Boundary | ✅ | Ollama บน Admin Desktop — AI ไม่เข้า DB โดยตรง |
| ADR-007 Error Handling | ✅ | Layered error classification — user-friendly messages |
| TypeScript Strict | ✅ | Zero `any`, zero `console.log` (ใช้ NestJS Logger) |
| i18n | ✅ | ใช้ i18n keys — ไม่ hardcode ภาษาไทย/อังกฤษ |

**ผ่าน Gate ทั้งหมด** — พร้อมดำเนินการ Phase 0

---

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/224-intent-classification/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
├── tasks.md             # Phase 2 output (speckit-tasks)
└── checklists/          # Quality checklists
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── modules/
│   │   └── ai/
│   │       ├── intent-classifier/          # NEW: Intent Classification Module
│   │       │   ├── intent-classifier.module.ts
│   │       │   ├── intent-classifier.service.ts
│   │       │   ├── intent-classifier.controller.ts
│   │       │   ├── entities/
│   │       │   │   ├── intent-definition.entity.ts
│   │       │   │   └── intent-pattern.entity.ts
│   │       │   ├── dto/
│   │       │   │   ├── classify-query.dto.ts
│   │       │   │   ├── classification-result.dto.ts
│   │       │   │   ├── create-intent-definition.dto.ts
│   │       │   │   └── create-intent-pattern.dto.ts
│   │       │   └── interfaces/
│   │       │       ├── classification-result.interface.ts
│   │       │       └── intent-category.enum.ts
│   │       └── ai.module.ts                # UPDATE: Add IntentClassifierModule
│   └── database/
│       └── seeds/
│           └── ai-intent.seed.ts           # Seed 12 Intent Definitions

frontend/
├── app/
│   └── (admin)/
│       └── admin/
│           └── ai/
│               └── intent-classification/  # NEW: Admin UI
│                   ├── page.tsx            # Intent Definitions List
│                   ├── [intentCode]/
│                   │   ├── page.tsx        # Intent Detail + Patterns
│                   │   └── patterns/
│                   │       └── page.tsx    # Pattern Management
│                   └── test-console/
│                       └── page.tsx        # Test Console
├── components/
│   └── ai/
│       └── intent-classification/          # NEW: Reusable Components
│           ├── intent-form.tsx
│           ├── pattern-form.tsx
│           ├── test-console-panel.tsx
│           └── classification-result-card.tsx
├── hooks/
│   └── ai/
│       └── use-intent-classification.ts    # TanStack Query hooks
└── lib/
    └── services/
        └── ai-intent.service.ts            # API client
```

**Structure Decision**: Web application (NestJS Backend + Next.js Frontend) — ตามโครงสร้างที่มีอยู่แล้วใน LCBP3

---

## Complexity Tracking

ไม่มี Constitution Violations ที่ต้องอธิบายเพิ่มเติม — ทุกอย่างสอดคล้องกับ ADRs ที่มีอยู่

---

## Phase 0: Research

ดูรายละเอียดใน [research.md](./research.md)

**หัวข้อที่ต้อง Research**:
1. Redis Cache Strategy สำหรับ Patterns (TTL + Invalidation)
2. Ollama HTTP API Integration (gemma4:e4b Q8_0)
3. Semaphore Pattern ใน NestJS (p-limit หรือ RxJS)
4. Regex Validation ใน TypeORM/Class-Validator

---

## Phase 1: Design Artifacts

### Data Model
ดูรายละเอียดใน [data-model.md](./data-model.md)

### API Contracts
ดูรายละเอียดใน [contracts/](./contracts/)

### Quick Start
ดูรายละเอียดใน [quickstart.md](./quickstart.md)

---

## Next Steps

1. ✅ **Phase 0 Complete** — Research ใน [research.md](./research.md)
2. ✅ **Phase 1 Complete** — Design artifacts: data-model.md, contracts/, quickstart.md
3. ⏳ **Phase 2** — รอ `/speckit-tasks` สร้าง tasks.md
4. ⏳ **Phase 3** — รอ `/speckit-analyze` ตรวจสอบความสอดคล้อง
