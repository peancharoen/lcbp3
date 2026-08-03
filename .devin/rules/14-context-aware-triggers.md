# Context-Aware Triggers

When user asks about... check these files:

| Request                        | Status | Files to Check                                                                        | Expected Response                                                       |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| "สร้าง API ใหม่"               | ✅     | `05-02-backend-guidelines.md`, `lcbp3-v1.9.0-schema-02-tables.sql`                    | NestJS Controller + Service + DTO + CASL Guard                          |
| "แก้ฟอร์ม frontend"            | ✅     | `05-03-frontend-guidelines.md`, `01-06-edge-cases-and-rules.md`                       | RHF+Zod + TanStack Query + Thai comments                                |
| "เพิ่ม field ใหม่"             | ✅     | `ADR-009`, `03-01-data-dictionary.md`, `lcbp3-v1.9.0-schema-02-tables.sql`            | Edit SQL directly + update Data Dictionary + Entity                     |
| "ตรวจสอบ UUID"                 | ✅     | `ADR-019`, `05-07-hybrid-uuid-implementation-plan.md`                                 | UUIDv7 MariaDB native UUID + TransformInterceptor                       |
| "สร้าง migration"              | ✅     | `ADR-009`, `03-06-migration-business-scope.md`                                        | Edit SQL schema directly + n8n workflow                                 |
| "ตรวจสอบ permission"           | ✅     | `lcbp3-v1.9.0-seed-permissions.sql`, `ADR-016`                                        | CASL 4-Level RBAC matrix                                                |
| "deploy production"            | ✅     | `04-08-release-management-policy.md`, `ADR-015`                                       | Release Gates + Blue-Green strategy                                     |
| "เพิ่ม test"                   | ✅     | `05-04-testing-strategy.md`                                                           | Coverage goals + test patterns                                          |
| "AI integration"               | ✅     | `ADR-023`, `ADR-023A`, `ADR-024`, `ADR-025`                                           | AI boundary + 2-model stack + BullMQ queue policy + Intent/Tool Layer   |
| "Error handling"               | ✅     | `ADR-007`                                                                             | Layered error classification + recovery                                 |
| "File upload"                  | ✅     | `ADR-016`, `05-02-backend-guidelines.md`, `03-Data-and-Storage/03-03-file-storage.md` | Two-phase upload → temp → commit; ClamAV + whitelist                    |
| "Notifications / Queue"        | ✅     | `ADR-008`, `05-02-backend-guidelines.md`                                              | BullMQ job — never inline; check retry + dead-letter                    |
| "Add i18n / translate"         | ✅     | `05-08-i18n-guidelines.md`                                                            | i18n keys only — no hardcoded text                                      |
| "Workflow / DSL"               | ✅     | `ADR-001`, `01-03-modules/01-03-06-unified-workflow.md`                               | DSL state machine + WorkflowEngineService                               |
| "Document numbering"           | ✅     | `ADR-002`, `01-02-business-rules/01-02-02-doc-numbering-rules.md`                     | Redis Redlock + DB optimistic lock (double-lock)                        |
| "ตรวจสอบ Workflow"             | ✅     | `01-06-edge-cases-and-rules.md`, `05-02-backend-guidelines.md`, `ADR-001`, `ADR-002`  | เช็คการเปลี่ยน State, คิว BullMQ และการล็อกเลขที่เอกสาร                 |
| "Transmittal submit"           | 📋     | `ADR-021`, `specs/200-fullstacks/201-transmittals-circulation/`                       | submit() with EC-RFA-004 validation                                     |
| "Circulation reassign"         | 📋     | `ADR-021`, `specs/200-fullstacks/201-transmittals-circulation/`                       | reassignRouting() with EC-CIRC-001                                      |
| "สร้าง workflow ใหม่"          | 📋     | `ADR-001`, `ADR-021`, `specs/200-fullstacks/203-unified-workflow-engine/`             | DSL workflow definition + WorkflowEngineService setup                   |
| "ตรวจสอบ AI boundary"          | ✅     | `ADR-023`, `ADR-023A`                                                                 | Verify Ollama isolation + BullMQ queues + Qdrant projectPublicId filter |
| "Intent classification"        | ✅     | `ADR-024`, `specs/200-fullstacks/224-intent-classification/`                          | Pattern Layer → LLM Fallback; ai_intent_patterns; Redis cache 5 min     |
| "AI Tool Layer"                | ✅     | `ADR-025`, `specs/200-fullstacks/225-ai-tool-layer-architecture/`                     | Tool Registry; CASL-guarded dispatch; ToolResult publicId only          |
| "Document Chat UI"             | ✅     | `ADR-026`, `specs/200-fullstacks/226-document-chat-ui-pattern/`                       | Side-panel; useAiChat() hook; streaming SSE; TanStack Query cache       |
| "AI Admin Console"             | ✅     | `ADR-027`, `specs/200-fullstacks/227-ai-admin-console/`                               | Dynamic model/prompt/intent control; admin-only CASL endpoints          |
| "Migration refactor"           | ✅     | `ADR-028`, `specs/200-fullstacks/228-migration-arch-refactor/`                        | Staging Queue; post-migration cleanup; validation gates                 |
| "Dynamic Prompt / Prompt"      | ✅     | `ADR-029`, `specs/06-Decision-Records/ADR-029-dynamic-prompt-management.md`           | ai_prompts table; Redis cache `ai:prompt:active:{type}` TTL 60s         |
| "AI Model / OCR Active Switch" | ✅     | `ADR-032`, `ADR-033`, `specs/200-fullstacks/233-ai-model-ocr-runner-management/`      | Synchronous LLM switches, VRAM Release, sidecar API Key protection      |
| "จัดการ document numbering"    | ✅     | `ADR-002`, `specs/03-Data-and-Storage/03-04-document-numbering.md`                    | Redis Redlock + template system + preview/override workflows            |
| "Audit ความปลอดภัย"            | ✅     | `ADR-016`, `ADR-019`, `ADR-023`, `ADR-023A`                                           | ตรวจสอบ UUID pattern, CASL Guard, AI Boundary และ Qdrant multi-tenancy  |
| "แก้ bug / bugfix"             | ✅     | `./workflows/bugfix.md`, `error-catalog.md`                                           | ใช้ bugfix workflow สำหรับเคสที่สาเหตุชัดเจน                            |
| "ตรวจแอปจริง"                  | ✅     | `./workflows/check-real-app.md`                                                       | ตรวจ endpoint/UI/console หลัง build pass — No Fake Evidence             |
| "งานค้าง / resume"             | ✅     | `./workflows/resume-pending-work.md`                                                  | อ่าน checkpoint เดิม → ตรวจ build → วางแผนต่อโดยไม่ทำงานซ้ำ             |

## Status Legend

- ✅ Implemented and verified
- 📋 Spec exists, implementation in progress
- 🔄 In development
- ❌ Not yet started
