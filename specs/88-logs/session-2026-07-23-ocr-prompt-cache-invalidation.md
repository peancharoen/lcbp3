# Session — 2026-07-23 (Feature-142: OCR Prompt Cache Invalidation)

## Summary

Implement Redis-based prompt cache invalidation สำหรับ OCR sidecar — ตรวจจับการเปลี่ยนแปลง system prompt และ unload Ollama model อัตโนมัติ เพื่อบังคับใช้ prompt ใหม่ พร้อม asyncio.Lock สำหรับ sequential OCR processing ป้องกัน race condition

## ปัญหาที่พบ (Root Cause)

Ollama มี KV cache สำหรับ system prompt — เมื่อส่ง system prompt ครั้งแรก จะถูก cache ไว้ และการส่ง system prompt ใหม่ในครั้งถัดไปจะไม่มีผล ระบบยึด prompt เดิม ต้อง unload model และโหลดใหม่เพื่อใช้ prompt ใหม่

ปัญหานี้รุนแรงขึ้นเมื่อย้ายไป New Server (RTX 5060 Ti 16GB) ที่ `keep_alive > 0` ทำให้ model อยู่ใน VRAM นานขึ้น → prompt cache อยู่นานขึ้น

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `04-ai/ocr-sidecar/requirements.txt` | เพิ่ม `redis>=5.0.0` |
| `04-ai/ocr-sidecar/docker-compose.yml` | เพิ่ม `REDIS_URL` env var |
| `04-ai/ocr-sidecar/services/prompt_cache.py` | สร้างใหม่: `compute_prompt_hash()`, `get/set/clear_prompt_hash()`, `unload_ollama_model()`, `check_and_unload_if_changed()`, `init_redis_client()` |
| `04-ai/ocr-sidecar/app.py` | เพิ่ม `asyncio.Lock` (ocr_lock), Redis client init ใน lifespan, `check_and_unload_if_changed()` ก่อน inference, T018 crash handling (clear hash on failure), T015 combined residency+hash logging, Change Log entry |
| `04-ai/ocr-sidecar/services/__init__.py` | อัปเดต comment |
| `04-ai/ocr-sidecar/tests/test_prompt_cache.py` | สร้างใหม่: 14 unit tests (compute_prompt_hash, check_and_unload_if_changed, unload_ollama_model, clear_prompt_hash) |
| `specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/tasks.md` | ทำเครื่องหมาย T001-T020 เสร็จทั้งหมด |

## กฎที่ Lock แล้ว

- **Prompt hash = SHA-256 truncated 16 hex chars** — `compute_prompt_hash(None)` คืน `"none"` เปรียบเทียบเหมือน prompt ปกติ
- **Redis key format**: `ocr:prompt:hash:{model_name}` — ใช้ Redis hash storage สำหรับ cross-process cache
- **Unload method**: POST `/v1/chat/completions` พร้อม `messages=[]`, `keep_alive=0` (ไม่ใช่ `/api/unload`)
- **asyncio.Lock** ครอบทั้ง `process_ocr` (unload + inference) — ป้องกัน race condition ระหว่าง unload กับ request ถัดไป
- **Graceful degradation**: ถ้า Redis ไม่พร้อม ระบบทำงานปกติโดยปิด prompt cache invalidation
- **T018 Edge case**: Ollama crash/restart ระหว่างประมวลผล → ล้าง Redis hash เพื่อบังคับ first-request behavior ใน retry

## Verification

- [ ] Rebuild OCR sidecar: `cd /opt/np-dms/04-ai/ocr-sidecar && sudo docker compose --env-file ../../.env up -d --build --no-cache`
- [ ] ทดสอบ unit tests: `pytest tests/test_prompt_cache.py`
- [ ] Quickstart Test 1: ส่ง OCR 2 ครั้งด้วย prompt เดียวกัน → ไม่ unload
- [ ] Quickstart Test 2: เปลี่ยน prompt → ส่ง OCR → unload + reload
- [ ] Quickstart Test 3: จำลอง keep_alive > 0 → เปลี่ยน prompt → unload อัตโนมัติ
- [ ] Quickstart Test 4: จำลอง Ollama crash → ส่ง OCR → hash ถูกล้าง → retry ทำงาน
