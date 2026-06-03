---
title: AI Integration Boundary (ADR-018 / ADR-020)
impact: CRITICAL
impactDescription: AI runs on Admin Desktop only; AI → DMS API → DB (never direct); human-in-the-loop validation mandatory; full audit trail.
tags: ai, ollama, boundary, adr-018, adr-020, privacy, audit
---

## AI Integration Boundary

LCBP3 uses **on-premises AI only** (Ollama on Admin Desktop) with strict isolation from data layers.

---

## The Boundary

```
┌────────────────────────────────────────────────────────────┐
│  User Browser (Next.js)                                    │
└─────────────────────────┬──────────────────────────────────┘
                          │  (authenticated HTTPS)
┌─────────────────────────▼──────────────────────────────────┐
│  DMS API (NestJS)  ◀── enforces CASL, validation, audit    │
│   ├─ AiGateway (proxies to Ollama)                          │
│   └─ DB + Storage (Elasticsearch, MariaDB, File System)    │
└─────────────────────────┬──────────────────────────────────┘
                          │ (HTTP → Admin Desktop, internal)
┌─────────────────────────▼──────────────────────────────────┐
│  Admin Desktop (Desk-5439)                                 │
│   ├─ Ollama (Gemma 4)                                       │
│   ├─ PaddleOCR (Thai + English)                             │
│   └─ n8n orchestration                                      │
└────────────────────────────────────────────────────────────┘
```

**❗ Admin Desktop has NO network access to MariaDB, no SMB to storage, no shared secrets.** It receives base64-encoded file bytes over HTTPS and returns extracted text + suggestions.

---

## Required Patterns

### 1. AiGateway Module (backend)

```typescript
@Module({
  controllers: [AiController],
  providers: [AiService, AiGateway, AiAuditLogger],
  exports: [AiService],
})
export class AiModule {}

@Injectable()
export class AiService {
  async extractMetadata(fileId: number, user: User): Promise<ExtractedMetadata> {
    // 1. Authorize (CASL: user can read this file)
    await this.ability.ensureCan(user, 'read', File, fileId);

    // 2. Load file (DMS API, inside the boundary)
    const fileBytes = await this.storageService.read(fileId);

    // 3. Call Admin Desktop AI over HTTP
    const raw = await this.aiGateway.extract(fileBytes);

    // 4. Validate AI output schema (Zod)
    const parsed = ExtractedMetadataSchema.parse(raw);

    // 5. Audit log (who, what, when, model, confidence)
    await this.auditLogger.log({
      userId: user.id,
      action: 'ai.extract_metadata',
      fileId,
      model: raw.model,
      confidence: parsed.confidence,
    });

    // 6. Return — frontend MUST render for human confirmation
    return parsed;
  }
}
```

### 2. Human-in-the-Loop

AI output is **never persisted directly**. Users must confirm via `DocumentReviewForm`:

```tsx
<DocumentReviewForm
  document={doc}
  aiSuggestions={suggestions}
  onConfirm={(reviewed) => saveMetadata(reviewed)} // user edits applied
/>
```

The `user_confirmed_at` timestamp and diff (AI suggestion → final value) are stored in the audit log.

### 3. Rate Limiting

```typescript
@Post('ai/extract')
@UseGuards(JwtAuthGuard, CaslAbilityGuard, ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 req/min/user
async extract(@Body() dto: ExtractDto) { /* ... */ }
```

---

## ❌ Forbidden

```typescript
// ❌ AI container connecting to DB
// docker-compose.yml inside ai-service:
// environment:
//   DATABASE_URL: mysql://...  ← NEVER

// ❌ AI SDK calling cloud API
import OpenAI from 'openai'; // ❌ No cloud AI SDKs in production code
const client = new OpenAI({ apiKey: ... });

// ❌ Persisting AI output without human confirm
async extractAndSave(fileId: number) {
  const metadata = await this.ai.extract(fileId);
  await this.repo.save({ fileId, ...metadata }); // ❌ skips human review
}

// ❌ Skipping audit log
const result = await this.aiGateway.extract(bytes); // no logging
return result;
```

---

## Audit Log Schema

```sql
CREATE TABLE ai_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id UUID UNIQUE NOT NULL,
  user_id INT NOT NULL,
  action VARCHAR(64) NOT NULL,       -- 'ai.extract_metadata', 'ai.classify', etc.
  file_id INT,
  model VARCHAR(64),                  -- 'gemma-4:7b', 'paddleocr-v3'
  confidence DECIMAL(4,3),
  input_hash CHAR(64),                -- SHA-256 of input for replay detection
  output_summary JSON,
  human_confirmed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_file (file_id)
);
```

---

## Reference

- [ADR-018 AI Boundary](../../../../specs/06-Decision-Records/ADR-018-ai-boundary.md)
- [ADR-020 AI Intelligence Integration](../../../../specs/06-Decision-Records/ADR-020-ai-intelligence-integration.md)
- [ADR-017 Ollama Data Migration](../../../../specs/06-Decision-Records/ADR-017-ollama-data-migration.md)
