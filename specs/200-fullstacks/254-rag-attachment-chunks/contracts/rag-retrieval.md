# Contract: RAG Retrieval and Citation

## Search

```http
POST /api/ai/rag/query
Idempotency-Key: <uuid>
Authorization: Bearer <jwt>
Content-Type: application/json
```

Request:

```json
{
  "projectPublicId": "019...",
  "query": "What is the latest approved revision?",
  "topK": 10
}
```

Rules:

- `projectPublicId` is mandatory and must be authorized for the caller.
- Qdrant search is filtered by the owning `project_public_id`.
- Distribution access to another Project does not grant RAG retrieval.
- Every Qdrant result is checked against an ACTIVE MariaDB generation before LLM context assembly.
- Missing, RETIRED, or FAILED chunks are skipped.
- If no valid chunks remain, the service uses approved keyword/full-text fallback.

Response:

```json
{
  "answer": "...",
  "sources": [
    {
      "attachmentPublicId": "019...",
      "ownerType": "CORRESPONDENCE",
      "ownerPublicId": "019...",
      "sourceLocator": "drawing.pdf",
      "segmentType": "PAGE",
      "segmentNumber": 3,
      "segmentLabel": "Page 3",
      "startOffset": 120,
      "endOffset": 640,
      "snippet": "...",
      "score": 0.91,
      "chunkPublicId": "019..."
    }
  ],
  "retrievalMode": "VECTOR" | "FULL_TEXT" | "HYBRID"
}
```

`generationUuid` must not be exposed in this response.
