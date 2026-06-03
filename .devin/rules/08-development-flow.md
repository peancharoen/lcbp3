---
trigger: always_on
---

# Development Flow

## 🔴 Critical Work — DB / API / Security / Workflow Engine

**MUST complete all steps:**

1. **Glossary check** — verify domain terms in `00-02-glossary.md`
2. **Read the spec** — select from Key Spec Files table
3. **Check schema** — verify table/column in `lcbp3-v1.9.0-schema-02-tables.sql`
4. **Check data dictionary** — confirm field meanings + business rules
5. **Scan edge cases** — `01-06-edge-cases-and-rules.md`
6. **Check ADRs** — verify decisions align (ADR-009, ADR-019, ADR-023)
7. **Write code** — TypeScript strict, no `any`, no `console.log`

## 🟡 Normal Work — UI / Feature / Integration

- Follow existing patterns in codebase.
- Check spec for relevant module only.
- **Hybrid Specs Organization:**
  - Place new Infrastructure tasks in `specs/100-Infrastructures/`
  - Place new Feature/Workflow tasks in `specs/200-fullstacks/`
  - Place Documentation/Research in `specs/300-others/`
- Ensure no forbidden patterns (`any`, `console.log`, UUID misuse) are introduced.

## 🟢 Quick Fix — Bug Fix / Typo / Style

- Fix directly
- Add minimal test if logic changed
- Check forbidden patterns before commit

### 🟢 Specialized Work — ADR-021, AI Runtime Layer, Complex Logic

**MUST complete:**

1. **Domain Knowledge Check** - Read relevant ADRs (ADR-021, ADR-023/023A, ADR-024~028)
2. **Pattern Verification** - Check existing implementations in codebase
3. **Specialized Requirements** - Follow domain-specific patterns
4. **Complex Logic Testing** - Multi-scenario test coverage
5. **Performance Validation** - Load testing if applicable

**For ADR-021 Integration:**

- Read ADR-021 - Integrated workflow & step attachments
- Check ADR-001 - Unified workflow engine patterns
- Verify WorkflowEngineService - Polymorphic instance handling
- Add workflow fields - Expose workflowInstanceId, workflowState, availableActions
- Include IntegratedBanner - Frontend workflow lifecycle display
- Test workflow transitions - State changes and action validation

**For AI Infrastructure (ADR-023/023A):**

- Verify AI boundary enforcement - No direct DB/storage access
- Check BullMQ 2-queue setup - ai-realtime + ai-batch
- Validate Qdrant multi-tenancy - projectPublicId filter required
- Test human-in-the-loop validation workflows
- Audit AI interaction logging to ai_audit_logs

**For AI Runtime Layer (ADR-024/025/026/027):**

- ADR-024: Pattern Layer first (ai_intent_patterns DB + Redis cache 5 min) → LLM Fallback (gemma4:e4b, semaphore max=3)
- ADR-025: Tool Registry dispatch — AI Gateway → Tool → Business Service; ToolResult DTO must use publicId only
- ADR-026: useAiChat() hook + side-panel UI; streaming response via SSE; TanStack Query cache
- ADR-027: Admin Console — dynamic model/prompt/intent control; CASL-guarded admin-only endpoints

**For Migration Pipeline (ADR-028):**

- Use Staging Queue pattern — never write directly to production tables
- Post-migration cleanup process required after each batch
- Migration Validation Gates must pass before promoting to production

**Expected output:**

- Backend services expose specialized context fields
- Frontend components use domain-specific patterns
- Complex state management with proper validation
- Performance metrics within acceptable thresholds
- Comprehensive test coverage for edge cases

---

## Context-Aware Triggers

| Request                     | Files to Check                                                                        | Expected Response                                                       |
| --------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| "สร้าง API ใหม่"            | `05-02-backend-guidelines.md`, `lcbp3-v1.9.0-schema-02-tables.sql`                    | NestJS Controller + Service + DTO + CASL Guard                          |
| "แก้ฟอร์ม frontend"         | `05-03-frontend-guidelines.md`, `01-06-edge-cases-and-rules.md`                       | RHF+Zod + TanStack Query + Thai comments                                |
| "เพิ่ม field ใหม่"          | `ADR-009`, `03-01-data-dictionary.md`, `lcbp3-v1.9.0-schema-02-tables.sql`            | Edit SQL directly + update Data Dictionary + Entity                     |
| "ตรวจสอบ UUID"              | `ADR-019`, `05-07-hybrid-uuid-implementation-plan.md`                                 | UUIDv7 MariaDB native UUID + TransformInterceptor                       |
| "สร้าง migration"           | `ADR-009`, `03-06-migration-business-scope.md`                                        | Edit SQL schema directly + n8n workflow                                 |
| "ตรวจสอบ permission"        | `lcbp3-v1.9.0-seed-permissions.sql`, `ADR-016`                                        | CASL 4-Level RBAC matrix                                                |
| "deploy production"         | `04-08-release-management-policy.md`, `ADR-015`                                       | Release Gates + Blue-Green strategy                                     |
| "เพิ่ม test"                | `05-04-testing-strategy.md`                                                           | Coverage goals + test patterns                                          |
| "AI integration"            | `ADR-023`, `ADR-023A`, `ADR-024`, `ADR-025`                                           | AI boundary + 2-model stack + BullMQ queue policy + Intent/Tool Layer   |
| "Error handling"            | `ADR-007`                                                                             | Layered error classification + recovery                                 |
| "File upload"               | `ADR-016`, `05-02-backend-guidelines.md`, `03-Data-and-Storage/03-03-file-storage.md` | Two-phase upload → temp → commit; ClamAV + whitelist                    |
| "Notifications / Queue"     | `ADR-008`, `05-02-backend-guidelines.md`                                              | BullMQ job — never inline; check retry + dead-letter                    |
| "Add i18n / translate"      | `05-08-i18n-guidelines.md`                                                            | i18n keys only — no hardcoded text                                      |
| "Workflow / DSL"            | `ADR-001`, `01-03-modules/01-03-06-unified-workflow.md`                               | DSL state machine + WorkflowEngineService                               |
| "Document numbering"        | `ADR-002`, `01-02-business-rules/01-02-02-doc-numbering-rules.md`                     | Redis Redlock + DB optimistic lock (double-lock)                        |
| "ตรวจสอบ Workflow"          | `01-06-edge-cases-and-rules.md`, `05-02-backend-guidelines.md`, `ADR-001`, `ADR-002`  | เช็คการเปลี่ยน State, คิว BullMQ และการล็อกเลขที่เอกสาร                 |
| "Transmittal submit"        | `ADR-021`, `specs/200-fullstacks/201-transmittals-circulation/`                       | submit() with EC-RFA-004 validation                                     |
| "Circulation reassign"      | `ADR-021`, `specs/200-fullstacks/201-transmittals-circulation/`                       | reassignRouting() with EC-CIRC-001                                      |
| "สร้าง workflow ใหม่"       | `ADR-001`, `ADR-021`, `specs/200-fullstacks/203-unified-workflow-engine/`             | DSL workflow definition + WorkflowEngineService setup                   |
| "ตรวจสอบ AI boundary"       | `ADR-023`, `ADR-023A`                                                                 | Verify Ollama isolation + BullMQ queues + Qdrant projectPublicId filter |
| "Intent classification"     | `ADR-024`, `specs/200-fullstacks/224-intent-classification/`                          | Pattern Layer → LLM Fallback; ai_intent_patterns; Redis cache 5 min     |
| "AI Tool Layer"             | `ADR-025`, `specs/200-fullstacks/225-ai-tool-layer-architecture/`                     | Tool Registry; CASL-guarded dispatch; ToolResult publicId only          |
| "Document Chat UI"          | `ADR-026`, `specs/200-fullstacks/226-document-chat-ui-pattern/`                       | Side-panel; useAiChat() hook; streaming SSE; TanStack Query cache       |
| "AI Admin Console"          | `ADR-027`, `specs/200-fullstacks/227-ai-admin-console/`                               | Dynamic model/prompt/intent control; admin-only CASL endpoints          |
| "Migration refactor"        | `ADR-028`, `specs/200-fullstacks/228-migration-arch-refactor/`                        | Staging Queue; post-migration cleanup; validation gates                 |
| "จัดการ document numbering" | `ADR-002`, `specs/03-Data-and-Storage/03-04-document-numbering.md`                    | Redis Redlock + template system + preview/override workflows            |
| "Audit ความปลอดภัย"         | `ADR-016`, `ADR-019`, `ADR-023`, `ADR-023A`                                           | ตรวจสอบ UUID pattern, CASL Guard, AI Boundary และ Qdrant multi-tenancy  |
| "แก้ bug / bugfix"          | `.agents/workflows/bugfix.md`, `error-catalog.md`                                     | ใช้ bugfix workflow สำหรับเคสที่สาเหตุชัดเจน                            |
| "ตรวจแอปจริง"               | `.windsurf/workflows/check-real-app.md`                                               | ตรวจ endpoint/UI/console หลัง build pass — No Fake Evidence             |
| "งานค้าง / resume"          | `.windsurf/workflows/resume-pending-work.md`                                          | อ่าน checkpoint เดิม → ตรวจ build → วางแผนต่อโดยไม่ทำงานซ้ำ             |
