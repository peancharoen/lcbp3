# Session — 2026-09-15 (ADR-054 E2E Verification + Review-Commit Defect Fix)

## Summary

รัน unified test plan `specs/999-test-plan/20260615-A-migration-admin-unified-test-plan.md`
ครอบ spec 256 (ADR-054) บน production-like environment จริง — re-ingest test data หลัง TRUNCATE,
ทดสอบ review-commit → พบ 3 defects ซ้อนกัน → แก้ + deploy + verify live แล้วปิด Phase 1/3/5 ของแผนครบ

## ปัญหาที่พบ (Root Cause)

`POST /api/ai/migration/review` คืน 500 ทุกรายการ — แกะพบ 3 defects ซ้อน:

| # | Root cause | Evidence |
|---|-----------|----------|
| D1 | `queueItem.issuedDate.toISOString()` — MariaDB คืน DATE column เป็น **string** ไม่ใช่ Date → TypeError | technicalMessage ใน SystemException |
| D2 | `manager.save(Tag, plainObj)` ไม่ fire `@BeforeInsert` → `tags.public_id` INSERT ล้ม | isolated test: plain save fail, `create()`+`save()` ผ่าน |
| D3 | `correspondence_tags` schema drift — prod มี 2 columns แต่ canonical ต้องการ 6 (`is_ai_suggested`, `confidence`, `created_by`, `created_at`) | INFORMATION_SCHEMA vs `schema-02-tables.sql` |

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `backend/src/modules/migration/migration-review.service.ts` | `toIsoDateString()` normalize string|Date|undefined → ISO; `manager.create(Tag,...)`+`save()` ให้ hook ทำงาน |
| `backend/src/modules/migration/migration.service.ts` | date normalization เดียวกันใน direct path + `INSERT INTO tags` ใส่ `public_id` |
| `specs/03-Data-and-Storage/deltas/2026-09-15-correspondence-tags-adr050-columns.sql` (+rollback) | additive delta — DB มี canonical columns อยู่แล้ว (verify-only) |
| `specs/999-test-plan/20260615-A-migration-admin-unified-test-plan.md` | ผลการทดสอบทั้งหมด + section 16 live results |

Commits: `fc633ab3` fix (pushed+deployed, image `fc633ab38a20`) + test plan updates

## ผลการทดสอบ (Live Evidence)

### 3C Integration — ครบ 8 ข้อ

- **3C.2 Incident replay (SC-005)**: `UPDATE ai_metadata_json=NULL` บน QC-0001 → re-extract →
  (1) `storage_temp_path` รอด (column ไม่ใช่ JSON), (2) extractor resolve PDF ผ่าน column →
  OCR จริง 15,087 chars, (3) `ocr_text_bak`=14,291 snapshot ก่อนทับ; `review_state_json` byte-identical
- **3C.3**: `storage_temp_path=NULL` + attachment อยู่ → resolve ผ่าน `attachments.file_path` → OCR จริง (D4 fallback)
- **3C.4**: ไม่มี path+attachment → `ai_status=FAILED` + `NO_PDF_OCR_PLACEHOLDER`, bak=15,335 (จริง) → restore สำเร็จ
- **3C.5**: re-extract ซ้ำขณะ NO_PDF → bak **ไม่ถูก placeholder ทับ** (placeholder-skip rule)
- **3C.6**: legacy ai-ingest → approve → IMPORTED + `imported_correspondence_public_id` ตรง `correspondences.uuid`, reviewed_by/at ตั้ง, audit log เขียน
- **3C.7**: review commit (คคง.) → IMPORTED + link + `review_state_json` persist
- **3C.8**: IMPORTED retention — ไม่มี auto-cleanup ลบ (`ExpirePendingReviewsWorker` scope เฉพาะ PENDING>30d → REJECTED; delete manual-only `migration.delete`+Idempotency-Key)

### 1G Browser E2E (production URL)

- Login admin → review QC-0001 → ปุ่ม "กู้คืน OCR เดิม" render ถูก → Thai confirm dialog →
  restore 61→14,291 chars → bak swap ถูกต้อง → 0 console errors
- **CSP gotcha**: `localhost:3001` ใช้ทดสอบไม่ได้ (`connect-src 'self'` บล็อก API calls ไป lcbp3.np-dms.work) — ต้องใช้ production URL ตรง ๆ

### 5E Security — ครบ 9 ข้อ

- viewer01/editor01 → 403 PERMISSION_DENIED (`migration.commit`), admin → 200
- missing Idempotency-Key → 400, bad UUID → 400 (ParseUUIDPipe), unknown → 404, no JWT → 401, no-backup → 422 `MIGRATION_NO_BACKUP`

## Findings / Follow-ups

1. **n8n remnants**: `POST /api/ai/legacy-migration/ingest` dead (ServiceAccountGuard + token ไม่ได้ set → 401 เสมอ), checkpoint/queue-record/errors endpoints, dormant webhooks — ต้องทำ spec+ADR amendment (15C.4)
2. **LINE notify ตายเงียบ**: `N8N_LINE_WEBHOOK_URL`/`N8N_WEBHOOK_URL` ไม่ได้ set → sendLine* no-op — ยังต้องการ LINE อยู่ หา channel ทดแทนภายหลัง
3. **Playwright browser lock**: stale headless Chrome จาก Sep 13 → kill แล้วใช้ได้
4. Queue state เก็บไว้เป็น fixture: QC-0001 PENDING_REVIEW/DONE, 4 IMPORTED rows, CHEC-...0002 PENDING

## Verification

- jest 743/743 pass หลัง fix (migration spec files)
- Live API verify: commit + re-extract + restore + approve ผ่าน endpoints จริง
- DB verify: ทุก claim เช็คผ่าน INFORMATION_SCHEMA + ตารางจริง
