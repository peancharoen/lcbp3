# Session 15 — 2026-06-05 (Feature 234 RAG Pipeline Enhancements — สมบูรณ์)

## Summary

Implement RAG Pipeline Enhancements ตาม Spec 234 / ADR-035 ครบทุก Functional Requirement (FR-001 → FR-015), ผ่าน speckit-analyze → speckit-implement → speckit-tester → speckit-validate; ปิด Gap ทั้ง 2 รายการ

## งานที่ทำในเซสชั่นนี้

| งาน | ไฟล์หลัก | สถานะ |
|-----|----------|-------|
| Sidecar `/embed` (BGE-M3 Dense+Sparse) | `ocr-sidecar/app.py`, `requirements.txt` | ✅ |
| Sidecar `/rerank` (BGE-Reranker-Large) | `ocr-sidecar/app.py` | ✅ |
| `OcrService.embedViaSidecar()` + `rerankViaSidecar()` | `ocr.service.ts` | ✅ |
| Hybrid Qdrant schema (1024 dims, drop+recreate) | `qdrant.service.ts` | ✅ |
| Payload indexes (project_public_id tenant, doc_public_id, status_code, doc_type) | `qdrant.service.ts` | ✅ |
| `EmbeddingService.embedDocument()` — Semantic Chunking + fallback | `embedding.service.ts` | ✅ |
| `semanticChunkTextWithFallback()` → `parseChunkTags()` → `fixedSizeChunk()` | `embedding.service.ts` | ✅ |
| `AiBatchProcessor` case `rag-prepare` → `processRagPrepare()` | `ai-batch.processor.ts` | ✅ |
| `AiQueueService.enqueueRagPrepare()` + jobId dedup | `ai-queue.service.ts` | ✅ |
| `CorrespondenceWorkflowService.syncStatus()` → `triggerRagPrepare()` | `correspondence-workflow.service.ts` | ✅ |
| `AiRagService.processQuery()` — Hybrid Search + Reranker | `ai-rag.service.ts` | ✅ |
| SQL delta `rag_chunking` prompt | `deltas/2026-06-05-add-rag-chunking-prompt.sql` | ✅ |
| Integration test (9 tests) | `ai-rag-pipeline.integration.spec.ts` | ✅ |
| Validation report | `specs/200-fullstacks/234-rag-pipeline-enhancements/validation-report.md` | ✅ |

## Verification

- `npx jest` (6 suites): **24/24 tests PASS**
- `npx tsc --noEmit`: **0 errors**
- speckit-validate: **15/15 FR covered, 6/6 SC verifiable, 0 Gaps remaining**

## Architecture Summary (ADR-035)

```
CorrespondenceWorkflowService.syncStatus()
  └── triggerRagPrepare() [fire-and-forget]
        └── AiQueueService.enqueueRagPrepare() [jobId dedup]
              └── BullMQ ai-batch queue
                    └── AiBatchProcessor.processRagPrepare()
                          ├── OcrService.detectAndExtract() [if no cached text]
                          └── EmbeddingService.embedDocument()
                                ├── semanticChunkTextWithFallback() → typhoon2.5 / fixed-size fallback
                                ├── OcrService.embedViaSidecar() → BGE-M3 [dense 1024 + sparse]
                                └── AiQdrantService.upsert() → lcbp3_vectors [delete-before-upsert]

AiRagService.processQuery()
  ├── OcrService.embedViaSidecar(question) → BGE-M3
  ├── AiQdrantService.searchByProject(dense, sparse, projectPublicId, 15) → RRF Fusion
  ├── OcrService.rerankViaSidecar(question, chunks) → BGE-Reranker top-5
  └── Ollama typhoon2.5-np-dms:latest → answer + citations
```
