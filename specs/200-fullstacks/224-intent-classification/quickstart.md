# Quick Start: Intent Classification System

**Feature**: 224-intent-classification  
**Date**: 2026-05-19

---

## Prerequisites

- Ollama Server บน Admin Desktop (Desk-5439) พร้อม Model `gemma4:e4b`
- Redis Server พร้อมใช้งาน
- Database Schema อัปเดตผ่าน SQL Delta

---

## Installation Steps

### 1. Database Schema

รัน SQL Delta:

```bash
# SSH to QNAP (192.168.10.8)
mysql -u napdms -p napdms < specs/03-Data-and-Storage/deltas/03-add-intent-classification.sql
```

### 2. Seed Intent Definitions

```bash
cd backend
npx ts-node src/database/seeds/ai-intent.seed.ts
```

หรือรัน SQL โดยตรง:

```sql
INSERT INTO ai_intent_definitions (intent_code, description_th, description_en, category) VALUES
('RAG_QUERY', 'ถามคำถามธรรมชาติ ตอบจาก vector + doc context', 'Natural language query from vector DB + document context', 'read'),
('GET_RFA', 'ดึง RFA ตาม filter', 'Get RFA by filters', 'read'),
('GET_DRAWING', 'ดึง Drawing revision', 'Get Drawing revision', 'read'),
('GET_TRANSMITTAL', 'ดึง Transmittal', 'Get Transmittal', 'read'),
('GET_CORRESPONDENCE', 'ดึง Correspondence ทั่วไป', 'Get Correspondence', 'read'),
('GET_CIRCULATION', 'ดึง Circulation', 'Get Circulation', 'read'),
('GET_RFA_DRAWINGS', 'ดึง Drawings ที่ผูกกับ RFA', 'Get Drawings linked to RFA', 'read'),
('SUMMARIZE_DOCUMENT', 'สรุปเอกสารที่เปิดอยู่', 'Summarize current document', 'read'),
('LIST_OVERDUE', 'รายการ cross-entity ที่เกินกำหนด', 'List overdue items across entities', 'read'),
('SUGGEST_METADATA', 'แนะนำ metadata สำหรับเอกสารที่อัปโหลด', 'Suggest metadata for uploaded document', 'suggest'),
('SUGGEST_ACTION', 'แจ้งเตือนว่าควรทำอะไรต่อ', 'Suggest next actions', 'suggest'),
('FALLBACK', 'ไม่เข้า intent ไหน / ไม่เกี่ยวกับระบบ', 'No matching intent / unrelated to system', 'utility');
```

### 3. Backend Configuration

เพิ่มใน `backend/.env`:

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://192.168.10.10:11434
OLLAMA_MODEL=gemma4:e4b
OLLAMA_TIMEOUT_MS=5000

# Intent Classification
INTENT_CLASSIFIER_LLM_SEMAPHORE=3
INTENT_PATTERN_CACHE_TTL=300
```

### 4. Backend Module Registration

ตรวจสอบว่า `AiModule` ได้ import `IntentClassifierModule`:

```typescript
// backend/src/modules/ai/ai.module.ts
import { IntentClassifierModule } from './intent-classifier/intent-classifier.module';

@Module({
  imports: [
    // ... existing modules
    IntentClassifierModule,
  ],
})
export class AiModule {}
```

### 5. Build & Deploy

```bash
# Backend
cd backend
npm run build

# Frontend
cd ../frontend
npm run build

# Deploy via Gitea Actions (or manual)
```

---

## Testing

### 1. API Test (curl)

```bash
# Classification API
curl -X POST http://localhost:3001/api/ai/intent/classify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "query": "สรุปเอกสารนี้",
    "projectPublicId": "019505a1-7c3e-7000-8000-abc123def456"
  }'

# Expected Response:
# {
#   "intentCode": "SUMMARIZE_DOCUMENT",
#   "confidence": 1.0,
#   "method": "pattern",
#   "latencyMs": 8
# }
```

### 2. Admin UI

1. เข้า `/admin/ai/intent-classification`
2. สร้าง Intent Pattern ใหม่
3. ทดสอบผ่าน Test Console

### 3. Unit Tests

```bash
cd backend
npm test -- intent-classifier.service.spec.ts

# Coverage target: 80%+ business logic
cd ../frontend
npm test -- use-intent-classification.test.ts
```

---

## Troubleshooting

### Pattern Match ไม่ทำงาน

1. ตรวจสอบ Redis: `redis-cli GET ai:intent:patterns:active`
2. Invalidate cache: รอ TTL 5 นาที หรือ restart service
3. ตรวจสอบ priority: ต่ำ = สำคัญกว่า (10 จะ match ก่อน 100)

### LLM Fallback Timeout

1. ตรวจสอบ Ollama Server: `curl http://192.168.10.10:11434/api/tags`
2. ตรวจสอบ GPU Memory: `nvidia-smi` บน Admin Desktop
3. ลด `OLLAMA_TIMEOUT_MS` หรือเพิ่มขึ้นตามสถานะ

### Semaphore Overflow

- ปกติ: Request จะ queue จนกว่ามี slot ว่าง
- หาก queue นานเกินไป: ปรับเพิ่ม `INTENT_CLASSIFIER_LLM_SEMAPHORE` (แต่ระวัง GPU)

---

## Next Steps

1. ✅ Schema + Seed ข้อมูล
2. ✅ Backend API พร้อมใช้งาน
3. ✅ Admin UI สำหรับจัดการ Patterns
4. ⏳ Integration กับ AI Tool Layer (ADR-025) — Phase ถัดไป
