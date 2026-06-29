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

---

## 🔌 MCP MariaDB Tools

MCP MariaDB server ให้เครื่องมือสำหรับตรวจสอบและจัดการ database โดยตรง ใช้สำหรับ:

- ตรวจสอบ schema กับ spec file `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`
- Debug ปัญหา database โดยไม่ต้องเข้า MySQL client
- ตรวจสอบ data ใน production/staging
- Validate การเปลี่ยนแปลง schema ก่อน deploy

### Available Tools

| Tool | หน้าที่ | ตัวอย่างการใช้งาน |
|------|----------|------------------|
| `mcp1_mysql_test_connection` | ทดสอบ connection กับ database | ตรวจสอบว่า MCP server เชื่อมต่อได้ |
| `mcp1_mysql_show_databases` | แสดง databases ทั้งหมด | ดูว่ามี database อะไรบ้าง |
| `mcp1_mysql_show_tables` | แสดง tables ทั้งหมดใน database | ดูรายชื่อ tables ใน `lcbp3` |
| `mcp1_mysql_describe_table` | ดู structure/columns ของ table | ตรวจสอบ columns, types, keys ของ `correspondences` |
| `mcp1_mysql_query` | รัน SELECT query | ดู data ใน table หรือ join query |
| `mcp1_mysql_insert` | INSERT data | เพิ่ม seed data หรือ test data |
| `mcp1_mysql_update` | UPDATE data | แก้ไข data ใน table |
| `mcp1_mysql_delete` | DELETE data | ลบ data ใน table |

### การใช้งานร่วมกับ Development Flow

**เมื่อเขียน query ใหม่:**
1. ใช้ `mcp1_mysql_describe_table` เพื่อตรวจสอบ columns และ types
2. เปรียบเทียบกับ `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`
3. ใช้ `mcp1_mysql_query` เพื่อทดสอบ query ก่อน implement

**เมื่อเปลี่ยน schema (ADR-009):**
1. ใช้ `mcp1_mysql_describe_table` เพื่อดู structure ปัจจุบัน
2. สร้าง SQL delta ใน `specs/03-Data-and-Storage/deltas/`
3. ใช้ `mcp1_mysql_query` เพื่อตรวจสอบผลลัพธ์หลัง apply delta

**เมื่อ debug ปัญหา database:**
1. ใช้ `mcp1_mysql_query` เพื่อดู data จริง
2. เปรียบเทียบกับ spec และ data dictionary
3. ตรวจสอบ foreign keys และ constraints

### ข้อควรระวัง

- **❌ ห้ามใช้ MCP MariaDB สำหรับ DDL operations** (CREATE/ALTER/DROP) โดยตรง — ต้องใช้ SQL delta ตาม ADR-009
- **✅ ใช้สำหรับ DQL/DML operations** (SELECT/INSERT/UPDATE/DELETE) เพื่อ debug และ test เท่านั้น
- **⚠️ ระวัง DELETE operations** — อาจทำให้เสีย data ใน production
- **✅ ตรวจสอบ schema กับ spec file เสมอ** ก่อนเขียน query

---

## 🧠 MCP Memory Tools

MCP Memory server ให้เครื่องมือสำหรับจัดการ Knowledge Graph และ Long-term Memory ใช้สำหรับ:

- จัดเก็บความรู้และ context ของโปรเจกต์ในรูปแบบ Graph (Entities + Relations + Observations)
- ค้นหาและดึงข้อมูล context จาก memory ที่บันทึกไว้ใน session ก่อนหน้า
- สร้าง/แก้ไข/ลบ entities, relations, และ observations ใน knowledge graph

### Available Tools

| Tool | หน้าที่ | ตัวอย่างการใช้งาน |
|------|----------|------------------|
| `mcp3_create_entities` | สร้าง entities ใหม่หลายตัวพร้อม observations | สร้าง entity ใหม่เช่น Project, User, Task |
| `mcp3_create_relations` | สร้าง relations ระหว่าง entities | สร้าง relation: Project → has → User |
| `mcp3_add_observations` | เพิ่ม observations ให้ entity ที่มีอยู่แล้ว | เพิ่ม context เพิ่มเติมให้ entity |
| `mcp3_delete_entities` | ลบ entities และ relations ที่เกี่ยวข้อง | ลบ entity ที่ไม่ใช้แล้ว |
| `mcp3_delete_relations` | ลบ relations ระหว่าง entities | ลบ relation ที่ผิดหรือไม่ใช้แล้ว |
| `mcp3_delete_observations` | ลบ observations จาก entity | ลบ context ที่ผิดหรือล้าสุด |
| `mcp3_open_nodes` | ดึงข้อมูล entities ตามชื่อ | ดึง entity ที่ระบุชื่อ |
| `mcp3_read_graph` | อ่าน knowledge graph ทั้งหมด | ดูทั้ง graph structure |
| `mcp3_search_nodes` | ค้นหา entities ตาม query | ค้นหา entity จากชื่อ, type, หรือ observation |

### การใช้งานร่วมกับ Development Flow

**เมื่อบันทึก context ใหม่:**
1. ใช้ `mcp3_create_entities` เพื่อสร้าง entities ใหม่ (ถ้ายังไม่มี)
2. ใช้ `mcp3_create_relations` เพื่อเชื่อมโยง entities
3. ใช้ `mcp3_add_observations` เพื่อเพิ่ม context/observations

**เมื่อค้นหา context:**
1. ใช้ `mcp3_search_nodes` เพื่อค้นหา entities ที่เกี่ยวข้อง
2. ใช้ `mcp3_open_nodes` เพื่อดึงข้อมูล entities ที่ต้องการ
3. ใช้ `mcp3_read_graph` เพื่อดู relations ระหว่าง entities

**เมื่อแก้ไข context:**
1. ใช้ `mcp3_add_observations` เพื่อเพิ่ม observations ใหม่
2. ใช้ `mcp3_delete_observations` เพื่อลบ observations ที่ผิด
3. ใช้ `mcp3_create_relations` หรือ `mcp3_delete_relations` เพื่อปรับ relations

### ข้อควรระวัง

- **✅ ใช้สำหรับบันทึก context ที่ต้องใช้ร่วมกันหลาย session** — เช่น การตัดสินใจสำคัญ, architecture decisions, rollout history
- **⚠️ ระวังการลบ entities** — อาจทำให้เสีย context ที่ยังใช้งานอยู่
- **✅ ตรวจสอบว่า entity มีอยู่แล้วก่อนสร้าง** — ใช้ `mcp3_search_nodes` หรือ `mcp3_open_nodes` ก่อน
- **✅ ใช้ชื่อ entity ที่ชัดเจนและไม่ซ้ำกัน** — เพื่อป้องกันความสับสน
