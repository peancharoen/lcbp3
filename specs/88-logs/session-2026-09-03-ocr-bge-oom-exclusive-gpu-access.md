# Session — 2026-09-03 (OCR OOM Root Cause + BGE Lazy-Load Restore + Exclusive GPU Access)

## Summary

User รายงาน `/admin/migration` extract ใช้งานไม่ได้ — พบว่า D171 (BGE lazy-load, 2026-08-26) หายไปจากโค้ด sidecar ทำให้ BGE ค้าง GPU จน np-dms-ocr OOM crash กู้คืนโค้ด + หา root cause ที่แท้จริง (ไม่ใช่ commit ไหนทำหาย แต่เป็น uncommitted hotfix ที่ถูก `copy-env.sh` ทับ) แล้วปิด process gap ถาวร ต่อด้วย implement exclusive GPU access ป้องกัน OOM แบบเดียวกันเกิดซ้ำกับคู่โมเดลอื่น (np-dms-ai/30b vs np-dms-ocr)

## ปัญหาที่พบ (Root Cause)

1. **BGE-M3 ค้าง GPU ตลอด** — `/opt/np-dms/04-ai/ocr-sidecar/app.py` ไม่มี `/bge/load|unload|status` endpoints และไม่มี auto-unload หลัง idle — โหลด BGE ตอน startup, ย้ายไป `cuda` ตอน `/embed`/`/rerank` แต่ไม่เคยย้ายกลับ `cpu`
2. เมื่อ `np-dms-ocr` ต้องการ vision encoder compute buffer ~9.3GB ระหว่าง active inference บน GPU 16GB ที่ BGE (~4.8GB) ค้างอยู่ → `cudaMalloc failed: out of memory` → `llama-server` crash (`signal: aborted, core dumped`) → sidecar auto-fallback ก็ fail (`write EPIPE` เพราะ connection พังไปแล้ว) → migration extract ล้มเหลว (`OCR_FAILED`)
3. **สาเหตุที่ D171 หาย:** commit `90e147fe` (2026-08-26, D171) แก้แค่ backend TypeScript (`ocr.service.ts` เรียก `/bge/unload`) — ฝั่ง Python sidecar (`/bge/*` endpoints, lazy-load functions) ถูก **hotfix ตรงที่ runtime server โดยไม่เคย commit เข้า canonical spec** ต่อมามีคน commit งาน ADR-040 D2/D3 (prompt hot-load, 2026-09-01) เข้า canonical แล้วรัน `/opt/np-dms/copy-env.sh` (one-way sync canonical→runtime) ทับ hotfix ที่ runtime หายไปแบบเงียบๆ — ไม่มี warning เพราะ git ไม่รู้จักไฟล์ runtime เลย
4. **ความเสี่ยงที่ 2 ที่พบระหว่างอธิบาย architecture:** ไม่มี guard ป้องกัน `np-dms-ai`/`np-dms-ai-30b` โหลดพร้อมกับ `np-dms-ocr` กำลัง active inference — `OllamaService.generate()` (เรียกทุก AI request) ไม่เช็ค VRAM หรือ evict OCR ก่อนเลย (auto-evict ของ ADR-048 มีเฉพาะ manual admin endpoint) ยิ่งอันตรายเพราะ `np-dms-ai-30b` = 17.7GB **ใหญ่กว่า GPU ทั้งใบ (16.3GB)**

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/04-Infrastructure-OPS/.../04-ai/ocr-sidecar/app.py` + `/opt/np-dms/04-ai/ocr-sidecar/app.py` | กู้คืน D171 (BGE lazy-load globals, `_load_bge_model`/`_load_reranker`/`_unload_bge_models`/`_ensure_bge_loaded`/`_check_bge_keep_alive`/`_bge_keep_alive_monitor`, `/bge/load\|unload\|status` endpoints) โดยรักษา D2/D3 (prompt hot-load) ที่มีอยู่ไว้ครบ |
| `/opt/np-dms/copy-env.sh` | เพิ่ม `warn_if_diff_lost()` — เตือน `[DIFF]` พร้อม diff จริงก่อนทับไฟล์ที่ runtime ต่างจาก canonical, สรุป banner ท้าย script ถ้ามี diff ถูกทับ (ไม่ block, ยัง automation-safe) — ไฟล์นี้อยู่นอก git (ไม่ commit ได้) |
| `backend/src/modules/ai/services/ocr.service.ts` | เพิ่ม exclusive GPU access ใน `detectAndExtract()` — unload BGE + main model ก่อนเรียก sidecar เสมอ, reload main กลับใน `finally`; inject `OllamaService` |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | ลบ explicit `unloadBgeModels()` call ใน `processLegacyAiEnrichment` (redundant, centralize แล้วใน `OcrService`) |
| `backend/src/modules/ai/tests/ocr.service.spec.ts`, `ocr-residency.spec.ts` | เพิ่ม `OllamaService` mock provider; แก้ assertion ให้หา axios call ด้วย URL แทน index 0 |
| `memory/project-memory-override.md` | เพิ่ม D259 (copy-env.sh one-way sync process gap) |

## กฎที่ Lock แล้ว

- **D259** — `copy-env.sh` เป็น one-way sync canonical→runtime เท่านั้น ห้าม hotfix sidecar Python ที่ runtime โดยไม่ commit กลับ canonical ก่อนเสมอ (ไม่งั้นถูกทับหายเงียบๆ รอบถัดไป)
- **D261** — Exclusive GPU access ระหว่าง `{main LLM, BGE}` กับ `np-dms-ocr`: unload ทั้งคู่ก่อน OCR ทุกครั้ง (ที่ `OcrService.detectAndExtract()`, single choke point ของทุก caller), reload main กลับหลังเสร็จเสมอ — ยอมรับ cold-start latency (5-15s ต่อครั้ง) แลกความปลอดภัย 100% แทนการทำ proactive-check เฉพาะจังหวะ spike (ตัดสินใจโดย user: "ยอมรับ latency แลกความปลอดภัย 100%")
- **ยังไม่แก้ (ทราบแล้ว แต่นอก scope):** `np-dms-ai-30b` (17.7GB) ใหญ่กว่า GPU ทั้งใบ (16.3GB) — เป็นปัญหา "โมเดลไม่พอดี" ไม่ใช่ปัญหา coordination แก้ด้วย load/unload sequencing ไม่ได้ ต้องพิจารณา partial GPU offload หรือเลิกใช้ตัวนี้บน GPU ขนาดนี้

## Verification

- [x] Sidecar rebuild + restart — `GET /bge/status` และ `POST /bge/unload` ตอบ 200 (เดิม 404)
- [x] GPU VRAM ว่างสนิทหลัง fix (12MiB used / 15.8GB free เทียบกับ BGE ค้าง ~4.8GB ก่อนหน้า)
- [x] Backend: `tsc --noEmit` ผ่าน, `eslint` ผ่าน, targeted tests 6/6 ผ่าน, full AI module suite 616/616 ผ่าน
- [x] Commit + push ไป `origin main` ผ่าน `2git.sh` — squashed เป็น `e420980d`
- [x] CI/CD pipeline (`.gitea/workflows/ci-deploy.yml`) trigger อัตโนมัติจาก push — build+test+deploy (SSH → `git reset --hard origin/main` → `scripts/deploy.sh`) โดยไม่ต้อง manual rebuild
- [ ] ตรวจสอบ CI/CD run ล่าสุดว่า pass/fail (user ขอให้รอเฉยๆ ไม่ต้องเช็คตอนนี้)

## Follow-up: loadModel() keep_alive bug พบระหว่าง verify จริง

หลัง deploy user ทดสอบแล้วรายงานว่า np-dms-ocr กับ np-dms-ai ยังโหลดพร้อมกันอยู่ — ตรวจ log พบว่า exclusive-GPU sequence (unload BGE → unload main → OCR → reload main) **ทำงานถูกต้องทุกขั้นตอนจริง** แต่ step สุดท้าย (reload main) ล้มเหลวด้วย `AxiosError 400` ทุกครั้ง

**Root cause:** `ConfigService.get<number>('OLLAMA_MAIN_KEEP_ALIVE_SECONDS', 120)` ไม่ cast ค่าจริง — env var เป็น string เสมอ (`process.env`) ทำให้ `this.mainKeepAliveSeconds` เป็น string `"120"` ตอน runtime ทั้งที่ TypeScript เชื่อว่าเป็น `number`; `loadModel()` ใช้ `typeof keepAlive === 'string'` ตัดสินว่า "format แล้ว" จึงส่ง `keep_alive: "120"` (ไม่มี unit) ไป Ollama 0.30+ โดน 400 — บั๊กนี้มีอยู่เดิม แต่ path นี้ไม่เคยถูกเรียกถี่ขนาดนี้มาก่อน (exclusive-GPU fix เรียก reload ทุกครั้งที่มี OCR)

**Fix:** เปลี่ยนเป็นเช็คว่าเป็นตัวเลขล้วนก่อน (`/^-?\d+$/`) ไม่ว่าจะเป็น JS number หรือ numeric string — commit `3c814acd` (D262), เพิ่ม regression test จำลอง ConfigService numeric-string, 617/617 tests ผ่าน

- [x] แก้ + verify + push `3c814acd`
- [ ] **ยังไม่ยืนยันผ่าน browser จริงหลัง fix รอบนี้** — ต้องลอง extract อีกครั้งหลัง CI/CD deploy commit ล่าสุดเสร็จ
