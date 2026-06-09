# Project Memory Override

> **Project:** NAP-DMS (LCBP3) — Laem Chabang Port Phase 3 Document Management System
> **Version:** 1.9.10 (Last Synced: 2026-06-08)
> **Stack:** NestJS 11 + Next.js 16 + TypeScript + MariaDB 11.8 + Redis + BullMQ + Elasticsearch + Ollama (on-prem AI)

> [!IMPORTANT]
> **Project memory นี้ต้องใช้งานภายใต้ `AGENTS.md` เสมอ**
>
> - ให้ใช้ `AGENTS.md` เป็นกฎหลักก่อน memory ทุกครั้ง
> - ถ้า memory เก่าหรือ session note ขัดกับ `AGENTS.md` ให้ยึด `AGENTS.md`
> - งาน schema ต้องทำตาม ADR-009 ผ่าน SQL/delta เท่านั้น
> - งาน UUID/Public API ต้องทำตาม ADR-019 โดยใช้ `publicId` และห้าม `parseInt()` บน UUID
> - งาน n8n / AI migration ต้องอยู่ในขอบเขต ADR-023A และ mutation ต้องมี `Idempotency-Key`

## OS Rules & Sandbox Constraints

> [!IMPORTANT]
> **ระบบรันอยู่บน Windows OS**
>
> - ห้ามใช้คำสั่ง `bash` หรือคำสั่งของ Linux โดยเด็ดขาด
> - คำสั่งทุกประเภทที่จะส่งให้ผู้ใช้รันหรือรันผ่าน Terminal ต้องเป็น **PowerShell** หรือ **CMD** เท่านั้น
> - ห้ามใช้คำสั่ง `cd` ในการสลับ Directory ให้ระบุพารามิเตอร์ `Cwd` ใน Tool ตรง ๆ

## Current Decisions (Locked)

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

## Environment & Services

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

### Key Environment Variables

```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
REDIS_HOST, REDIS_PORT
JWT_SECRET, JWT_EXPIRES_IN
OLLAMA_BASE_URL (ชี้ไป Admin Desktop)
QDRANT_URL
```

## Next Session Focus

### N8N Migration & E2E Testing

- [ ] **Import `n8n.workflow.v2.json`** เข้า n8n UI และทดสอบ End-to-End
- [ ] **ทดสอบ End-to-End จริง** — รัน n8n กับ Excel ตัวอย่าง
- [ ] **Frontend Editable Review Form** (Pipeline B) — pre-fill AI suggestions + tag suggestion UI
- [ ] **Dry Run** กับ Excel จริงก่อน Production Migration

### RAG Pipeline — Production Readiness

- [X] **รัน SQL delta** `2026-06-05-add-rag-chunking-prompt.sql` ใน MariaDB production
- [ ] **Deploy OCR Sidecar ใหม่** บน Desk-5439 หลัง rebuild image
- [ ] **Drop + recreate Qdrant collection** `lcbp3_vectors` เป็น Hybrid schema
- [ ] **SC-002 E2E accuracy test** — ทดสอบ Chat Q&A ≥ 80% accuracy

### General Tasks

- [ ] เพิ่ม unit test สำหรับ `upsertQueueRecord` ใน `ai-migration-checkpoint.service.spec.ts`
- [ ] เพิ่ม unit test สำหรับ checksum dedup ใน `file-storage.service.spec.ts`
