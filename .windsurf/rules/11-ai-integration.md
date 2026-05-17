---
trigger: always_on
---

# ADR-023/023A AI Integration Architecture

## CRITICAL RULES

- **ALWAYS** follow ADR-023 AI boundary policy (isolation on Admin Desktop)
- **ALWAYS** use ADR-023A 2-model stack (gemma4:e4b Q8_0 + nomic-embed-text)
- **ALWAYS** use BullMQ 2-queue (ai-realtime + ai-batch) for GPU overload prevention
- **NEVER** allow AI direct database/storage access
- **ALWAYS** implement human-in-the-loop validation
- **NEVER** send sensitive data to cloud AI services
- **ALWAYS** enforce Qdrant projectPublicId filter (compile-time enforcement)
- **NEVER** allow n8n to call Ollama/Qdrant directly (must go through DMS API → BullMQ)

## AI Integration Patterns

### Architecture Overview

```
Frontend → AI Gateway API → BullMQ → Admin Desktop (Ollama) → Backend Validation
n8n (Migration) → DMS API → BullMQ → Admin Desktop (Ollama) → Backend Validation
```

### Key Components

| Component         | Location                  | Purpose                                                                  |
| ----------------- | ------------------------- | ------------------------------------------------------------------------ |
| **AI Gateway**    | Backend (NestJS)          | API endpoints, validation, audit logging                                 |
| **BullMQ Queues** | Backend (NestJS)          | ai-realtime (RAG/Suggest), ai-batch (OCR/Extract/Embed)                  |
| **Ollama Engine** | Admin Desktop (Desk-5439) | gemma4:e4b Q8_0 (LLM) + nomic-embed-text (Embedding)                     |
| **OCR Engine**    | Admin Desktop (Desk-5439) | PaddleOCR + PyThaiNLP (Thai/English text extraction)                     |
| **Orchestrator**  | QNAP NAS (n8n)            | Migration Phase orchestrator only (calls DMS API, never Ollama directly) |

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
    // 3. Worker sends to Admin Desktop AI (gemma4:e4b Q8_0)
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

- **AI Isolation:** All AI processing on Admin Desktop only (Desk-5439)
- **Data Privacy:** No cloud AI services, on-premises only
- **Audit Trail:** Log all AI interactions and human validations to ai_audit_logs
- **Rate Limiting:** Prevent AI abuse and resource exhaustion
- **Validation:** All AI outputs must be validated before use
- **Multi-tenant Isolation:** Qdrant queries MUST include projectPublicId filter (compile-time enforcement)
- **n8n Boundary:** n8n MUST call DMS API → BullMQ, NEVER Ollama/Qdrant directly
- **GPU Overload Prevention:** BullMQ 2-queue (ai-realtime + ai-batch) with concurrency=1

## ADR-023A Specific Rules

- **2-Model Stack:** gemma4:e4b Q8_0 (~4.0GB) + nomic-embed-text (~0.3GB) = ~4.3GB VRAM peak
- **PDF 3-Page Limit:** Classification/Tagging uses first 3 pages only (NOT RAG embedding)
- **RAG Embedding:** Full document chunked at 512 tokens/64 tokens overlap
- **OCR Auto-Detect:** PyMuPDF chars > 100 → Fast path, else PaddleOCR
- **Embed Auto-Trigger:** AUTO after commit (parallel), gap covered by DB search
- **Threshold Recalibration:** After 100-500 docs, based on ai_audit_logs analysis

## Required Implementation

- [ ] AiModule with ADR-023 boundary enforcement
- [ ] AI Gateway API endpoints with validation
- [ ] BullMQ 2-queue setup (ai-realtime + ai-batch)
- [ ] QdrantService with projectPublicId enforcement
- [ ] DocumentReviewForm reusable component
- [ ] Admin Desktop Ollama (gemma4:e4b Q8_0 + nomic-embed-text) + PaddleOCR setup
- [ ] n8n workflow orchestration (Migration Phase only)
- [ ] AI audit logging and monitoring (ai_audit_logs)
- [ ] Human-in-the-loop validation workflows

## Related Documents

- `specs/06-Decision-Records/ADR-023-unified-ai-architecture.md` (Base architecture)
- `specs/06-Decision-Records/ADR-023A-unified-ai-architecture.md` (Model revision - current)
