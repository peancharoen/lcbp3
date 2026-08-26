# Session 2026-08-26 — BGE Lazy-Load + GPU Coordination (OCR OOM Fix)

## Summary

แก้ Bug #1 (WAITING status missing in DB enum) และ Bug #2 (OCR OOM เพราะ BGE กิน GPU 4.8GB ตลอดเวลา) — refactor BGE จาก startup-load เป็น lazy-load + keep_alive auto-unload + coordination logic ระหว่าง Ollama และ Sidecar

## ปัญหาที่พบ (Root Cause)

### Bug #1: WAITING status missing in DB enum

- `migration_review_queue.ai_status` enum ใน DB ขาด `WAITING` (มีแค่ `PENDING, RUNNING, DONE, FAILED`)
- Service พยายาม `UPDATE ... SET ai_status='WAITING'` → error `Data truncated for column`
- SQL delta มีอยู่ใน repo แต่ไม่ได้ apply ลง DB

### Bug #2: OCR OOM — `num_ctx 32768` investigation

**คำถามผู้ใช้:** "num_ctx 32768 อยู่ที่ไหน"

**คำตอบ:**
- `np-dms-ocr` Modelfile ตั้ง `PARAMETER num_ctx 16384`
- Ollama คูณด้วย `OLLAMA_NUM_PARALLEL=2` → `-c 32768` (16384 × 2 slots) ใน llama-server command
- **ไม่ใช่สาเหตุ OOM**

**สาเหตุจริงของ OCR OOM:**
- ก่อนหน้านี้ sidecar BGE รัน CPU → GPU 16GB ทั้งหมดให้ Ollama → OCR ทำงานได้
- พอเพิ่ม GPU ให้ sidecar (แก้ rerank timeout) → BGE กิน 4.8GB GPU ตลอด → เหลือ 11GB
- OCR ต้องการ: model weights 3GB + KV cache 2GB + vision encoder 9.3GB = 14.3GB > 11GB → OOM
- แม้ไม่มี `np-dms-ai` โหลดอยู่ก็ยัง OOM เพราะ BGE กิน 4.8GB อยู่

**Key insight จากผู้ใช้:** "ก่อนหน้านี้ ใช้ scb10x/typhoon2.5-qwen3-30b-a3b + scb10x/typhoon-ocr1.5-3b ก็รันได้ พอเปลี่ยนเป็น scb10x/typhoon2.5-qwen3-4b + scb10x/typhoon-ocr1.5-3b กลับมีปัญหา ทั้งที่ np-dms-ai ลดขนาดลง np-dms-ocr ก็ตัวเดิม" → บอกว่าปัญหาไม่ใช่ model ขนาด แต่เป็นการเพิ่ม GPU ให้ sidecar

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `specs/03-Data-and-Storage/deltas/2026-08-26-add-waiting-to-ai-status-enum.sql` | Apply delta ลง DB — เพิ่ม `WAITING` ใน enum |
| `/opt/np-dms/04-ai/ocr-sidecar/app.py` | Refactor BGE จาก startup-load → lazy-load + keep_alive auto-unload (300s); เพิ่ม `/bge/load`, `/bge/unload`, `/bge/status` endpoints; background keep_alive monitor task |
| `backend/src/modules/ai/services/ocr.service.ts` | เพิ่ม `unloadBgeModels()` และ `getBgeStatus()` methods |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | Unload BGE ก่อน OCR job (coordination logic 4.a) |
| `backend/src/modules/ai/ai-rag.service.ts` | Unload BGE ก่อน LLM generate (coordination logic 4.b — เผื่อกลับไปใช้ 30B model) |
| `backend/src/modules/ai/ai.controller.ts` | เพิ่ม `POST /ai/admin/bge/load`, `POST /ai/admin/bge/unload`, `GET /ai/admin/bge/status` endpoints |
| `frontend/components/admin/ai/CombinedOllamaEngineCard.tsx` | เพิ่ม BGE row ใน model catalog table (3 models: np-dms-ai, np-dms-ocr, bge-m3-reranker) |
| `frontend/components/admin/ai/ai-constants.ts` | เพิ่ม `BGE_MODEL_NAME = 'bge-m3-reranker'` |
| `frontend/lib/services/admin-ai.service.ts` | เพิ่ม `loadBgeModels()`, `unloadBgeModels()`, `getBgeStatus()` + `BgeStatusResponse` interface |

## กฎที่ Lock แล้ว

- **D170: BGE Lazy-Load + GPU Coordination** — BGE-M3 และ BGE-Reranker ต้อง lazy-load (ไม่โหลดตอน sidecar startup) + auto-unload หลัง idle 300s; backend ต้อง unload BGE ก่อน OCR job และก่อน LLM generate เพื่อคืน GPU memory ให้ Ollama
- **D171: BGE Model Control in UI** — `CombinedOllamaEngineCard` ต้องแสดง 3 models (np-dms-ai, np-dms-ocr, bge-m3-reranker) พร้อม Load/Unload buttons; BGE row ใช้ purple accent color เพื่อแยกจาก Ollama models
- **D172: num_ctx 32768 = Modelfile × NUM_PARALLEL** — Ollama คูณ `num_ctx` จาก Modelfile ด้วย `OLLAMA_NUM_PARALLEL` slots; ไม่ใช่ค่าที่ตั้งโดยตรง แต่เป็นผลพลอยได้จาก parallel slot configuration

## Verification

- [x] DB enum ครบ: `enum('PENDING','WAITING','RUNNING','DONE','FAILED')`
- [x] Sidecar startup: GPU ใช้ 10MB (BGE ไม่โหลด)
- [x] `/health` แสดง `bgeLoaded: false, rerankerLoaded: false`
- [x] `/bge/status` ทำงาน
- [x] OCR test: 200 OK (112s) — ได้ข้อความ OCR จริงจาก PDF
- [x] Embed test: 200 OK (5.4s) — BGE lazy load สำเร็จ
- [x] Rerank test: 200 OK (40s) — BGE lazy load สำเร็จ
- [x] BGE unload: คืน 4.8GB GPU (212MB → 15.6GB free)
- [x] Backend build: pass
- [x] Frontend build: pass
- [x] Commit: `2503c1b7`
- [ ] Browser verify: หน้า `/admin/ai` แสดง BGE row ใน Ollama Engine & VRAM Management
- [ ] Browser verify: กด Load/Unload BGE ได้
- [ ] Browser verify: Legacy Review Queue แสดง WAITING status
- [ ] Gitea Actions deploy
