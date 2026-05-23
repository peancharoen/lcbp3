<!-- File: memory/agent-memory.md -->
<!-- Change Log
- 2026-05-23: Initialized long-term memory system with core project rules, Windows environment settings, and constraints.
- 2026-05-23 (Session 2): N8N Workflow Refactor — QuizMe session, decisions locked, สร้าง CONTEXT-N8N-Refactor.md, สร้าง n8n.workflow.v2.json (ADR-023A compliant), อัพเดต 03-05 และ 03-06.
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

## 🔄 4. สถานะและประวัติการทำงาน (Latest Session Progress)

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

## 🎯 5. แผนงานขั้นต่อไป (Next Session Focus)

### N8N Migration (งานหลักที่เหลือ)

- [ ] **Import `n8n.workflow.v2.json`** เข้า n8n UI และทดสอบ End-to-End
- [ ] **ตรวจสอบ `ai-realtime` processor** ว่า return `suggestedTags[]` พร้อม `isNew` flag
- [ ] **Frontend Editable Review Form** (Pipeline B) — pre-fill AI suggestions + tag suggestion UI
- [ ] **Dry Run** กับ Excel จริงก่อน Production Migration

### งานทั่วไป

- [ ] รักษาความเป็นระเบียบและอัปเดต `memory/agent-memory.md` ทุกครั้งที่ Task สำคัญเสร็จ
