# Session 2026-08-07 — BullMQ ai-batch Failed Jobs Fix + IDE ts-server Fix

## Summary

ตรวจสอบ BullMQ queue ทั้งหมด 13 คิว พบ `ai-batch` มี failed 7 รายการ (ทั้งหมดเป็น `sandbox-rag-prep` job type) ล้มเหลวด้วย `AxiosError: timeout of 30000ms exceeded` จาก `OllamaService.generate()` — แก้ไขโดยเพิ่ม env `AI_BATCH_TIMEOUT_MS` (default 120000ms) สำหรับ batch jobs และล้าง failed jobs ออกจาก Redis แล้ว หลังจากนั้นแก้ไข IDE ts-server false positive สำหรับ `.spec.ts` files โดยสร้าง `tsconfig.spec.json`

## ปัญหาที่พบ (Root Cause)

### ปัญหาที่ 1: BullMQ ai-batch failed 7 รายการ

- **Queue:** `bull:ai-batch` (คิวอื่นทั้งหมด 0 failed)
- **Job type:** `sandbox-rag-prep` (ทั้ง 7 รายการ)
- **Error:** `AxiosError: timeout of 30000ms exceeded`
- **Stack trace:** `OllamaService.generate` → `AiBatchProcessor.processSandboxRagPrep`
- **เวลาที่ fail:** 2026-08-03 (5 รายการ) + 2026-08-07 (2 รายการ)
- **Retry:** ทุก job retry ครบ 3 ครั้ง (exponential backoff 5s) แล้ว fail ทั้ง 3 ครั้ง

**Root cause:** `processSandboxRagPrep` เรียก `ollamaService.generate()` โดยไม่ส่ง `timeoutMs` จึงใช้ default `AI_TIMEOUT_MS = 30000` (30s) ซึ่งสั้นเกินไปสำหรับ batch job ที่ LLM โมเดล Qwen3 MoE 30.5B ต้อง generate ถึง 4096 tokens (ใช้เวลา 12-60s+ ตามขนาด prompt)

**สิ่งที่ตรวจสอบยืนยัน:**
- Ollama (192.168.10.11:11434) ทำงานปกติ — ไม่ใช่ปัญหา network/connectivity
- โมเดล `np-dms-ai:latest` โหลดอยู่ใน VRAM ~15.3GB/16GB
- ทดสอบจริง: prompt ขนาดปานกลาง + 4096 tokens ใช้เวลา ~12.6 วินาที — ถ้า prompt ใหญ่กว่า + generate ถึง 4096 tokens จะเกิน 30s
- `AI_TIMEOUT_MS` ไม่ได้ตั้งใน env ของ backend เลยใช้ default 30s
- มี hardcoded `timeoutMs: 120000` อยู่ 5 ที่ใน processor แต่ `processSandboxRagPrep` ลืมใส่

### ปัญหาที่ 2: IDE ts-server false positive ใน .spec.ts files

- **Error:** `Cannot find name 'jest'/'describe'/'it'/'expect'/'beforeEach'` ใน `ollama.service.spec.ts`
- **Root cause:** `tsconfig.json` หลักไม่ได้ระบุ `types: ["jest"]` และรวม spec files ใน `include` — IDE ts-server จึงไม่รู้จัก jest globals
- **ยืนยันว่าเป็น false positive:** build, lint, tests ทั้งหมดผ่าน (1013/1013 tests)

## การแก้ไข (Fix)

### ปัญหาที่ 1: AI_BATCH_TIMEOUT_MS env

| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `backend/src/modules/ai/services/ollama.service.ts` | เพิ่ม `batchTimeoutMs` (อ่านจาก env `AI_BATCH_TIMEOUT_MS`, default 120000) + getter `getBatchTimeoutMs()` |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | `processSandboxRagPrep` ส่ง `timeoutMs` แล้ว และแทนที่ hardcoded `120000` ทั้ง 5 จุดด้วย `getBatchTimeoutMs()` |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/03-application/docker-compose.yml` | เพิ่ม `AI_TIMEOUT_MS` + `AI_BATCH_TIMEOUT_MS` env |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/.env.template` | เพิ่ม documentation สำหรับ timeout ทั้งสองตัว |
| `backend/src/modules/ai/services/ollama.service.spec.ts` | เพิ่ม `AI_BATCH_TIMEOUT_MS: 120000` ใน mock config + เพิ่ม test สำหรับ `getBatchTimeoutMs()` |
| `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` | เพิ่ม `getBatchTimeoutMs: jest.fn().mockReturnValue(120000)` ใน mock |

### ปัญหาที่ 2: tsconfig.spec.json

| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `backend/tsconfig.spec.json` | **สร้างใหม่** — extends `tsconfig.json`, เพิ่ม `types: ["node", "jest"]`, include เฉพาะ spec/mock/test files |
| `backend/tsconfig.json` | เพิ่ม `src/**/*.spec.ts`, `src/**/*.mock.ts`, `tests` ใน `exclude` |
| `backend/jest.config.js` | ts-jest ใช้ `tsconfig.spec.json` (`{ tsconfig: 'tsconfig.spec.json' }`) |

### Redis cleanup

- ลบ `bull:ai-batch:failed` sorted set (7 entries)
- ลบ hash key ของ 7 failed jobs แต่ละ job

## กฎที่ Lock แล้ว

- **D97 — AI Batch Timeout:** BullMQ `ai-batch` jobs ต้องใช้ `OllamaService.getBatchTimeoutMs()` (env `AI_BATCH_TIMEOUT_MS`, default 120000ms) ไม่ใช่ default `AI_TIMEOUT_MS` (30000ms) — เพราะ LLM batch jobs ใช้เวลานานกว่า realtime calls
- **D98 — tsconfig.spec.json:** spec files ต้องใช้ `tsconfig.spec.json` (extends `tsconfig.json` + `types: ["node", "jest"]`) แยกจาก `tsconfig.json` หลัก เพื่อให้ IDE และ ts-jest รู้จัก jest globals โดยไม่กระทบ production build

## Verification

- [x] Build: `pnpm run build` — pass (exit 0)
- [x] Lint: `npx eslint` สำหรับไฟล์ที่แก้ — pass (exit 0)
- [x] Tests targeted: `ollama.service.spec` + `ai-batch.processor.spec` — 50/50 pass (เพิ่ม 1 test ใหม่)
- [x] Tests full suite: 108 suites, 1013 tests passed (10 skipped, 0 failed)
- [x] Redis queue status: ทุกคิว `failed=0` หลังล้าง
- [x] IDE ts-server false positive แก้ไขแล้ว (อาจต้อง restart TS server ใน IDE)
