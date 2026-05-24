<!-- File: memory/agent-memory.md -->
<!-- Change Log
- 2026-05-23: Initialized long-term memory system with core project rules, Windows environment settings, and constraints.
- 2026-05-23 (Session 2): N8N Workflow Refactor — QuizMe session, decisions locked, สร้าง CONTEXT-N8N-Refactor.md, สร้าง n8n.workflow.v2.json (ADR-023A compliant), อัพเดต 03-05 และ 03-06.
- 2026-05-24: เพิ่ม sections: Known Commands, Current Decisions, Do/Don't Quick Reference, Environment & Services, Recent Rollouts.
-->

# 🧠 Agent Long-term Project Memory

> **Project:** NAP-DMS (LCBP3) — Laem Chabang Port Phase 3 Document Management System
> **Version:** 1.9.6 (Last Synced: 2026-05-23)
> **Stack:** NestJS 11 + Next.js 16 + TypeScript + MariaDB 11.8 + Redis + BullMQ + Elasticsearch + Ollama (on-prem AI)

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
- โมเดลที่ใช้: `gemma4:e4b Q8_0` (LLM) และ `nomic-embed-text` (Embeddings)
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
| D10 | AI model stack: `gemma4:e4b Q8_0` (LLM) + `nomic-embed-text` (Embeddings) on Admin Desktop  | ADR-023A  |

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

| Service          | Local URL / Port            | Production                | Notes                                |
| ---------------- | --------------------------- | ------------------------- | ------------------------------------ |
| **Backend API**  | `http://localhost:3001`     | QNAP `192.168.10.8`       | NestJS — `/api` prefix               |
| **Frontend**     | `http://localhost:3000`     | QNAP `192.168.10.8`       | Next.js                              |
| **MariaDB**      | `localhost:3307`            | QNAP internal             | DB: `lcbp3`, root via docker         |
| **Redis**        | `localhost:6379`            | QNAP internal             | BullMQ + session store               |
| **n8n**          | `http://localhost:5678`     | QNAP `192.168.10.8:5678`  | Migration orchestrator only          |
| **Ollama**       | `http://192.168.10.X:11434` | Admin Desktop (Desk-5439) | gemma4:e4b Q8_0 + nomic-embed-text   |
| **Qdrant**       | `http://localhost:6333`     | Admin Desktop (Desk-5439) | Vector DB — requires projectPublicId |
| **Gitea**        | `https://git.np-dms.work`   | QNAP `192.168.10.8`       | Source + CI/CD                       |
| **Gitea Runner** | ASUSTOR `192.168.10.9`      | —                         | CI runner                            |

### Key Environment Variables (ตรวจสอบใน `docker-compose.yml`)

```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
REDIS_HOST, REDIS_PORT
JWT_SECRET, JWT_EXPIRES_IN
OLLAMA_BASE_URL (ชี้ไป Admin Desktop)
QDRANT_URL
```

---

## 🚀 8. Recent Rollouts

| วันที่     | Version | รายการ                                                                          | สถานะ                       |
| ---------- | ------- | ------------------------------------------------------------------------------- | --------------------------- |
| 2026-05-23 | v1.9.6  | Specs reorganization (`100/200/300-*` folders), AGENTS.md v1.9.6 update         | ✅ Complete                 |
| 2026-05-23 | v1.9.6  | N8N Workflow v2 (`n8n.workflow.v2.json`) — ADR-023A compliant, ลบ Ollama direct | ⏳ Pending import to n8n UI |
| 2026-05-24 | v1.9.6  | AGENTS.md Project Memory Override rule (Windsurf / Antigravity / Codex)         | ✅ Complete                 |

---

## 🔄 9. สถานะและประวัติการทำงาน (Latest Session Progress)

### Session 1 — 2026-05-23 (Specs Reorganization)

- Reorganize โครงสร้างโฟลเดอร์ `specs/` สำเร็จ (`100-Infrastructures`, `200-fullstacks`, `300-others`)
- อัปเดตกฎ `AGENTS.md` และ `GEMINI.md` ให้ตรงกับมาตรฐานใหม่
- ริเริ่มระบบ `memory/agent-memory.md`

### Session 2 — 2026-05-23 (N8N Workflow Refactor) ← **ล่าสุด**

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

---

## 🎯 10. แผนงานขั้นต่อไป (Next Session Focus)

### N8N Migration (งานหลักที่เหลือ)

- [ ] **Import `n8n.workflow.v2.json`** เข้า n8n UI และทดสอบ End-to-End
- [ ] **ตรวจสอบ `ai-realtime` processor** ว่า return `suggestedTags[]` พร้อม `isNew` flag
- [ ] **Frontend Editable Review Form** (Pipeline B) — pre-fill AI suggestions + tag suggestion UI
- [ ] **Dry Run** กับ Excel จริงก่อน Production Migration

### งานทั่วไป

- [ ] รักษาความเป็นระเบียบและอัปเดต `memory/agent-memory.md` ทุกครั้งที่ Task สำคัญเสร็จ
