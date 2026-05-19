# Data Model: Intent Classification System

**Feature**: 224-intent-classification  
**Date**: 2026-05-19  
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

---

## Entity Overview

```
┌─────────────────────┐       ┌─────────────────────┐
│  IntentDefinition   │ 1:N  │   IntentPattern     │
├─────────────────────┤       ├─────────────────────┤
│ publicId (UUID)     │──────▶│ publicId (UUID)     │
│ intentCode (PK)     │       │ intentCode (FK)     │
│ description_th      │       │ patternType         │
│ description_en      │       │ patternValue        │
│ category            │       │ language            │
│ isActive            │       │ priority            │
│ createdAt           │       │ isActive            │
│ updatedAt           │       │ createdAt           │
└─────────────────────┘       │ updatedAt           │
                              └─────────────────────┘
```

---

## Entity: IntentDefinition

**Table**: `ai_intent_definitions`  
**Purpose**: เก็บข้อมูล Intent หลักที่ระบบรองรับ

### Attributes

| Attribute | Type | Constraints | Description |
|-----------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Internal ID (ไม่ expose) |
| publicId | UUID | NOT NULL, DEFAULT UUID() | Public UUIDv7 (API response) |
| intentCode | VARCHAR(50) | NOT NULL, UNIQUE | เช่น `RAG_QUERY`, `GET_RFA`, `FALLBACK` |
| descriptionTh | VARCHAR(255) | NOT NULL | คำอธิบายภาษาไทย |
| descriptionEn | VARCHAR(255) | NOT NULL | คำอธิบายภาษาอังกฤษ |
| category | ENUM | NOT NULL | `read`, `suggest`, `utility` |
| isActive | BOOLEAN | NOT NULL, DEFAULT TRUE | เปิดใช้งานหรือไม่ |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

### Indexes

```sql
PRIMARY KEY (id)
UNIQUE KEY uk_intent_code (intentCode)
INDEX idx_intent_active (isActive, category)
```

### Validation Rules

- `intentCode`: ตัวพิมพ์ใหญ่, underscore, ตัวเลข — format: `[A-Z][A-Z0-9_]*`
- `category`: ต้องเป็น `read`, `suggest`, หรือ `utility`
- `descriptionTh` และ `descriptionEn`: ห้ามว่าง

---

## Entity: IntentPattern

**Table**: `ai_intent_patterns`  
**Purpose**: เก็บ Pattern (keyword/regex) สำหรับ Pattern Matching Layer

### Attributes

| Attribute | Type | Constraints | Description |
|-----------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Internal ID (ไม่ expose) |
| publicId | UUID | NOT NULL, DEFAULT UUID() | Public UUIDv7 (API response) |
| intentCode | VARCHAR(50) | NOT NULL, FK | อ้างอิง IntentDefinition |
| language | ENUM | NOT NULL, DEFAULT 'any' | `th`, `en`, `any` |
| patternType | ENUM | NOT NULL, DEFAULT 'keyword' | `keyword`, `regex` |
| patternValue | VARCHAR(255) | NOT NULL | ค่า pattern (keyword หรือ regex) |
| priority | INT | NOT NULL, DEFAULT 100 | ลำดับการตรวจสอบ (ต่ำ = ตรวจก่อน) |
| isActive | BOOLEAN | NOT NULL, DEFAULT TRUE | เปิดใช้งานหรือไม่ |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

### Indexes

```sql
PRIMARY KEY (id)
UNIQUE KEY uk_pattern_public_id (publicId)
INDEX idx_intent_code (intentCode)
INDEX idx_intent_active_priority (isActive, priority ASC)
CONSTRAINT fk_intent_pattern_definition
  FOREIGN KEY (intentCode) REFERENCES ai_intent_definitions(intentCode)
  ON UPDATE CASCADE ON DELETE RESTRICT
```

### Validation Rules

- `patternType` = `regex` → ต้อง validate ว่าเป็น regex ที่ valid (ใช้ `new RegExp()` ใน try-catch)
- `priority`: ต่ำ = สำคัญกว่า (ตรวจก่อน) — แนะนำให้ใช้ 10, 20, 50, 100
- `language`:
  - `th`: ใช้กับคำถามภาษาไทยเท่านั้น
  - `en`: ใช้กับคำถามภาษาอังกฤษเท่านั้น
  - `any`: ใช้กับทุกภาษา

---

## Value Objects / DTOs

### ClassificationResult (Response)

```typescript
interface ClassificationResult {
  intentCode: string;           // เช่น 'RAG_QUERY', 'GET_RFA'
  confidence: number;           // 0.0 - 1.0
  method: 'pattern' | 'llm_fallback' | 'semaphore_overflow' | 'llm_error';
  params?: Record<string, any>; // Optional extracted params
  latencyMs: number;           // รวมทั้งหมด
}
```

### ClassificationInput (Request)

```typescript
interface ClassificationInput {
  query: string;              // คำถามจาก user (trim, max 200 chars)
  projectPublicId?: string;   // Context project (optional)
  userPublicId?: string;      // Context user (optional)
  currentDocumentId?: string; // Context document ที่เปิดอยู่ (optional)
}
```

---

## Enums

### IntentCategory

```typescript
enum IntentCategory {
  READ = 'read',           // ดึงข้อมูล: RAG_QUERY, GET_RFA, etc.
  SUGGEST = 'suggest',     // แนะนำ: SUGGEST_METADATA, SUGGEST_ACTION
  UTILITY = 'utility'      // อื่น ๆ: FALLBACK
}
```

### PatternType

```typescript
enum PatternType {
  KEYWORD = 'keyword',     // case-insensitive includes()
  REGEX = 'regex'          // RegExp.test()
}
```

### PatternLanguage

```typescript
enum PatternLanguage {
  TH = 'th',      // ภาษาไทย
  EN = 'en',      // ภาษาอังกฤษ
  ANY = 'any'     // ทุกภาษา
}
```

---

## SQL Schema Delta (ADR-009)

ไฟล์: `specs/03-Data-and-Storage/deltas/03-add-intent-classification.sql`

```sql
-- Delta 03: Add Intent Classification Tables (ADR-024)
-- Created: 2026-05-19
-- Feature: 224-intent-classification

-- Intent Definitions Table
CREATE TABLE IF NOT EXISTS ai_intent_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id UUID NOT NULL DEFAULT UUID(),
  intent_code VARCHAR(50) NOT NULL,
  description_th VARCHAR(255) NOT NULL,
  description_en VARCHAR(255) NOT NULL,
  category ENUM('read', 'suggest', 'utility') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_intent_code (intent_code),
  INDEX idx_intent_active (is_active, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Intent Patterns Table
CREATE TABLE IF NOT EXISTS ai_intent_patterns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id UUID NOT NULL DEFAULT UUID(),
  intent_code VARCHAR(50) NOT NULL,
  language ENUM('th', 'en', 'any') NOT NULL DEFAULT 'any',
  pattern_type ENUM('keyword', 'regex') NOT NULL DEFAULT 'keyword',
  pattern_value VARCHAR(255) NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_pattern_public_id (public_id),
  INDEX idx_intent_code (intent_code),
  INDEX idx_intent_active_priority (is_active, priority ASC),
  CONSTRAINT fk_intent_pattern_definition
    FOREIGN KEY (intent_code) REFERENCES ai_intent_definitions(intent_code)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Seed Data (12 Intent Definitions)

```sql
-- Seed Intent Definitions (v1)
INSERT INTO ai_intent_definitions (intent_code, description_th, description_en, category) VALUES
-- Read Intents
('RAG_QUERY', 'ถามคำถามธรรมชาติ ตอบจาก vector + doc context', 'Natural language query from vector DB + document context', 'read'),
('GET_RFA', 'ดึง RFA ตาม filter', 'Get RFA by filters', 'read'),
('GET_DRAWING', 'ดึง Drawing revision', 'Get Drawing revision', 'read'),
('GET_TRANSMITTAL', 'ดึง Transmittal', 'Get Transmittal', 'read'),
('GET_CORRESPONDENCE', 'ดึง Correspondence ทั่วไป', 'Get Correspondence', 'read'),
('GET_CIRCULATION', 'ดึง Circulation', 'Get Circulation', 'read'),
('GET_RFA_DRAWINGS', 'ดึง Drawings ที่ผูกกับ RFA', 'Get Drawings linked to RFA', 'read'),
('SUMMARIZE_DOCUMENT', 'สรุปเอกสารที่เปิดอยู่', 'Summarize current document', 'read'),
('LIST_OVERDUE', 'รายการ cross-entity ที่เกินกำหนด', 'List overdue items across entities', 'read'),
-- Suggest Intents
('SUGGEST_METADATA', 'แนะนำ metadata สำหรับเอกสารที่อัปโหลด', 'Suggest metadata for uploaded document', 'suggest'),
('SUGGEST_ACTION', 'แจ้งเตือนว่าควรทำอะไรต่อ', 'Suggest next actions', 'suggest'),
-- Utility Intents
('FALLBACK', 'ไม่เข้า intent ไหน / ไม่เกี่ยวกับระบบ', 'No matching intent / unrelated to system', 'utility');
```

---

## Relationships Summary

| Relationship | Type | Description |
|-------------|------|-------------|
| IntentDefinition → IntentPattern | 1:N | Intent หนึ่งรายการมีได้หลาย Patterns |
| IntentPattern → IntentDefinition | N:1 | Pattern อ้างอิง Intent หนึ่งรายการ (FK) |

---

## Performance Considerations

1. **Query Pattern หลัก**: `SELECT * FROM ai_intent_patterns WHERE is_active = TRUE ORDER BY priority ASC` → ใช้ Index `idx_intent_active_priority`
2. **Cache Strategy**: Redis เก็บผล Query ข้างต้น → ลด DB Load 70-80%
3. **Size Estimation**:
   - Intent Definitions: ~20 rows (v1 มี 12, อนาคตเพิ่มได้)
   - Intent Patterns: ~100-500 rows (depends on Admin configuration)
   - Cache Size: < 100KB JSON
