# ADR-024: Intent Classification Strategy

**Status:** Accepted
**Date:** 2026-05-19
**Decision Makers:** Development Team, System Architect, AI Integration Lead
**Related Documents:**
- [ADR-023A: Unified AI Architecture — Model Revision](./ADR-023A-unified-ai-architecture.md)
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md)
- [ADR-016: Security & Authentication](./ADR-016-security-authentication.md)
- [CONTEXT.md](../../CONTEXT.md)

> **หมายเหตุ:** ADR นี้กำหนดกลยุทธ์การจำแนก Intent สำหรับ AI Runtime Layer — เป็น layer เพิ่มเติมจาก ADR-023A (Infrastructure) โดยทำหน้าที่แปลงคำถามธรรมชาติ (ไทย/อังกฤษปน) เป็น Server-side Intent enum ก่อน route ไปยัง AI Tool Layer

---

## Context and Problem Statement

ระบบ AI Gateway (ADR-023A) รองรับ job types เช่น `ai-suggest`, `rag-query`, `ocr` ผ่าน BullMQ แล้ว แต่ยังไม่มีกลไกแปลงคำถามธรรมชาติจาก user → Server-side Intent ที่ระบบเข้าใจ

ความท้าทาย:
1. **Bilingual input** — user พิมพ์ภาษาไทย/อังกฤษปนกันอย่างอิสระ
2. **GPU budget จำกัด** — RTX 2060 Super 8GB ใช้ร่วมกับ RAG, OCR, Embedding
3. **Latency** — Intent classification เป็น prerequisite ก่อน route → ต้องเร็ว
4. **Extensibility** — Intent เพิ่มทุก quarter ต้องไม่ต้อง deploy code ใหม่ทุกครั้ง

---

## Decision Drivers

- **Low latency for common queries** — 70-80% ของ queries เป็น pattern ที่ชัดเจน
- **Bilingual tolerance** — ภาษาไทย+อังกฤษปน, typo ต้อง handle ได้
- **GPU conservation** — ลด LLM calls ให้น้อยที่สุด เพราะ VRAM ใช้ร่วมกับงาน AI อื่น
- **Runtime configurability** — Admin จัดการ pattern ได้โดยไม่ต้อง deploy
- **Graceful degradation** — ถ้า LLM ไม่ว่าง/ล่ม ระบบยังตอบ user ได้

---

## Considered Options

### Option A: Pure Pattern Matching (Keyword + Regex)

**Pros:**
- Deterministic, latency < 5ms, ไม่ใช้ GPU
- Testable 100%

**Cons:**
- ❌ ภาษาไทย+อังกฤษปน → regex ซับซ้อนมาก
- ❌ Typo = miss ทุกครั้ง
- ❌ ต้อง maintain rule set ที่โตขึ้นทุก quarter

### Option B: Pure LLM-based (Ollama Classify ทุก request)

**Pros:**
- เข้าใจ bilingual, typo-tolerant, ขยาย intent ง่าย (แก้ system prompt)

**Cons:**
- ❌ Latency 500ms–2s ทุก request
- ❌ GPU load ทุก chat message → แย่ง resource กับ RAG/OCR
- ❌ Non-deterministic → ต้อง validate ทุกครั้ง

### Option C: Hybrid — Pattern First, LLM Fallback ✅ (เลือก)

**Pros:**
- Common queries (70-80%) จับได้ที่ pattern layer < 10ms
- Bilingual + typo handle ได้ผ่าน LLM fallback
- GPU load ลดลง 70-80% เทียบกับ Pure LLM
- Pattern เก็บใน DB → Admin แก้ได้ runtime

**Cons:**
- Maintain 2 layers (แต่ pattern layer เป็น DB records, ไม่ใช่ code)

---

## Decision

**เลือก Option C: Hybrid (Pattern First → LLM Fallback)**

---

## Classification Flow

```
User Query
    │
    ▼
┌─────────────────────────────┐
│ 1. Load patterns from Redis │ (cache TTL 5 min)
│    (fallback: query DB)     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 2. Pattern Match Loop       │ priority ASC
│    - keyword: includes()    │
│    - regex: RegExp.test()   │
└─────────────┬───────────────┘
              │
       ┌──────┴──────┐
       │ Match?      │
       ▼             ▼
    ┌─────┐      ┌──────────────────────────────┐
    │ YES │      │ 3. LLM Fallback (Ollama)     │
    │     │      │    - Synchronous call         │
    │     │      │    - Semaphore max=3          │
    │     │      │    - Dynamic system prompt    │
    └──┬──┘      └──────────────┬───────────────┘
       │                        │
       ▼                        ▼
┌─────────────┐     ┌─────────────────────────┐
│ confidence  │     │ Confidence Threshold     │
│ = 1.0       │     │ ≥ 0.7  → use            │
│             │     │ 0.4–0.69 → use + log    │
│             │     │ < 0.4  → FALLBACK       │
└──────┬──────┘     └────────────┬────────────┘
       │                         │
       └────────────┬────────────┘
                    ▼
         ┌────────────────────┐
         │ Return Intent +    │
         │ confidence + params│
         └────────────────────┘
```

---

## v1 Intent Enum (12 intents)

### Read-only (ดึงข้อมูล)

| Intent Code | คำอธิบาย | ตัวอย่าง Query |
|-------------|----------|---------------|
| `RAG_QUERY` | ถามคำถามธรรมชาติ ตอบจาก vector + doc context | "สรุปเนื้อหา RFA-0042 ให้หน่อย" |
| `GET_RFA` | ดึง RFA ตาม filter | "RFA ล่าสุดของ contract A" |
| `GET_DRAWING` | ดึง Drawing revision | "drawing A-101 rev ล่าสุด" |
| `GET_TRANSMITTAL` | ดึง Transmittal | "transmittal เลขที่ TR-0015" |
| `GET_CORRESPONDENCE` | ดึง Correspondence ทั่วไป | "จดหมาย NAP-OUT-0233" |
| `GET_CIRCULATION` | ดึง Circulation | "circulation ที่ส่งให้ฉัน" |
| `GET_RFA_DRAWINGS` | ดึง Drawings ที่ผูกกับ RFA | "drawings ใน RFA-0042" |
| `SUMMARIZE_DOCUMENT` | สรุปเอกสารที่เปิดอยู่ | "สรุปเอกสารนี้" |
| `LIST_OVERDUE` | รายการ cross-entity ที่เกินกำหนด | "อะไรเกินกำหนดบ้าง" |

### Suggest (แจ้งเตือน)

| Intent Code | คำอธิบาย | ตัวอย่าง Query |
|-------------|----------|---------------|
| `SUGGEST_METADATA` | แนะนำ metadata สำหรับเอกสารที่อัปโหลด | "ช่วยแนะนำ metadata" |
| `SUGGEST_ACTION` | แจ้งเตือนว่าควรทำอะไรต่อ (notification-grade) | "มีอะไรที่ควรทำบ้าง" |

### Utility

| Intent Code | คำอธิบาย |
|-------------|----------|
| `FALLBACK` | ไม่เข้า intent ไหน / ไม่เกี่ยวกับระบบ → ตอบว่าไม่เข้าใจ + แนะนำตัวอย่าง |

---

## Database Schema

### `ai_intent_definitions`

```sql
CREATE TABLE ai_intent_definitions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT UUID(),
  intent_code     VARCHAR(50)  NOT NULL UNIQUE,
  description_th  VARCHAR(255) NOT NULL,
  description_en  VARCHAR(255) NOT NULL,
  category        ENUM('read','suggest','utility') NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

### `ai_intent_patterns`

```sql
CREATE TABLE ai_intent_patterns (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT UUID(),
  intent_code     VARCHAR(50)  NOT NULL,
  language        ENUM('th','en','any') NOT NULL DEFAULT 'any',
  pattern_type    ENUM('keyword','regex') NOT NULL DEFAULT 'keyword',
  pattern_value   VARCHAR(255) NOT NULL,
  priority        INT NOT NULL DEFAULT 100,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_intent_active (is_active, priority),
  INDEX idx_intent_code (intent_code),
  CONSTRAINT fk_intent_pattern_definition
    FOREIGN KEY (intent_code) REFERENCES ai_intent_definitions(intent_code)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
```

---

## LLM Fallback Specification

### System Prompt (Dynamic)

```
คุณเป็นตัวจำแนกคำสั่ง (Intent Classifier) สำหรับระบบจัดการเอกสารก่อสร้าง
จงวิเคราะห์คำถามของผู้ใช้ แล้วตอบเป็น JSON เท่านั้น:
{"intent":"<INTENT_CODE>","confidence":<0.0-1.0>}

Intent ที่รองรับ:
{{DYNAMIC_INTENT_LIST_FROM_DB}}

กฎ:
- ตอบ JSON บรรทัดเดียว ห้ามมีข้อความอื่น
- ถ้าไม่มั่นใจ ให้ confidence ต่ำ
- ถ้าไม่เกี่ยวกับระบบเอกสาร ให้ intent=FALLBACK
```

`{{DYNAMIC_INTENT_LIST_FROM_DB}}` สร้างจาก `SELECT intent_code, description_th FROM ai_intent_definitions WHERE is_active = TRUE`

### Confidence Thresholds

| Range | Action |
|-------|--------|
| ≥ 0.7 | ใช้ intent ที่ LLM ตอบ |
| 0.4–0.69 | ใช้ intent + log warning ใน `ai_audit_logs` |
| < 0.4 | Override เป็น `FALLBACK` |

### Recalibration

หลังรวบรวม 100-500 queries ใน `ai_audit_logs` → วิเคราะห์:
- Intent ไหนที่ LLM classify ถูก/ผิดบ่อย
- Threshold ควรปรับขึ้น/ลง
- Pattern ไหนควรเพิ่มเพื่อลด LLM calls

---

## Performance Budget

| Step | Target Latency | Notes |
|------|---------------|-------|
| Pattern match (cache hit) | < 10ms | regex loop over cached patterns |
| Pattern match (cache miss → DB) | < 50ms | query + cache write |
| LLM fallback (Ollama) | < 2000ms | synchronous, gemma4:e4b Q8_0, prompt ~200 tokens |
| **Total worst case** | < 2100ms | pattern miss + LLM |
| **Total best case** | < 10ms | pattern hit |

---

## Concurrency Protection

- **Semaphore**: max 3 concurrent LLM classify calls
- **Overflow behavior**: เกิน semaphore → return `FALLBACK` intent + confidence 0 + log warning
- **เหตุผล**: prompt สั้น (~200 tokens) จึงใช้ 3 concurrent ได้บน RTX 2060 Super 8GB โดยไม่กระทบ RAG/OCR ที่ใช้ `ai-batch` queue

---

## Caching Strategy

- **Key**: `ai:intent:patterns:active`
- **Format**: JSON array ของ patterns sorted by priority
- **TTL**: 300 seconds (5 นาที)
- **Invalidation**: TTL-based เท่านั้น (v1) — Admin แก้ pattern แล้วรอไม่เกิน 5 นาที
- **Cache miss**: query `ai_intent_patterns WHERE is_active = TRUE ORDER BY priority ASC` → write cache

---

## Admin UI (v1 Scope)

Admin page สำหรับจัดการ Intent Classification:

1. **Intent Definitions** — CRUD intent codes + descriptions
2. **Intent Patterns** — CRUD patterns per intent (keyword/regex, language, priority)
3. **Test Console** — input query → แสดงผล classification result (pattern hit / LLM fallback + confidence)
4. **Analytics** — แสดง hit rate (pattern vs LLM), confidence distribution จาก `ai_audit_logs`

---

## Audit & Observability

ทุก classification request บันทึกใน `ai_audit_logs`:

```json
{
  "action": "intent_classification",
  "input": "<user query>",
  "output": { "intent": "GET_RFA", "confidence": 0.85 },
  "method": "pattern" | "llm_fallback" | "semaphore_overflow",
  "latencyMs": 8,
  "projectPublicId": "...",
  "userPublicId": "..."
}
```

---

## Consequences

### Positive
- 70-80% ของ queries ตอบได้ < 10ms โดยไม่ใช้ GPU
- ขยาย intent ได้ runtime ผ่าน Admin UI (ไม่ต้อง deploy)
- Bilingual + typo tolerance ผ่าน LLM fallback
- Audit trail ครบทุก classification → recalibrate ได้

### Negative
- 2 layers to maintain (DB patterns + LLM prompt) — แต่ทั้งคู่ configurable ไม่ใช่ hardcode
- LLM fallback ไม่ deterministic → ต้องมี threshold + audit
- Admin UI เพิ่ม scope ใน v1

### Risks
- gemma4:e4b Q8_0 classify ผิดสำหรับ query ที่กำกวม → mitigate ด้วย threshold + FALLBACK + recalibration
- Pattern ที่กว้างเกินไป (เช่น keyword "เอกสาร" match ทุก intent) → mitigate ด้วย priority ordering + regex specificity

---

## Migration Notes (ADR-009)

- เพิ่มตาราง `ai_intent_definitions` และ `ai_intent_patterns` ผ่าน SQL delta file
- Seed ข้อมูล 12 intents + initial patterns
- ไม่ใช้ TypeORM migration
