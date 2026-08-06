// File: specs/88-logs/session-2026-08-06-migration-ai-pipeline-speckit.md
// Change Log:
// - 2026-08-06: Initial session log for Migration AI Pipeline Refactor speckit workflow

# Session — 2026-08-06 (Migration AI Pipeline Refactor Speckit)

## Summary

Speckit workflow สำหรับ Feature-242 Migration AI Pipeline Refactor: สร้างครบทุก design artifacts (spec.md, plan.md, research.md, data-model.md, contracts, quickstart.md, tasks.md) และทำ cross-artifact consistency analysis พบ 11 issues (2 Critical, 3 High, 3 Medium, 3 Low) และแก้ทั้งหมดใน tasks.md

## ปัญหาที่พบ (Root Cause)

1. **Bug ใน `create-new-feature.sh`** — `CATEGORY_NAME` ไม่ถูก define ทำให้สร้าง directory ผิด
2. **Cross-artifact inconsistencies** — ระหว่าง spec.md (FRs), plan.md, data-model.md, contracts และ tasks.md มีช่องว่างและขัดแย้งกันในหลายจุด

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `.agents/scripts/bash/create-new-feature.sh` | Fix `CATEGORY_NAME` bug: default `CATEGORY=200` + map category numbers to directory names |
| `.agents/scripts/bash/update-agent-context.sh` | Add missing `windsurf` dispatch case |
| `specs/200-fullstacks/242-migration-ai-pipeline/spec.md` | Created — 4 user stories, 30 FRs, edge cases, success criteria |
| `specs/200-fullstacks/242-migration-ai-pipeline/plan.md` | Created — implementation plan, constitution check, phase breakdown |
| `specs/200-fullstacks/242-migration-ai-pipeline/research.md` | Created — resolved R1-R7 technical decisions + F1-F4 cross-cutting findings |
| `specs/200-fullstacks/242-migration-ai-pipeline/data-model.md` | Created — schema delta, entity changes, 5 new types, state transitions, query patterns |
| `specs/200-fullstacks/242-migration-ai-pipeline/contracts/migration-batch-api.yaml` | Created — OpenAPI for resolve-batch + trigger-rag-batch |
| `specs/200-fullstacks/242-migration-ai-pipeline/contracts/migration-review-api.yaml` | Created — OpenAPI deltas for review queue list/get/commit |
| `specs/200-fullstacks/242-migration-ai-pipeline/contracts/migration-compare-prompt.md` | Created — prompt template contract with parsing rules |
| `specs/200-fullstacks/242-migration-ai-pipeline/quickstart.md` | Created — 12-step end-to-end verification |
| `specs/200-fullstacks/242-migration-ai-pipeline/tasks.md` | Created 65 tasks + fixed 11 analysis issues (C1-C2, H1-H3, M1-M3, L1-L3) |

### Analysis Issues Fixed

| ID | Severity | Fix |
| --- | --- | --- |
| C1 | Critical | T024/T029: capture threshold values into `ai_metadata_json` at processing time (FR-010c) |
| C2 | Critical | T030/T023: `reviewGroup` reads from captured thresholds, not current `system_settings` |
| H1 | High | T033: added `GET /api/migration/review-thresholds` endpoint |
| H2 | High | T031: added `reviewGroup` filter + single-item GET endpoint response shape |
| H3 | High | T024: write `CompareResult` to `ai_audit_logs.ai_suggestion_json` (FR-028) |
| M1 | Medium | T054: check active import batches, return `warning: 'IMPORT_IN_PROGRESS'` |
| M2 | Medium | Dependencies: T044 must follow T036 sequentially (same file `page.tsx`) |
| M3 | Medium | T019: verify full FR-004 whitelist (PDF/DOCX/DWG/XLSX/ZIP) |
| L1 | Low | T031: apply response shape to single-item GET endpoint (merged with H2) |
| L2 | Low | T064: verify FR-030 project isolation for migrated documents |
| L3 | Low | T050: configurable timeout from `system_settings` instead of hardcoded 30s |

## กฎที่ Lock แล้ว

- **D97**: `reviewGroup` ต้อง compute จาก **captured thresholds** ใน `ai_metadata_json` ณ _processing time_ — ห้ามอ่านจาก `system_settings` ปัจจุบัน (FR-010c non-retroactive)
- **D98**: `CompareResult` (หรือ raw LLM response on failure) ต้องเขียนลง `ai_audit_logs.ai_suggestion_json` ทุกครั้ง (FR-028)
- **D99**: `migration_compare` prompt แทนที่ `ocr_extraction` — ใช้ข้อมูลจากทะเบียนเป็นค่าตั้งต้น และรายงานเฉพาะความไม่ตรงกัน (FR-009)
- **D100**: Tag/UUID resolution แยกออกจาก `processMigrateDocument()` — ทำเป็น batch endpoint หลังนำเข้า (FR-016, FR-017)

## Verification

- [x] spec.md: 4 user stories, 30 FRs, 8 edge cases, 11 success criteria
- [x] plan.md: constitution check passed, all artifacts marked complete
- [x] research.md: R1-R7 resolved, F1-F4 documented
- [x] data-model.md: schema delta, 5 new types, 9 validation rules, 2 query patterns
- [x] contracts: 3 contract files (batch API, review API, compare prompt)
- [x] quickstart.md: 12-step verification plan
- [x] tasks.md: 65 tasks, 30/30 FRs covered (100%), 11 analysis issues fixed
- [x] Coverage: 100% FR coverage after fixes
- [ ] **Commit + push via 2git.sh** — pending user approval
- [ ] **MCP Knowledge Graph** — บันทึก Feature-242 + D97-D100
