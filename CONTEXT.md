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

### AI

**AI Document Assistant**:
ผู้ช่วยที่ให้ Insight + Suggest + Notify โดยไม่เปลี่ยน state ของเอกสารเอง (ADR-023A)
_Avoid_: AI Document Controller, AI Agent, Autonomous Agent

**AI Gateway**:
NestJS module ที่เป็นจุดเข้าเดียวของทุกคำขอ AI — enforce CASL + tenant scope ก่อนส่งงานเข้า BullMQ
_Avoid_: AI Service (generic), Tool Layer

**Server-side Intent**:
Enum ของคำขอที่ AI Gateway รองรับ (เช่น `RAG_QUERY`, `CLASSIFY_DOCUMENT`, `EXTRACT_METADATA`) — แทนที่ LLM function-calling
_Avoid_: Tool, LLM tool, LangChain tool

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

**Human-in-the-loop**:
ทุก AI suggestion ต้องผ่านการ accept/reject โดย user ก่อนกลายเป็น state change — บันทึกใน `ai_audit_logs`
_Avoid_: Auto-apply, AI auto-execute

## Relationships

- A **Correspondence** has a 1:1 specialization to **RFA** / **Transmittal** / etc. (table inheritance)
- A **RFA** has 1:N **RFA Revisions**, each linking to one or more **Shop Drawing Revisions** via `rfa_items`
- A **Workflow Instance** governs exactly one **Correspondence**; its current state is projected into entity columns (e.g. `rfa_revisions.rfa_status_code_id`) but **`workflow_instances` is the source of truth**
- A **Document Chunk** (MariaDB) has a 1:1 **Vector Point** in Qdrant via shared `chunk_public_id` (UUIDv7)
- An **AI Document Assistant** suggestion produces an `ai_audit_logs` row; if user accepts, it triggers a normal **Workflow Transition** (AI never writes the transition itself)
- **Qdrant queries MUST be filtered by `project_public_id`** — enforced at compile time by `QdrantService` signature

## AI authority scope (resolved)

| Scope | Allowed? | Mechanism |
|-------|----------|-----------|
| Read-only insight (summarise, explain) | ✅ | AI Gateway → service → CASL-guarded query |
| Suggest action (UI shows button) | ✅ | Response shape `{ suggestedAction, confidence, reasoning }` |
| Auto-trigger side-effects (notify, alert, comment) | ✅ | BullMQ job (ADR-008); MUST NOT change workflow state |
| Auto-execute workflow transition | ❌ | Forbidden Tier 1 — every transition needs human `actor_user_id` |

## Upload pipeline (resolved)

| Stage | Mode | Queue | Notes |
|-------|------|-------|-------|
| 1. Upload → **temp** + return `tempUploadId` | Sync | — | <1s |
| 2. ClamAV scan + MIME whitelist | Sync | — | block ก่อน commit (ADR-016) |
| 3. User commit (metadata + ย้าย permanent) | Sync | — | สร้าง `documents` row, ใช้ `Idempotency-Key` |
| 4. **Classification/Tagging** (3 pages แรก) | Async | `ai-realtime` | suggest metadata; user accept/reject (human-in-the-loop) |
| 5. **RAG Embedding** (full doc; OCR ถ้า text-layer < 100 chars/page) | Async | `ai-batch` | trigger AUTO หลัง commit, parallel กับ stage 4 |
| 6. Qdrant upsert + `ai_document_chunks.embedded_at = NOW()` | Async | (worker) | gap = DB full-text fallback |

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

| Boundary | Identifier ที่ใช้ |
|----------|-------------------|
| API (FE ↔ AI Gateway) | `publicId` (UUIDv7 string) เท่านั้น; INT `id` มี `@Exclude()` |
| Server-side Intent payload | `*PublicId` strings; service แปลงเป็น INT FK ภายใน |
| LLM context (prompt) | `publicId` + business code (`rfa_number`, `drawing_code`) ห้ามเห็น INT |
| Qdrant payload | `project_public_id`, `document_public_id`, `chunk_public_id` |
| `ai_document_chunks` internals | INT FK ใช้ได้ภายใน DB; identity ที่ expose = `chunk_public_id BINARY(16)` |
| Business codes (e.g. `drawing_code = "A-101"`) | รับเป็น input ได้ แต่ resolve → `publicId` ก่อน query |

**Forbidden (Tier 1 CI blocker):**
- `parseInt(<*PublicId>)`, `Number(<*PublicId>)`, `+<*PublicId>`
- `publicId ?? id ?? ''` fallback chain
- DTO ที่มีทั้ง `{ id, uuid, publicId }`

## Flagged ambiguities

- **"approval logic"** ในเอกสารเก่าใช้คาบเกี่ยวระหว่าง `rfa_approve_codes` (business outcome เช่น 1A/1B) กับ `workflow_definitions` (state transition rules) — resolved: เป็นคนละสิ่ง
- **"ai_embeddings"** vs **"ai_document_chunks"** — resolved: ใช้ `ai_document_chunks` (metadata + text) + Qdrant (vector only); ห้ามเก็บ vector ใน MariaDB
- **"Tool Layer"** ในเอกสาร AI — resolved: ไม่ใช่ LLM-callable tools, เป็น **Server-side Intents** ที่ NestJS controlใน AI Gateway
- **"AI = Document Controller"** — resolved: ใช้ **AI Document Assistant** (Suggest + Insight) แทน เพื่อกัน scope creep ไปทาง autonomous agent
- **OpenRAG vs ADR-023A** — `specs/03-Data-and-Storage/03-07-OpenRAG.md` ระบุ Elasticsearch + dense_vector ซึ่งขัดกับ ADR-023A (Qdrant + nomic-embed-text) — **ยังไม่ resolve**, ต้องตัดสินใจในรอบถัดไป
