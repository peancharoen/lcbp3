# Session 2026-09-07 (Delta Verification + Spec Sync)

## Summary

ตรวจสอบ SQL deltas ช่วง `2026-07-27` → `2026-08-31` (15+1 ไฟล์) เทียบกับ DB จริง (`lcbp3` ผ่าน MCP MariaDB + docker exec),
baseline `lcbp3-v1.9.0-*.sql` และ `03-01-data-dictionary.md` — พบ drift หลายจุด แก้ครบแล้ว,
apply ADR-049 delta ที่ค้างลง DB, พบ+แก้ truncation bug ใน `rfa_consent_reasons`,
แล้วย้าย deltas ที่ verified ทั้งหมดไป `specs/99-archives/deltas/`

## ปัญหาที่พบ (Root Cause)

1. **ADR-049 delta (2026-08-28) ยังไม่เคย apply ลง DB จริง** — `workflow_histories` ขาด `impersonated`/`on_behalf_of_*`,
   ไม่มีตาราง `rfa_consent_reasons`, `rfa_approve_codes` ยังเป็น scheme เก่าทั้งหมด active —
   แต่ baseline schema + seed + dictionary เขียนไว้ว่า applied แล้ว (spec นำ DB)
2. **`rfa_consent_reasons.code` VARCHAR(20) สั้นเกิน** — seed codes `AGREED_WITH_CONDITIONS` (22 ตัวอักษร) และ
   `FORWARDED_TO_DESIGNER` (21) ถูก `INSERT IGNORE` truncate เงียบ ๆ (MariaDB แปลง truncation error เป็น warning เมื่อมี IGNORE)
3. **ชื่อคอลัมน์ 3 ทาง** — delta 2026-08-20 + migration.sql + dictionary ใช้ `ai_suggested_category`
   แต่ DB จริง + schema-02 ใช้ `ai_suggested_correspondence_type`
4. **`refresh_tokens` device columns** (delta 2026-08-18) apply ลง DB แล้วแต่ไม่ได้ merge กลับเข้า schema-02
5. **Data dictionary เก่า/ขาด** — `ai_job_id` ยังเป็น VARCHAR(36) (จริงคือ 150), ขาด `ai_status`+WAITING,
   `requires_human_review`, `ocr_quality_confidence`, `is_sandbox`, `attachments.ocr_text`
6. **`ai_metadata_json`** — schema-02 เขียน NOT NULL แต่ delta/DB เป็น NULL
7. **Seed files ขาด** — SANDBOX project, `MIGRATION_*` system_settings, `ai_prompts` migration_compare
   มีแค่ใน delta → fresh install จะไม่ได้ข้อมูลเหล่านี้
8. **`users.must_change_password` = 0 ทุก user** — user ยืนยันว่าถูกต้อง (ไม่ใช่ bug)

## การแก้ไข (Fix)

| ไฟล์/สถานที่ | การเปลี่ยนแปลง |
| -------------- | ---------------- |
| DB `lcbp3` (docker exec mariadb) | รัน delta `2026-08-28-adr-049-*.sql` ทั้งไฟล์; `ALTER rfa_consent_reasons MODIFY code VARCHAR(50)` + UPDATE 2 truncated rows |
| `deltas/2026-09-07-rfa-consent-reasons-code-width.sql` | สร้าง delta ใหม่บันทึก fix (ตาม ADR-044 convention) |
| `lcbp3-v1.9.0-schema-02-tables.sql` | เพิ่ม refresh_tokens 4 device columns; `ai_metadata_json` → NULL; `rfa_consent_reasons.code` → VARCHAR(50) |
| `lcbp3-v1.9.0-migration.sql` | rename `ai_suggested_category` → `ai_suggested_correspondence_type` |
| `lcbp3-v1.9.0-seed-basic.sql` | เพิ่ม SANDBOX project, `MIGRATION_*` 3 settings, `ai_prompt_types`+`ai_prompts` migration_compare (syntax verified ผ่าน transaction+rollback) |
| `03-01-data-dictionary.md` | อัปเดต 9 จุด: refresh_tokens §2.9, ai_job_id VARCHAR(150) ×2 section, ai_status/WAITING, ai_failed, ocr_text, requires_human_review, ocr_quality_confidence, is_sandbox, rename + index + business rules |
| `deltas/2026-08-20-*.sql`, `deltas/2026-08-28-*.sql` | เพิ่ม NOTE อ้างอิง fix/canonical name |
| `specs/99-archives/deltas/` | ย้าย 16 delta files ที่ verified ครบ (git mv, history ไม่หาย) + อัปเดต `deltas/README.md` |

## กฎที่ Lock แล้ว

- **D277**: `ai_suggested_correspondence_type` คือ canonical column name (ห้ามใช้ `ai_suggested_category`)
- **D278**: `rfa_consent_reasons.code` = VARCHAR(50); seed-code values ต้องเช็คความยาวเทียบ column width เสมอ — `INSERT IGNORE` ทำให้ truncation เป็น silent warning
- Delta ที่ verified+applied ครบแล้วให้ย้ายไป `specs/99-archives/deltas/` — `deltas/` เหลือเฉพาะ pending

## Verification

- [x] `workflow_histories` มี 3 columns + index `idx_wf_hist_on_behalf_of_user_id` (information_schema)
- [x] `rfa_consent_reasons` 5 rows codes ครบไม่ truncate
- [x] `rfa_approve_codes` scheme 1/2/3/4 active, เก่า is_active=0
- [x] seed SQL ที่เพิ่มรันผ่านใน transaction (rollback — ไม่มี side effect)
- [x] Committed: spec sync ใน squash `3190aa41` + archive `1a4dc783`

## Pending

- ยังไม่ push `origin/main` (user defer — main นำ origin 1 commit `3190aa41`)
- Deltas `2026-09-03` (pending_vector_deletions) + `2026-09-06` (correspondence-import-review-permission) ยังไม่ได้ verify — อยู่นอก scope ที่สั่ง
- `2026-09-01` verified applied แล้ว (ai_prompt_types มี 8 rows) แต่ยังอยู่ใน `deltas/` เพราะนอกช่วงที่สั่งย้าย
