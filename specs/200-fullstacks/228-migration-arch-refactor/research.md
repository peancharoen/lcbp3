// File: specs/200-fullstacks/228-migration-arch-refactor/research.md
// Change Log:
// - 2026-05-22: Phase 0 research derived from grill session + clarify session

# Research: ADR-028 Migration Architecture Refactor

## Resolved Decisions

### 1. n8n → BullMQ (ไม่ใช่ Direct Ollama)

- **Decision**: n8n ต้องเรียกผ่าน `POST /api/ai/jobs` (DMS API) → BullMQ → Ollama Worker
- **Rationale**: ให้ RBAC, ADR-007 Error Handling, และ `ai_audit_logs` ครอบคลุมทุก AI job โดยอัตโนมัติ ถ้า n8n bypass BullMQ จะเกิด audit gap
- **Alternatives considered**: n8n เรียก Ollama REST API โดยตรง — ถูก reject เพราะขัด ADR-023A และ audit trail ขาด

### 2. AI Model Stack

- **Decision**: `gemma4:e4b Q8_0` สำหรับ inference, `nomic-embed-text` สำหรับ embedding
- **Rationale**: กำหนดโดย ADR-023A — VRAM peak ~4.3GB (ต่ำกว่า RTX 2060 SUPER 8GB), เพียงพอสำหรับ Thai + English document classification
- **Alternatives considered**: llama3.2:3b, mistral:7b, Typhoon2-4B, Qwen2.5-7B — ถูก reject เพราะ ADR-023A กำหนด model stack แล้ว, ไม่มี fallback (BullMQ concurrency=1 จัดการ GPU)

### 3. OCR Pipeline

- **Decision**: Auto-detect — PyMuPDF (extracted_chars > 100/page) → Fast Path; PaddleOCR + PyThaiNLP → Slow Path
- **Rationale**: Thai document support ดีกว่า Apache Tika; auto-detect ลด latency สำหรับ PDF ที่มี text layer; รันบน Desk-5439 ผ่าน BullMQ Worker
- **Alternatives considered**: Apache Tika — ถูก reject เพราะ n8n ต้องรัน extract เอง (ขัด ADR-023A), Thai NLP support อ่อนแอ

### 4. Migration Token Policy

- **Decision**: Token ≤ 7 วัน, Renew ทุกสัปดาห์, Revoke ทันที Go-Live
- **Rationale**: ADR-023 security policy; token "100 ปี" (ที่เดิมระบุใน 03-05) เป็นความเสี่ยงด้าน security สูง
- **Alternatives considered**: Token 100 ปี (ไม่ expire) — ถูก reject เพราะขัด ADR-016/ADR-023

### 5. `/api/ai/jobs` Endpoint Status

- **Decision**: ยังไม่มี — ต้องพัฒนาเป็น Blocking Prerequisite ก่อน Migration Phase เริ่ม
- **Rationale**: Migration plan ทั้งหมด (n8n → BullMQ) อาศัย endpoint นี้; ต้องเสร็จก่อน Gate #1
- **Required**: BullMQ job type `migrate-document` ใหม่ + polling endpoint

### 6. Tags Schema

- **Decision**: สร้าง SQL delta สำหรับ `tags` และ `correspondence_tags` ตาม ADR-009
- **Rationale**: ตารางเหล่านี้ยังไม่มีใน production schema; ต้องสร้างก่อน Migration เพื่อให้ AI tag suggestions ทำงานได้
- **SQL delta path**: `specs/03-Data-and-Storage/deltas/`

### 7. Orphaned Temp Files

- **Decision**: Auto-cleanup 24 ชั่วโมง หลัง job `failed` หรือไม่มี commit (Scheduled BullMQ cleanup job)
- **Rationale**: ป้องกัน NAS space ล้น; สอดคล้องกับ Two-Phase storage pattern (ADR-016)
- **Alternatives considered**: n8n รับผิดชอบ cleanup / Manual cleanup — ถูก reject เพราะ n8n อาจ miss cases และ manual cleanup ไม่ reliable

### 8. Final Commit RBAC

- **Decision**: `DOCUMENT_CONTROLLER` | `ADMIN` | `SUPERADMIN`
- **Rationale**: Document Controller รับผิดชอบเอกสารโดยตรง; Admin และ SUPERADMIN ต้องมีสิทธิ์เป็น fallback
- **Alternatives considered**: Admin only / DC only — ถูก reject เพราะ lockout risk

### 9. Migration Tables Retention

- **Decision**: `import_transactions` เก็บถาวร (audit trail); ตารางอื่น Drop หลัง Gate #3 (T+30 วัน)
- **Rationale**: `import_transactions` เป็น compliance requirement — ต้องรู้ว่าใครนำเข้าอะไรเมื่อไหร่; ตาราง operational state ไม่มีคุณค่าหลัง migration เสร็จ
