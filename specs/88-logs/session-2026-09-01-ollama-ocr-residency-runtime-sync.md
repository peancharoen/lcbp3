# Session — 2026-09-01 (Ollama/OCR Residency และ Runtime Sync)

## Summary

แก้ปัญหา `np-dms-ai` ถูก pin ใน Ollama แบบ `Forever`, แก้ OCR prompt-cache unload ที่เรียก endpoint ผิด, แยก model footprint ออกจาก GPU-resident memory ใน AI Control Center และ sync canonical OCR compose กับตัวรันจริง `/opt/np-dms/04-ai/ocr-sidecar`.

## ปัญหาที่พบ (Root Cause)

- `OllamaService.generate()` และ OCR model-switch reload ใช้ `keep_alive=-1` ทำให้ `np-dms-ai` ค้างใน VRAM ตลอด
- ค่า OCR ประมาณ `2892 MB` มาจาก Ollama `size_vram` ซึ่งเป็นเฉพาะส่วนที่ resident บน GPU ไม่ใช่ model footprint ทั้งหมด (`size` ประมาณ 10 GB)
- OCR sidecar ส่ง empty messages ไป `/v1/chat/completions` เพื่อ unload และ Ollama ตอบ `400 Bad Request`; native `/api/generate` รองรับ empty prompt + `keep_alive: 0`
- การ recreate sidecar ครั้งแรกไม่ได้ส่ง `/opt/np-dms/.env` ทำให้ Redis authentication ล้มเหลว; runtime script กำหนดให้ใช้ `--env-file ../../.env`
- Canonical OCR compose ล้าหลัง runtime: ไม่มี NVIDIA runtime/device reservation, memory limit ยังเป็น 2G และ `OCR_MAX_PAGES=0`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/services/ollama.service.ts` | เพิ่ม finite main-model residency ผ่าน `OLLAMA_MAIN_KEEP_ALIVE_SECONDS` ค่าเริ่มต้น 120 วินาที |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | reload main model หลัง OCR ด้วย finite residency แทน `-1` |
| `backend/src/modules/ai/services/vram-monitor.service.ts` | Admin load ใช้ finite residency และคืน `modelSizeMB` แยกจาก `vramUsageMB` |
| `frontend/components/admin/ai/CombinedOllamaEngineCard.tsx` | แสดงขนาดรวมและ GPU-resident memory คนละคอลัมน์ |
| `specs/.../03-application/docker-compose.yml` และ `.env.template` | เพิ่ม `OLLAMA_MAIN_KEEP_ALIVE_SECONDS=120` |
| `specs/.../04-ai/ocr-sidecar/services/prompt_cache.py` | เปลี่ยน unload เป็น `/api/generate` + empty prompt + `keep_alive: 0` |
| `/opt/np-dms/04-ai/ocr-sidecar/services/prompt_cache.py` | sync fix ไปยัง source ของตัวรันจริง |
| `/opt/np-dms/04-ai/ocr-sidecar/requirements.txt` | pin `pytest==8.3.5` และ `pytest-asyncio==0.25.3` ใน image จริง |
| `specs/.../04-ai/ocr-sidecar/docker-compose.yml` | sync NVIDIA runtime, GPU reservation, memory 4G และ `OCR_MAX_PAGES=5` จาก runtime |

## กฎที่ Lock แล้ว

- Main Ollama model ต้องใช้ finite residency (default 120 วินาที) ไม่ใช้ `keep_alive=-1` เป็น default
- Ollama model unload ต้องเรียก native `/api/generate` ด้วย `prompt: ""` และ `keep_alive: 0`
- Telemetry/UI ต้องแยก `size` (model footprint) ออกจาก `size_vram` (GPU-resident memory)
- การจัดการ OCR sidecar runtime ต้องใช้ `/opt/np-dms/04-ai/ocr-sidecar/docker-compose.yml` พร้อม `--env-file ../../.env`; canonical spec ต้อง sync กับ runtime

## Verification

- [x] Backend targeted tests 101 tests ผ่าน
- [x] Frontend tests 996 tests ผ่าน
- [x] Backend build และ lint ผ่าน
- [x] Frontend production build และ lint ผ่าน
- [x] OCR prompt-cache pytest 16 tests ผ่านใน rebuilt runtime image
- [x] `ocr-sidecar` healthy และ log ยืนยัน Redis client connected
- [x] Canonical/runtime OCR compose มี SHA256 ตรงกัน: `3115be0a813f9d6033db35a2faf26d2cae2dbbcb764623f85a67e2f3e5127806`
