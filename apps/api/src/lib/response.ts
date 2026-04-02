import type { ApiResponse, ApiError } from '@onebrain/shared';

export function success<T>(data: T, requestId?: string): ApiResponse<T> {
  return {
    data,
    meta: { requestId: requestId ?? crypto.randomUUID() },
  };
}

export function error(
  code: string,
  message: string,
  statusCode: number,
  requestId?: string,
  details?: unknown[],
): { statusCode: number; body: ApiResponse<never> } {
  const apiError: ApiError = { code, message };
  if (details) {
    apiError.details = details;
  }
  return {
    statusCode,
    body: {
      error: apiError,
      meta: { requestId: requestId ?? crypto.randomUUID() },
    },
  };
}
