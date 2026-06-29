# Research: ADR-022 RAG — Technical Unknowns Resolution

**Date**: 2026-04-19 | **Phase**: 0 — Pre-Design Research

---

## R1: Local Ollama LLM Model (Marked "Confidential" in Spec)

**Decision**: ใช้ environment variable `OLLAMA_RAG_MODEL` กำหนด model ที่ใช้ในแต่ละ environment  
**Rationale**: Model name ถูก mark confidential ใน spec — ไม่ hardcode ใน codebase; ทีม ops กำหนดผ่าน docker-compose env; fallback default คือ `llama3:8b` หากไม่ได้ set  
**Alternatives considered**:
- Hardcode model name: ❌ ขัด ADR-018 (sensitive config ไม่ควรอยู่ใน code)
- Config file: ❌ ซับซ้อนเกินจำเป็น; env var เพียงพอ

**Implementation**:
```env
# docker-compose.yml
OLLAMA_RAG_MODEL=<model-name>   # กำหนดโดย ops team
OLLAMA_URL=http://admin-desktop:11434
```

---

## R2: PyThaiNLP Integration Strategy

**Decision**: Python microservice แยกต่างหาก รับ text ผ่าน HTTP POST จาก NestJS processor  
**Rationale**: NestJS เป็น TypeScript — ไม่สามารถ import PyThaiNLP โดยตรง; HTTP microservice ง่ายต่อ deploy แยก container บน Admin Desktop  
**Alternatives considered**:
- Python subprocess จาก NestJS: ❌ fragile, ยาก scale
- Node.js Thai tokenizer (node-nlp): ❌ คุณภาพต่ำกว่า PyThaiNLP สำหรับภาษาไทยเฉพาะทาง

**PyThaiNLP version**: 5.0.x (latest stable, support Python 3.11)

**Processing steps**:
1. Word tokenization (newmm engine — best for mixed Thai/English)
2. Thai numeral normalization: `๑๐` → `10`
3. Abbreviation expansion: `รฟม.` → `การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย (รฟม.)`
4. Section header strip: `หน้า 1/3`, `ลงชื่อ__________` removed
5. Rejoin tokens with space for nomic-embed-text input

**Microservice endpoint**:
```
POST http://admin-desktop:8765/preprocess
Body: { "text": "..." }
Response: { "normalized": "..." }
```

---

## R3: Qdrant Tiered Multitenancy Setup (v1.16+)

**Decision**: Single collection `lcbp3_vectors` + `is_tenant: true` payload index บน `project_public_id`  
**Rationale**: Qdrant v1.16 รองรับ tenant-aware HNSW index ที่ให้ query speed 3-5× เร็วขึ้นเมื่อ filter ด้วย tenant field; ไม่ต้องบริหาร N collections  
**Alternatives considered**:
- Separate collection per project: ❌ ops burden สูง; lifecycle management ซับซ้อนเมื่อ project เพิ่ม/ลบ
- Plain payload filter: ❌ ช้ากว่า is_tenant=true บน large collection

**Qdrant collection creation**:
```typescript
await qdrantClient.createCollection('lcbp3_vectors', {
  vectors: { size: 768, distance: 'Cosine' },
  hnsw_config: { payload_m: 16, m: 0 },  // ปิด global index
});

await qdrantClient.createPayloadIndex('lcbp3_vectors', {
  field_name: 'project_public_id',
  field_schema: { type: 'keyword', is_tenant: true },
});

// Additional indexes for filtering
await qdrantClient.createPayloadIndex('lcbp3_vectors', {
  field_name: 'classification',
  field_schema: 'keyword',
});
```

---

## R4: Hybrid Search Implementation

**Decision**: BM25 (MariaDB FULLTEXT) + Vector (Qdrant) merged with weighted score (0.7 vector + 0.3 keyword)  
**Rationale**: RRF (Reciprocal Rank Fusion) มีความซับซ้อนสูงกว่าสำหรับ initial implementation; weighted sum ง่ายกว่า tune และ debug; v1.1.2 spec ระบุ 0.7/0.3 ไว้แล้ว  
**Alternatives considered**:
- RRF fusion: ✅ ดีกว่าสำหรับ production long-term แต่ complex กว่า — defer ไปเป็น Future Enhancement
- Vector-only: ❌ พลาด keyword เช่น doc number `REF-2026-001` (v1.1.1 reviewer ชี้ประเด็นนี้)

**Merge algorithm**:
```typescript
// Normalize scores 0-1 then merge
const mergedScore = (0.7 * vectorScore) + (0.3 * keywordScore);
// Top 20 → Re-rank → Top 5
```

---

## R5: BullMQ Queue Architecture

**Decision**: 3 queues แยก (ocr, thai-preprocess, embedding) เพื่อ scale แต่ละ stage ได้อิสระ  
**Rationale**: OCR bound by CPU; thai-preprocess bound by network (HTTP to microservice); embedding bound by Ollama GPU — scale แยกกันได้  
**Queue design**:

| Queue | Worker Location | Concurrency | DLQ |
|-------|----------------|-------------|-----|
| `rag:ocr` | QNAP NAS | 2 | ✅ max 3 retries |
| `rag:thai-preprocess` | QNAP NAS | 4 | ✅ max 3 retries |
| `rag:embedding` | QNAP NAS | 3 | ✅ max 3 retries |

**DLQ (Dead Letter Queue)**: ไฟล์ที่ fail > 3 ครั้ง → update `rag_status = 'FAILED'` + บันทึก error ใน `rag_last_error` → alert ทีม Dev

---

## R6: Typhoon API Failover Pattern

**Decision**: Circuit-breaker pattern ใน `TyphoonService` — auto-failover to Ollama เมื่อ timeout > 5s หรือ HTTP 5xx  
**Rationale**: Simple threshold-based failover เพียงพอสำหรับ initial version; ไม่ต้องใช้ library circuit-breaker เพิ่ม  

**Failover logic**:
```typescript
async generateAnswer(context: string, query: string, classification: Classification): Promise<RagAnswer> {
  if (classification === 'CONFIDENTIAL') {
    return this.generateWithOllama(context, query); // ADR-018: local only
  }
  try {
    return await Promise.race([
      this.generateWithTyphoon(context, query),
      this.timeoutAfter(5000), // 5s
    ]);
  } catch {
    this.logger.warn('Typhoon timeout/error — failing over to Ollama');
    return { ...(await this.generateWithOllama(context, query)), used_fallback_model: true };
  }
}
```

---

## R7: Security — Prompt Injection Defense

**Decision**: Structured output enforcement + system prompt boundary markers  
**Rationale**: "ignore external instructions" (v1.1.2) ไม่เพียงพอ; ต้องใช้ structured JSON output บังคับ format ป้องกัน model เบี่ยงเบน  

**Defense layers**:
1. System prompt: `<CONTEXT_START>` / `<CONTEXT_END>` boundary markers
2. Require JSON-only output (structured output mode)
3. Post-generation validation: ตรวจ `citations` array ว่า `doc_number` มีอยู่จริงใน retrieved chunks
4. ถ้า validation ล้มเหลว → return fallback "ไม่พบข้อมูลที่ระบุ"

---

## Resolution Summary

| Unknown | Status | Decision |
|---------|--------|---------|
| Ollama model name | ✅ Resolved | `OLLAMA_RAG_MODEL` env var |
| PyThaiNLP integration | ✅ Resolved | Python HTTP microservice บน Admin Desktop |
| Qdrant multitenancy API | ✅ Resolved | `is_tenant: true` payload index (Qdrant v1.16+) |
| Hybrid search merge | ✅ Resolved | Weighted sum 0.7/0.3 (RRF deferred) |
| BullMQ queue structure | ✅ Resolved | 3 queues: ocr, thai-preprocess, embedding |
| Typhoon failover pattern | ✅ Resolved | Promise.race timeout + Ollama fallback |
| Prompt injection defense | ✅ Resolved | Structured JSON output + citation validation |
