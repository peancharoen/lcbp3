# Data Model: AI Tool Layer Architecture

## Database Changes
No new tables required. The feature leverages the existing `ai_audit_logs` table.

### `ai_audit_logs` Schema Re-use
```sql
-- Represents how tool execution results are persisted:
INSERT INTO ai_audit_logs (
    public_id,
    action, -- 'tool_call'
    intent, -- e.g., 'GET_RFA'
    params, -- JSON representation of input
    result, -- 'ok', 'forbidden', 'not_found', 'service_error'
    latency_ms,
    project_public_id,
    user_public_id,
    created_at
) VALUES (...);
```

## Internal Data Types

### `ToolCallResult<T>`
```typescript
export type ToolCallReason = 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_PARAMS' | 'SERVICE_ERROR';

export type ToolCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ToolCallReason; message: string };
```

### Tool Result DTOs
All return structures adhere to ADR-019 (no integer IDs).

**Example: `RfaToolResult`**
```typescript
export interface RfaToolResult {
  publicId: string;
  rfaNumber: string;
  revisionCode: string;
  statusCode: string;
  drawingCount: number;
  submittedAt: string | null;
  respondedAt: string | null;
  contractPublicId: string;
}
```
