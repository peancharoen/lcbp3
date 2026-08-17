# Phase 2.2 — ADR-023 AI Boundary Audit (Migration Module)

**Date:** 2026-08-17
**Issue:** Gitea #3
**Scope:** Audit migration module สำหรับ AI boundary violations ตาม ADR-023/023A

## Audit Results

### ✅ ไม่พบ AI Boundary Violations

Migration module (`backend/src/modules/migration/`) ปฏิบัติตาม ADR-023/023A อย่างถูกต้อง:

#### 1. ไม่มีการ import Ollama/Qdrant/AiService โดยตรง

ตรวจพบเฉพาะ:
- `import { SystemSetting } from '../ai/entities/system-setting.entity'` — เป็นการอ่านค่า config จาก DB เท่านั้น ไม่ใช่ AI inference call
- `import { ... } from '../../ai/types/migration-compare-result.type'` — เป็น type definitions เท่านั้น

#### 2. RagBatchService ใช้ BullMQ queue อย่างถูกต้อง

```typescript
@InjectQueue('ai-batch')
private readonly aiBatchQueue?: Queue
```

- ใช้ `aiBatchQueue.add()` เพื่อ enqueue jobs
- มี idempotency check ผ่าน `aiBatchQueue.getJob(jobId)`
- ไม่ได้เรียก Ollama หรือ Qdrant โดยตรง
- ใช้ `dataSource` เฉพาะสำหรับ query RAG candidates (DB read) ซึ่งถูกต้อง

#### 3. MetadataResolutionService ไม่มี AI calls

- ใช้ `dataSource` สำหรับ batch SQL resolution (org/type/discipline)
- ไม่ได้เรียก AI services ใดๆ
- เป็น pure data resolution logic

#### 4. ExpirePendingReviewsWorker เป็น cron cleanup

- ไม่เกี่ยวข้องกับ AI
- ใช้ TypeORM repositories สำหรับ cleanup expired reviews

#### 5. ไม่มี QdrantService.search() โดยไม่มี projectPublicId

Migration module ไม่ได้เรียก QdrantService โดยตรงเลย

## สรุป

Migration module ปฏิบัติตาม ADR-023/023A อย่างครบถ้วน — ไม่ต้อง refactor ใดๆ ใน Phase 2.2
