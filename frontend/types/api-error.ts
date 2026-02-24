// Shared API error type for Axios-based error handling in TanStack Query
export interface ApiErrorResponse {
  message?: string;
  error?: string;
  statusCode?: number;
}

/** Axios-compatible error with typed response data */
export interface ApiError extends Error {
  response?: {
    data?: ApiErrorResponse;
    status?: number;
  };
}

/** Extract human-readable message from API error */
export function getApiErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  const apiError = error as ApiError;
  return apiError?.response?.data?.message ?? apiError?.message ?? fallback;
}
