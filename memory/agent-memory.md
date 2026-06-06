<!-- File: memory/agent-memory.md -->
<!-- Change Log
- 2026-05-23: Initialized long-term memory system with core project rules, Windows environment settings, and constraints.
- 2026-05-23 (Session 2): N8N Workflow Refactor — QuizMe session, decisions locked, สร้าง CONTEXT-N8N-Refactor.md, สร้าง n8n.workflow.v2.json (ADR-023A compliant), อัพเดต 03-05 และ 03-06.
- 2026-05-24: เพิ่ม sections: Known Commands, Current Decisions, Do/Don't Quick Reference, Environment & Services, Recent Rollouts.
- 2026-05-25 (Session 3): แก้ไขบัค `tempAttachmentId` ใน Migration Queue — เปลี่ยนจาก Integer ที่ไม่มีอยู่จริงเป็น UUID string (ADR-019), อัปเดต DTO, Service UUID-to-INT resolution, และ n8n.workflow.v2.json.
- 2026-05-25 (Session 4): Normalize migration error logging ตาม AGENTS.md — แก้ n8n `Log Error to CSV`/`Log Error to DB`, harden backend `logError()`, เพิ่ม `job_id` ใน migration_errors SQL/delta, และเพิ่ม regression test.
- 2026-05-25 (Session 5): N8N Workflow Debug — แก้ Submit AI Job (jsonBody serialization + RBAC permission gap) และเพิ่ม checksum-based dedup ใน FileStorageService.upload().
- 2026-05-25 (Session 6): AI Model Management (ADR-027) — เพิ่มระบบเลือกโมเดล AI แบบไดนามิกผ่าน AI Admin Console: สร้าง `ai_available_models` table + entity, extend `AiSettingsService` ด้วย methods CRUD โมเดล, add REST endpoints, update frontend UI ด้วย Select dropdown และ model list management, update `OllamaService` ใช้ DB-configured model แทน ENV เท่านั้น.
- 2026-05-25 (Session 7): PaddleOCR Sidecar setup บน Desk-5439 — สร้าง FastAPI sidecar (port 8765) รองรับ `/ocr` + `/normalize`, แก้ AggregateError ใน ocr.service.ts, เพิ่ม path remapping (`OCR_SIDECAR_UPLOAD_BASE`), CIFS volume mount จาก QNAP.
- 2026-05-30: เพิ่ม system memories ที่หายไป — QNAP SSH Key Authentication, TransformInterceptor double registration, ADR-021 Transmittals/Circulation integration, Correspondence detail fixes, Playwright E2E setup, Tag/Contract UUID fixes.
- 2026-05-27: Context-Aware Prompts & DB CC Typo Cleanup (ADR-030) — นำเสนอการผูก Master Data เข้ากับ Prompt Extraction, ออกแบบ JSON Context-Aware configuration, อัปเดต Entity/DTOs, ออกแบบ JSON format ผู้รับเป็น Object Array ป้องกันบัค และแก้ whitespace typo 'CC ' ในฐานข้อมูล
- 2026-05-30 (Session 8): OCR Engine Migration — เปลี่ยนจาก PaddleOCR เป็น Tesseract OCR เพื่อแก้ปัญหา SIGILL (Illegal Instruction) บน CPU เก่าที่ไม่รองรับ AVX: อัปเดต requirements.txt (ลบ paddlepaddle/paddleocr, เพิ่ม pytesseract), app.py (เปลี่ยนใช้ pytesseract, OCR_LANG=tha+eng), Dockerfile (ติดตั้ง tesseract-ocr + ภาษาไทย/อังกฤษ), docker-compose.yml (OCR_LANG=tha+eng, ลบ paddleocr_models volume), backend ocr.service.ts (เปลี่ยน comment/error message), frontend OcrSandboxPromptManager.tsx (เปลี่ยน Badge text)
- 2026-05-30 (Session 10): OCR Sandbox Two-Step Flow (ADR-030/231) — แยก OCR Sandbox เป็น 2 steps: Step 1 OCR-only → Step 2 AI Extraction. Backend: เพิ่ม job types sandbox-ocr-only และ sandbox-ai-extract, processors processSandboxOcrOnly/processSandboxAiExtract, endpoints POST /ai/admin/sandbox/ocr และ /ai/admin/sandbox/ai-extract, method findByVersion ใน AiPromptsService. Frontend: เพิ่ม methods submitSandboxOcr/submitSandboxAiExtract ใน adminAiService, refactor OcrSandboxPromptManager.tsx ให้มี 2-step UI พร้อม states sandboxStep/ocrResult/selectedPromptVersion, handlers handleStep1Ocr/handleStep2AiExtract/handleResetSandbox. Schema Fix: สร้าง delta SQL 2026-05-30-add-ai-prompts-publicId.sql เพื่อเพิ่ม publicId column ใน ai_prompts table (ADR-019 compliance).
- 2026-05-30 (Session 11): Typhoon OCR & LLM Integration (ADR-032) — พัฒนาการใช้งานโมเดลภาษาไทยผสมอังกฤษ Typhoon OCR-3B ร่วมกับ Tesseract OCR แบบ Dynamic พร้อมระบบ caching 24 ชม., VRAM Monitor ป้องกัน GPU OOM และระบบ fallback 5s เมื่อโมเดลมีปัญหา และการสลับและบริหารจัดการ LLM โมเดลหลักแบบ Dynamic ในระบบ AI Model Management ของ Next.js frontend
- 2026-06-03: Thai-Optimized AI Model Stack (ADR-034) — เปลี่ยนโมเดลหลักเป็น `typhoon2.5-np-dms:latest` + `typhoon-np-dms-ocr:latest` (สำหรับ OCR, keep_alive:0); เพิ่ม model switching logic ใน ai-batch processor; เพิ่ม static constants ใน AiSettingsService; สร้าง SQL delta สำหรับ ai_available_models
- 2026-06-05 (Session 12): Typhoon OCR Prompt Cleaning — แก้ปัญหา prompt/instruction ติดมาใน Typhoon OCR output โดยย้าย instruction จาก Modelfile SYSTEM มา prompt ใน app.py แทน ลบ clean_typhoon_output() filter downstream และแก้ git conflict โดยเลือกเวอร์ชัน local (ไม่มี SYSTEM instruction)
- 2026-06-05 (Session 13): OCR Sandbox Step 2 AI Extraction Bug Fix — แก้ปัญหา "Not Found Exception" ใน Step 2 AI Extraction โดยเพิ่ม conditional check ใน processSandboxExtract และ processSandboxAiExtract เพื่อส่ง undefined แทน 'default' projectPublicId ไปยัง resolveContext (เพราะ 'default' ไม่ใช่ project UUID ที่ถูกต้อง). Frontend: เพิ่ม startPolling method ใน useSandboxRun hook เพื่อรองรับ 2-step flow และแก้ OcrSandboxPromptManager.tsx ให้ใช้ startPolling แทน custom polling logic. Model Switching Analysis: Production OCR Extraction มี model switching (unload main → load OCR model → run → reload main) เพื่อประหยัด VRAM แต่ Sandbox AI Extraction ไม่มี model switching เพราะใช้ main model สกัด metadata จาก OCR text ที่มาจาก Step 1 (Tesseract OCR sidecar) แล้ว ไม่ใช่ OCR model. OCR Sidecar Location: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/ (ใช้ Tesseract OCR ไม่ใช่ PaddleOCR ตั้งแต่ 2026-05-30). Model Config: เพิ่ม SYSTEM prompt ภาษาไทยใน typhoon2.5-np-dms.model.md และ typhoon2.5-np-dms.main-model.md สำหรับ LCBP3 DMS context
- 2026-06-05 (Session 14): RAG Pipeline Enhancements (Spec 234 / ADR-035) — แก้ compile blockers 4 จุดหลักหลังเปลี่ยน contract ของ Embedding/Qdrant, เพิ่ม `projectPublicId` ใน vector deletion path, ย้าย dashboard RAG page ไป `/ai/rag/*`, ถอด legacy frontend RAG hook/components, mark legacy `/rag/*` deprecated, และสุดท้ายถอด `RagModule` + `rag.controller.ts` ออกจาก runtime พร้อมอัปเดต ADR-035
- 2026-06-05 (Session 15): Feature 234 RAG Pipeline สมบูรณ์ — implement BGE-M3 embedding (dense 1024 + sparse), BGE-Reranker-Large, Semantic Chunking (typhoon2.5 + `<chunk topic>` tags + fallback), Hybrid Qdrant schema (drop+recreate), workflow hook `syncStatus()` → `enqueueRagPrepare()`, processRagPrepare pipeline ใน ai-batch.processor; แก้ CRITICAL 2 ประเด็นจาก speckit-analyze; ผ่าน speckit-tester (19/19 tests), speckit-validate (15/15 FR, ทุก SC); ปิด Gap ทั้ง 2 รายการ (jobId dedup confirmed + integration test 9 tests); สร้าง validation-report.md ใน specs/200-fullstacks/234-rag-pipeline-enhancements/
- 2026-06-06: เพิ่ม MCP MariaDB Tools section ใน memory/agent-memory.md, AGENTS.md, และ rule files (.agents/rules/08-development-flow.md, .devin/rules/08-development-flow.md) — รวม 8 tools (test_connection, show_databases, show_tables, describe_table, query, insert, update, delete), การใช้งานร่วมกับ Development Flow, และข้อควรระวังเรื่อง DDL operations
- 2026-06-06: เพิ่ม MCP Memory Tools section ใน memory/agent-memory.md — รวม 9 tools (create_entities, create_relations, add_observations, delete_entities, delete_relations, delete_observations, open_nodes, read_graph, search_nodes), การใช้งานร่วมกับ Development Flow สำหรับจัดการ Knowledge Graph และ Long-term Memory
-->

# 🧠 Agent Long-term Project Memory

> **Project:** NAP-DMS (LCBP3) — Laem Chabang Port Phase 3 Document Management System
> **Version:** 1.9.9 (Last Synced: 2026-06-03)
> **Stack:** NestJS 11 + Next.js 16 + TypeScript + MariaDB 11.8 + Redis + BullMQ + Elasticsearch + Ollama (on-prem AI)

> [!IMPORTANT]
> **Project memory นี้ต้องใช้งานภายใต้ `AGENTS.md` เสมอ**
>
> - ให้ใช้ `AGENTS.md` เป็นกฎหลักก่อน memory ทุกครั้ง
> - ถ้า memory เก่าหรือ session note ขัดกับ `AGENTS.md` ให้ยึด `AGENTS.md`
> - งาน schema ต้องทำตาม ADR-009 ผ่าน SQL/delta เท่านั้น
> - งาน UUID/Public API ต้องทำตาม ADR-019 โดยใช้ `publicId` และห้าม `parseInt()` บน UUID
> - งาน n8n / AI migration ต้องอยู่ในขอบเขต ADR-023A และ mutation ต้องมี `Idempotency-Key`

---

## 🧭 1. กฎการรันคำสั่งและการทำงานบนระบบ (OS Rules & Sandbox Constraints)

> [!IMPORTANT]
> **ระบบรันอยู่บน Windows OS**
>
> - ห้ามใช้คำสั่ง `bash` หรือคำสั่งของ Linux โดยเด็ดขาด
> - คำสั่งทุกประเภทที่จะส่งให้ผู้ใช้รันหรือรันผ่าน Terminal ต้องเป็น **PowerShell** หรือ **CMD** เท่านั้น
> - ห้ามใช้คำสั่ง `cd` ในการสลับ Directory ให้ระบุพารามิเตอร์ `Cwd` ใน Tool ตรง ๆ

---

## 🔴 2. กฎเหล็กระดับ Tier 1 (CI Blocker - ห้ามละเมิดเด็ดขาด)

### 🆔 2.1 กลยุทธ์ UUID (ADR-019)

- คีย์หลักในฐานข้อมูล (Internal PK) เป็น `INT AUTO_INCREMENT` ส่วนคีย์สาธารณะใน API/URL (Public API) จะใช้ **UUIDv7** เท่านั้น
- ฟิลด์คีย์สาธารณะชื่อ `publicId: string` จะถูกส่งออกไปใน API โดยตรง
- ❌ **ห้ามใช้** `parseInt()`, `Number()`, หรือเครื่องหมายบวก `+` บน UUID (เช่น `parseInt(projectId)` จะคำนวณผิดพลาดทันที)
- ❌ **ห้ามใช้** fallback ในลักษณะ `id ?? ''` ในฝั่ง Frontend ให้ใช้ `publicId` เท่านั้น

### 🛡️ 2.2 สิทธิ์การใช้งานและความปลอดภัย (RBAC & Auth)

- API ทุกตัวที่เป็นการปรับปรุงข้อมูล (Mutation: POST/PUT/PATCH) ต้องใช้ **CASL Guard** ตรวจสอบสิทธิ์ 4 ระดับ (RBAC Matrix) เสมอ
- API สำหรับการแก้ไขข้อมูล (POST/PUT/PATCH) ต้องตรวจสอบและยืนยัน **`Idempotency-Key`** ใน HTTP Header ทุกครั้ง
- การเข้ารหัสรหัสผ่านใช้ `bcrypt` ที่ระดับ 12 salt rounds เสมอ

### 💾 2.3 การปรับแต่งและเปลี่ยนแปลง Schema (ADR-009)

- ❌ **ห้ามใช้ TypeORM migrations ในการอัปเดต Schema** บนสภาพแวดล้อม Production
- ให้ใช้วิธี **แก้ไขไฟล์ SQL โครงสร้างหลักตรง ๆ** ใน `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` หรือเพิ่มการทำงานในโฟลเดอร์ `deltas/*.sql` เท่านั้น

### 🏎️ 2.4 ป้องกัน Race Conditions ในเลขเอกสาร (ADR-002)

- การจัดสรรและจองเลขที่เอกสารใหม่ (Document Numbering) ต้องใช้ **Redis Redlock** ควบคู่กับ TypeORM `@VersionColumn` เสมอ ห้ามเขียนตัวนับ (Counter) ในฝั่ง Application เดี่ยว ๆ

### 🤖 2.5 ขอบเขตและการแยกส่วน AI (ADR-023/023A)

- **Ollama (AI Inference) ต้องทำงานบน Admin Desktop เท่านั้น** ห้ามรันบน Server หรือ Docker ใน Production
- AI ห้ามเชื่อมต่อและเข้าถึง Database หรือ Storage โดยตรง (ต้องผ่าน DMS API เท่านั้น)
- โมเดลที่ใช้: `typhoon2.5-np-dms:latest` (Main LLM, ADR-034) + `typhoon-np-dms-ocr:latest` (OCR, keep_alive:0) + **`BGE-M3`** (Embeddings Dense 1024 + Sparse, ADR-035) + **`BGE-Reranker-Large`** (Reranker, ADR-035) — `nomic-embed-text` ถูกแทนที่แล้ว
- การทำงานแบบ Background Job หรือ Inference ที่ใช้เวลานานต้องสั่งงานผ่าน **BullMQ** (คิว `ai-realtime` และ `ai-batch`)
- ข้อมูลผลลัพธ์จาก AI ทั้งหมดต้องผ่านการตรวจสอบความถูกต้องโดยมนุษย์ (Human-in-the-loop) เสมอ

---

## 🏷️ 3. Domain Terminology (คำศัพท์เฉพาะของระบบ DMS)

ห้ามใช้คำศัพท์ทั่วไป ให้ใช้คำศัพท์ตามสารบัญหลักของโปรเจกต์เสมอ:

| คำศัพท์ที่ถูกต้อง (✅ Use) | คำศัพท์ที่ห้ามใช้ (❌ Don't Use) | คำอธิบายภาษาไทย                                |
| :------------------------- | :------------------------------- | :--------------------------------------------- |
| **Correspondence**         | Letter, Communication            | จดหมาย/เอกสารติดต่อสื่อสาร (ครอบคลุมทุกประเภท) |
| **RFA**                    | Approval Request                 | เอกสารขออนุมัติ (Request for Approval)         |
| **Transmittal**            | Delivery Note, Cover Letter      | เอกสารนำส่งแบบและเอกสาร                        |
| **Circulation**            | Distribution, Routing            | ใบเวียนเอกสารภายในหน่วยงาน                     |
| **Shop Drawing**           | Construction Drawing             | แบบก่อสร้างจริง                                |
| **Contract Drawing**       | Design Drawing, Blueprint        | แบบคู่สัญญา                                    |
| **Workflow Engine**        | Approval Flow, Process Engine    | ระบบควบคุมและเปลี่ยนสถานะเอกสาร                |
| **Document Numbering**     | Document ID, Auto Number         | ระบบออกเลขที่เอกสารอัตโนมัติ                   |

---

## ⌨️ 4. Known Commands (PowerShell — Windows Only)

> [!NOTE]
> ห้ามใช้ bash/Linux commands ทุกอย่างต้องเป็น **PowerShell** หรือ **CMD** เท่านั้น

### Dev Servers

```powershell
# Backend (NestJS) — port 3001
npm run start:dev                        # รันจาก e:\np-dms\lcbp3\backend

# Frontend (Next.js) — port 3000
npm run dev                              # รันจาก e:\np-dms\lcbp3\frontend
```

### Build & Type Check

```powershell
# Backend
npm run build                            # tsc compile
npm run lint                             # ESLint

# Frontend
npm run build                            # Next.js build
npx tsc --noEmit                         # Type check only
```

### Tests

```powershell
# Backend Unit Tests
npm run test                             # Jest all
npm run test -- --testPathPattern=<name> # เฉพาะ file
npm run test:cov                         # Coverage report

# Frontend Unit Tests
npm run test                             # Vitest

# E2E
npx playwright test                      # รันจาก e:\np-dms\lcbp3\frontend
```

### Database & Services

```powershell
# Docker (รันจาก root หรือ backend)
docker compose up -d                     # Start all services
docker compose logs -f backend           # Tail backend logs
docker compose ps                        # Check status
```

---

## 🏛️ 5. Current Decisions (Locked)

> การตัดสินใจเหล่านี้ **ไม่สามารถเปลี่ยนแปลงได้** โดยไม่ได้รับ Explicit Approval

| ID  | Decision                                                                                    | ADR       |
| --- | ------------------------------------------------------------------------------------------- | --------- |
| D1  | n8n = Migration Phase orchestrator เท่านั้น — ห้ามทำ New Correspondence pipeline ผ่าน n8n   | ADR-023A  |
| D2  | New Correspondence → BullMQ `ai-realtime` queue โดยตรง (ไม่ผ่าน n8n)                        | ADR-023A  |
| D3  | n8n ต้อง call `POST /api/ai/jobs` (DMS Backend) เท่านั้น — ห้าม call Ollama/Qdrant โดยตรง   | ADR-023A  |
| D4  | Excel metadata ส่งไปพร้อม AI job เป็น context (docNumber, title, sender ฯลฯ)                | Session 2 |
| D5  | Tag suggestion ใช้ทาง C: แนะนำ existing tags + สร้างใหม่ได้ถ้าไม่มี (`isNew: true` flag)    | Session 2 |
| D6  | Editable Review Form: AI pre-fill → user approve/edit → submit (human-in-the-loop ทุกครั้ง) | ADR-023   |
| D7  | UUID Strategy: `publicId` (UUIDv7) เท่านั้นสำหรับ Public API — INT PK ต้อง `@Exclude()`     | ADR-019   |
| D8  | Schema changes: แก้ SQL โดยตรง + เพิ่ม `deltas/*.sql` — ห้ามใช้ TypeORM migration files     | ADR-009   |
| D9  | Qdrant search ต้องส่ง `projectPublicId` เป็น mandatory parameter ทุกครั้ง (compile-time)    | ADR-023A  |
| D10 | AI model stack: `typhoon2.5-np-dms:latest` (Main LLM) + `typhoon-np-dms-ocr:latest` (OCR, keep_alive:0) + `BGE-M3` (Dense 1024 + Sparse Embedding) + `BGE-Reranker-Large` (Reranker) on Admin Desktop — `nomic-embed-text` ถูกแทนที่แล้ว (ADR-034/035) | ADR-034/035 |
| D11 | RAG Embedding trigger: `syncStatus()` → `enqueueRagPrepare()` เมื่อ status ≠ DRAFT; jobId = `rag-prepare:{documentPublicId}:{revisionNumber}` (BullMQ dedup); delete-before-upsert ทุกครั้ง | ADR-035 |
| D12 | Qdrant collection `lcbp3_vectors` = Hybrid schema: `bge_dense` (1024 dims, Cosine) + `bge_sparse` (SPLADE); payload indexes: `project_public_id` (tenant), `doc_public_id`, `status_code`, `doc_type` | ADR-035 |

---

## ✅❌ 6. Do / Don't Quick Reference

| ✅ Do                                                          | ❌ Don't                                            |
| -------------------------------------------------------------- | --------------------------------------------------- |
| ใช้ `publicId` (UUID string) ใน API/URL                        | `parseInt()` / `Number()` บน UUID                   |
| ใช้ `RequestWithUser` ใน NestJS controller                     | `req: any` ใน controller                            |
| ส่ง notification/email ผ่าน BullMQ                             | ส่ง email แบบ inline ใน service                     |
| เขียน schema changes ใน `deltas/*.sql`                         | สร้าง TypeORM migration files                       |
| ใช้ NestJS `Logger` แทน `console.log`                          | `console.log` ใน committed code                     |
| ตรวจสอบ table/column ใน `schema-02-tables.sql` ก่อนเขียน query | คาดเดาชื่อ column โดยไม่ตรวจสอบ schema              |
| ใช้ CASL Guard กับทุก mutation endpoint                        | สร้าง API ที่ไม่มี auth guard                       |
| ผ่าน `StorageService` ทุกครั้งที่จัดการไฟล์                    | ทำ file operation โดยตรงโดยไม่ผ่าน `StorageService` |
| ใช้คำสั่ง PowerShell/CMD บน Windows                            | ใช้ bash/Linux commands บน Windows                  |
| Human-in-the-loop validate ก่อน apply AI output                | ใช้ AI output โดยตรงโดยไม่ผ่าน human review         |
| เขียน comment ภาษาไทย, code identifier ภาษาอังกฤษ              | คำ comment ภาษาอังกฤษ หรือ identifier ภาษาไทย       |
| ใส่ file header `// File: path/filename` ทุกไฟล์ TypeScript    | ไฟล์ที่ไม่มี file header                            |

---

## 🌐 7. Environment & Services

| Service           | Local URL / Port              | Production                | Notes                                |
| ----------------- | ----------------------------- | ------------------------- | ------------------------------------ |
| **Backend API**   | `http://localhost:3001`       | QNAP `192.168.10.8`       | NestJS — `/api` prefix               |
| **Frontend**      | `http://localhost:3000`       | QNAP `192.168.10.8`       | Next.js                              |
| **MariaDB**       | `localhost:3307`              | QNAP internal             | DB: `lcbp3`, root via docker         |
| **Redis**         | `localhost:6379`              | QNAP internal             | BullMQ + session store               |
| **Ollama**        | `http://192.168.10.100:11434` | Admin Desktop (Desk-5439) | typhoon2.5-np-dms:latest (main) + typhoon-np-dms-ocr:latest (OCR, keep_alive:0) |
| **Qdrant**        | `http://localhost:6333`       | Admin Desktop (Desk-5439) | Vector DB — requires projectPublicId |
| **OCR Sidecar**   | `http://192.168.10.100:8765`  | Admin Desktop (Desk-5439) | Tesseract (fallback) / Typhoon OCR-3B (primary) + BGE-M3 `/embed` + BGE-Reranker `/rerank` |
| **Gitea**         | `https://git.np-dms.work`     | QNAP `192.168.10.8`       | Source + CI/CD                       |
| **Gitea Runner**  | ASUSTOR `192.168.10.9`        | —                         | CI runner                            |

### Key Environment Variables (ตรวจสอบใน `docker-compose.yml`)

```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
REDIS_HOST, REDIS_PORT
JWT_SECRET, JWT_EXPIRES_IN
OLLAMA_BASE_URL (ชี้ไป Admin Desktop)
QDRANT_URL
```

---

## � 8. MCP MariaDB Tools

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

## 🧠 9. MCP Memory Tools

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

---

## 🚀 10. Recent Rollouts

| วันที่     | Version | รายการ                                                                                               | สถานะ                         |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| 2026-05-23 | v1.9.6  | Specs reorganization (`100/200/300-*` folders), AGENTS.md v1.9.6 update                              | ✅ Complete                   |
| 2026-05-23 | v1.9.6  | N8N Workflow v2 (`n8n.workflow.v2.json`) — ADR-023A compliant, ลบ Ollama direct                      | ⏳ Pending import to n8n UI   |
| 2026-05-24 | v1.9.6  | AGENTS.md Project Memory Override rule (Windsurf / Antigravity / Codex)                              | ✅ Complete                   |
| 2026-05-25 | v1.9.6  | Migration Queue attachment UUID fix — DTO + Service + n8n.workflow.v2.json (Session 3)               | ✅ Complete (tsc verified)    |
| 2026-05-25 | v1.9.6  | Migration error normalization + `job_id` logging — workflow + backend + SQL/delta (Session 4)        | ✅ Complete                   |
| 2026-05-25 | v1.9.6  | PaddleOCR Sidecar บน Desk-5439 — FastAPI `/ocr`+`/normalize`, CIFS mount, path remapping (Session 7) | ✅ Running                    |
| 2026-05-27 | v1.9.7  | Context-Aware Prompt Templates & DB CC Whitespace Cleanup (ADR-030) (Session 9)                      | ✅ Complete (v1.9.7 main)     |
| 2026-05-30 | v1.9.7  | OCR Engine Migration — PaddleOCR → Tesseract (Session 8)                                             | ✅ Complete (pending rebuild) |

---

## 🔄 9. สถานะและประวัติการทำงาน (Latest Session Progress)

### Session 1 — 2026-05-23 (Specs Reorganization)

- Reorganize โครงสร้างโฟลเดอร์ `specs/` สำเร็จ (`100-Infrastructures`, `200-fullstacks`, `300-others`)
- อัปเดตกฎ `AGENTS.md` และ `GEMINI.md` ให้ตรงกับมาตรฐานใหม่
- ริเริ่มระบบ `memory/agent-memory.md`

### Session 2 — 2026-05-23 (N8N Workflow Refactor)

#### Decisions ที่ Lock แล้ว (จาก QuizMe Session)

| #       | Decision                                                                             |
| ------- | ------------------------------------------------------------------------------------ |
| S1      | **n8n = Migration only** — New Correspondence ใช้ Backend pipeline (BullMQ)          |
| S2      | New Correspondence → BullMQ `ai-realtime` (ไม่ผ่าน n8n)                              |
| S3      | n8n call `POST /api/ai/jobs` (Backend) แทน Ollama direct (ADR-023A)                  |
| PA      | Excel metadata (`docNumber`, `title`, `sender`, etc.) ส่งไปพร้อม AI job เป็น context |
| PB-Tags | Tag suggestion ทาง C — แนะนำ existing + สร้าง tag ใหม่ได้ถ้าไม่มี (`isNew` flag)     |
| PB-UX   | Editable form pre-filled ด้วย AI suggestions — user approve/edit ก่อน submit         |

#### Endpoint ที่ Verified แล้ว

- `POST /api/ai/jobs` (`type: migrate-document`) — **พร้อมใช้งานแล้ว** (verified 2026-05-23)
- `GET /api/ai/jobs/:jobId` — polling endpoint พร้อม
- `POST /api/storage/upload` — two-phase upload พร้อม

#### ไฟล์ที่สร้าง/แก้ไข

| ไฟล์                                                           | การเปลี่ยนแปลง                                                 |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| `specs/03-Data-and-Storage/CONTEXT-N8N-Refactor.md`            | ✅ สร้างใหม่ — context doc สำหรับ implement                    |
| `specs/03-Data-and-Storage/n8n.workflow.v2.json`               | ✅ สร้างใหม่ — ADR-023A compliant workflow                     |
| `specs/03-Data-and-Storage/03-05-n8n-migration-setup-guide.md` | ✅ อัพเดต v1.9.0 — ลบ Ollama direct, เพิ่มขั้นตอน update token |
| `specs/03-Data-and-Storage/03-06-migration-business-scope.md`  | ✅ อัพเดต — Gate #1 blocker → Verified 2026-05-23              |

#### สาระสำคัญของ n8n.workflow.v2.json

**Nodes ที่ลบ (ADR-023A violations):** `Ollama AI Analysis`, `Build AI Prompt`, `Extract PDF Text` (Tika), `Check/Update Fallback State`, `Import to Backend`, `Upsert Tags`, `Link Tags`

**Nodes ใหม่:** `Validate Token` → `Upload PDF to Backend` → `Build AI Job Payload` → `Submit AI Job` → `Poll AI Job Status`

**Flow สรุป:**

```
Form Trigger → Set Config → Health/Token Check → Fetch Master Data
→ File Mount Check → Read Excel → Read Checkpoint
→ [Per Record: File Validate → Upload PDF → Submit AI Job → Poll → Parse/Route]
    → Auto/Flagged → migration_review_queue
    → Rejected → CSV Log
    → Error → CSV + DB Log
→ Save Checkpoint → Delay → Loop
```

### Session 3 — 2026-05-24 (Migration Queue Attachment UUID Bug Fix)

#### ปัญหาที่พบ (Root Cause)

ไฟล์ `n8n.workflow.v2.json` (โหนด `Insert Review Queue`) ส่งค่า `tempAttachmentId` โดยใช้ `{{parseInt($json.attachmentId)}}` ซึ่งพยายามแปลง UUID string เป็นตัวเลข ผลลัพธ์คือค่า `NaN` หรือตัวเลขที่ผิดพลาด (เช่น `"0195..."` → `19`) ทำให้คอลัมน์ `temp_attachment_id` ใน `migration_review_queue` เป็น `NULL` เสมอ — ละเมิด ADR-019 Tier 1 Blocker

#### การแก้ไข (Fix)

| ไฟล์                                                        | การเปลี่ยนแปลง                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `backend/src/modules/ai/dto/migration-checkpoint.dto.ts`    | ปรับ `tempAttachmentId` เป็น `@IsOptional()` รองรับทั้ง UUID string และ Integer PK |
| `backend/src/modules/ai/ai-migration-checkpoint.service.ts` | เพิ่ม UUID→INT resolution: `SELECT id FROM attachments WHERE uuid = ? LIMIT 1`     |
| `specs/03-Data-and-Storage/n8n.workflow.v2.json`            | เปลี่ยนส่ง `temp_attachment_public_id` (UUID string) แทน `parseInt(...)` ที่ผิด    |

#### Pattern ที่ตกลง (Locked)

```
n8n ส่ง: { tempAttachmentId: "019505a1-7c3e-7000-..." }  ← UUID string
Backend รับ: ตรวจสอบประเภท → ถ้าเป็น string → query DB → ได้ INT id จริง
DB บันทึก: migration_review_queue.temp_attachment_id = <INT>  ← ถูกต้อง
```

#### Verification

- `npx tsc --noEmit` — ✅ ผ่าน ไม่มี type error
- ตรวจสอบ logic ใน Service แล้ว ไม่มีการเขียนทับ `tempAttachmentId` ด้วย `undefined` (guard check แล้ว)

### Session 4 — 2026-05-25 (Migration Error Normalization ตาม AGENTS.md) ← **ล่าสุด**

#### ปัญหาที่พบ (Root Cause)

- `Log Error to CSV` และ `Log Error to DB` ใน `n8n.workflow.v2.json` ส่ง `error_type` บางค่าไม่ตรง enum ของ `migration_errors`
- ค่าที่พบจริงและต้อง normalize: `AI_JOB_FAILED`, `PARSE_ERROR`, `TOKEN_EXPIRED`
- backend `AiMigrationCheckpointService.logError()` เดิม insert ค่า `dto.errorType` ตรง ๆ ทำให้เสี่ยง DB enum reject
- ตาราง `migration_errors` เดิมไม่มี `job_id` แม้ workflow/DTO จะมี `jobId` อยู่แล้ว ทำให้ trace กลับไป BullMQ job ไม่ครบ

#### การแก้ไข (Fix)

| ไฟล์                                                                                   | การเปลี่ยนแปลง                                                                |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `specs/03-Data-and-Storage/n8n.workflow.v2.json`                                       | normalize `error_type`, `document_number`, `error`, `job_id` ก่อนเขียน CSV/DB |
| `backend/src/modules/ai/ai-migration-checkpoint.service.ts`                            | map/validate `errorType` ซ้ำก่อน insert และเพิ่ม `job_id` ใน SQL insert       |
| `backend/src/modules/migration/entities/migration-error.entity.ts`                     | เพิ่ม field `jobId?: string`                                                  |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-migration.sql`                                 | เพิ่มคอลัมน์ `job_id VARCHAR(100) NULL` และ index                             |
| `specs/03-Data-and-Storage/deltas/2026-05-22-drop-migration-tables.rollback.sql`       | อัปเดต table definition ของ `migration_errors` ให้มี `job_id`                 |
| `specs/03-Data-and-Storage/deltas/2026-05-24-add-migration-errors-job-id.sql`          | เพิ่ม delta สำหรับ add `job_id`                                               |
| `specs/03-Data-and-Storage/deltas/2026-05-24-add-migration-errors-job-id.rollback.sql` | เพิ่ม rollback สำหรับ drop `job_id`                                           |
| `backend/src/modules/ai/ai-migration-checkpoint.service.spec.ts`                       | เพิ่ม regression tests สำหรับ error normalization + `job_id`                  |

#### Mapping ที่ Lock แล้ว

```
AI_JOB_FAILED -> API_ERROR
PARSE_ERROR -> AI_PARSE_ERROR
TOKEN_EXPIRED -> API_ERROR
unsupported value -> UNKNOWN
```

#### กฎใช้งานต่อไป

- ให้ถือ enum ของ `migration_errors.error_type` เป็น source of truth เสมอ
- workflow ต้อง normalize ก่อนส่งเข้า backend และ backend ต้อง normalize ซ้ำอีกชั้น
- ห้ามพึ่ง DB enum reject เป็น validation mechanism
- การเพิ่มคอลัมน์ `job_id` ต้องทำผ่าน SQL/delta ตาม ADR-009 เท่านั้น

#### Verification

- workflow normalization assertion — ✅ ผ่าน
- `pnpm --filter backend build` — ✅ ผ่าน
- `pnpm --filter backend test -- --runTestsByPath src/modules/ai/ai-migration-checkpoint.service.spec.ts` — ✅ ผ่าน
- regression seam ที่เพิ่มยืนยัน:
  - `AI_JOB_FAILED` map เป็น `API_ERROR`
  - unsupported error type fallback เป็น `UNKNOWN`

---

### Session 5 — 2026-05-25 (N8N Submit AI Job Debug + Upload Dedup)

#### ปัญหาที่พบ (Root Cause)

**Bug 1: `Submit AI Job` → 400 Bad Request**

- n8n HTTP Request node `typeVersion: 4.1` เมื่อ `specifyBody: "json"` และ `jsonBody` เป็น expression ที่ return **object** → n8n ส่ง body เป็น `"[object Object]"` แทน JSON string
- แก้ด้วย `JSON.stringify($json.submit_payload)`

**Bug 2: `Submit AI Job` → 403 Forbidden**

- `migration_bot` (user_id=5, role_id=1/Superadmin) ไม่มี `ai.suggest` ใน `role_permissions`
- Root cause: Seed script `INSERT INTO role_permissions SELECT 1, permission_id FROM permissions WHERE is_active = 1` รันก่อน `ai.*` permissions (id 181-186) ถูก insert เข้า `permissions` table
- แก้ด้วย delta SQL grant ai.\* ให้ role_id=1

**Bug 3: Upload ซ้ำเมื่อ n8n retry**

- `FileStorageService.upload()` เดิมไม่มี dedup → ทุก retry สร้าง orphan temp attachment ใหม่
- แก้ด้วย checksum-based dedup: query หา temp record ที่มี checksum+userId เดิมและยังไม่หมดอายุ → คืน record เดิมแทน

#### การแก้ไข (Fix)

| ไฟล์                                                                                          | การเปลี่ยนแปลง                                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `specs/03-Data-and-Storage/n8n.workflow.v2.json`                                              | `jsonBody` เปลี่ยนเป็น `JSON.stringify($json.submit_payload)` |
| `specs/03-Data-and-Storage/deltas/2026-05-25-grant-ai-permissions-to-superadmin.sql`          | INSERT IGNORE ai.\* permissions สำหรับ role_id=1 (Superadmin) |
| `specs/03-Data-and-Storage/deltas/2026-05-25-grant-ai-permissions-to-superadmin.rollback.sql` | Rollback DELETE สำหรับ delta ข้างบน                           |
| `backend/src/common/file-storage/file-storage.service.ts`                                     | เพิ่ม checksum dedup ใน `upload()` ก่อน write file            |

#### กฎที่ Lock แล้ว

- `jsonBody` ใน n8n HTTP Request `typeVersion >= 4.1` ต้องใช้ `JSON.stringify(...)` เมื่อ `specifyBody: "json"` และค่าเป็น object
- ทุกครั้งที่เพิ่ม permission ใหม่ใน `permissions` table ต้อง grant ให้ Superadmin (role_id=1) ด้วยทันที — ห้ามปล่อยให้ขาดหาย
- `FileStorageService.upload()` เป็น idempotent ผ่าน SHA-256 checksum + userId + expiresAt

#### Verification ที่ยังต้องทำ

- รัน delta SQL ใน MariaDB (ถ้ายังไม่รัน): `2026-05-25-grant-ai-permissions-to-superadmin.sql`
- Import `n8n.workflow.v2.json` ใหม่เข้า n8n UI
- `pnpm --filter backend test -- file-storage` — ยืนยัน checksum dedup

---

### Session 7 — 2026-05-25 (PaddleOCR Sidecar Setup) ← **ล่าสุด**

#### สิ่งที่ทำ

- แก้ `AggregateError` (empty message) ใน `ocr.service.ts` — wrap เป็น Error พร้อม context ที่ชัดเจน
- สร้าง PaddleOCR + PyThaiNLP FastAPI sidecar รันบน Desk-5439 (Windows 10/11, Docker Desktop WSL2)
- เพิ่ม path remapping `remapPath()` ใน `OcrService` — แปลง `/app/uploads/...` → `/mnt/uploads/...`

#### ไฟล์ที่สร้าง/แก้ไข

| ไฟล์                                                                                        | การเปลี่ยนแปลง                                                                  |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/Dockerfile`         | ✅ สร้างใหม่ — Python 3.10 slim, ลบ pre-download step (segfault)                |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py`             | ✅ สร้างใหม่ — FastAPI: `/health`, `/ocr` (PaddleOCR), `/normalize` (PyThaiNLP) |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/requirements.txt`   | ✅ สร้างใหม่ — `numpy<2.0` ต้องอยู่ก่อน paddlepaddle (ABI fix)                  |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/docker-compose.yml` | ✅ สร้างใหม่ — CIFS volume mount + named volume สำหรับ model cache              |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/docker-compose-app.yml`          | เพิ่ม `OCR_API_URL`, `OCR_CHAR_THRESHOLD`, `OCR_SIDECAR_UPLOAD_BASE`            |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/.env.example`                    | เพิ่ม `OCR_API_URL`, `OCR_CHAR_THRESHOLD`, `OCR_SIDECAR_UPLOAD_BASE`            |
| `backend/src/modules/ai/services/ocr.service.ts`                                            | เพิ่ม `remapPath()`, AggregateError fix                                         |

#### Known Issues / Fixes

- `numpy<2.0` ต้องอยู่ก่อน `paddlepaddle` — ABI mismatch กับ cv2 (numpy 2.x)
- Docker Desktop WSL2 ไม่รองรับ bind mount จาก network drive (Z:\) → ใช้ CIFS volume แทน
- Pre-download model ใน Dockerfile ทำให้ segfault (exit 139) → ลบออก download ตอน runtime
- `OLLAMA_RAG_MODEL` → เปลี่ยนเป็น `OLLAMA_MODEL_MAIN=gemma4:e2b` ตาม ADR-023A

#### CIFS Volume Config

```yaml
volumes:
  qnap_uploads:
    driver: local
    driver_opts:
      type: cifs
      o: 'username=${QNAP_USER},password=${QNAP_PASS},vers=3.0,uid=0,gid=0'
      device: '//192.168.10.8/np-dms-as/data/uploads'
```

#### Path Remapping

```
backend: /app/uploads/temp/xxx.pdf → sidecar: /mnt/uploads/temp/xxx.pdf
OCR_SIDECAR_UPLOAD_BASE=/mnt/uploads (env var)
```

#### Verification

- `curl http://localhost:8765/health` → `{"status":"ok","engine":"paddleocr"}` ✅
- `POST /ocr` ทดสอบกับไฟล์จริงใน `/mnt/uploads/temp/` → ได้ text กลับ ✅
- 78 test suites, 672 tests ผ่านทั้งหมด ✅

---

### Session 8 — 2026-05-30 (OCR Engine Migration — PaddleOCR → Tesseract)

#### ปัญหาที่พบ (Root Cause)

**Bug 1: PaddleOCR SIGILL (Illegal Instruction)**

- PaddleOCR 2.6.2 ต้องการ AVX instruction set ซึ่ง CPU บน Desk-5439 ไม่รองรับ
- ลองลดรุ่นเป็น 2.5.2 → ยังมี dependency conflict กับ paddleocr 2.7.3
- ลองใช้ paddlepaddle-cpu → ยังคงมีปัญหา dependency

**Bug 2: OCR ภาษาไทยผิด**

- PaddleOCR ตั้งค่า `lang="en"` ทำให้ข้อความภาษาไทยถูกแปลงเป็นอักษรละตินผิดๆ
- เช่น: "10 กุมภาพันธ์ 2568" → "10 qunnwus 2568"

#### การแก้ไข (Fix)

เปลี่ยนจาก PaddleOCR เป็น Tesseract OCR เพื่อ:

1. แก้ปัญหา SIGILL บน CPU เก่าที่ไม่รองรับ AVX
2. รองรับภาษาไทยด้วย `tha+eng` language code

| ไฟล์                                                                                        | การเปลี่ยนแปลง                                                               |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/requirements.txt`   | ลบ paddlepaddle/paddleocr, เพิ่ม pytesseract, Pillow                         |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py`             | เปลี่ยนใช้ pytesseract, OCR_LANG เป็น `tha+eng`, ลบ PaddleOCR initialization |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/Dockerfile`         | ติดตั้ง tesseract-ocr, tesseract-ocr-tha, tesseract-ocr-eng                  |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/docker-compose.yml` | OCR_LANG เป็น `tha+eng`, ลบ paddleocr_models volume                          |
| `backend/src/modules/ai/services/ocr.service.ts`                                            | เปลี่ยน comment/error message จาก PaddleOCR เป็น Tesseract                   |
| `frontend/components/admin/ai/OcrSandboxPromptManager.tsx`                                  | เปลี่ยน Badge text จาก PaddleOCR เป็น Tesseract                              |

#### กฎที่ Lock แล้ว

- Tesseract OCR ไม่ต้องการ AVX instruction set → ทำงานได้บน CPU ทุกรุ่น
- Tesseract รองรับภาษาไทยด้วย `tha+eng` language code
- API contract ยังเหมือนเดิม (`POST /ocr` คืน `{ text, ocrUsed }`) → backend/frontend ไม่ต้องเปลี่ยน logic

#### Verification ที่ต้องทำ

- Rebuild container บน Desk-5439: `docker compose down && docker compose up -d --build`
- ทดสอบ OCR ภาษาไทย: "10 กุมภาพันธ์ 2568" ควรออกมาถูกต้อง

---

### Session 9 — 2026-05-26 (System Memories Consolidation)

#### QNAP SSH Key Authentication & CI/CD Deployment

**Infrastructure:**

- QNAP `192.168.10.8` — target deploy server (runs Gitea + app containers)
- ASUSTOR `192.168.10.9` — Gitea runner

**SSH Key Setup (Persistent):**

- Private key: `/etc/config/ssh/gitea-runner`
- Public key: `/etc/config/ssh/gitea-runner.pub`
- Fingerprint: `SHA256:OhPbRe9vi4aWTyzBqCQ6T3MLl+JK9lFtH5bPrx+ICPw`
- Authorized keys: `/etc/config/ssh/authorized_keys` (symlinked from `/root/.ssh/`)
- QNAP SSH config: `/etc/config/ssh/sshd_config` (persistent — ใช้อันนี้เท่านั้น ไม่ใช้ `/etc/ssh/sshd_config`)

**Critical Fix: AuthorizedKeysFile**

```
AuthorizedKeysFile /etc/config/ssh/authorized_keys
```

ต้องใช้ **absolute path** — ถ้าใช้ `.ssh/authorized_keys` จะ resolve ไปที่ `/share/homes/admin/.ssh/` ซึ่งผิด (admin home = `/share/homes/admin` แต่ symlink อยู่ที่ `/root/.ssh`)

**Reload QNAP SSH daemon**

```bash
kill -HUP $(ps | grep "/usr/sbin/sshd -f /etc/config" | grep -v grep | awk '{print $1}')
```

ไม่มี `pgrep` และไม่มี `systemctl` บน QNAP

**Gitea Secrets:**
| Secret | Value |
|--------|-------|
| HOST | `192.168.10.8` |
| PORT | `22` |
| USERNAME | `admin` |
| SSH_KEY | private key content from `/etc/config/ssh/gitea-runner` |

**deploy.sh Fix:**

```bash
# scripts/deploy.sh line 10 — correct path:
COMPOSE_FILE="$SOURCE_DIR/specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/docker-compose-app.yml"
```

ไม่ใช่ `...04-00-docker-compose/docker-compose-app.yml` (ขาด `QNAP/app/`)

**Root Causes (ทั้งหมด):**

1. `authorized_keys` เสียหาย — 2 keys บรรทัดเดียว
2. SSH key pair หายหลัง reboot — QNAP `/` เป็น RAM, ต้องเก็บใน `/etc/config/`
3. `AuthorizedKeysFile` ใช้ relative path — resolve ผิด directory
4. HOST secret ชี้ไปผิด server (Go SSH) — แก้เป็น `192.168.10.8:22`
5. `deploy.sh` COMPOSE_FILE path ผิด — ขาด `QNAP/app/` subdirectory

#### Backend TransformInterceptor Double Registration Bug

**Issue:** API responses were double-wrapped `{ data: { data: actualData } }` causing frontend detail pages to fail loading data.

**Root Cause:** TransformInterceptor registered in TWO places:

1. `backend/src/main.ts`: `app.useGlobalInterceptors(new TransformInterceptor())`
2. `backend/src/common/common.module.ts`: `{ provide: APP_INTERCEPTOR, useClass: TransformInterceptor }`

**Fix:** Removed duplicate registration from `main.ts` (keep only APP_INTERCEPTOR in CommonModule).

**Why list page still worked:** Paginated responses were re-detected as paginated by second interceptor, preventing double-nesting. Non-paginated (detail) endpoints were affected.

**Verification:** `curl http://localhost:3001/api/correspondences/{uuid}` now returns single-wrapped `{ data: {...} }` instead of double-wrapped.

**Pattern to Avoid:** Never register global interceptors/filters in both `main.ts` AND via `APP_INTERCEPTOR`/`APP_FILTER` providers.

#### ADR-021 Integration: Transmittals & Circulation

**Summary:** Successfully integrated ADR-021 (Integrated Workflow Context & Step-specific Attachments) into Transmittals and Circulation modules. All backend services, frontend pages, and tests are wired to the Unified Workflow Engine.

**Backend Changes (B1-B9):**

- **WorkflowEngineService**: Added `getInstanceByEntity(entityType, entityId)` for polymorphic workflow instance lookup
- **TransmittalService**:
  - Expose `workflowInstanceId`, `workflowState`, `availableActions` in `findOneByUuid()`
  - Added purpose filter to `findAll()`
  - Added `submit()` with EC-RFA-004 validation (prevents submission if any item correspondence is DRAFT)
  - Starts workflow instance `TRANSMITTAL_FLOW_V1` and updates CorrespondenceRevision status
- **TransmittalController**: Added `POST /:uuid/submit` endpoint with RBAC and Audit
- **TransmittalModule**: Imported `WorkflowEngineModule` and `CorrespondenceRevision`
- **CirculationService**:
  - Expose workflow fields in `findOneByUuid()`
  - Added `reassignRouting()` (EC-CIRC-001) for PENDING routing reassignment
  - Added `forceClose()` (EC-CIRC-002) with transactional rollback and reason validation
- **CirculationController**: Added `PATCH /:uuid/routing/:routingId/reassign` and `POST /:uuid/force-close`
- **Circulation Entity**: Added `deadlineDate` column for EC-CIRC-003 Overdue badge
- **Schema Delta**: `05-add-circulation-deadline.sql` per ADR-009 (no migrations)

**Frontend Changes (F1-F7):**

- **Types**: Extended `Transmittal` and `Circulation` interfaces with workflow fields; added `deadlineDate` to Circulation
- **Hooks**: Created `useTransmittal()` and extended `useCirculation()` hooks with TanStack Query
- **Detail Pages**:
  - Both wired with `IntegratedBanner` and `WorkflowLifecycle` using live workflow data
  - Circulation page includes EC-CIRC-003 Overdue badge logic (`isOverdue()`)
- **List Page**: Added purpose filter dropdown to `transmittals/page.tsx`

**Tests (T1-T2): 19/19 Passing**

- **TransmittalService**: 7 tests covering EC-RFA-004 validation, workflow instance creation, and error cases
- **CirculationService**: 12 tests covering EC-CIRC-001 (reassign), EC-CIRC-002 (forceClose), EC-CIRC-003 (deadlineDate exposure)

**Key Technical Decisions:**

- Followed ADR-019 UUID handling (no parseInt, use string UUIDs)
- Used ADR-009 direct schema edits (no TypeORM migrations)
- Enforced RBAC with CASL guards and Audit decorators
- Implemented transactional force-close with proper rollback
- Maintained existing patterns for error handling and service architecture

**Remaining Work:**

- I1: i18n keys for new workflow actions (low priority)

#### Correspondence Detail Display Fixes

**Issue:** `/correspondences/[uuid]` detail display inconsistency

**Fix:** Made backend `findOneByUuid` query deterministic with explicit relation joins and revision ordering (rev.revisionNumber DESC, rev.createdAt DESC), and normalized recipient_type values in frontend detail page before TO/CC filtering to handle whitespace variants per schema (e.g., 'CC ').

**Files Modified:**

- `backend/src/modules/correspondence/correspondence.service.ts`
- `frontend/components/correspondences/detail.tsx`

#### Correspondence Create Permission Bypass

**Issue:** Users without primaryOrganizationId could not create documents even with system.manage_all permission

**Fix:** In backend CorrespondenceService.create flow, users without primaryOrganizationId can still create when they have system.manage_all and provide originatorId. Validation now resolves originator organization under that permission instead of immediately throwing 'User must belong to an organization to create documents'. Added regression test in correspondence.service.spec.ts.

**Extension:** Applied same pattern to RFA, Transmittal, and Circulation create endpoints — they now accept optional originatorId and allow creation for users with system.manage_all even when primaryOrganizationId is null. Added permission-gated impersonation checks in their services to prevent unauthorized cross-organization creation.

#### Playwright E2E Testing Setup

**Test Stack:**

- **Backend**: Jest (Unit + Integration + E2E)
- **Frontend**: Vitest (Unit) + Playwright (E2E)

**MCP Server Setup (Windsurf):**

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**Windsurf Cascade Tools:**

- `browser_navigate` - เปิด URL
- `browser_click` - คลิก element
- `browser_type` - พิมพ์ข้อความ
- `browser_take_screenshot` - ถ่าย screenshot
- `browser_evaluate` - รัน JavaScript

**Run E2E Tests:**

```bash
cd frontend
npx playwright test                    # Run all
npx playwright test --ui               # Debug mode
npx playwright test --headed           # See browser
npx playwright show-report             # Generate report
```

**E2E Script Location:** `frontend/e2e/workflow-adr021.spec.ts`

#### Tag Creation and Contract UUID Fixes

**Issue 1:** `/admin/doc-control/reference/tags` needed a list-level Project dropdown filter and Tag creation could fail due to TypeORM Tag entity column-name mismatches.

**Fix:** Added selectedProjectId filter in frontend tags page and mapped backend Tag entity fields to schema names (project_id, tag_name, color_code, created_by, created_at, updated_at, deleted_at).

**Issue 2:** Frontend contract detail page typecheck failure — `contract.project?.id` vs `contract.project?.publicId`

**Fix:** In `frontend/app/(admin)/admin/doc-control/contracts/page.tsx`, handleEdit must read nested project UUID from contract.project?.id (not project?.publicId) because Contract.project is typed and returned as { id: string; projectCode; projectName }.

---

### Session 9 — 2026-05-27 (Context-Aware Prompt Templates & Database Typo CC Cleanup) ← **ล่าสุด**

**Summary:** ดำเนินการอิมพลีเมนต์ ADR-030 (Context-Aware Prompt Templates สำหรับการสกัดข้อมูลเอกสาร) และทำการแก้ไขบัคช่องว่างประเภทผู้รับ `'CC '` ในฐานข้อมูล

**Backend Changes (B1-B6):**

- **AiPrompt Entity**: เพิ่มการแมปคอลัมน์ `contextConfig` ไปยัง JSON ฟิลด์ `context_config` ในฐานข้อมูลเพื่อควบคุม master data resolution
- **CreateAiPromptDto / Response DTO**: ปรับแต่งให้รองรับการรับและส่งออกคอลัมน์ `contextConfig`
- **AiPromptsService**:
  - อิมพลีเมนต์เมธอด `resolveContext()` สำหรับการดึงข้อมูล Master Data ดำเนินการคัดกรองข้อมูลอ้างอิงโครงการ (Projects, Organizations, Disciplines, CorrespondenceTypes, Tags) สอดคล้องกับ dynamic config filter
  - ติดตั้ง **Gatekeeper Rule** (ตัวกรองความปลอดภัย) โยน `ForbiddenException` ทันทีเมื่อมีการร้องขอ override project UUID ข้ามอาณาเขตโครงการที่กำหนดใน template เพื่อป้องกัน Cross-project data leak
- **AiBatchProcessor**:
  - ปรับปรุงโครงสร้าง `MigrateDocumentMetadata` interface, sandbox extraction, และ migration process ให้ดึงข้อมูลและแมป master data context-aware
  - สกัดและจำแนกผู้รับเอกสาร (recipients) ภายใต้โครงสร้าง JSON แบบใหม่ในรูป Object Array: `recipients: Array<{ organizationPublicId: string, recipientType: 'TO' | 'CC' }>` เพื่อความเสถียรและทนทานของข้อมูล
- **Unit Tests**:
  - เพิ่มชุดการทดสอบ `resolveContext` ใน `ai-prompts.service.spec.ts` ครอบคลุมการจำลอง master data resolution, การโยน `NotFoundException` และการล็อคสิทธิ์ความปลอดภัยด้วย `ForbiddenException` เมื่อ override โครงการข้าม boundary
  - แก้ไข mock dependencies ของ `AiPromptsService` ใน `ai-batch.processor.spec.ts` ป้องกันปัญหา `TypeError: getActive is not a function` ทำให้ผ่าน unit tests 100%

**Database & Schema Changes (ADR-009):**

- **schema-02-tables.sql**: แก้ไข line 338 ปรับปรุง `ENUM('TO', 'CC ')` เป็น `ENUM('TO', 'CC')`
- **SQL Delta**: สร้าง `2026-05-27-add-context-aware-prompts-and-cleanup.sql` ดำเนินการ `UPDATE` ข้อมูลเก่าที่เป็น `'CC '` ให้เป็น `'CC'` เพื่อล้างช่องว่าง จากนั้นสั่ง `ALTER TABLE` ปรับปรุงฟิลด์ enum และ Seed template ภาษาไทยเวอร์ชัน 2
- **Rollback SQL**: สร้างไฟล์ย้อนกลับ `2026-05-27-add-context-aware-prompts-and-cleanup.rollback.sql` เรียบร้อย

**Frontend Changes:**

- **detail.tsx**: ตรวจสอบการใช้งาน `normalizeRecipientType` ซึ่งครอบคลุมการล้างช่องว่างและการกรองผู้รับ TO/CC ได้อย่างทนทาน

**Verification:**

- `pnpm --filter backend build` — ✅ Compile ผ่านแบบ Strict Mode
- unit tests AI module & backend suites — ✅ ผ่านทั้งหมด 60 suites / 521 tests

---

### Session 10 — 2026-05-30 (OCR Sandbox Two-Step Flow) ← **ล่าสุด**

**Summary:** แยก OCR Sandbox เป็น 2 steps ตาม spec 231: Step 1 OCR-only → Step 2 AI Extraction เพื่อให้ admin ตรวจคุณภาพ OCR ก่อนทดสอบ AI prompt

**Backend Changes (B1-B5):**

- **AiBatchJobType**: เพิ่ม `sandbox-ocr-only` และ `sandbox-ai-extract` job types
- **AiBatchProcessor**:
  - เพิ่ม `processSandboxOcrOnly()` — รัน OCR เท่านั้น, cache OCR text ใน Redis key `ai:sandbox:ocr:{idempotencyKey}` (TTL 3600s)
  - เพิ่ม `processSandboxAiExtract()` — ดึง OCR text จาก cache, resolve prompt version (active หรือ version ที่ระบุ), replace {{ocr_text}} และ {{master_data_context}}, run LLM
- **AiPromptsService**: เพิ่ม `findByVersion(promptType, versionNumber)` method สำหรับดึง prompt version ที่ระบุ
- **AiController**:
  - เพิ่ม `POST /ai/admin/sandbox/ocr` — Step 1 endpoint (รับ file multipart/form-data)
  - เพิ่ม `POST /ai/admin/sandbox/ai-extract` — Step 2 endpoint (รับ requestPublicId + optional promptVersion)
- **AiQueueService**: อัปเดต `enqueueSandboxJob()` รองรับ job types ใหม่และ extraPayload สำหรับส่ง promptVersion

**Frontend Changes (F1-F3):**

- **adminAiService**: เพิ่ม `submitSandboxOcr(file)` และ `submitSandboxAiExtract(requestPublicId, promptVersion)` methods
- **OcrSandboxPromptManager.tsx**:
  - เพิ่ม states: `sandboxStep` ('ocr'|'ai'), `ocrResult` (requestPublicId, ocrText, ocrUsed), `selectedPromptVersion`
  - เพิ่ม handlers: `handleStep1Ocr()` (poll OCR result), `handleStep2AiExtract()` (poll AI result), `handleResetSandbox()`
  - Refactor UI: Step 1 (upload + Run OCR button) → Step 2 (prompt version dropdown + Run AI Extraction button + Reset button)
  - แสดง OCR Raw Text card หลัง Step 1 เสร็จ (สีน้ำเงิน, badge บอก PaddleOCR/Fast Path)
  - แสดง AI Extraction result หลัง Step 2 เสร็จ (สีเขียว, badge บอก promptVersionUsed)

**Schema Fix (ADR-009 + ADR-019):**

- **Delta SQL**: สร้าง `2026-05-30-add-ai-prompts-publicId.sql` เพิ่ม `publicId CHAR(36) UNIQUE` column ใน `ai_prompts` table
- **Root Cause**: Entity มี `publicId` field แต่ DB table ไม่มี column นี้ → QueryFailedError: "Unknown column 'AiPrompt.publicId' in 'SELECT'"
- **Fix**: ใช้ CHAR(36) แทน UUID type (MariaDB compatible), generate UUID สำหรับ existing records ด้วย `UUID()` function

**Verification:**

- Backend TypeScript: ✅ ผ่าน (`npx tsc --noEmit`)
- Frontend TypeScript: ✅ ผ่าน (`npx tsc --noEmit`)
- ESLint: ✅ ผ่าน (แก้ unused `user` parameter ใน `submitSandboxAiExtract`)

**Data Flow:**

```
Step 1: Upload PDF → POST /ai/admin/sandbox/ocr
  ↓
  BullMQ: sandbox-ocr-only job
  ↓
  OCR Service → Cache OCR text (ai:sandbox:ocr:{id})
  ↓
  Frontend displays OCR Raw Text

Step 2: Select prompt version → POST /ai/admin/sandbox/ai-extract
  ↓
  BullMQ: sandbox-ai-extract job
  ↓
  Retrieve OCR text from cache (ai:sandbox:ocr:{id})
  ↓
  Replace {{ocr_text}} → LLM → JSON result
  ↓
  Frontend displays AI Extraction result
```

**Pending:**

- Run delta SQL `2026-05-30-add-ai-prompts-publicId.sql` ใน production database
- Restart backend service หลัง apply delta
- Test 2-step flow จริงใน production environment

---

### Session 11 — 2026-05-30 (Typhoon OCR & LLM Integration) ← **ล่าสุด**

**Summary:** ออกแบบและพัฒนาการใช้งานโมเดลภาษาไทยผสมอังกฤษ Typhoon OCR-3B ร่วมกับ Tesseract OCR แบบ Dynamic พร้อมระบบ caching 24 ชม., VRAM Monitor ป้องกัน GPU OOM และระบบ fallback 5s เมื่อโมเดลมีปัญหา และการสลับและบริหารจัดการ LLM โมเดลหลักแบบ Dynamic ในระบบ AI Model Management ของ Next.js frontend ตามข้อกำหนด ADR-032

**Backend Changes (B1-B5):**

- **OcrService**:
  - เพิ่ม dynamic OCR engine selection (`getOcrEngines()`, `selectOcrEngine()`, `getActiveEngineId()`) จัดเก็บสถานะหลักใน DB `system_settings` (`OCR_ACTIVE_ENGINE`) พร้อม cache ใน Redis 30s ป้องกันคิวรีซ้ำซ้อน
  - ปรับปรุง `detectAndExtract()` ให้เลือกใช้ engine ที่เหมาะสม หากผู้ใช้เลือก Typhoon OCR-3B จะทำงานผ่าน `processWithTyphoon()` ร่วมกับ `OcrCacheService` (24-hour Redis caching) และ `VramMonitorService` (ตรวจสอบ VRAM capacity > 4GB ก่อนโหลดโมเดล)
  - พัฒนาระบบ **Graceful Fallback** ไปยัง Tesseract OCR ในเวลา 5 วินาทีหาก Typhoon ขัดข้องหรือ VRAM ไม่เพียงพอ โดยมีการบันทึกรายละเอียดและ error ลง `ai_audit_logs`
- **AiService**:
  - เพิ่ม endpoints สำหรับ AI Model Management: `GET /models`, `POST /models` (Superadmin), `PATCH /models/:modelId/activate` และ `GET /vram/status` (Used/Free VRAM และ Active models บน GPU) ร่วมกับ `AiSettingsService` และ `VramMonitorService`
  - ตรวจสอบความปลอดภัย VRAM ก่อนอนุญาตให้สลับโมเดลหลัก หากเหลือพื้นที่หน่วยความจำ GPU ไม่พอ จะโยน `BusinessException` แจ้งเตือนภาษาไทยพร้อมบันทึกลง Audit Log และระงับการเปลี่ยนโมเดลทันที
  - แก้ไขข้อผิดพลาด build error ใน `ai.service.ts` โดยการนำเข้า `OllamaService` และ `AiQdrantService` ที่ขาดหายไปใน constructor

**Frontend Changes (F1-F3):**

- **admin-ai.service.ts**: เพิ่ม interface `LoadedModelInfo` และ `VramStatusResponse` และเพิ่ม methods `getVramStatus()`, `getAvailableModels()`, `setActiveModel()`, และ `addModel()` โดยใช้ dynamic path ที่อ้างอิง UUIDv7 (`modelId`) และส่ง idempotency headers ตาม ADR-019/ADR-016
- **admin/ai/page.tsx**: อัปเดตหน้า AI Admin page โดยเพิ่ม **VRAM GPU Monitor Card** แบบ realtime (ดึงและสลับรีเฟรชผ่าน React Query ทุก 15s) แสดง Free/Used VRAM และ active models บน GPU และปรับปรุง UI ส่วน AI Model Management ให้สลับโมเดลหลักผ่าน UUIDv7 และแสดง VRAM requirements ของแต่ละโมเดลอย่างสวยงามพรีเมียม

**ADRs Update (ADR-023/023A):**

- อัปเดต `ADR-023-unified-ai-architecture.md` (v1.2) และ `ADR-023A-unified-ai-architecture.md` (v1.3) เพื่อรับรองสถาปัตยกรรม dynamic Thai specialized models (Typhoon OCR & LLM) ภายใต้การควบคุมของ VRAM Monitor

**Verification:**

- Backend NestJS Build: ✅ Compile สำเร็จ 100% ปราศจาก Error (`npm run build` ใน backend)
- Frontend Next.js Build: ✅ Compile สำเร็จ 100% ปราศจาก Error (`npm run build` ใน frontend)

---

### Session 14 — 2026-06-05 (RAG Pipeline Enhancements / Spec 234 / ADR-035) ← **ล่าสุด**

**Summary:** ปรับโค้ดให้สอดคล้องกับ feature `234-rag-pipeline-enhancements` และ `ADR-035-ai-pipeline-flow-architecture` โดยปิด compile blockers ของ RAG pipeline ใหม่, บังคับ tenant scope ผ่าน `projectPublicId` ใน vector deletion path, ย้าย dashboard ไปใช้ `/ai/rag/*`, และ retire runtime surface ของ legacy `/rag/*`

**Backend Changes (B1-B6):**

- **Compile blockers fixed (4 จุด):**
  - ปรับ `ai-batch.processor.ts` ให้ legacy `embed-document` path ส่งข้อมูลตาม signature ใหม่ของ `EmbeddingService.embedDocument(...)`
  - เพิ่ม `projectPublicId` ใน `AiVectorDeletionJobPayload` และ propagate ผ่าน `AiQueueService` + `vector-deletion.processor.ts`
  - ปรับ typing ใน `src/modules/ai/qdrant.service.ts` ให้รองรับ hybrid upsert contract ของ Qdrant client
  - แก้ nullability ใน `correspondence-workflow.service.ts` สำหรับ trigger `enqueueRagPrepare()`
- **Legacy delete path hardening:** `backend/src/modules/rag/rag.service.ts` เปลี่ยน `deleteVectors()` ให้ resolve `projectPublicId` จาก `DocumentChunk`/server-side context ก่อน ไม่เชื่อ query param จาก client เป็นหลัก
- **Legacy runtime deprecation:** mark `backend/src/modules/rag/rag.controller.ts` และ endpoint summaries เป็น deprecated ชั่วคราวระหว่าง audit
- **Legacy runtime removal:** หลัง consumer audit ใน repo ไม่พบ caller ของ `/rag/status`, `/rag/ingest`, `/rag/vectors`, `/rag/admin/init-collection`, จึงถอด `RagModule` ออกจาก `backend/src/app.module.ts` และลบ `backend/src/modules/rag/rag.controller.ts` + `rag.module.ts`

**Frontend Changes (F1-F2):**

- **Dashboard RAG migration:** `frontend/app/(dashboard)/rag/page.tsx` เปลี่ยนมาใช้ `RagChatWidget` ซึ่งวิ่งผ่าน `POST /ai/rag/query` และ `GET /ai/rag/jobs/:requestPublicId`
- **Legacy frontend cleanup:** ลบ `frontend/hooks/use-rag.ts` และ `frontend/components/rag/*` ที่ไม่ถูกใช้งานแล้ว

**Architecture / Documentation Updates:**

- **ADR-035:** เพิ่มและอัปเดต Legacy Compatibility Note ให้สะท้อนสถานะจริงของ migration ไป `/ai/rag/*`
- **Current runtime state:** `/rag/*` ไม่ถูก mount ใน `AppModule` แล้ว; flow หลักของระบบใช้ `AiModule` + `/ai/rag/*`

**Verification:**

- `pnpm --filter backend build` — ✅ ผ่าน
- `pnpm --filter backend lint:ci` — ✅ ผ่าน
- `pnpm --filter backend test -- --runTestsByPath src/modules/ai/processors/ai-batch.processor.spec.ts src/modules/ai/services/embedding.service.spec.ts` — ✅ ผ่าน
- `pnpm --filter backend test -- --runTestsByPath src/modules/rag/__tests__/rag.service.spec.ts` — ✅ ผ่าน
- `pnpm --filter lcbp3-frontend lint` — ✅ ผ่าน
- `pnpm exec tsc --noEmit -p frontend/tsconfig.json` — ✅ ผ่าน

**Follow-up Completed (Session 14+):**

- ✅ แก้ `backend/src/modules/ai/qdrant.service.ts` — `ensureCollection()` ตรวจ schema ก่อน delete: ถ้าเป็น Hybrid 1024 dims แล้ว skip recreation
- ✅ ย้าย `rag-prepare` enqueue ใน `CorrespondenceWorkflowService.syncStatus()` ไปหลัง commit — after-commit pattern ด้วย `triggerRagPrepare()`
- ✅ ลบ `backend/src/modules/rag/` ทั้งหมด (audit ไม่พบ import จาก backend/src)
- ✅ สร้าง `backend/src/modules/ai/ai-qdrant.service.spec.ts` — regression test สำหรับ `deleteByDocumentPublicId()` (4/4 ผ่าน)
- ✅ Code Review Fixes (Session 14+): try-catch after-commit, `createPayloadIndexes()` private, defensive vector size check, `skipRagPrepare` flag
- ✅ F5 (Session 15): เพิ่ม `ai-rag-pipeline.integration.spec.ts` — 9 integration tests ครอบคลุม SC-002, SC-003, SC-006, FR-005, jobId dedup

---

### Session 15 — 2026-06-05 (Feature 234 RAG Pipeline Enhancements — สมบูรณ์) ← **ล่าสุด**

**Summary:** Implement RAG Pipeline Enhancements ตาม Spec 234 / ADR-035 ครบทุก Functional Requirement (FR-001 → FR-015), ผ่าน speckit-analyze → speckit-implement → speckit-tester → speckit-validate; ปิด Gap ทั้ง 2 รายการ

**งานที่ทำในเซสชั่นนี้:**

| งาน | ไฟล์หลัก | สถานะ |
|-----|----------|-------|
| Sidecar `/embed` (BGE-M3 Dense+Sparse) | `ocr-sidecar/app.py`, `requirements.txt` | ✅ |
| Sidecar `/rerank` (BGE-Reranker-Large) | `ocr-sidecar/app.py` | ✅ |
| `OcrService.embedViaSidecar()` + `rerankViaSidecar()` | `ocr.service.ts` | ✅ |
| Hybrid Qdrant schema (1024 dims, drop+recreate) | `qdrant.service.ts` | ✅ |
| Payload indexes (project_public_id tenant, doc_public_id, status_code, doc_type) | `qdrant.service.ts` | ✅ |
| `EmbeddingService.embedDocument()` — Semantic Chunking + fallback | `embedding.service.ts` | ✅ |
| `semanticChunkTextWithFallback()` → `parseChunkTags()` → `fixedSizeChunk()` | `embedding.service.ts` | ✅ |
| `AiBatchProcessor` case `rag-prepare` → `processRagPrepare()` | `ai-batch.processor.ts` | ✅ |
| `AiQueueService.enqueueRagPrepare()` + jobId dedup | `ai-queue.service.ts` | ✅ |
| `CorrespondenceWorkflowService.syncStatus()` → `triggerRagPrepare()` | `correspondence-workflow.service.ts` | ✅ |
| `AiRagService.processQuery()` — Hybrid Search + Reranker | `ai-rag.service.ts` | ✅ |
| SQL delta `rag_chunking` prompt | `deltas/2026-06-05-add-rag-chunking-prompt.sql` | ✅ |
| Integration test (9 tests) | `ai-rag-pipeline.integration.spec.ts` | ✅ |
| Validation report | `specs/200-fullstacks/234-rag-pipeline-enhancements/validation-report.md` | ✅ |

**Verification:**

- `npx jest` (6 suites): **24/24 tests PASS**
- `npx tsc --noEmit`: **0 errors**
- speckit-validate: **15/15 FR covered, 6/6 SC verifiable, 0 Gaps remaining**

**Architecture Summary (ADR-035):**

```
CorrespondenceWorkflowService.syncStatus()
  └── triggerRagPrepare() [fire-and-forget]
        └── AiQueueService.enqueueRagPrepare() [jobId dedup]
              └── BullMQ ai-batch queue
                    └── AiBatchProcessor.processRagPrepare()
                          ├── OcrService.detectAndExtract() [if no cached text]
                          └── EmbeddingService.embedDocument()
                                ├── semanticChunkTextWithFallback() → typhoon2.5 / fixed-size fallback
                                ├── OcrService.embedViaSidecar() → BGE-M3 [dense 1024 + sparse]
                                └── AiQdrantService.upsert() → lcbp3_vectors [delete-before-upsert]

AiRagService.processQuery()
  ├── OcrService.embedViaSidecar(question) → BGE-M3
  ├── AiQdrantService.searchByProject(dense, sparse, projectPublicId, 15) → RRF Fusion
  ├── OcrService.rerankViaSidecar(question, chunks) → BGE-Reranker top-5
  └── Ollama typhoon2.5-np-dms:latest → answer + citations
```

---

## 🎯 11. แผนงานขั้นต่อไป (Next Session Focus)

### N8N Migration & E2E Testing (งานหลักที่เหลือ)

- [ ] **Import `n8n.workflow.v2.json`** เข้า n8n UI และทดสอบ End-to-End (มี fix จาก Session 3, 4, 5 แล้ว)
- [ ] **ทดสอบ End-to-End จริง** — รัน n8n กับ Excel ตัวอย่าง → ตรวจสอบว่า `Submit AI Job` ผ่าน, `migration_review_queue` มีข้อมูล, `migration_errors.job_id` ถูกบันทึก
- [ ] **Frontend Editable Review Form** (Pipeline B) — pre-fill AI suggestions + tag suggestion UI
- [ ] **Dry Run** กับ Excel จริงก่อน Production Migration

### RAG Pipeline — Production Readiness

- [X] **รัน SQL delta** `2026-06-05-add-rag-chunking-prompt.sql` ใน MariaDB production
- [ ] **Deploy OCR Sidecar ใหม่** บน Desk-5439 หลัง rebuild image (เพิ่ม `FlagEmbedding>=1.2.0` + `/embed` + `/rerank`)
- [ ] **Drop + recreate Qdrant collection** `lcbp3_vectors` เป็น Hybrid schema (1024 dims) ผ่าน `ensureCollection()` auto-migration
- [ ] **SC-002 E2E accuracy test** — ทดสอบ Chat Q&A ≥ 80% accuracy กับเอกสาร Correspondence จริง

### งานทั่วไป

- [ ] เพิ่ม unit test สำหรับ `upsertQueueRecord` ใน `ai-migration-checkpoint.service.spec.ts` (UUID→INT path)
- [ ] เพิ่ม unit test สำหรับ checksum dedup ใน `file-storage.service.spec.ts`
