// File: specs/200-fullstacks/228-migration-arch-refactor/quickstart.md
// Change Log:
// - 2026-05-22: Phase 1 quickstart for ADR-028 Migration Architecture Refactor

# Quickstart: ADR-028 Migration Architecture Refactor

## Pre-requisites Checklist (ก่อนเริ่ม implement)

- [ ] Branch `228-migration-arch-refactor` ถูก checkout แล้ว
- [ ] Staging DB พร้อม (MariaDB ตาม docker-compose)
- [ ] Redis พร้อม (BullMQ)
- [ ] Ollama บน Desk-5439 online — `curl http://192.168.20.100:11434/api/tags` → ได้ `gemma4:e4b` + `nomic-embed-text`
- [ ] OCR Service (PaddleOCR container) บน Desk-5439 online

---

## Scenario 1: Test POST /api/ai/jobs (MVP — US1)

```bash
# 1. ทดสอบ submit migration job
curl -X POST http://localhost:3000/api/ai/jobs \
  -H "Authorization: Bearer <MIGRATION_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-001" \
  -d '{
    "type": "migrate-document",
    "payload": {
      "tempAttachmentId": "<uuid-ของ-temp-file>",
      "documentNumber": "LCP-GEN-COR-001-001",
      "title": "หนังสือทดสอบ",
      "existingTags": [],
      "systemCategories": ["Correspondence", "Drawing"],
      "batchId": "test_batch_001"
    }
  }'

# Expected: { "data": { "jobId": "...", "status": "queued" } }

# 2. Poll ผลลัพธ์
curl http://localhost:3000/api/ai/jobs/<jobId> \
  -H "Authorization: Bearer <MIGRATION_TOKEN>"

# Expected (after ~30s): { "data": { "status": "completed", "result": { "confidence": ..., "category": ... } } }
```

---

## Scenario 2: Test Execute Import (US2)

```bash
# 1. ดึงรายการ PENDING จาก review queue
curl http://localhost:3000/api/ai/migration/review \
  -H "Authorization: Bearer <DC_OR_ADMIN_JWT>"

# 2. Execute Import
curl -X POST http://localhost:3000/api/ai/migration/review \
  -H "Authorization: Bearer <DC_OR_ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: commit-001" \
  -d '{
    "reviewQueueId": 1,
    "action": "approve",
    "overrideTags": []
  }'

# Expected: { "data": { "correspondencePublicId": "...", "tagsLinked": 2 } }

# 3. ตรวจสอบ RBAC (ต้อง 403)
curl -X POST http://localhost:3000/api/ai/migration/review \
  -H "Authorization: Bearer <VIEWER_JWT>" \
  ...
# Expected: 403 Forbidden
```

---

## Scenario 3: Apply SQL Deltas (US3)

```bash
# Apply tags tables
mysql -h <DB_HOST> -u root -p lcbp3_production \
  < specs/03-Data-and-Storage/deltas/2026-05-22-create-tags-tables.sql

# Apply ai_job_id column
mysql -h <DB_HOST> -u root -p lcbp3_production \
  < specs/03-Data-and-Storage/deltas/2026-05-22-alter-migration-review-queue.sql

# Verify
mysql -e "DESCRIBE tags; DESCRIBE correspondence_tags; SHOW COLUMNS FROM migration_review_queue LIKE 'ai_job_id';" lcbp3_production
```

---

## Scenario 4: Verify Temp File Auto-Cleanup

```bash
# ดู BullMQ scheduled jobs (admin UI หรือ Redis CLI)
redis-cli KEYS "bull:ai-batch:*cleanup*"

# ตรวจ temp files ที่ครบ 24h (สำหรับ test ปรับ interval เป็น 5 นาที)
mysql -e "SELECT id, created_at FROM attachments WHERE is_temporary=1 AND created_at < NOW() - INTERVAL 24 HOUR;" lcbp3_production
```

---

## Reference Docs

| ทำอะไร | อ่านที่ |
|--------|---------|
| API contracts | `contracts/ai-jobs-api.md` |
| Data model / Schema | `data-model.md` |
| Architecture decisions | `research.md` |
| Full task list | `tasks.md` |
| Migration docs | `specs/03-Data-and-Storage/03-04-legacy-data-migration.md` |
