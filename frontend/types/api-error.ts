// File: frontend/types/api-error.ts
// Change Log:
// - 2026-08-20: Initial creation — shared API error type
// - 2026-08-20: ADR-007 — เพิ่ม structured error shape จาก parseApiError interceptor
//   (error.error.message และ response.data.error.message) เพื่อให้ getApiErrorMessage
//   อ่าน message จาก ADR-007 structured payload ได้ถูกต้อง

/** ADR-007 structured error shape ที่ backend ส่งกลับ */
export interface StructuredError {
  type?: string;
  code?: string;
  message?: string;
  severity?: string;
  timestamp?: string;
  statusCode?: number;
  recoveryActions?: string[];
}

/** Legacy API error response (pre-ADR-007) */
export interface ApiErrorResponse {
  message?: string;
  error?: string | StructuredError;
  statusCode?: number;
}

/** Axios-compatible error with typed response data */
export interface ApiError extends Error {
  response?: {
    data?: ApiErrorResponse;
    status?: number;
  };
  /** ADR-007 structured shape ที่ interceptor reject ออกมา */
  error?: StructuredError;
}

/** ดึง message จาก ADR-007 structured error object */
function extractStructuredMessage(structured: unknown): string | undefined {
  if (
    structured &&
    typeof structured === 'object' &&
    'message' in structured &&
    typeof (structured as StructuredError).message === 'string'
  ) {
    return (structured as StructuredError).message;
  }
  return undefined;
}

/**
 * Extract human-readable message from API error
 * รองรับทั้ง ADR-007 structured shape และ legacy Axios shape
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred'
): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const apiError = error as ApiError;

  // 1. ADR-007 structured shape ที่ interceptor reject ออกมา: { error: { message } }
  const structuredMsg = extractStructuredMessage(apiError.error);
  if (structuredMsg) return structuredMsg;

  // 2. Axios raw error ที่มี structured payload ใน response.data.error.message
  const dataError = apiError.response?.data?.error;
  if (dataError) {
    const msg = extractStructuredMessage(dataError);
    if (msg) return msg;
    // กรณี data.error เป็น string (legacy)
    if (typeof dataError === 'string') return dataError;
  }

  // 3. Legacy Axios shape: { response: { data: { message } } }
  if (apiError.response?.data?.message) {
    return apiError.response.data.message;
  }

  // 4. Error.message ธรรมดา
  if (apiError.message) {
    return apiError.message;
  }

  return fallback;
}
