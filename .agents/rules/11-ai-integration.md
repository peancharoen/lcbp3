
# ADR-020 AI Integration Architecture

## CRITICAL RULES

- **ALWAYS** follow ADR-018 AI boundary policy (isolation on Admin Desktop)
- **ALWAYS** use RFA-First approach for AI implementation
- **NEVER** allow AI direct database/storage access
- **ALWAYS** implement human-in-the-loop validation
- **NEVER** send sensitive data to cloud AI services

## AI Integration Patterns

### Architecture Overview

```
Frontend → AI Gateway API → Admin Desktop (Ollama) → Backend Validation
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **AI Gateway** | Backend (NestJS) | API endpoints, validation, audit logging |
| **Ollama Engine** | Admin Desktop (Desk-5439) | LLM inference (Gemma 4) |
| **OCR Engine** | Admin Desktop (Desk-5439) | Thai/English text extraction |
| **Orchestrator** | QNAP NAS (n8n) | Workflow management |

## Backend Implementation (NestJS)

```typescript
// AI Module with boundary enforcement
@Module({
  controllers: [AiController],
  providers: [AiService, AiGateway],
  exports: [AiService],
})
export class AiModule {
  constructor() {
    // Enforce ADR-018 boundaries
  }
}

// AI Service with validation
@Injectable()
export class AiService {
  async extractMetadata(documentId: string): Promise<AIMetadata> {
    // 1. Validate permissions
    // 2. Send to Admin Desktop AI
    // 3. Validate AI response
    // 4. Log audit trail
    // 5. Return validated results
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

- **AI Isolation:** All AI processing on Admin Desktop only
- **Data Privacy:** No cloud AI services, on-premises only
- **Audit Trail:** Log all AI interactions and human validations
- **Rate Limiting:** Prevent AI abuse and resource exhaustion
- **Validation:** All AI outputs must be validated before use

## Required Implementation

- [ ] AiModule with ADR-018 boundary enforcement
- [ ] AI Gateway API endpoints with validation
- [ ] DocumentReviewForm reusable component
- [ ] Admin Desktop Ollama + PaddleOCR setup
- [ ] n8n workflow orchestration
- [ ] AI audit logging and monitoring
- [ ] Human-in-the-loop validation workflows

## Related Documents

- `specs/06-Decision-Records/ADR-018-ai-boundary.md`
- `specs/06-Decision-Records/ADR-020-ai-intelligence-integration.md`
- `specs/06-Decision-Records/ADR-017-ollama-data-migration.md`
