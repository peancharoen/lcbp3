# Session — 2026-08-05 (AI Profile Defaults Sync)

## Summary

Sync ค่า default ของ `defaultProfiles` (interactive/standard/quality/deep-analysis) ให้ตรงกันทั้ง 3 แหล่ง (code, docs, seed SQL) โดยยึด `ai-policy.service.ts` เป็น canonical และอัปเดตฐานข้อมูล lcbp3 ให้ตรงกับ code ด้วย

## ปัญหาที่พบ (Root Cause)

ตรวจพบค่า default ของ 4 execution profiles แตกต่างกัน 3 ชุด:

1. **ชุด A — `docs/ai-profiles.md`** (เอกสารอ้างอิง): temp interactive=0.7, standard=0.5, quality=0.1, deep-analysis=0.3; repeat_penalty=1.15 ทุกตัว
2. **ชุด B — `ai-policy.service.ts`** (code จริง): temp interactive=0.15, standard=0.3, quality=0.1, deep-analysis=0.3; repeat_penalty=1.05 ทุกตัว
3. **ชุด C — `lcbp3-v1.9.0-seed-basic.sql`** (seed DB): temp interactive=0.7, standard=0.5, quality=0.3, deep-analysis=0.2; repeat_penalty=1.1/1.15/1.2/1.25; keep_alive=300 ทุกตัว (ผิดจาก docs ที่ระบุ 600/600/0)

และ DB ที่รันจริงมีค่าเท่ากับชุด C (seed เดิม) — ไม่ตรงกับ code ที่ใช้ fallback

## การแก้ไข (Fix)

ยึด `ai-policy.service.ts` (ชุด B) เป็น canonical และ sync ทุกแหล่ง + DB ให้ตรงตาม

### ค่า Canonical ใหม่

| Profile | temp | topP | maxTokens | numCtx | repeatPenalty | keepAliveSeconds |
|---|---|---|---|---|---|---|
| interactive | 0.15 | 0.9 | 2048 | 4096 | 1.05 | 300 |
| standard | 0.3 | 0.8 | 4096 | 8192 | 1.05 | 600 |
| quality | 0.1 | 0.95 | 8192 | 8192 | 1.05 | 600 |
| deep-analysis | 0.3 | 0.85 | 8192 | 32768 | 1.05 | 0 |

### ไฟล์ที่แก้ไข (7 ไฟล์)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `docs/ai-profiles.md` | อัปเดตค่าทั้ง 4 profile ให้ตรงกับ code |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-basic.sql` | อัปเดต seed `ai_execution_profiles` (4 rows) + `ai_sandbox_profiles` (standard) |
| `specs/200-fullstacks/235-ai-runtime-policy-refactor/data-model.md` | อัปเดต default comments ใน RuntimePolicy interface |
| `specs/200-fullstacks/235-ai-runtime-policy-refactor/contracts/create-ai-job.dto.md` | อัปเดตตาราง Profile Default Parameters |
| `specs/200-fullstacks/236-unified-ocr-architecture/quickstart.md` | อัปเดต expected values (standard temperature 0.5 → 0.3) 3 จุด |
| `backend/src/modules/ai/tests/ai-policy.service.spec.ts` | อัปเดต 2 assertions ที่ตรวจ default fallback (standard temp 0.5 → 0.3) |

### การอัปเดต DB (lcbp3)

อัปเดตผ่าน MCP MariaDB tools (`mysql_update`):

**`ai_execution_profiles`:**
- `interactive`: temperature 0.700 → 0.150, repeat_penalty 1.150 → 1.050
- `standard`: temperature 0.500 → 0.300, repeat_penalty 1.150 → 1.050
- `quality`: repeat_penalty 1.150 → 1.050
- `deep-analysis`: repeat_penalty 1.150 → 1.050

**`ai_sandbox_profiles`:**
- `standard`: temperature 0.500 → 0.300, repeat_penalty 1.150 → 1.050

**ไม่ได้แตะ:**
- `ocr-extract` profile (ใช้ `defaultOcrPolicy` ไม่ใช่ `defaultProfiles` — admin calibrate เอง)
- `quality` และ `deep-analysis` ค่าอื่นที่นอกจาก repeat_penalty (ถูกต้องอยู่แล้ว)

## กฎที่ Lock แล้ว

- **D94 — defaultProfiles canonical source:** `ai-policy.service.ts` เป็น canonical source ของค่า default ทั้ง 4 profile (interactive/standard/quality/deep-analysis) — `docs/ai-profiles.md`, seed SQL, และ DB ต้อง sync ให้ตรงเสมอ; ห้ามแก้ค่าใน docs/seed โดยไม่แก้ใน code ก่อน
- **D95 — resolve priority:** `AiPolicyService.getProfileParameters()` resolve ตามลำดับ Redis cache (TTL 60s) → DB (`ai_execution_profiles` is_active=1) → hardcoded default ใน code — admin calibrate ผ่าน DB ได้ แต่ fallback ต้องตรงกับ code เสมอ
- **D96 — `ocr-extract` แยกจาก defaultProfiles:** `ocr-extract` ใช้ `defaultOcrPolicy` (model `np-dms-ocr`, keep_alive dynamic ตาม VRAM headroom) ไม่ใช่ส่วนหนึ่งของ 4 defaultProfiles — ไม่ต้อง sync ตาม

## Verification

- [x] `npx jest --testPathPatterns='ai-policy.service.spec'` — 25/25 tests pass
- [x] `npx jest --testPathPatterns='ai'` — 317 passed, 9 skipped, 0 failed (33 suites)
- [x] DB query ยืนยันค่าทั้ง 5 rows ของ `ai_execution_profiles` ถูกต้อง
- [x] DB query ยืนยันค่า `ai_sandbox_profiles` (standard) ถูกต้อง
- [x] ตรวจไม่มีไฟล์อื่นที่อ้างค่า default เดิม (0.7/0.5/1.15 ใน context ของ defaultProfiles) ยกเว้น Modelfiles ที่เป็นพารามิเตอร์ Ollama คนละ layer (runtime policy ส่งไป override ตอน request)
