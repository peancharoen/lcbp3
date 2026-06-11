// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/data-model.md
// Change Log:
// - 2026-06-11: Data model for AI Runtime Policy Refactor

# Data Model: AI Runtime Policy Refactor

> หมายเหตุ: Feature นี้ไม่เพิ่ม schema DB ใหม่ (ADR-009 compliant) — เปลี่ยนเฉพาะ TypeScript interfaces, DTO shapes, และ Python data structures บน sidecar

---

## TypeScript Types (Backend)

### ExecutionProfile (enum)

```typescript
// File: backend/src/modules/ai/interfaces/execution-policy.interface.ts
export type ExecutionProfile = 'fast' | 'balanced' | 'thai-accurate' | 'large-context';
```

### RuntimePolicy (interface)

```typescript
// File: backend/src/modules/ai/interfaces/execution-policy.interface.ts
export interface RuntimePolicy {
  canonicalModel: 'np-dms-ai' | 'np-dms-ocr';  // ชื่อ canonical เท่านั้น
  temperature: number;
  topP: number;
  maxTokens: number;
  keepAliveSeconds: number;                        // สำหรับ main model
}
```

### OcrResidencyDecision (interface)

```typescript
// File: backend/src/modules/ai/interfaces/ocr-residency.interface.ts
export interface OcrResidencyDecision {
  keepAliveSeconds: number;          // 0 = unload; > 0 = residency window
  vramHeadroomMb: number;            // หรือ -1 ถ้า query ล้มเหลว
  activeProfile: ExecutionProfile | null;
  reason: 'large-context-active' | 'high-pressure' | 'headroom-sufficient' | 'query-failed';
}
```

### VramHeadroom (interface)

```typescript
// File: backend/src/modules/ai/interfaces/execution-policy.interface.ts
export interface VramHeadroom {
  totalMb: number;         // ค่า total VRAM (hardcoded จาก env)
  usedMb: number;          // ค่าจาก Ollama /api/ps
  availableMb: number;     // totalMb - usedMb
  querySuccess: boolean;   // false = ใช้ safe default
}
```

### CreateAiJobDto (updated)

```typescript
// File: backend/src/modules/ai/dto/create-ai-job.dto.ts
// [CHANGE] ลบ model field และ parameter overrides ออก
export class CreateAiJobDto {
  @IsEnum(['auto-fill-document', 'migrate-document', 'rag-query'])
  type: 'auto-fill-document' | 'migrate-document' | 'rag-query';

  @IsOptional()
  @IsUUID('all')
  documentPublicId?: string;

  @IsOptional()
  @IsUUID('all')
  attachmentPublicId?: string;

  @IsOptional()
  @IsEnum(['fast', 'balanced', 'thai-accurate', 'large-context'])
  executionProfile?: ExecutionProfile;

  // [REMOVED] model: { key, parameters } — ไม่อนุญาตแล้ว
}
```

---

## Python Types (OCR Sidecar)

### VramHeadroom (dataclass)

```python
# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/services/vram_monitor.py
@dataclass
class VramHeadroom:
    total_mb: float
    used_mb: float
    available_mb: float
    query_success: bool
```

### OcrResidencyPolicy (dataclass)

```python
# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/services/residency_policy.py
@dataclass
class OcrResidencyDecision:
    keep_alive_seconds: int   # 0 = unload
    vram_headroom_mb: float
    reason: str               # 'large-context-active' | 'high-pressure' | 'headroom-sufficient' | 'query-failed'
```

### EmbedRequest (updated)

```python
# ไม่มี model selection field — backend policy กำหนด model ทั้งหมด
class EmbedRequest(BaseModel):
    texts: List[str]
    # [NO model field] — device selection เป็น internal logic ของ sidecar
```

---

## ai_audit_logs — เพิ่ม Fields (ไม่เปลี่ยน schema, เปลี่ยน payload JSON)

```text
ai_audit_logs.metadata (JSON column ที่มีอยู่แล้ว) จะเพิ่ม fields:
  - modelUsed: "np-dms-ai" | "np-dms-ocr"  (canonical name เสมอ)
  - executionProfile: ExecutionProfile
  - ocrResidencyDecision: OcrResidencyDecision (สำหรับ OCR jobs)
  - retrievalDevice: "gpu" | "cpu"           (สำหรับ RAG jobs)
  - vramHeadroomMb: number                   (ขณะ job เริ่มรัน)
```

> ใช้ JSON column ที่มีอยู่ — ไม่ต้อง ALTER TABLE (ADR-009 compliant)
