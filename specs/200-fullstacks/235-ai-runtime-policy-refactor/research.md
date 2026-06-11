// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/research.md
// Change Log:
// - 2026-06-11: Phase 0 research for AI Runtime Policy Refactor

# Research: AI Runtime Policy Refactor

## 1. VRAM Headroom Query Strategy

**Decision**: ใช้ Ollama `/api/ps` endpoint เพื่อดู running models และ VRAM usage — คำนวณ headroom จาก total VRAM (16GB RTX 5060 Ti) หักด้วย loaded model VRAM

**Rationale**:
- Ollama `/api/ps` response มี `size_vram` สำหรับแต่ละ loaded model
- ไม่ต้องพึ่ง `pynvml` หรือ `nvidia-ml-py` ซึ่งเพิ่ม dependency และ platform coupling
- หาก `/api/ps` timeout หรือ error → safe default = 0 headroom (unload)

**Alternatives considered**:
- `pynvml` direct NVIDIA API: platform-specific, ต้อง CUDA toolkit, ไม่ต้อง
- `nvidia-smi` subprocess: fragile on container env, parsing overhead
- Hardcode threshold per model: ไม่ adaptive, ต้องอัปเดตทุกครั้งที่เปลี่ยน model

**Response shape จาก Ollama `/api/ps`**:
```json
{
  "models": [
    {
      "name": "np-dms-ai:latest",
      "model": "np-dms-ai:latest",
      "size": 8192000000,
      "size_vram": 7680000000,
      "digest": "...",
      "expires_at": "..."
    }
  ]
}
```

---

## 2. ExecutionProfile → RuntimePolicy Mapping

**Decision**: Mapping table ใน `AiPolicyService` เป็น `readonly` constant — ไม่เก็บใน DB เพราะเป็น architecture decision ไม่ใช่ operational config

**Rationale**:
- Profile set เล็กและเสถียร (4 values) — DB overhead ไม่คุ้ม
- ถ้าต้องการเปลี่ยน profile behavior ต้องผ่าน code review (governance)
- Runtime parameters เป็น implementation detail ของ backend policy — ไม่ expose ใน API

**Policy mapping (draft)**:

| Profile | Canonical Model | Temperature | Top-P | Max Tokens | Notes |
|---------|----------------|-------------|-------|------------|-------|
| `fast` | `np-dms-ai` | 0.1 | 0.9 | 1024 | Quick suggestions |
| `balanced` | `np-dms-ai` | 0.3 | 0.9 | 2048 | Default RAG/suggest |
| `thai-accurate` | `np-dms-ai` | 0.1 | 0.8 | 2048 | Thai doc extraction |
| `large-context` | `np-dms-ai` | 0.3 | 0.9 | 8192 | Admin-only, long docs |

**Data-affecting overrides**:
- `migrate-document` → force `thai-accurate` profile parameters
- `auto-fill-document` → force `thai-accurate` profile parameters
- `ocr-extraction` → handled by OCR sidecar policy, not main LLM

---

## 3. Adaptive OCR Residency Calculation

**Decision**: Policy function ใน `OcrService` (backend) คำนวณ `keep_alive` แล้วส่งไปใน OCR request header/body — สidecar ใช้ค่านั้นตรงๆ

**Rationale**:
- Backend มี context ของ active job profile ที่ sidecar ไม่มี
- Central policy ง่ายกว่า distributed decision

**Algorithm**:
```
function calculateOcrKeepAlive(activeProfile, vramHeadroomMb):
  if activeProfile == 'large-context': return 0
  if vramHeadroomMb < VRAM_HEADROOM_THRESHOLD_MB: return 0
  if vramHeadroomMb >= VRAM_HEADROOM_THRESHOLD_MB: return OCR_RESIDENCY_WINDOW_SECONDS (default: 120)
  fallback (query error): return 0
```

**Default values**:
- `VRAM_HEADROOM_THRESHOLD_MB`: 3000 (3GB) — configurable env variable
- `OCR_RESIDENCY_WINDOW_SECONDS`: 120 (2 min) — configurable env variable

---

## 4. CPU Fallback for Retrieval (FlagEmbedding + BGE-Reranker)

**Decision**: `FlagEmbedding` รองรับ `use_fp16=False` และ device selection — pass `device="cpu"` เมื่อ headroom ไม่พอ

**Rationale**:
- FlagEmbedding (`BGE-M3`) รองรับ CPU inference โดย native — ไม่ต้อง rewrite
- `BGE-Reranker-Large` ก็รองรับ CPU เช่นกัน
- ต้องเพิ่ม timeout guard: CPU embed อาจใช้เวลา 10–30s สำหรับ long doc

**Pattern ใน sidecar**:
```python
async def embed_with_fallback(texts: list[str], vram_headroom_mb: float) -> EmbedResponse:
    device = "cuda" if vram_headroom_mb >= settings.VRAM_HEADROOM_THRESHOLD_MB else "cpu"
    # ใช้ FlagEmbedding พร้อม device parameter
    # log fallback decision
    return result
```

---

## 5. BullMQ Concurrency Uplift Pattern

**Decision**: ใช้ job-type classification ใน `ai-realtime.processor.ts` — ตรวจ `job.data.type` ก่อน process; lightweight jobs (intent-classify, tool-suggest) ทำงาน concurrently; generation-heavy jobs enforce semaphore

**Rationale**:
- BullMQ Worker รองรับ `concurrency: 2` ระดับ worker configuration
- Lightweight jobs ไม่เรียก Ollama → ไม่มี GPU contention จริง
- ไม่ต้องสร้าง queue ใหม่ — เปลี่ยน config + add guard ใน processor พอ

**Lightweight job types** (ที่อนุญาต concurrency = 2):
- `intent-classify` (Pattern Layer only)
- `tool-suggest` (no model switch)

**Generation-heavy** (ยังคง serialize):
- `rag-query`
- `auto-fill-document`
- `migrate-document`
- `ocr-extraction`

---

## 6. Canonical Name Enforcement Strategy

**Decision**: ใช้ `AiPolicyService.getCanonicalModelName(runtimeModelTag)` function ที่ map runtime tag → canonical — เรียกก่อน log/response ทุกครั้ง

**Pattern**:
```typescript
// ไม่ว่า Ollama จะตอบ runtime tag อะไร ให้ map ก่อน expose
const canonicalName = this.aiPolicyService.getCanonicalModelName(ollamaResponse.model);
// canonicalName = "np-dms-ai" หรือ "np-dms-ocr" เสมอ
```

**Mapping table**:
```typescript
const CANONICAL_MODEL_MAP: Record<string, string> = {
  'typhoon2.5-np-dms:latest': 'np-dms-ai',
  'np-dms-ai:latest': 'np-dms-ai',
  'np-dms-ai': 'np-dms-ai',
  'typhoon-np-dms-ocr:latest': 'np-dms-ocr',
  'np-dms-ocr:latest': 'np-dms-ocr',
  'np-dms-ocr': 'np-dms-ocr',
};
```
