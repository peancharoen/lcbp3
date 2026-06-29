# Data Model Design

**Feature**: Context-Aware Prompt Templates & Database Typo Cleanup
**Created**: 2026-05-27

---

## 1. Schema Modifications (ADR-009)

### ตาราง `ai_prompts`
เพิ่มคอลัมน์ `context_config` เพื่อกำหนดการกรองตัวแปรอ้างอิงและตั้งค่าเฉพาะ

```sql
ALTER TABLE ai_prompts 
ADD COLUMN context_config JSON NULL 
COMMENT 'Configuration สำหรับ context ที่ backend ต้องส่งให้ AI (filter, pageSize, language, etc.)';
```

### ตาราง `correspondence_recipients`
ปรับปรุงคอลัมน์ `recipient_type` ให้ตัดช่องว่างที่พิมพ์ผิดออกไป

```sql
ALTER TABLE correspondence_recipients
MODIFY COLUMN recipient_type ENUM('TO', 'CC') NOT NULL COMMENT 'ประเภทผู้รับ (TO หรือ CC)';
```

---

## 2. JSON Configurations

### `context_config` Schema
ตัวอย่างค่าที่จะถูกจัดเก็บและประมวลผล:

```json
{
  "filter": {
    "projectId": 1,
    "contractId": 1
  },
  "pageSize": 3,
  "language": "th",
  "outputLanguage": "th"
}
```
