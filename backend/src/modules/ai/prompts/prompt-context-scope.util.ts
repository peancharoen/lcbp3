// File: backend/src/modules/ai/prompts/prompt-context-scope.util.ts
// Change Log
// - 2026-06-15: Added context filter parsing helper for public UUID isolation

/**
 * Public UUID filters configured per prompt version.
 */
export interface PromptContextScope {
  projectPublicId?: string;
  contractPublicId?: string;
}

/**
 * อ่านค่า filter จาก context_config โดยรองรับชื่อเดิมและชื่อ publicId ที่ชัดเจน
 */
export function readPromptContextScope(
  contextConfig: Record<string, unknown> | null
): PromptContextScope {
  const filter = readFilter(contextConfig);
  return {
    projectPublicId: readOptionalString(
      filter.projectPublicId ?? filter.projectId
    ),
    contractPublicId: readOptionalString(
      filter.contractPublicId ?? filter.contractId
    ),
  };
}

function readFilter(
  contextConfig: Record<string, unknown> | null
): Record<string, unknown> {
  const value = contextConfig?.filter;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}
