import { NextResponse } from 'next/server';

/**
 * Standard API error response interface
 */
export interface APIErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Standard API success response interface
 */
export interface APISuccessResponse<T = unknown> {
  success: true;
  data?: T;
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  status: number,
  options?: { code?: string; details?: unknown }
): NextResponse<APIErrorResponse> {
  const body: APIErrorResponse = { error: message };

  if (options?.code) {
    body.code = options.code;
  }

  if (options?.details !== undefined) {
    body.details = options.details;
  }

  return NextResponse.json(body, { status });
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data?: T,
  status: number = 200
): NextResponse<APISuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

// Pre-defined error responses for common cases
export const ApiErrors = {
  unauthorized: () => errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }),

  forbidden: (message?: string) =>
    errorResponse(message || 'Forbidden', 403, { code: 'FORBIDDEN' }),

  notFound: (resource: string) =>
    errorResponse(`${resource} not found`, 404, { code: 'NOT_FOUND' }),

  badRequest: (message: string, details?: unknown) =>
    errorResponse(message, 400, { code: 'BAD_REQUEST', details }),

  invalidUUID: (field: string) =>
    errorResponse(`Invalid ${field} format`, 400, { code: 'INVALID_UUID' }),

  invalidJSON: () =>
    errorResponse('Invalid JSON in request body', 400, { code: 'INVALID_JSON' }),

  validationError: (errors: unknown) =>
    errorResponse('Validation failed', 400, { code: 'VALIDATION_ERROR', details: errors }),

  internalError: (message?: string) =>
    errorResponse(message || 'Internal server error', 500, { code: 'INTERNAL_ERROR' }),

  databaseError: (message?: string) =>
    errorResponse(message || 'Database operation failed', 500, { code: 'DATABASE_ERROR' }),

  rateLimited: () =>
    errorResponse('Too many requests', 429, { code: 'RATE_LIMITED' }),
} as const;
