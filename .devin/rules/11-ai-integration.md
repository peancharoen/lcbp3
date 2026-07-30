---
trigger: always_on
---

# ADR-023/023A AI Integration Architecture

## CRITICAL RULES

- **ALWAYS** follow ADR-023 AI boundary policy (isolation on np-dms-lcbp3 — post-ADR-041)
- **ALWAYS** use ADR-034/035/040 model stack (np-dms-ai + np-dms-ocr + BGE-M3 + BGE-Reranker)
- **ALWAYS** use BullMQ 2-queue (ai-realtime + ai-batch) for GPU overload prevention
- **NEVER** allow AI direct database/storage access
- **ALWAYS** implement human-in-the-loop validation
- **NEVER** send sensitive data to cloud AI services
- **ALWAYS** enforce Qdrant projectPublicId filter (compile-time enforcement)
- **NEVER** allow n8n to call Ollama/Qdrant directly (must go through DMS API → BullMQ)

## AI Integration Patterns

### Architecture Overview

```
Frontend → AI Gateway API → BullMQ → np-dms-lcbp3 (Ollama) → Backend Validation
n8n (Migration) → DMS API → BullMQ → np-dms-lcbp3 (Ollama) → Backend Validation
```

### Key Components

| Component         | Location               | Purpose                                                                                           |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| **AI Gateway**    | Backend (NestJS)       | API endpoints, validation, audit logging                                                          |
| **BullMQ Queues** | Backend (NestJS)       | ai-realtime (RAG/Suggest), ai-batch (OCR/Extract/Embed)                                           |
| **Ollama Engine** | np-dms-lcbp3 (systemd) | np-dms-ai (Main LLM, standby) + np-dms-ocr (OCR, keep_alive:0 adaptive)                           |
| **OCR Sidecar**   | np-dms-lcbp3 (Docker)  | FastAPI: /ocr-upload (np-dms-ocr via Ollama) + /embed (BGE-M3) + /rerank (BGE-Reranker) — ADR-040 |
| **Orchestrator**  | np-dms-lcbp3 (n8n)     | Migration Phase orchestrator only (calls DMS API, never Ollama directly)                          |

## Backend Implementation (NestJS)

```typescript
// AI Module with boundary enforcement
@Module({
  controllers: [AiController],
  providers: [AiService, AiGateway, QdrantService],
  exports: [AiService],
})
export class AiModule {
  constructor() {
    // Enforce ADR-023 boundaries
  }
}

// QdrantService with compile-time projectPublicId enforcement
@Injectable()
export class QdrantService {
  async search(
    projectPublicId: string,   // required — compile-time enforcement
    vector: number[],
    topK: number = 5,
  ): Promise<QdrantSearchResult[]> {
    return this.client.search('documents', {
      vector,
      limit: topK,
      filter: {
        must: [{ key: 'project_public_id', match: { value: projectPublicId } }],
      },
    });
  }

  async upsert(
    projectPublicId: string,   // required
    chunks: DocumentChunk[],
  ): Promise<void> { ... }

  // ❌ NEVER expose rawSearch() or method without projectPublicId filter
}

// AI Service with validation
@Injectable()
export class AiService {
  async extractMetadata(documentId: string): Promise<AIMetadata> {
    // 1. Validate permissions
    // 2. Queue job to BullMQ (ai-batch or ai-realtime)
    // 3. Worker sends to np-dms-lcbp3 AI (np-dms-ai via Ollama)
    // 4. Validate AI response
    // 5. Log audit trail to ai_audit_logs
    // 6. Return validated results
  }
}
```

## Frontend Pattern (Next.js)

```typescript
// Document Review Form (reusable component)
const DocumentReviewForm = ({ document, aiSuggestions }) => {
  return (
    <form>
      <Field label="Document Type" suggestions={aiSuggestions.documentType} />
      <Field label="Project Code" suggestions={aiSuggestions.projectCode} />
      <Field label="Discipline" suggestions={aiSuggestions.discipline} />

      <ConfidenceScore score={aiSuggestions.confidence} />
      <HumanValidationActions />
    </form>
  );
};
```

## Security Requirements

- **AI Isolation:** All AI processing on np-dms-lcbp3 only (post-ADR-041 — formerly Desk-5439)
- **Data Privacy:** No cloud AI services, on-premises only
- **Audit Trail:** Log all AI interactions and human validations to ai_audit_logs
- **Rate Limiting:** Prevent AI abuse and resource exhaustion
- **Validation:** All AI outputs must be validated before use
- **Multi-tenant Isolation:** Qdrant queries MUST include projectPublicId filter (compile-time enforcement)
- **n8n Boundary:** n8n MUST call DMS API → BullMQ, NEVER Ollama/Qdrant directly
- **GPU Overload Prevention:** BullMQ 2-queue (ai-realtime + ai-batch) with concurrency=1

## ADR-034/035/040 Model Stack (supersedes ADR-023A §2.1)

- **Model Config:** np-dms-ai (Main LLM, standby) + np-dms-ocr (OCR, keep_alive:0 adaptive) + BGE-M3 (Embedding) + BGE-Reranker-Large (Reranking)
- **Engine:** Single engine `np-dms-ocr` — no Tesseract fallback (ADR-040 D1 amends ADR-035)
- **`/normalize` endpoint:** Removed from sidecar (ADR-040 D2 — no consumer)
- **PDF 3-Page Limit:** Classification/Tagging uses first 3 pages only (NOT RAG embedding)
- **RAG Embedding:** Full document chunked at 512 tokens/64 tokens overlap
- **OCR Auto-Detect:** PyMuPDF `auto` branch is dead code for PDF scan (corpus = image scan); engine `np-dms-ocr` used directly
- **Embed Auto-Trigger:** AUTO after commit (parallel), gap covered by DB search
- **Threshold Recalibration:** After 100-500 docs, based on ai_audit_logs analysis

## Required Implementation

- [ ] AiModule with ADR-023 boundary enforcement
- [ ] AI Gateway API endpoints with validation
- [ ] BullMQ 2-queue setup (ai-realtime + ai-batch)
- [ ] QdrantService with projectPublicId enforcement
- [ ] DocumentReviewForm reusable component
- [ ] np-dms-lcbp3 Ollama (np-dms-ai + np-dms-ocr) + OCR Sidecar (BGE-M3 + BGE-Reranker) setup
- [ ] n8n workflow orchestration (Migration Phase only)
- [ ] AI audit logging and monitoring (ai_audit_logs)
- [ ] Human-in-the-loop validation workflows

## Related Documents

- `specs/06-Decision-Records/ADR-023-unified-ai-architecture.md` (Base architecture)
- `specs/06-Decision-Records/ADR-023A-unified-ai-architecture.md` (Model revision - current)
- `specs/06-Decision-Records/ADR-024-intent-classification-strategy.md` (Pattern→LLM Fallback)
- `specs/06-Decision-Records/ADR-025-ai-tool-layer-architecture.md` (Tool Registry)
- `specs/06-Decision-Records/ADR-026-document-chat-ui-pattern.md` (Chat UI)
- `specs/06-Decision-Records/ADR-027-ai-admin-console-and-dynamic-control.md` (Admin Console)
- `specs/06-Decision-Records/ADR-028-migration-architecture-refactor.md` (Migration Pipeline)
- `specs/06-Decision-Records/ADR-034-AI-model-change.md` (Thai-Optimized Model Stack)
- `specs/06-Decision-Records/ADR-035-ai-pipeline-flow-architecture.md` (AI Pipeline Flow — ⚠️ amended by ADR-040)
- `specs/06-Decision-Records/ADR-040-ocr-sidecar-refactor.md` (OCR Sidecar Refactor — amends ADR-035)
- `specs/06-Decision-Records/ADR-041-server-consolidation.md` (Server Consolidation)
- `specs/06-Decision-Records/ADR-042-sandbox-project-and-ocr-text-persistence.md` (Sandbox Project + OCR Persist)
- `specs/02-Architecture/02-05-ai-document-ingestion-flow.md` (AI Ingestion Flow walkthrough)
