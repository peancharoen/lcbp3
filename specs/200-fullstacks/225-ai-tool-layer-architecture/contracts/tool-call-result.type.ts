export type ToolCallReason = 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_PARAMS' | 'SERVICE_ERROR';

export type ToolCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ToolCallReason; message: string };
