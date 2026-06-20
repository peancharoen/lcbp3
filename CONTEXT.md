# LCBP3 / NAP-DMS Context

ระบบจัดการเอกสารงานก่อสร้าง (DMS) สำหรับโครงการ LCBP3 — เน้นการควบคุม Correspondence, RFA, Transmittal, Drawing พร้อมผู้ช่วย AI แบบ on-premises ที่ทำงานภายใต้ Workflow Engine กลางและขอบเขต AI ที่เข้มงวด (ADR-023A/ADR-033)

> **Agent/ tooling context:** สำหรับ Hermes Agent, Telegram Bridge, และ DevOps tooling → ดู [`specs/06-Decision-Records/CONTEXT-ADR-031.md`](specs/06-Decision-Records/CONTEXT-ADR-031.md)
> **Typhoon OCR context:** สำหรับ Typhoon OCR-3B และ typhoon2.1-gemma3-4b integration → ดู [`specs/06-Decision-Records/ADR-032-typhoon-ocr-integration.md`](specs/06-Decision-Records/ADR-032-typhoon-ocr-integration.md)

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
ชั้นที่สอง of Intent Classifier — synchronous Ollama call (`np-dms-ai`) เมื่อ Pattern Layer ไม่ match, ใช้ semaphore max=3; runtime model tag เป็น ops detail ใน Modelfile เท่านั้น
_Avoid_: BullMQ-based classification, async intent routing, gemma4:e4b (runtime tag ไม่ใช่ domain term)

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
Container สำเร็จรูป (FastAPI Sidecar บน Desk-5439) ทำหน้าที่ประมวลผล OCR และสื่อสารผ่าน `X-API-Key` ป้องกันความปลอดภัย (ADR-032/033)
_Avoid_: OCR microservice (ที่ขาดการป้องกัน)

**Prompt Version**:
Immutable snapshot ของ prompt template ใน `ai_prompts` table — ทุกครั้งที่ admin กด "บันทึก" จะสร้าง version ใหม่ (`version_number` เพิ่มทีละ 1) version เก่ายังอยู่ใน history ลบได้ยกเว้น active version (ADR-029)
_Avoid_: Prompt config, Prompt setting, Editable prompt

**Active Prompt**:
Prompt Version ที่มี `is_active = 1` ต่อ `prompt_type` — ใช้โดยทั้ง OCR Sandbox และ `processMigrateDocument` พร้อมกัน, cached ใน Redis TTL 60s; invalidated เมื่อ admin activate version อื่น (ADR-029)
_Avoid_: Production prompt (sandbox และ migrate-document ใช้เดียวกัน)

**Prompt Template**:
String ที่ใส่ placeholder ตาม `prompt_type` — backend validate ก่อน save; processor แทนที่ด้วยค่าจริงก่อนส่งเข้า Ollama (ADR-029, ADR-037)
Canonical placeholder names per type: `ocr_extraction` → `{{ocr_text}}` (required), `{{master_data_context}}` (optional); `rag_query_prompt` → `{{query}}`, `{{context}}` (both required); `rag_prep_prompt` → `{{text}}` (required); `classification_prompt` → `{{document_text}}` (required)
_Avoid_: Prompt string, Prompt text (ambiguous); ห้ามใช้ชื่อ placeholder อื่น เช่น `{{user_query}}`, `{{retrieved_chunks}}`, `{{document_metadata}}` — ชื่อเหล่านี้ไม่ใช่ canonical

**Human-in-the-loop**:
ทุก AI suggestion ต้องผ่านการ accept/reject โดย user ก่อนกลายเป็น state change — บันทึกใน `ai_audit_logs`
_Avoid_: Auto-apply, AI auto-execute

**Execution Profile** _(admin-facing only)_:
Policy ภายในที่ backend กำหนดให้ AI job อัตโนมัติจาก `job.type` — ไม่มี caller input; มี 4 ค่า: `interactive` (ตอบเร็ว), `standard` (ทั่วไป), `quality` (แม่นยำสูง, ภาษาไทย), `deep-analysis` (context ยาว) — admin เห็นใน audit log และ Admin Console; ค่า default ใน `docs/ai-profiles.md`, calibrate ได้ผ่าน Admin Console (ADR-029)
_Avoid_: executionProfile (API field), model selection, profile override

**Canonical Model Identity**:
ชื่อ `np-dms-ai` (LLM หลัก) และ `np-dms-ocr` (OCR) — ชื่อที่แสดงต่อทุก layer ที่มนุษย์อ่าน (API response, audit log, Admin Console) แทนชื่อ runtime จริง (เช่น `typhoon2.5-np-dms:latest`)
_Avoid_: runtime model name, model tag, Ollama model name (ใช้ใน ops เท่านั้น)

**OCR Residency**:
Policy ที่ตัดสินว่า `np-dms-ocr` จะถูก unload ออกจาก VRAM หลัง job เสร็จทันที (`keep_alive: 0`) หรือเก็บไว้ช่วงหนึ่ง (`keep_alive > 0`) — คำนวณ dynamic จาก VRAM headroom ณ ขณะนั้น; ถ้า `deep-analysis` active หรือ VRAM pressure สูง → unload ทันทีเสมอ
_Avoid_: OCR keep_alive setting, fixed keep_alive, OCR cache

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
- A **ToolResult DTO** contains only `publicId` + business codes — injected into LLM prompt as JSON context (v1, max 500 tokens)

## AI authority scope (resolved)

| Scope                                              | Allowed? | Mechanism                                                       |
| :------------------------------------------------- | :------- | :-------------------------------------------------------------- |
| Read-only insight (summarise, explain)             | ✅       | AI Gateway → service → CASL-guarded query                       |
| Suggest action (UI shows button)                   | ✅       | Response shape `{ suggestedAction, confidence, reasoning }`     |
| Auto-trigger side-effects (notify, alert, comment) | ✅       | BullMQ job (ADR-008); MUST NOT change workflow state            |
| Auto-execute workflow transition                   | ❌       | Forbidden Tier 1 — every transition needs human `actor_user_id` |

## Upload pipeline (resolved)

| Stage                                                                | Mode  | Queue         | Notes                                                    |
| :------------------------------------------------------------------- | :---- | :------------ | :------------------------------------------------------- |
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

## Identifier rules (ADR-019, AI subsystem)

| Boundary                                       | Identifier ที่ใช้                                                         |
| :--------------------------------------------- | :------------------------------------------------------------------------ |
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
- **Ollama** — Local LLM inference บน Admin Desktop (ADR-034: typhoon2.5-np-dms + typhoon-np-dms-ocr + nomic-embed-text)
- **QdrantService** — Vector search แบบ project-isolated
- **AiRagService** — RAG pipeline (embed query → Qdrant → LLM context)
- **OcrService / sidecar** — ระบบประมวลผล OCR ปลอดภัยด้วย API Key และ dynamic model swapping (ADR-033)

## Glossary Updates (from ADR-034)

| Term                                         | Definition                                                                                                                                                                                               | Avoid                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Thai-Optimized Model**                     | โมเดล AI ที่ถูก fine-tune มาสำหรับภาษาไทยโดยเฉพาะ (เช่น Typhoon series จาก SCB10X)                                                                                                                       | Generic model, English-only model                                            |
| **Model Unload/Load**                        | กระบวนการยกเลิกโหลดโมเดลจาก VRAM และโหลดโมเดลใหม่เข้าไปแทน เพื่อสลับการใช้งานระหว่างโมเดลต่างๆ                                                                                                           | Model switching (ambiguous), Hot swap                                        |
| **Cold Start Penalty**                       | ความล่าช้า 5-15 วินาทีที่เกิดจากการโหลดโมเดล weights เข้า VRAM หลังจากโมเดลถูก unload (keep_alive: 0)                                                                                                    | Initial delay, First-run latency                                             |
| **Canonical AI Model Identity**              | ชื่อโมเดลหลักที่ระบบ backend, admin console และเอกสารสถาปัตยกรรมใช้อ้างอิงร่วมกันเป็น source of truth เดียว                                                                                              | Alias-only model name, temporary deploy tag                                  |
| **Adaptive OCR Residency**                   | นโยบาย keep_alive ของ OCR model ที่ปรับตาม VRAM headroom และ active model ขณะนั้น แทนการค้างหรือ unload แบบตายตัว                                                                                        | Fixed keep_alive, always-resident OCR                                        |
| **Execution Profile**                        | สัญญาณเชิงนโยบายที่ caller ส่งมาเพื่อบอกระดับความเร็ว/ความแม่นยำ/บริบทที่ต้องการ โดย backend map ต่อไปเป็น model และ parameters ที่อนุญาต                                                                | Free-form model key, direct model override                                   |
| **Canonical Profile Set**                    | ชุดค่า `Execution Profile` มาตรฐานที่คงที่ระดับ contract เช่น `fast`, `balanced`, `thai-accurate`, `large-context` แทนการแตก profile ตาม internal pipeline                                               | Job-specific routing key, per-endpoint profile taxonomy                      |
| **Policy-Enforced Profile Override**         | กฎที่ backend มีสิทธิ์บังคับ profile สำหรับงานที่มีผลต่อข้อมูลหรือ metadata โดยไม่ยึดค่าที่ caller ส่งมา                                                                                                 | Caller-controlled quality for write-affecting jobs, advisory-only governance |
| **LLM-First GPU Ownership**                  | นโยบายจัดลำดับสิทธิ์ VRAM ที่ให้ main LLM และ OCR path มาก่อน embedding/reranking; retrieval side ใช้ GPU ได้เฉพาะเมื่อมี headroom ผ่าน policy                                                           | Flat shared GPU pool, equal-priority GPU consumers                           |
| **CPU Fallback Retrieval**                   | พฤติกรรม degrade ของ embedding/reranking ที่สลับกลับไปใช้ CPU ทันทีเมื่อ GPU headroom ไม่พอ โดยไม่รอคิว GPU                                                                                              | GPU wait queue for retrieval, hard failure on low VRAM                       |
| **Selective Realtime Concurrency**           | นโยบายเพิ่ม concurrency ของ `ai-realtime` ได้เฉพาะ job type ที่ไม่แตะ OCR path หรือ model switching; pause/resume coordination หลักยังคงอยู่                                                             | Global realtime concurrency uplift, scheduler rewrite                        |
| **Lightweight Realtime Job**                 | งานใน `ai-realtime` ที่ไม่เรียก OCR, ไม่บังคับ model switch, และไม่พึ่ง GPU-heavy generation path จึงมีสิทธิ์อยู่ใน concurrency uplift set                                                               | RAG query, OCR-triggering job, GPU-heavy generation                          |
| **Generation-Centric RAG Query**             | การจัดประเภท `rag-query` ว่าเป็นงาน generation เป็นหลัก โดย retrieval ทำหน้าที่เตรียม context และยอม degrade ได้                                                                                         | Retrieval-first RAG, search-only job                                         |
| **Restricted Large-Context Profile**         | โปรไฟล์ `large-context` เป็นความสามารถพิเศษที่จำกัดใช้เฉพาะ admin หรือ special workflows ที่ backend อนุญาต ไม่ใช่ตัวเลือกทั่วไปของ `rag-query`                                                          | Public long-context option, caller-driven context inflation                  |
| **Big Bang AI Runtime Rollout**              | การเปลี่ยน runtime policy, model identity, และ GPU scheduling หลายส่วนพร้อมกันในรอบ deploy เดียว เพราะระบบยังไม่เปิด production                                                                          | Phase-gated rollout, incremental policy cutover                              |
| **Big Bang Cutover Gate**                    | เกณฑ์ผ่านก่อน cutover ที่บังคับให้ policy contract, model switching, adaptive OCR residency, และ RAG fallback ต้องผ่านครบทั้งชุด ไม่รับ partial success                                                  | Best-effort rollout, partial completion gate                                 |
| **Executable-First Verification**            | เกณฑ์ยืนยันผลหลักของ AI runtime rollout ต้องอิง test, log, metric, หรือ trace ที่รันซ้ำได้ แต่แต่ละแกนต้องมี manual validation path สำหรับยืนยันพฤติกรรมเชิงใช้งานจริงประกบเสมอ                          | Manual-only signoff, unverifiable smoke check                                |
| **Single-Name Canonical Model Policy**       | เมื่อประกาศ canonical model identity ใหม่ ชื่อเดียวกันต้องถูกใช้สอดคล้องกันทุกชั้นของระบบที่ผู้ใช้และนักพัฒนาเห็น ส่วนชื่อ base runtime จริงเป็น implementation detail ใน ops/runtime internals เท่านั้น | Dual naming, mixed canonical and base model labels                           |
| **Canonical OCR Identity**                   | OCR model ต้องใช้ชื่อ canonical เดียวทุกชั้นของระบบเช่น `np-dms-ocr` โดยไม่เปิดชื่อ runtime เดิมเป็น public/internal contract หลัก                                                                       | Legacy OCR runtime label as primary name, mixed OCR naming                   |
| **Profile-Only Parameter Governance**        | API caller ส่งได้เพียง `Execution Profile`; ค่า temperature, top_p, max tokens และ runtime parameters จริงถูกกำหนดโดย backend policy เท่านั้น                                                            | Caller parameter override, free-form runtime tuning                          |
| **Integrated Retrieval Acceleration Policy** | การเร่งความเร็ว retrieval เช่น BGE embedding/reranking บน GPU เป็นส่วนหนึ่งของ AI runtime resource policy เดียวกับ main model และ OCR ไม่ใช่งาน optimization แยกอิสระ                                    | Standalone retrieval tuning, separate GPU policy for RAG only                |

## Glossary Updates (from ADR-036)

| Term                            | Definition                                                                                                                                                                                                                                                                                                                | Avoid                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Apply to Production**         | การกระทำของ admin ที่ copy ค่าจาก **Sandbox Draft Profile** (`ai_sandbox_profiles`) ทับ production row ใน `ai_execution_profiles` (UPSERT + invalidate Redis); systemPrompt → activate version ใน `ai_prompts`; มีผลกับงานที่ submit **หลังจากนั้น** เท่านั้น                                                             | new system_settings param store, lazy-read at process time               |
| **Sandbox Draft Profile**       | ค่า runtime params ที่ admin ปรับ/ทดสอบ — เก็บแยก persisted ใน `ai_sandbox_profiles` (mirror `ai_execution_profiles` + `profile_name` + `canonical_model`); **seed ค่าตั้งต้นจาก production row** เมื่อยังไม่มี draft หรือกด reset; production **ไม่เห็น** draft จนกว่าจะกด Apply to Production                           | ephemeral override, draft ใน production table, implicit production write |
| **Production Pipeline Sandbox** | เครื่องมือ admin ที่รัน **เส้นทางประมวลผลเดียวกับ production** (`processMigrateDocument`): OCR → Active Prompt → Master Data context → LLM extraction — ต่างแค่ **ไม่ commit ลง DB**; เพื่อ parity จริงต้องดึง runtime params จาก `ai_execution_profiles` row เดียวกับ production (ห้าม hardcode `num_ctx`/`num_predict`) | OCR Sandbox (สื่อแคบ), OCR test tool, OCR-only sandbox                   |
| **Tunable Production Defaults** | ค่า runtime params ที่ admin ปรับได้และ production ดึงไปใช้ = row ใน `ai_execution_profiles` (รวม row `ocr-extract` สำหรับ `np-dms-ocr`) ไม่ใช่ store แยก                                                                                                                                                                 | OCR*PRODUCTION_DEFAULTS key, AI_MODEL*\*\_DEFAULTS system_settings       |

---

## System readiness summary (resolved)

| Component                      | สถานะ    | หมายเหตุ                                                                                                                                         |
| :----------------------------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Infrastructure**             | ✅ พร้อม | NestJS + Next.js + MariaDB + Redis + Elasticsearch                                                                                               |
| **Workflow Engine**            | ✅ พร้อม | DSL-based, ADR-001/021                                                                                                                           |
| **AI Boundary**                | ✅ พร้อม | ADR-023A — Ollama isolation, no direct DB access                                                                                                 |
| **RAG Pipeline**               | ✅ พร้อม | Qdrant service ป้องกันการรั่วไหลระหว่างโปรเจกต์                                                                                                  |
| **Intent Router**              | ✅ พร้อม | ADR-024 Active — Intent Classifier (Pattern→LLM Fallback) ทำงานเสร็จสมบูรณ์                                                                      |
| **AI Tool Layer**              | ✅ พร้อม | ADR-025 Active — Tool Layer Bridge functions พัฒนาเสร็จสมบูรณ์                                                                                   |
| **Document Chat UI**           | ✅ พร้อม | ADR-026 Active — แผงควบคุม Side-panel Chat UI พัฒนาเสร็จสมบูรณ์                                                                                  |
| **AI Admin Console**           | ✅ พร้อม | ADR-027 Active — แผงควบคุม Dynamic prompt & model control                                                                                        |
| **Dynamic Prompt Mgmt**        | ✅ พร้อม | ADR-029 Active — พัฒนาเสร็จสมบูรณ์ทั้ง Entity, API, Sandbox, Cache และ UI                                                                        |
| **Active Model & OCR Switch**  | ✅ พร้อม | ADR-033 Active — สลับโมเดลแบบ Synchronous, GPU VRAM Auto-release และ API Key sidecar protection                                                  |
| **AI Runtime Policy Refactor** | ✅ พร้อม | Feature-235 — `np-dms-ai`/`np-dms-ocr` canonical names, adaptive OCR residency, CPU fallback retrieval, queue policy (ai-realtime concurrency=2) |

## Flagged ambiguities

- **"approval logic"** ในเอกสารเก่าใช้คาบเกี่ยวระหว่าง `rfa_approve_codes` (business outcome เช่น 1A/1B) กับ `workflow_definitions` (state transition rules) — resolved: เป็นคนละสิ่ง
- **"ai_embeddings"** vs **"ai_document_chunks"** — resolved: ใช้ `ai_document_chunks` (metadata + text) + Qdrant (vector only); ห้ามเก็บ vector ใน MariaDB
- **"Tool Layer"** ในเอกสาร AI — resolved: ไม่ใช่ LLM-callable tools, เป็น **Server-side Intents** ที่ NestJS controlใน AI Gateway
- **"AI = Document Controller"** — resolved: ใช้ **AI Document Assistant** (Suggest + Insight) แทน เพื่อกัน scope creep ไปทาง autonomous agent
- **OpenRAG vs ADR-023A** — resolved: **ADR-023A เป็น canonical source** — ใช้ Qdrant + nomic-embed-text สำหรับ vector search; Elasticsearch ใช้สำหรับ keyword/full-text เท่านั้น; `specs/03-Data-and-Storage/03-07-OpenRAG.md` เป็นเอกสาร reference แต่ไม่ใช่ active spec
- **".agents/ กับ Production AI"** — resolved: `.agents/` คือ Dev AI toolkit (ช่วยเขียนโค้ด); Production AI คือ AI Gateway + n8n + Ollama — เป็นคนละ layer กัน
- **"np-dms-ai" vs `typhoon2.5-np-dms:latest`** — resolved: ถ้าเดินตาม AI refactor ใหม่ `np-dms-ai` คือ **Canonical AI Model Identity** ใหม่ของระบบ ไม่ใช่แค่ deploy alias
- **"OCR keep_alive"** — resolved: policy ใหม่ควรถูกอธิบายเป็น **Adaptive OCR Residency** ตาม VRAM headroom และ active model ไม่ใช่ fixed `0` หรือ fixed `300`
- **"`model.key` ใน API job request"** — resolved: caller ไม่ควรเลือกชื่อโมเดลตรง ๆ; ควรส่ง **Execution Profile** แล้วให้ backend policy เป็นคน map ไป model/parameters ที่อนุญาต
- **"profile names"** — resolved: ใช้ **Canonical Profile Set** แบบเล็กและเสถียร (`interactive`, `standard`, `quality`, `deep-analysis`) แทนการแตกชื่อ profile ตาม job ภายใน
- **"profile สำหรับ migrate-document / auto-fill-document / OCR extraction"** — resolved: ใช้ **Policy-Enforced Profile Override**; backend บังคับ profile เองสำหรับงานที่มีผลต่อข้อมูล ไม่เปิดให้ caller เลือกคุณภาพอย่างอิสระ
- **"BGE-M3 / Reranker บน GPU"** — resolved: ถ้าย้ายขึ้น GPU ต้องอยู่ใต้ **LLM-First GPU Ownership**; LLM/OCR มี priority สูงกว่า retrieval path เสมอ
- **"embed/rerank ตอน VRAM ไม่พอ"** — resolved: ใช้ **CPU Fallback Retrieval**; retrieval path ต้อง degrade ไป CPU ทันที ไม่รอ GPU queue
- **"`ai-realtime = 2`"** — resolved: ใช้ **Selective Realtime Concurrency**; เพิ่มได้เฉพาะงาน realtime ที่ไม่ชนกับ OCR/model switching และยังคง pause/resume model เดิมเป็นแกนหลัก
- **"งานไหนได้สิทธิ์ realtime concurrency 2"** — resolved: จำกัดเฉพาะ **Lightweight Realtime Job**; ไม่รวม `rag-query`
- **"`rag-query` ควรถูกมองเป็นอะไร"** — resolved: ใช้ **Generation-Centric RAG Query**; main model path เป็น policy หลัก ส่วน retrieval เป็นขั้นเตรียม context ที่ fallback CPU ได้
- **"`large-context` ใช้กับอะไร"** — resolved: ใช้ **Restricted Large-Context Profile**; จำกัดเฉพาะ admin/special workflows ไม่เปิดเป็นตัวเลือกทั่วไปของ `rag-query`
- **"rollout ของ AI refactor"** — resolved: ใช้ **Big Bang AI Runtime Rollout** แม้มีหลาย runtime policy changes พร้อมกัน เพราะระบบยังไม่เปิด production
- **"อะไรคือเกณฑ์ผ่านของ big bang"** — resolved: ใช้ **Big Bang Cutover Gate**; ต้องผ่านครบทั้ง policy contract, model switching, adaptive OCR residency และ RAG fallback
- **"evidence แบบไหนนับว่าผ่าน gate"** — resolved: ใช้ **Executable-First Verification** เป็นหลัก แต่ต้องมี manual validation path ควบคู่ในแต่ละแกน
- **"`np-dms-ai` ควรตั้งชื่ออย่างไรในระบบ"** — resolved: ใช้ **Single-Name Canonical Model Policy**; `np-dms-ai` เป็นชื่อเดียวทุกชั้นที่ผู้ใช้และนักพัฒนาเห็น
- **"`np-dms-ocr` ควรเดินตาม naming policy เดียวกันไหม"** — resolved: ใช้ **Canonical OCR Identity**; `np-dms-ocr` เป็นชื่อ canonical เดียวทุกชั้นเหมือน `np-dms-ai`
- **"`temperature/topP/maxTokens` ใครคุม"** — resolved: ใช้ **Profile-Only Parameter Governance**; caller ส่งได้แค่ profile ส่วน runtime parameters จริงให้ backend policy คุมทั้งหมด
- **"BGE GPU uplift อยู่ใน scope เดียวกันไหม"** — resolved: ใช้ **Integrated Retrieval Acceleration Policy**; retrieval acceleration เป็นส่วนหนึ่งของ runtime resource policy เดียวกัน
- **"ADR-036 system_settings store ใหม่"** — resolved: **ไม่สร้าง** parallel param store ใน `system_settings`; `ai_execution_profiles` คือ setting store เดิมที่ production ดึงค่าอยู่แล้ว (`getProfileParameters()`) — ADR-036 เป็น **enhance** (เติม write/apply path) ไม่ใช่ supersede Profile-Only Parameter Governance
- **"VersionHistory pagination — button-based หรือ infinite scroll"** — resolved: **infinite scroll** ตาม spec FR; ใช้ `IntersectionObserver` + sentinel `<div>` (ไม่ใช้ external library); แสดง 20 รายการแรก โหลดเพิ่มครั้งละ 20 เมื่อ scroll ถึง sentinel; `visibleCount` รีเซ็ตเมื่อ `versions` prop เปลี่ยน; แสดง counter "แสดง X จาก Y เวอร์ชัน" ขณะยังมีของเหลือ (2026-06-15)
- **"ContextConfigEditor Language enum และ default"** — resolved: enum ที่ถูกต้องคือ `th`/`en`/`mixed` (lowercase ตาม seed data และ code); default = `th` (ไม่ใช่ `MIXED` ตามที่ spec เดิมระบุ); frontend เพิ่ม `mixed` option แล้ว (2026-06-15); backend `@IsString()` ไม่มี enum constraint — accept any string; spec FR-020 + ADR-037 อัปเดตแล้ว
- **"Sandbox Step 3 ใช้ selected version หรือ active version ของ rag_prep_prompt"** — resolved: **ใช้ Active Prompt เสมอ** (`getActive('rag_prep_prompt')`) — RAG Prep เป็น global chunking operation ไม่ผูกกับ version ที่กำลังทดสอบ; Step 2 (ocr_extraction) ใช้ selected version ได้เพราะเป็น version ที่ admin กำลัง evaluate แต่ Step 3 ทดสอบ embedding quality ของ active chunking strategy (ADR-037)
- **"Step 3 RAG Prep sandbox ใช้ BGE-M3 standalone หรือ Sidecar"** — resolved: ใช้ `OcrService.embedViaSidecar()` (OCR Sidecar `/embed` endpoint) ไม่ใช่ BGE-M3 standalone; LLM (`np-dms-ai`) ทำ semantic chunking ผ่าน `rag_prep_prompt` template (`{{text}}`) → parse `<chunk>` XML tags → embed แต่ละ chunk ผ่าน sidecar; ผลลัพธ์เก็บใน Redis 60 min TTL เท่านั้น **ไม่ commit ลง Qdrant**; queue = `ai-batch` ไม่ใช่ `ai-realtime` (ADR-037, 2026-06-15)
- **"ชื่อ placeholder ใน Prompt Template"** — resolved: ใช้ชื่อตาม code/processor จริงเป็น canonical (`{{query}}`, `{{context}}`, `{{text}}`, `{{document_text}}`) ไม่ใช่ชื่อ spec เดิมที่ semantic กว่า (`{{user_query}}`, `{{retrieved_chunks}}`, `{{document_metadata}}`); `{{master_data_context}}` เป็น optional ใน `ocr_extraction` ไม่ block save; ADR-037 + spec.md FR-023–FR-026 ถูกอัปเดตให้ตรงกับ code แล้ว (2026-06-15)
- **"ADR-036 systemPrompt เก็บที่ไหน"** — resolved: systemPrompt อยู่ใน `ai_prompts` (**Active Prompt**, ADR-029, versioned, มี `{{ocr_text}}`) เท่านั้น — ห้ามเก็บใน `ai_execution_profiles` หรือ `system_settings`
- **"ADR-036 OCR tunability"** — resolved: OCR tunable params = **`temperature`/`top_p`/`repeat_penalty`** เท่านั้น (ตรงกับ `OcrTyphoonOptions`) เก็บเป็น row `ocr-extract` ใน `ai_execution_profiles` พร้อมเพิ่ม column `canonical_model`; `num_ctx`/`max_tokens` nullable (OCR ไม่ใช้); **`keep_alive` ไม่ tunable** — ใช้ Adaptive OCR Residency (ADR-033) ดู Gap 2
- **"ADR-036 read semantics (Apply to Production)"** — resolved: คง **Snapshot semantics** — params ถูกแช่แข็งลง job payload ณ เวลา dispatch (`createJobPayload()`); ค่าที่ admin apply มีผลกับงานใหม่เท่านั้น ไม่แทรกงานที่ค้างคิว (รักษา reproducibility + audit `snapshot_params_json`)
- **"sandbox draft params เก็บที่ไหน / Apply ทำอะไร"** — resolved: ใช้ **2-layer draft→production** — draft persisted ใน **`ai_sandbox_profiles`** (admin iterate ได้ ไม่กระทบ production); **Apply** = UPSERT draft ทับ row ใน `ai_execution_profiles` + DEL redis cache. production อ่านเฉพาะ `ai_execution_profiles` (ไม่เห็น draft); sandbox pipeline อ่าน draft จาก `ai_sandbox_profiles`
- **"draft ตั้งต้นมาจากไหน"** — resolved: draft ต้อง **seed จาก production row** (`ai_execution_profiles`) เมื่อยังไม่มี draft หรือเมื่อ admin กด "Reset to Production" — `getSandboxParameters()` ถ้าไม่พบ draft ให้ clone จาก production row แล้ว return (ไม่ fallback ไป hardcoded ก่อน); ทำให้ admin เริ่มจากค่า production จริงแล้วปรับ delta
- **"OCR params ไปถึง production OCR step อย่างไร (Gap 1)"** — resolved: production `OcrService.processWithTyphoon` ปัจจุบันส่ง sidecar แค่ `engine`+`keep_alive` → ต้อง wire ให้ส่ง `temperature/topP/repeatPenalty` ด้วย (sidecar `/ocr-upload` รับ field พวกนี้อยู่แล้ว `app.py:265-273`); เพิ่ม `typhoonOptions?: OcrTyphoonOptions` ใน `OcrDetectionInput` แล้ว `processMigrateDocument` ส่ง `job.data.ocrSnapshotParams`
- **"keep_alive tunable หรือ adaptive (Gap 2)"** — resolved: ใช้กฎ **quality params freeze / resource params lazy** — temperature/top_p/repeat/num_ctx/max_tokens แช่แข็ง ณ dispatch; **keep_alive มาจาก `calculateOcrResidency()` (Adaptive OCR Residency, ADR-033) ณ process time** ไม่อยู่ใน OCR tunable set (สอดคล้อง `OcrTyphoonOptions` ที่ไม่มี keep_alive)
- **"dual-model job snapshot กี่ชุด (Gap 3)"** — resolved: `migrate-document`/`auto-fill-document` ใช้ 2 model (OCR+LLM) → `AiJobPayload` คง `snapshotParams` (LLM, backward-compat) + เพิ่ม **`ocrSnapshotParams?: OcrTyphoonOptions`**; populate เมื่อ pipeline รัน OCR; audit row เดียว `{ ...llm, ocr }`
- **"ocr-extract เป็น ExecutionProfile ไหม (Gap 4)"** — resolved: **ไม่** — `ocr-extract` เป็น **model-defaults row** (key ด้วย `canonical_model`/`profile_name`) ไม่ใช่สมาชิก `ExecutionProfile` union (คง Canonical Profile Set 4 ตัว); ใช้ accessor `getModelDefaults('np-dms-ocr')` แยกจาก `getProfileParameters(profile)`
- **"OCR Sandbox คืออะไร"** — resolved: **Production Pipeline Sandbox** — `processSandboxExtract`/`processSandboxAiExtract` รันเส้นเดียวกับ `processMigrateDocument` (OCR → Active Prompt → Master Data → LLM) ต่างแค่ไม่ commit DB; ปัจจุบันมี **parity gap** — sandbox hardcode `{ num_ctx: 16384, num_predict: 4096 }` ส่วน production ใช้ `snapshotParams` จาก profile → ADR-036 ต้องให้ sandbox เลิก hardcode แล้วดึง params จาก **`ai_sandbox_profiles`** (Sandbox Draft Profile, schema เดียวกับ `ai_execution_profiles`) เพื่อให้ admin เห็นผลของค่าที่กำลังปรับก่อนกด Apply; หลัง Apply draft จะเท่ากับ production row
- **"Master Data context parity (Gap 5)"** — resolved: Sandbox (`processSandboxExtract`/`processSandboxAiExtract`) ปัจจุบัน skip master data context ถ้า `projectPublicId='default'` → ทำให้ prompt content ต่างจาก production. Sandbox UI ต้องให้ admin ระบุ `projectPublicId` (และ `contractPublicId`) จริง; `aiPromptsService.resolveContext` ต้องถูกเรียกด้วย ID จริงเสมอ (ไม่ใช้ `'default'` เพื่อ skip); `aiPromptsService` จะคืนค่า empty context ถ้า project/contract ไม่มี master data
- **"Apply Guardrails (Gap 6)"** — resolved: Apply to Production เป็น critical config change → ต้องมี guardrails ตาม AGENTS.md: (1) **Idempotency-Key** header mandatory สำหรับ `POST /api/ai/profiles/:profileName/apply` (Redis dedupe 5 นาที); (2) **CASL Guard** `@UseGuards(CaslGuard)` + permission `system.manage_ai`; (3) **Param Validation** class-validator (`@Min(0) @Max(1)` สำหรับ temperature/topP); (4) **Audit Trail** `ai_audit_logs` บันทึก `action='APPLY_PROFILE'`, user, old→new values; (5) **Range Guard** service layer throw `BusinessException` ถ้า out of range
- **"Entity/Service canonicalModel mapping (Gap 7)"** — resolved: `AiExecutionProfileEntity` ไม่มี mapping `canonical_model` column; `getProfileParameters` (`:125`) hardcode `canonicalModel: 'np-dms-ai'` → ต้องเพิ่ม `@Column({ name: 'canonical_model' })` ใน Entity; แก้ `getProfileParameters` อ่านจาก column แทน hardcode; สร้าง accessor `getModelDefaults(canonicalModel)` สำหรับ query ตาม canonical_model โดยตรง
- **"OCR Sidecar X-API-Key"** — resolved: ใช้ **Network Isolation Only** (ADR-040 D5) — supersede ADR-033 §7; ลบ `X-API-Key` validation จาก sidecar endpoints; ตรวจสอบผ่าน Docker-internal network (post-consolidation) หรือ VLAN/firewall ACL (interim cross-host); sequencing: ลบ `X-API-Key` เฉพาะเมื่อ ADR-041 cutover เสร็จ (single Docker host)
- **"Cross-host trust gap ของ OCR sidecar"** — resolved: ใช้ **Server Consolidation** (ADR-041) — co-locate ทุก services บน single Docker host (Ryzen 5 5600 / 32GB / RTX 5060 Ti 16GB); sidecar+backend อยู่บน Docker bridge เดียวกัน → Docker-internal isolation จริง; QNAP ยังคงเป็น NAS (CIFS) สำหรับ file storage

## ADRs ที่เกี่ยวข้องกับ AI Runtime Layer

| ADR     | หัวข้อ                             | ตัดสินใจอะไร                                                                    | สถานะ       |
| :------ | :--------------------------------- | :------------------------------------------------------------------------------ | :---------- |
| ADR-024 | Intent Classification Strategy     | Hybrid: Pattern First → LLM Fallback                                            | ✅ Accepted |
| ADR-025 | AI Tool Layer Architecture         | Bridge pattern, CASL enforcement, response shape                                | ✅ Accepted |
| ADR-026 | Document Chat UI Pattern           | Side-panel vs modal vs separate page                                            | ✅ Accepted |
| ADR-027 | AI Admin Console & Dynamic Control | Admin Panel + dynamic model/prompt/intent control                               | ✅ Accepted |
| ADR-028 | Migration Architecture Refactor    | Staging Queue & post-migration cleanup                                          | ✅ Active   |
| ADR-029 | Dynamic Prompt Management          | `ai_prompts` table, versioned OCR extraction prompt                             | ✅ Active   |
| ADR-032 | Typhoon OCR Integration            | Typhoon OCR-3B + typhoon2.1-gemma3-4b on Admin Desktop                          | ✅ Active   |
| ADR-033 | Active Model & OCR Management      | Synchronous Model switch, GPU VRAM Auto-release, Sidecar API Key protection     | ✅ Active   |
| ADR-034 | Thai Model Stack                   | typhoon2.5-np-dms:latest (Main) + typhoon-np-dms-ocr:latest (OCR, keep_alive:0) | ✅ Active   |

**หมายเหตุ**: ADR-023A ยังคงเป็น canonical สำหรับ infrastructure — ADR-024/025/026/027 เพิ่ม runtime layer; ADR-028 ปรับ Migration Pipeline; ADR-033 จัดระบบโมเดลและ OCR

## สิ่งที่ควรทำในอนาคต (Future Maintenance & Security Tasks)

- **Axios Dependency**: ได้รับการอัปเกรด dependencies เป็นรุ่นปลอดภัยล่าสุดและแก้ไขช่องโหว่ Prototype Pollution เรียบร้อยแล้ว (pnpm audit CLEAN 100%)
- **ความปลอดภัยของ Sidecar และ GPU**: นำระบบ API Key Header verification (`X-API-Key`) และกลไก Unload model (`keep_alive: 0`) มาประยุกต์ใช้อย่างสมบูรณ์บนเครื่องประมวลผลโลคัล Desk-5439
