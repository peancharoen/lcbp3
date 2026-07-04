# Session — 2026-07-04 (Ollama Env Var Mismatch Bugfix)

## Summary

แก้ไข bug หลัง Server Consolidation Migration (ADR-041) — backend ไม่สามารถเชื่อมต่อ Ollama ได้เนื่องจาก env var name mismatch ระหว่าง docker-compose และ backend code และ hardcoded fallback URLs ชี้ไป IP เดิมที่ถูกยกเลิกแล้ว

## ปัญหาที่พบ (Root Cause)

หลัง ADR-041 Server Consolidation ย้าย Ollama จาก Desk-5439 (`192.168.10.100`) ไป New Server (`192.168.10.11`) เป็น native systemd service:

1. **Env var name mismatch** — docker-compose ตั้ง `OLLAMA_API_URL` แต่ backend code อ่าน `OLLAMA_URL` → env var ไม่ถูกส่งเข้า container
2. **Hardcoded fallback URLs** ชี้ไป IP เดิมที่ถูกยกเลิก:
   - `192.168.10.100` (Desk-5439 — ปิดไปแล้ว)
   - `localhost` (ไม่ถูกต้องใน Docker container)
3. **Inconsistent env var names** — `ollama-client.service.ts` ใช้ `OLLAMA_BASE_URL` (ไม่ตรงกับ service อื่น)
4. **Missing `OLLAMA_URL`** ใน `env.validation.ts` Joi schema

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/03-application/docker-compose.yml` | `OLLAMA_API_URL` → `OLLAMA_URL` |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/.env.template` | `OLLAMA_API_URL` → `OLLAMA_URL` |
| `backend/src/modules/ai/services/ollama.service.ts` | fallback `192.168.10.100` → `192.168.10.11` |
| `backend/src/modules/ai/services/vram-monitor.service.ts` | fallback `192.168.10.100` → `192.168.10.11` |
| `backend/src/modules/ai/intent-classifier/services/ollama-client.service.ts` | `OLLAMA_BASE_URL` → `OLLAMA_URL` + fallback `localhost` → `192.168.10.11` |
| `backend/src/modules/ai/processors/np-dms-ai.processor.ts` | fallback `localhost` → `192.168.10.11` |
| `backend/src/modules/ai/ai-rag.service.ts` | fallback `localhost` → `192.168.10.11` |
| `backend/src/common/config/env.validation.ts` | เพิ่ม `OLLAMA_URL` ใน Joi schema |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/MIGRATION-PLAN.md` | อัปเดต env var name ในตาราง |

## กฎที่ Lock แล้ว

- **OLLAMA_URL** เป็น canonical env var name สำหรับ Ollama API URL ทุก service — ห้ามใช้ `OLLAMA_API_URL` หรือ `OLLAMA_BASE_URL`
- **Fallback URLs** ทุกที่ใน backend code ต้องชี้ไป `http://192.168.10.11:11434` (New Server — ADR-041) ไม่ใช่ `192.168.10.100` หรือ `localhost`
- OCR Sidecar (Python) ยังคงใช้ `OLLAMA_API_URL` เป็น env var ได้ เพราะเป็นคนละ codebase

## Verification

- [x] `tsc --noEmit` (backend) — exit 0, ไม่มี error
- [x] Jest: 147 tests passed, 17 suites (ollama/rag/vram/intent/processor)
- [x] ไม่มี `OLLAMA_API_URL` หรือ `OLLAMA_BASE_URL` เหลือใน backend executable code (เหลือเฉพาะใน change log comments)
- [x] ไม่มี `192.168.10.100` หรือ `192.168.10.8` เหลือใน backend executable code (เหลือเฉพาะใน change log comments)
- [ ] Restart application stack เพื่อยืนยันว่า backend เชื่อมต่อ Ollama ได้จริง
