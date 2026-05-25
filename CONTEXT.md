# LCBP3 / NAP-DMS Context

ระบบจัดการเอกสารงานก่อสร้าง (DMS) สำหรับโครงการ LCBP3 — เน้นการควบคุม Correspondence, RFA, Transmittal, Drawing พร้อมผู้ช่วย AI แบบ on-premises ที่ทำงานภายใต้ Workflow Engine กลางและขอบเขต AI ที่เข้มงวด (ADR-023A)

## Language

### Documents

**Correspondence**:
ซองจดหมาย/เอกสารทุกประเภทที่หมุนเวียนในโครงการ เป็น parent ของ RFA / Transmittal / Memo
_Avoid_: Letter, Communication, Document (generic)

**RFA** (Request For Approval):
Correspondence ประเภทขออนุมัติ มี revision และอ้างอิง Drawing Revision ผ่าน `rfa_items`
_Avoid_: Approval Request, Submit for Approval

**Transmittal**:
Correspondence ที่ใช้ส่งมอบเอกสาร/แบบ ไม่ใช่จดหมายปะหน้า
_Avoid_: Delivery Note, Cover Letter

**Shop Drawing**:
แบบที่ผู้รับเหมาจัดทำเพื่อขออนุมัติก่อนก่อสร้าง
_Avoid_: Construction Drawing

**Contract Drawing**:
แบบต้นฉบับตามสัญญา ไม่ใช่ Shop Drawing
_Avoid_: Design Drawing, Blueprint

### Workflow

**Workflow Engine**:
State machine กลาง DSL-based (ADR-001) — authority เดียวของการเปลี่ยน state ของทุก Correspondence
_Avoid_: Approval Flow, Process Engine, RFA status flow (เป็นเพียง definition หนึ่ง)

**Workflow Definition**:
Row ใน `workflow_definitions` ระบุ DSL ของ flow เช่น `RFA_FLOW_V1`, `CORRESPONDENCE_FLOW_V1`
_Avoid_: Approval logic, Hardcoded flow

**Workflow Instance**:
Row ใน `workflow_instances` = สถานะปัจจุบันของเอกสารหนึ่งฉบับ — source of truth ของ state
_Avoid_: Status, Stage (ใช้ภายใน DSL ได้แต่ห้ามแทน instance)

**Workflow Transition**:
การเปลี่ยน state ที่บันทึกใน `workflow_histories` พร้อม `actor_user_id` (มนุษย์เท่านั้น)
_Avoid_: Auto-execute, AI-driven approval

### Intent Classification

**Intent Classifier**:
Service ที่แปลงคำถามธรรมชาติ (ไทย/อังกฤษปน) → Server-side Intent enum ใช้ Hybrid strategy: Pattern First → LLM Fallback (ADR-024)
_Avoid_: NLU, NLP router, LangChain router

**Server-side Intent**:
Enum ของคำขอที่ AI Gateway รองรับ — สร้างจาก `ai_intent_definitions` table ไม่ใช่ hardcode
_Avoid_: Tool, LLM tool, LangChain tool

**Pattern Layer**:
ชั้นแรกของ Intent Classifier — keyword/regex match จาก `ai_intent_patterns` table, cache ใน Redis TTL 5 min
_Avoid_: Rule engine, NLU pipeline

**LLM Fallback**:
ชั้นที่สองของ Intent Classifier — synchronous Ollama call (gemma4:e4b Q8*0) เมื่อ Pattern Layer ไม่ match, ใช้ semaphore max=3
\_Avoid*: BullMQ-based classification, async intent routing

### AI

**AI Document Assistant**:
ผู้ช่วยที่ให้ Insight + Suggest + Notify โดยไม่เปลี่ยน state ของเอกสารเอง (ADR-023A)
_Avoid_: AI Document Controller, AI Agent, Autonomous Agent

**AI Gateway**:
NestJS module ที่เป็นจุดเข้าเดียวของทุกคำขอ AI — enforce CASL + tenant scope ก่อนส่งงานเข้า BullMQ
_Avoid_: AI Service (generic), Tool Layer

**Document Chunk**:
Row ใน `ai_document_chunks` (MariaDB) เก็บ chunk text + metadata, ground truth สำหรับ re-embed
_Avoid_: ai_embeddings, embedding row

**Vector Point**:
Point ใน Qdrant — เก็บแค่ `chunk_public_id`, vector, และ payload `{ project_public_id, document_public_id, chunk_index }`
_Avoid_: Embedding (ambiguous), Vector record

**RAG Query**:
Pipeline: embed query → `QdrantService.search(projectPublicId, vector)` → ดึง `chunk_text` จาก MariaDB → ส่งเข้า LLM พร้อม context
_Avoid_: Semantic search (overloaded), Vector search (incomplete)

**OCR Service**:
Container สำเร็จรูป (opaque black box) เปิด HTTP API ให้ NestJS เรียก — ไม่มีโค้ด Python ใน repo, ทีมไม่ maintain runtime ภายใน
_Avoid_: Python sidecar, OCR microservice (ที่เรา maintain เอง)

**Prompt Version**:
Immutable snapshot ของ prompt template ใน `ai_prompts` table — ทุกครั้งที่ admin กด "บันทึก" จะสร้าง version ใหม่ (version*number เพิ่มทีละ 1) version เก่ายังอยู่ใน history ลบได้ยกเว้น active version (ADR-029)
\_Avoid*: Prompt config, Prompt setting, Editable prompt

**Active Prompt**:
Prompt Version ที่มี `is_active = 1` ต่อ `prompt_type` — ใช้โดยทั้ง OCR Sandbox และ `processMigrateDocument` พร้อมกัน, cached ใน Redis TTL 60s; invalidated เมื่อ admin activate version อื่น (ADR-029)
_Avoid_: Production prompt (ทั้ง sandbox และ migrate-document ใช้อันเดียวกัน)

**Prompt Template**:
String ที่มี `{{ocr_text}}` placeholder บังคับ — backend validate ก่อน save; processor แทนที่ด้วย OCR output ก่อนส่งเข้า Ollama (ADR-029)
_Avoid_: Prompt string, Prompt text (ambiguous — อาจหมายถึง resolved prompt ที่มี OCR text แล้ว)

**Human-in-the-loop**:
ทุก AI suggestion ต้องผ่านการ accept/reject โดย user ก่อนกลายเป็น state change — บันทึกใน `ai_audit_logs`
_Avoid_: Auto-apply, AI auto-execute

**AI Tool Layer**:
Bridge layer ระหว่าง AI Gateway กับ business modules — dispatch โดย AI Gateway หลังได้ Server-side Intent, enforce CASL ภายใน tool เอง (ADR-025)
_Avoid_: LLM function calling, Tool plugin, LangChain tool

**Tool Registry**:
Static map ใน `AiToolRegistryService` ที่ map `ServerIntent` → tool handler — Intent ที่ไม่มีใน registry route ไป RAG หรือ FALLBACK
_Avoid_: Dynamic plugin registry, Runtime-loaded tools

**ToolResult DTO**:
LLM-friendly response object จาก tool — มีเฉพาะ `publicId` + business codes, ไม่มี INT `id` (ADR-019), ไม่มี TypeORM relations
_Avoid_: Raw entity, Full entity response

**ToolCallResult**:
Result wrapper ที่ tool คืนให้ Gateway: `{ ok: true, data }` หรือ `{ ok: false, reason, message }` — ไม่ throw exception
_Avoid_: Throw exception from tool, Untyped error

## Relationships

- A **Correspondence** has a 1:1 specialization to **RFA** / **Transmittal** / etc. (table inheritance)
- A **RFA** has 1:N **RFA Revisions**, each linking to one or more **Shop Drawing Revisions** via `rfa_items`
- A **Workflow Instance** governs exactly one **Correspondence**; its current state is projected into entity columns (e.g. `rfa_revisions.rfa_status_code_id`) but **`workflow_instances` is the source of truth**
- A **Prompt Version** lives in `ai_prompts`; exactly one per `prompt_type` has `is_active = 1` — this is the **Active Prompt** consumed by both OCR Sandbox and `processMigrateDocument`; cached in Redis TTL 60s
- A **Document Chunk** (MariaDB) has a 1:1 **Vector Point** in Qdrant via shared `chunk_public_id` (UUIDv7)
- An **AI Document Assistant** suggestion produces an `ai_audit_logs` row; if user accepts, it triggers a normal **Workflow Transition** (AI never writes the transition itself)
- **Qdrant queries MUST be filtered by `project_public_id`** — enforced at compile time by `QdrantService` signature
- An **Intent Classifier** receives user query → returns **Server-side Intent** + confidence; Pattern Layer (DB table) checked first, **LLM Fallback** (Ollama sync) used only when pattern miss
- An **Intent Definition** (`ai_intent_definitions`) has 1:N **Intent Patterns** (`ai_intent_patterns`); Admin จัดการได้ runtime
- **AI Gateway** dispatches to **AI Tool Layer** directly (server-side) after receiving Intent — LLM never calls tools itself; **Tool Registry** maps Intent → handler; each handler returns **ToolCallResult** wrapper
- A **ToolResult DTO** contains only `publicId` + business codes — injected into LLM prompt as JSON context (v1, max 500 tokens); hybrid RAG+Tool deferred to Phase 4

## AI authority scope (resolved)

| Scope                                              | Allowed? | Mechanism                                                       |
| -------------------------------------------------- | -------- | --------------------------------------------------------------- |
| Read-only insight (summarise, explain)             | ✅       | AI Gateway → service → CASL-guarded query                       |
| Suggest action (UI shows button)                   | ✅       | Response shape `{ suggestedAction, confidence, reasoning }`     |
| Auto-trigger side-effects (notify, alert, comment) | ✅       | BullMQ job (ADR-008); MUST NOT change workflow state            |
| Auto-execute workflow transition                   | ❌       | Forbidden Tier 1 — every transition needs human `actor_user_id` |

## Upload pipeline (resolved)

| Stage                                                                | Mode  | Queue         | Notes                                                    |
| -------------------------------------------------------------------- | ----- | ------------- | -------------------------------------------------------- |
| 1. Upload → **temp** + return `tempUploadId`                         | Sync  | —             | <1s                                                      |
| 2. ClamAV scan + MIME whitelist                                      | Sync  | —             | block ก่อน commit (ADR-016)                              |
| 3. User commit (metadata + ย้าย permanent)                           | Sync  | —             | สร้าง `documents` row, ใช้ `Idempotency-Key`             |
| 4. **Classification/Tagging** (3 pages แรก)                          | Async | `ai-realtime` | suggest metadata; user accept/reject (human-in-the-loop) |
| 5. **RAG Embedding** (full doc; OCR ถ้า text-layer < 100 chars/page) | Async | `ai-batch`    | trigger AUTO หลัง commit, parallel กับ stage 4           |
| 6. Qdrant upsert + `ai_document_chunks.embedded_at = NOW()`          | Async | (worker)      | gap = DB full-text fallback                              |

**กฎ:**

- ❌ ห้าม OCR/embed ใน HTTP request handler
- ✅ BullMQ `jobId = chunk_public_id` (UUIDv7) กัน duplicate
- ✅ Embed fail → graceful degrade (เอกสารยังใช้งานได้, AI feature ลด)
- ✅ Revision ใหม่ → chunks เก่า mark `superseded_at`, **ไม่ลบ** vector
- ✅ Frontend ใช้ `AiStatusBanner` แสดง progress

## Example dialogue

> **Dev:** "AI สรุป **RFA** revision นี้ให้หน่อย แล้วเปลี่ยน status เป็น approved เลย"
> **Domain expert:** "ไม่ได้ — AI สรุปได้ (read-only insight) และเสนอ 'ควร approve เพราะ…' ได้ (suggest action) แต่การเปลี่ยน state ต้องผ่าน user กดปุ่มเอง ระบบจะเรียก `WorkflowService.transition()` ซึ่งบันทึก `actor_user_id` เป็นมนุษย์ใน `workflow_histories`"

> **Dev:** "งั้น **Tool Layer** ใน plan เก่าที่ให้ LLM เรียก `get_rfa(id)` ใช้ได้ไหม"
> **Domain expert:** "ไม่ใช่ tool ของ LLM — เป็น **Server-side Intent** ที่ AI Gateway แปลงเป็น service call ภายใต้ CASL + `projectPublicId` scope LLM แค่รับ context ที่ pre-fetched มาแล้ว"

## Identifier rules (ADR-019, AI subsystem)

| Boundary                                       | Identifier ที่ใช้                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| API (FE ↔ AI Gateway)                         | `publicId` (UUIDv7 string) เท่านั้น; INT `id` มี `@Exclude()`             |
| Server-side Intent payload                     | `*PublicId` strings; service แปลงเป็น INT FK ภายใน                        |
| LLM context (prompt)                           | `publicId` + business code (`rfa_number`, `drawing_code`) ห้ามเห็น INT    |
| Qdrant payload                                 | `project_public_id`, `document_public_id`, `chunk_public_id`              |
| `ai_document_chunks` internals                 | INT FK ใช้ได้ภายใน DB; identity ที่ expose = `chunk_public_id BINARY(16)` |
| Business codes (e.g. `drawing_code = "A-101"`) | รับเป็น input ได้ แต่ resolve → `publicId` ก่อน query                     |

**Forbidden (Tier 1 CI blocker):**

- `parseInt(<*PublicId>)`, `Number(<*PublicId>)`, `+<*PublicId>`
- `publicId ?? id ?? ''` fallback chain
- DTO ที่มีทั้ง `{ id, uuid, publicId }`

## AI integration architecture (resolved)

**มีแล้ว (Infrastructure):**

- **AI Gateway** — NestJS module, CASL-guarded, enqueue jobs ไป BullMQ
- **n8n** — Workflow orchestrator บน QNAP (Migration Phase + simple routing)
- **Ollama** — Local LLM inference บน Admin Desktop (gemma4:e4b Q8_0 + nomic-embed-text)
- **QdrantService** — Vector search แบบ project-isolated
- **AiRagService** — RAG pipeline (embed query → Qdrant → LLM context)

**ยังขาด (Runtime Layer):**

- **Intent Router** — แปลงคำถามธรรมชาติ → Server-side Intent enum (เช่น `RAG_QUERY`, `GET_RFA`, `GET_DRAWING_REVISIONS`)
- **AI Tool Layer** — Bridge functions ที่เรียก business modules (RFA, Drawing, Transmittal) ภายใต้ CASL scope
- **Document Chat UI** — Side-panel component สำหรับคุยกับ AI ใน context ของเอกสาร

**ความสัมพันธ์:**

User Chat → Intent Router (ยังไม่มี) → Server-side Intent → AI Gateway → CASL Check →
├─→ BullMQ → n8n → Ollama → Response
└─→ Tool Layer (ยังไม่มี) → Business Service → Response

## System readiness summary (resolved)

| Component               | สถานะ           | หมายเหตุ                                                                                  |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| **Infrastructure**      | ✅ พร้อม        | NestJS + Next.js + MariaDB + Redis + Elasticsearch                                        |
| **Workflow Engine**     | ✅ พร้อม        | DSL-based, ADR-001/021                                                                    |
| **AI Boundary**         | ✅ พร้อม        | ADR-023A — Ollama isolation, no direct DB access                                          |
| **RAG Pipeline**        | 🟡 บางส่วน      | Qdrant service มีใน code, ต้องตรวจสอบ deployment                                          |
| **Intent Router**       | 🟡 ADR Accepted | ADR-024 Accepted — Intent Classifier (Pattern→LLM Fallback) รอ implementation             |
| **AI Tool Layer**       | 🟡 ADR Accepted | ADR-025 Accepted — Tool Layer Architecture รอ implementation                              |
| **Document Chat UI**    | 🟡 ADR Accepted | ADR-026 Accepted — Side-panel Chat UI รอ implementation                                   |
| **AI Admin Console**    | 🟡 ADR Accepted | ADR-027 Accepted — Dynamic Control Panel รอ implementation                                |
| **Dynamic Prompt Mgmt** | ✅ พร้อม        | ADR-029 Active — พัฒนาเสร็จสมบูรณ์ทั้ง Entity, API, Sandbox Runner, Cache และ UI Playgrounds |

## Flagged ambiguities

- **"approval logic"** ในเอกสารเก่าใช้คาบเกี่ยวระหว่าง `rfa_approve_codes` (business outcome เช่น 1A/1B) กับ `workflow_definitions` (state transition rules) — resolved: เป็นคนละสิ่ง
- **"ai_embeddings"** vs **"ai_document_chunks"** — resolved: ใช้ `ai_document_chunks` (metadata + text) + Qdrant (vector only); ห้ามเก็บ vector ใน MariaDB
- **"Tool Layer"** ในเอกสาร AI — resolved: ไม่ใช่ LLM-callable tools, เป็น **Server-side Intents** ที่ NestJS controlใน AI Gateway
- **"AI = Document Controller"** — resolved: ใช้ **AI Document Assistant** (Suggest + Insight) แทน เพื่อกัน scope creep ไปทาง autonomous agent
- **OpenRAG vs ADR-023A** — resolved: **ADR-023A เป็น canonical source** — ใช้ Qdrant + nomic-embed-text สำหรับ vector search; Elasticsearch ใช้สำหรับ keyword/full-text เท่านั้น; `specs/03-Data-and-Storage/03-07-OpenRAG.md` เป็นเอกสาร reference แต่ไม่ใช่ active spec
- **".agents/ กับ Production AI"** — resolved: `.agents/` คือ Dev AI toolkit (ช่วยเขียนโค้ด); Production AI คือ AI Gateway + n8n + Ollama — เป็นคนละ layer กัน

## Roadmap: AI Runtime Layer (pending ADRs)

สร้างตามลำดับ dependency:

### Phase 1 — Intent Router (2-3 สัปดาห์)

**เป้าหมาย**: แปลงคำถามธรรมชาติ → Server-side Intent enum

**ขั้นตอน:**

1. สร้าง `IntentClassifier` service — ใช้ Ollama หรือ simple pattern matching เป็น v1
2. กำหนด `ServerIntent` enum: `RAG_QUERY`, `GET_RFA`, `GET_DRAWING`, `GET_TRANSMITTAL`, `SUMMARIZE_DOCUMENT`
3. เพิ่ม endpoint `POST /ai/intent` ที่รับ `{ query: string, context?: { type, publicId } }` → คืน `{ intent, confidence, params }`
4. ทดสอบ: "RFA ล่าสุดของโครงการนี้คืออะไร" → `GET_RFA` with `{ sort: 'latest', limit: 1 }`

**ขึ้นกับ:** ไม่มี (ใช้ Ollama ที่มีอยู่)

---

### Phase 2 — AI Tool Layer (3-4 สัปดาห์)

**เป้าหมาย**: Bridge functions ที่เรียก business modules ภายใต้ CASL scope

**ขั้นตอน:**

1. สร้าง `AiToolService` — registry สำหรับ tool functions
2. สร้าง tool wrappers:
   - `getRfa(params: { publicId?; rfaNumber?; contractPublicId?; status? })`
   - `getDrawing(params: { publicId?; drawingCode?; contractPublicId?; revision? })`
   - `getTransmittal(params: { publicId?; transmittalNumber?; purpose? })`
   - `getRfaDrawings(rfaPublicId: string)` — ดึง drawings ที่ผูกกับ RFA
3. ใส่ CASL guard ทุก tool — ตรวจสอบ `projectPublicId` scope
4. เพิ่ม response formatter — แปลง entity → LLM-friendly context (publicId + business codes เท่านั้น)
5. ทดสอบ: Intent Router → Tool Layer → RfaService → Response

**ขึ้นกับ:** Phase 1 (Intent Router ต้องรู้ว่าเรียก tool ไหน)

---

### Phase 3 — Document Chat UI (2 สัปดาห์)

**เป้าหมาย**: Side-panel component สำหรับคุยกับ AI ใน context เอกสาร

**ขั้นตอน:**

1. สร้าง `AiChatPanel` component — รับ `context: { type: 'drawing'|'rfa'|'transmittal', publicId: string }`
2. เพิ่ม chat interface: user message + AI response + suggested actions
3. สร้าง `useAiChat()` hook — TanStack Query, streaming response (optional)
4. ฝังใน pages:
   - `/drawings/[publicId]` — context เป็น drawing นั้น
   - `/rfas/[publicId]` — context เป็น RFA นั้น
   - `/transmittals/[publicId]` — context เป็น transmittal นั้น
5. ทดสอบ: เปิด drawing → ถาม "RFA ที่เกี่ยวข้องกับ drawing นี้คืออะไร" → AI ตอบถูก

**ขึ้นกับ:** Phase 1 + 2 (ต้องมี Intent Router + Tool Layer ก่อน)

---

### Phase 4 — Integration & Polish (2 สัปดาห์)

**ขั้นตอน:**

1. เพิ่ม RAG context ผสมกับ Tool results (hybrid response)
2. เพิ่ม suggested actions ที่มาจาก AI ("ควรสร้าง RFA ใหม่ไหม?")
3. ทดสอบ end-to-end ทุก flow
4. ปรับ threshold / confidence scores ตามผลทดสอบ

---

## ADRs ที่เกี่ยวข้องกับ AI Runtime Layer

| ADR     | หัวข้อ                             | ตัดสินใจอะไร                                                                             | สถานะ       |
| ------- | ---------------------------------- | ---------------------------------------------------------------------------------------- | ----------- |
| ADR-024 | Intent Classification Strategy     | Hybrid: Pattern First → LLM Fallback                                                     | ✅ Accepted |
| ADR-025 | AI Tool Layer Architecture         | Bridge pattern, CASL enforcement, response shape                                         | ✅ Accepted |
| ADR-026 | Document Chat UI Pattern           | Side-panel vs modal vs separate page                                                     | ✅ Accepted |
| ADR-027 | AI Admin Console & Dynamic Control | Admin Panel + dynamic model/prompt/intent control                                        | ✅ Accepted |
| ADR-028 | Migration Architecture Refactor    | Staging Queue & post-migration cleanup                                                   | ✅ Active   |
| ADR-029 | Dynamic Prompt Management          | `ai_prompts` table, versioned OCR extraction prompt shared by sandbox + migrate-document | ✅ Active   |

**หมายเหตุ**: ADR-023A ยังคงเป็น canonical สำหรับ infrastructure — ADR-024/025/026/027 เพิ่ม runtime layer; ADR-028 ปรับ Migration Pipeline
