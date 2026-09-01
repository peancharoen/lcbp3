// File: specs/200-fullstacks/251-prompt-types-domain-rename/quickstart.md
// Change Log:
// - 2026-09-01: Initial quickstart for Feature 251

# Quickstart: Prompt Types Master Table + Domain Term Rename

**Feature**: 251-prompt-types-domain-rename
**Date**: 2026-09-01

> คู่มือสำหรับ developer/admin ตรวจสอบว่า feature ทำงานถูกต้องหลัง deploy

## ข้อกำหนดเบื้องต้น

- MariaDB 11.8 + Redis + Ollama (np-dms-ai + np-dms-ocr) ทำงาน
- Backend + frontend deploy พร้อมกัน (atomic deploy, FR-015)
- SQL delta `2026-09-01-ai-prompt-types-and-category-rename.sql` รันแล้ว

## ขั้นตอนที่ 1: ตรวจสอบตาราง `ai_prompt_types`

```sql
SELECT prompt_type, display_name, is_system_managed, is_active
FROM ai_prompt_types
ORDER BY prompt_type;
```

**คาดหวัง**: 7 rows — `classification_prompt`, `migration_compare`, `ocr_extraction`, `ocr_system`, `rag_chunking`, `rag_prep_prompt`, `rag_query_prompt`

## ขั้นตอนที่ 2: ตรวจสอบ FK constraint

```sql
SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_NAME = 'ai_prompts'
  AND REFERENCED_TABLE_NAME = 'ai_prompt_types';
```

**คาดหวัง**: FK row referencing `ai_prompt_types.prompt_type`

## ขั้นตอนที่ 3: ตรวจสอบ column rename

```sql
SHOW COLUMNS FROM migration_review_queue LIKE 'ai_suggested_correspondence_type';
```

**คาดหวัง**: 1 row — column ใหม่ปรากฏ
```sql
SHOW COLUMNS FROM migration_review_queue LIKE 'ai_suggested_category';
```

**คาดหวัง**: 0 rows — column เดิมหายไป

## ขั้นตอนที่ 4: ทดสอบ API prompt types

```bash
# Login แล้วใช้ token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/ai/prompt-types
```

**คาดหวัง**: JSON มี `data` array 7 items

## ขั้นตอนที่ 5: ทดสอบ unified prompt management page

1. เปิด `/admin/ai/prompt-management` ในเบราว์เซอร์
2. ตรวจสอบ: dropdown แสดงครบทุก type (รวม `migration_compare` และ `rag_chunking` ที่เดิมมองไม่เห็น)
3. เลือก `ocr_extraction` → ดู version list
4 สร้าง version ใหม่ → ตรวจสอบว่า backend validate placeholder จาก master table

## ขั้นตอนที่ 6: ทดสอบ redirect 308

```bash
curl -I http://localhost:3000/admin/ai/prompts
```

**คาดหวัง**: `HTTP/1.1 308 Permanent Redirect` → `/admin/ai/prompt-management`

## ขั้นตอนที่ 7: ทดสอบ migration review UI

1. เปิด `/admin/migration/review/<publicId>`
2. ตรวจสอบ: label บอก "Correspondence Type" (ไม่ใช่ "Category")
3. ตรวจสอบ: dropdown ผูก `correspondence_types`
4. Commit review → ตรวจสอบ request payload มี `correspondenceType` (ไม่ใช่ `category`)

## ขั้นตอนที่ 8: ทดสอบ runtime fallback (FR-014)

```bash
# พยายามเรียก prompt type ที่ไม่มี
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/ai/prompts/nonexistent_type
```

**คาดหวัง**: `BusinessException` พร้อมข้อความ "prompt_type nonexistent_type ไม่มีในระบบ"

## ขั้นตอนที่ 9: ทดสอบ delete protection (FR-012)

```bash
# พยายามลบ type ที่มี prompt อ้างอิง
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/ai/prompt-types/ocr_extraction
```

**คาดหวัง**: `409 Conflict` พร้อมข้อความ "ไม่สามารถลบได้เพราะมี ai_prompts อ้างอิงอยู่"

## ขั้นตอนที่ 10: Grep ตรวจสอบว่าไม่มี `category` เหลือ

```bash
# ใน migration review files (ไม่นับ system_settings.category ที่เป็น setting key)
grep -rn "category" backend/src/modules/migration/ \
  --include="*.ts" | grep -v "system_settings" | grep -v "node_modules"
```

**คาดหวัง**: 0 matches (หรือเฉพาะ comment ที่อธิบายการเปลี่ยนชื่อ)
