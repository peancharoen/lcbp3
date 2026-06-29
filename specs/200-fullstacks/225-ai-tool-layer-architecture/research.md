# Research Notes: AI Tool Layer Architecture

- **ADR-025 Analysis**: Focus on Server-Side Dispatch. Instead of giving LLM direct tool calling capabilities, we map a `ServerIntent` to a function call securely on our server. This ensures CASL enforcement prior to executing logic, rather than relying on the LLM runtime to provide constraints.
- **Data Shape**: Tools will return `ToolCallResult<T>` which is defined as:
  ```typescript
  type ToolCallReason = 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_PARAMS' | 'SERVICE_ERROR';
  type ToolCallResult<T> = 
    | { ok: true; data: T }
    | { ok: false; reason: ToolCallReason; message: string };
  ```
- **Error Types**: Follows ADR-007 layered classification.
- **Identifiers**: Adheres to ADR-019 (Hybrid Identifier). No internal integer `id` exposed. All references utilize `publicId`.
- **Security Check**: Enforce `CaslAbilityGuard` behavior directly inside the Tool Service methods, utilizing `CaslAbilityFactory` instantiated with the `RequestUser`.
