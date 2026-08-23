# Session 2026-08-23 — Qdrant "Down" ที่หน้า AI System (undici override)

## Summary

หน้า `/admin/ai/system` แสดง `Qdrant Vector DB = Down` ทั้งที่ container `qdrant` healthy และ network เข้าถึงได้ปกติ — root cause คือ pnpm override ของ `undici` แบบปลายเปิดทำให้ resolve ไป 8.10.0 ซึ่งเข้ากันไม่ได้กับ `@qdrant/js-client-rest`; แก้โดย pin `undici: 7.29.0` แบบ bounded, deploy `9951b41d` และยืนยัน Qdrant Healthy บน production

## ปัญหาที่พบ (Root Cause)

**อาการที่ทำให้เข้าใจผิด:** ทุกชั้น infrastructure ดูปกติหมด

- container `qdrant` — Up 4 days (healthy), `/healthz` = passed, collection `lcbp3_vectors` มีอยู่, server v1.18.1
- `curl http://qdrant:6333/collections` **จากใน backend container** = HTTP 200
- `node -e "fetch('http://qdrant:6333/collections')"` (global fetch เปล่า ๆ) ในคอนเทนเนอร์ = สำเร็จ

**Root cause จริง — undici major mismatch:**

`@qdrant/js-client-rest@1.17.0` สร้าง `undici.Agent` แล้วส่งเป็น `dispatcher` เข้า **global `fetch` ของ Node 24** (ซึ่งใช้ undici 7 เป็น internal) — Agent ของ **undici 8** ตัด handler interface แบบเก่าออก จึง throw `invalid onRequestStart method` ห่อออกมาเป็น `fetch failed`

qdrant client ประกาศ dependency ไว้ `undici: ^6.23.0` แต่ overrides ใน `pnpm-workspace.yaml` เป็นแบบ **ปลายเปิด**:

```yaml
"undici@<6.24.0": ">=6.24.0"          # → pnpm resolve เป็น latest = 8.10.0
"undici@>=6.0.0 <6.24.0": ">=6.24.0"  # → เหมือนกัน
"undici@>=7.0.0 <7.29.0": "7.29.0"    # bounded ถูกต้อง (ตัวนี้ไม่มีปัญหา)
```

lockfile ยืนยัน: `@qdrant/js-client-rest@1.17.0 → undici: 8.10.0`

**ผลกระทบกว้างกว่าไฟแดงบน UI** — Qdrant ทุก operation fail ไม่ใช่แค่ health badge:

- `AiQdrantService.onModuleInit()` → `collection init failed — fetch failed` ตอน boot ทุกครั้ง
- `ensureCollection()` ไม่ทำงาน → payload index `project_public_id` (multi-tenancy ตาม ADR-023) ไม่ถูกสร้าง/ตรวจ
- RAG search + embed upsert ใช้งานไม่ได้ทั้งหมด

**ปัญหาคลาสเดียวกันที่พบเพิ่มจากการ audit:** override `"nodemailer@<8.0.8": ">=8.0.8"` ดัน nodemailer เป็น **9.0.1** ทั้งที่ `backend/package.json` ประกาศ `^8.0.3` (lockfile เขียน importer specifier ใหม่เป็น `>=8.0.8`) — ยังไม่พังเพราะ breaking change ของ v9 คือบังคับ validate TLS cert ตอน fetch remote content ซึ่ง `notification.processor.ts` ใช้แค่ SMTP transport

## การพิสูจน์ (Empirical Matrix)

ทดสอบแยก sandbox ยิงไป service จริงบน Node 24 (บังคับ nested undici แต่ละเวอร์ชัน):

| Consumer                        | undici 6.28.0 | undici 7.29.0 | undici 8.10.0                       |
| ------------------------------- | ------------- | ------------- | ----------------------------------- |
| `@qdrant/js-client-rest@1.17.0` | OK            | OK            | **FAIL** `invalid onRequestStart method` |
| `@elastic/transport` (ES 8.11.1)| OK            | OK            | OK                                  |

→ ไม่มี consumer ตัวไหนต้องใช้ 8.x จึง pin 7.29.0 ได้ทั้งทรีอย่างปลอดภัย (`@elastic/transport` ไม่พังเพราะใช้ undici Connection ของตัวเอง ไม่ได้ส่ง dispatcher เข้า global fetch)

## การแก้ไข (Fix)

| ไฟล์                    | การเปลี่ยนแปลง                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm-workspace.yaml`   | รวม override undici 3 บรรทัดเป็น `undici: "7.29.0"` (bounded) + คอมเมนต์อธิบาย root cause กันคนแก้กลับ             |
| `backend/package.json`  | `nodemailer` `^8.0.3` → `^9.0.1` ให้ตรงกับเวอร์ชันที่ติดตั้งจริง                                                  |
| `pnpm-lock.yaml`        | undici 8.10.0 หายจากทรีทั้งหมด เหลือ 7.29.0 เวอร์ชันเดียว; nodemailer specifier `>=8.0.8` → `^9.0.1`              |

commit `9951b41d` → push `main` → Gitea Actions deploy → `lcbp3-backend:9951b41d96cf` + `lcbp3-frontend:9951b41d96cf`

## กฎที่ Lock แล้ว

- **D144 (Bounded Override Rule):** override ใน `pnpm-workspace.yaml` ต้องมีขอบบนเสมอ — target แบบ `">=x"` ปลายเปิดจะถูก pnpm resolve ไป major ล่าสุด ข้าม major ที่ dependency ประกาศไว้ และพังแบบเงียบ ๆ ตอน runtime; ถ้าต้องปิด CVE ให้ระบุเวอร์ชันตรง ๆ หรือใส่ `<upper` เสมอ
- **D145 (undici Pin 7.29.0):** `undici` ต้อง pin `7.29.0` — ห้าม resolve ไป 8.x เพราะ `@qdrant/js-client-rest` ส่ง `undici.Agent` เป็น dispatcher เข้า global fetch ของ Node 24 (undici 7 internal) และ Agent ของ undici 8 ตัด handler interface เดิมออก (`invalid onRequestStart method`); jsdom 29 ก็ต้องการ undici 7.x internals (`wrap-handler.js`) เช่นกัน
- **Debug pattern:** อาการ service "Down" บนหน้า monitoring ที่ container healthy + `curl` จากใน container ผ่าน ให้สงสัย client library / dependency layer ก่อน network — reproduce ด้วย client library ตัวจริงในคอนเทนเนอร์ (`docker exec backend node -e "..."`) ไม่ใช่ `curl`

## Verification

- [x] Reproduce ได้ในคอนเทนเนอร์: `docker exec backend node -e "new QdrantClient(...).getCollections()"` → `DOWN 3ms fetch failed | cause: invalid onRequestStart method`
- [x] ยืนยันเวอร์ชันด้วย empirical matrix (qdrant × undici 6/7/8, elastic × undici 7/8) ยิง service จริง
- [x] หลัง `pnpm install`: lockfile เหลือ undici 7.29.0 ตัวเดียว; `@qdrant/js-client-rest → undici: 7.29.0`; `@elastic/transport → undici: 7.29.0`
- [x] Pre-deploy gates: `backend npx tsc --noEmit` 0 error, `pnpm --filter backend lint:ci` 0, backend 1038 tests pass, frontend 965 tests pass
- [x] Post-deploy: `docker exec backend` → undici 7.29.0 (ทั้ง root + ที่ qdrant client resolve), nodemailer 9.0.1
- [x] Post-deploy: `getCollections()` จาก backend → **HEALTHY latency 18ms** (เดิม DOWN 3ms)
- [x] Post-deploy log: `collection lcbp3_vectors already exists with correct Hybrid schema (1024 dims)` + `Created payload indexes` — ไม่มี `collection init failed` อีก
- [x] Payload index ครบตาม ADR-023: `project_public_id`, `doc_public_id`, `status_code`, `doc_type`; collection status `green`
- [x] backend + frontend container healthy บน image `9951b41d96cf`; log ไม่มี ERROR ใหม่
- [x] **User ยืนยัน UI:** `/admin/ai/system` → Qdrant Vector DB = Healthy

## งานค้าง (Follow-up)

- [ ] ทำ override ที่เหลืออีก 58 ตัวใน `pnpm-workspace.yaml` ให้ bounded ทั้งชุด (audit แล้วไม่มีตัวไหนพังตอนนี้ — 17 ตัวที่ script ตีธงเป็น false positive จากการมีหลาย major อยู่ร่วมกันตามปกติ เช่น minimatch 3/5/10, ajv 6/8, uuid 11/13)
- [ ] พิจารณาอัปเกรด `@qdrant/js-client-rest` → 1.19.0 (pin `undici: 7.29.0` แบบ exact ที่ต้นทาง ไม่ต้องพึ่ง override)
- [ ] `@types/nodemailer` ยังเป็น `^7.0.4` ขณะที่ runtime เป็น 9.0.1 (tsc ผ่าน จึงไม่แก้ในรอบนี้เพื่อเลี่ยง scope creep)
