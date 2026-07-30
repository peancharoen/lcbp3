// File: specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/research.md
// Change Log:
// - 2026-07-23: Initial research for OCR Prompt Cache Invalidation

# Research: OCR Prompt Cache Invalidation

## R1: Ollama KV Cache Behavior with keep_alive

**Decision**: ใช้ `keep_alive=0` บน empty request เพื่อบังคับ unload model จาก VRAM

**Rationale**: จากการทดลองของผู้ใช้ยืนยันว่าเมื่อ model ค้างใน VRAM (keep_alive > 0) การส่ง system prompt ใหม่ใน payload ไม่มีผล เพราะ KV cache ยึด context เดิม ต้อง unload แล้ว reload ถึงจะใช้ prompt ใหม่ได้ จาก Ollama docs ยืนยันว่าการส่ง request พร้อม `keep_alive=0` และ empty messages/prompt จะ unload model ออกจาก memory

**Alternatives considered**:
- `ollama stop <model>` CLI command — ไม่ใช่ HTTP API ใช้ใน sidecar ไม่ได้
- รอให้ keep_alive หมดเอง — ช้าเกินไป (อาจเป็นนาทีถึงชั่วโมง)
- ส่ง system message แยก (role: "system") — จากการทดลอง Ollama ยึด KV cache เดิม ไม่รับ system message ใหม่

## R2: Unload Endpoint Selection

**Decision**: ใช้ `/v1/chat/completions` (OpenAI-compatible) พร้อม `keep_alive=0` และ `messages=[]`

**Rationale**: sidecar ปัจจุบันใช้ `/v1/chat/completions` สำหรับ inference อยู่แล้ว การใช้ endpoint เดียวกันสำหรับ unload ลดความซับซ้อน และเป็นวิธีที่ผู้ใช้ทดลองและยืนยันได้ผลจริง

**Alternatives considered**:
- `/api/generate` (Ollama native) พร้อม `keep_alive=0` — ใช้ได้เช่นกัน แต่ต่างจาก inference endpoint ที่ใช้อยู่
- `/api/chat` (Ollama native) พร้อม `keep_alive=0` — ใช้ได้ แต่เป็น native API ไม่ใช่ OpenAI-compatible

## R3: Redis vs Process-Level Variable for Hash Storage

**Decision**: ใช้ Redis สำหรับเก็บ prompt hash

**Rationale**: รองรับ multi-worker/multi-process ในอนาคต หาก sidecar scale เป็นหลาย workers แต่ละ worker จะเห็น prompt hash เดียวกัน นอกจากนี้ sidecar อยู่ใน Docker network เดียวกับ Redis อยู่แล้ว (docker-compose) การเพิ่ม Redis connection ไม่ซับซ้อน

**Alternatives considered**:
- Process-level variable (global) — ง่ายที่สุด แต่ถ้ามีหลาย workers จะไม่ share state
- File-based — ช้าและมี race condition
- SQLite — มากเกินไปสำหรับเก็บ hash 1 ค่า

## R4: asyncio.Lock for Sequential OCR Processing

**Decision**: ใช้ `asyncio.Lock` ที่ sidecar เพื่อบังคับ sequential OCR request

**Rationale**: sidecar ปัจจุบันรัน single-process (uvicorn workers=1) แต่ FastAPI รับ concurrent requests ได้ หากมี 2 requests พร้อมกันด้วย prompt ต่างกัน จะเกิด race condition ระหว่าง unload ของ request แรกกับ request ที่สอง asyncio.Lock บังคับให้ทีละตัว ปลอดภัยและง่าย

**Alternatives considered**:
- ไม่ใช้ lock — ถือว่า BullMQ concurrency=1 เป็นการันตี — แต่ sidecar ไม่ควร assume เรื่อง queue config
- Redis distributed lock — มากเกินไปสำหรับ single-process sidecar

## R5: Redis Connection from Sidecar

**Decision**: เพิ่ม `redis` package ใน requirements.txt และใช้ `redis.asyncio` (aioredis) สำหรับ async Redis operations

**Rationale**: sidecar ปัจจุบันไม่มี Redis connection (ไม่มีใน requirements.txt) ต้องเพิ่ม `redis>=5.0.0` ซึ่งรวม `redis.asyncio` อยู่แล้ว ใช้ async Redis client เพื่อไม่ block event loop ของ FastAPI

**Alternatives considered**:
- `aioredis` package — deprecated แล้ว รวมเข้า `redis-py` ตั้งแต่ v4.2+
- HTTP-based Redis proxy — ไม่จำเป็น เพิ่มความซับซ้อน

## R6: Hash Function Selection

**Decision**: ใช้ SHA-256 ตัดเหลือ 16 hex characters

**Rationale**: เพียงพอสำหรับการเปรียบเทียบ prompt เปลี่ยนหรือไม่ (collision probability ต่ำมากสำหรับ prompt text) และกิน Redis storage น้อย (16 chars)

**Alternatives considered**:
- MD5 — เร็วกว่า แต่ collision risk สูงกว่า
- Full SHA-256 (64 chars) — เกินจำเป็น
- xxhash — เร็วที่สุด แต่ต้องติดตั้งเพิ่ม
