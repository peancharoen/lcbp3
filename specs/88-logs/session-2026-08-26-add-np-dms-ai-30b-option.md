# Session — 2026-08-26 (Add np-dms-ai-30b Model Option)

## Summary

เพิ่ม `np-dms-ai-30b:latest` (30B variant, `scb10x/typhoon2.5-qwen3-30b-a3b`) เป็นตัวเลือก Load/Unload ใน VRAM Management Card ของ `CombinedOllamaEngineCard` คู่กับ `np-dms-ai` (4B) และ `np-dms-ocr` — และแก้ default model ที่ผิดหลายจุด + แก้ auto-evict substring bug ที่จะเกิดขึ้นเมื่อมี 2 variants ของ `np-dms-ai`

## ปัญหาที่พบ (Root Cause)

1. **`OLLAMA_RAG_MODEL` default = `gemma2`** — `ai-rag.service.ts` ใช้ `gemma2` เป็น default ทั้งที่ model นี้ไม่ได้ใช้จริงในระบบ (model จริง = `np-dms-ai:latest`); `OLLAMA_RAG_MODEL` env var ไม่ได้ set ใน container จึงใช้ default นี้
2. **`OLLAMA_INTENT_MODEL` fallback = `gemma4:e4b`** — `intent-classifier/ollama-client.service.ts` ใช้ `gemma4:e4b` เป็น fallback ของ `OLLAMA_MODEL_MAIN` ทั้งที่ canonical model = `np-dms-ai:latest`
3. **`autoEvictIfNeeded` substring bug** — `vram-monitor.service.ts` ใช้ `model.name.includes(targetModelName.replace(':latest', ''))` สำหรับ skip eviction ของ target model; แต่ `"np-dms-ai"` เป็น substring ของ `"np-dms-ai-30b"` ทำให้เมื่อโหลด `np-dms-ai` (4B) ระบบจะไม่ evict `np-dms-ai-30b` ที่กิน VRAM อยู่ — เป็น latent bug ที่จะ manifest เมื่อมี 2 variants
4. **`toCanonicalModel` substring collision** — `ai-constants.ts` เช็ค `MAIN_MODEL_NAME` (`np-dms-ai`) ก่อน ทำให้ `np-dms-ai-30b:latest` ถูก normalize เป็น `np-dms-ai` แทน `np-dms-ai-30b`; เดิมมีแค่ 1 variant จึงไม่มีปัญหา

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/ai-rag.service.ts` | `OLLAMA_RAG_MODEL` default `gemma2` → `np-dms-ai:latest` |
| `backend/src/modules/ai/intent-classifier/services/ollama-client.service.ts` | `OLLAMA_MODEL_MAIN` fallback `gemma4:e4b` → `np-dms-ai:latest` |
| `backend/src/modules/ai/services/vram-monitor.service.ts` | `autoEvictIfNeeded` เปลี่ยนจาก `includes()` substring match → exact match หลัง strip `:latest` (กัน `np-dms-ai` match `np-dms-ai-30b`) |
| `frontend/components/admin/ai/ai-constants.ts` | เพิ่ม `MAIN_MODEL_30B_NAME = 'np-dms-ai-30b'`; อัปเดต `toCanonicalModel` ให้เช็ค 30b ก่อน main (เพราะ `"np-dms-ai-30b"` มี `"np-dms-ai"` เป็น substring) |
| `frontend/components/admin/ai/CombinedOllamaEngineCard.tsx` | เพิ่ม `MAIN_MODEL_30B_NAME` ใน import + `canonicalCatalog` + `normalizeLoadedModels` (2 branches) + `healthOllamaModels` mapping — แสดงเป็น row ที่ 2 คู่กับ `np-dms-ai` และ `np-dms-ocr` |

## กฎที่ Lock แล้ว

- **D174 — Multi-Variant Model Substring Collision**: เมื่อมีหลาย variants ของ model เดียวกัน (เช่น `np-dms-ai` และ `np-dms-ai-30b`) การ normalize ชื่อและการเปรียบเทียบใน backend/frontend ต้องเช็ค variant ที่ยาวกว่าก่อน (longest-prefix-first) เพราะชื่อสั้นกว่าเป็น substring ของชื่อยาวกว่า; ใช้ exact match หลัง strip `:latest` สำหรับ auto-evict logic ไม่ใช้ `includes()`
- **D175 — Default Model = Canonical**: default ของ `OLLAMA_RAG_MODEL` และ `OLLAMA_INTENT_MODEL` fallback ต้องเป็น `np-dms-ai:latest` (canonical model ตาม ADR-034) ไม่ใช่ `gemma2`/`gemma4:e4b` ที่ไม่ได้ใช้จริง

## Verification

- [x] Backend build ผ่าน (`nest build` exit 0)
- [x] Frontend production build ผ่าน (49 pages)
- [x] ESLint ผ่าน (pre-commit hook ใน 2git.sh)
- [x] Commit `8bb5683b` pushed to `origin/main` (`90e147fe..8bb5683b`)
- [ ] **Browser verify** — หน้า `/admin/ai` แสดง 3 Ollama models: `np-dms-ai`, `np-dms-ai-30b`, `np-dms-ocr`
- [ ] **Browser verify** — กด Load `np-dms-ai-30b` ได้ (ต้อง unload `np-dms-ai` ก่อนเพราะ VRAM 16GB ไม่พอโหลดพร้อมกัน)
- [ ] **Browser verify** — auto-evict ทำงานถูกต้องเมื่อโหลด 4B ขณะที่ 30B resident (ต้อง evict 30B ไม่ใช่ skip)
- [ ] **Gitea Actions deploy** — pending after push
