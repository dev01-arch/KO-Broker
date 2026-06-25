import { NextResponse } from 'next/server';
import type { ApiErrorResponse, ApiSuccessResponse } from '@ko/types';
import { ZodError } from 'zod';

export function apiSuccess<T>(
  data: T,
  init?: ResponseInit & { meta?: ApiSuccessResponse<T>['meta'] },
) {
  const { meta, ...responseInit } = init ?? {};
  const body: ApiSuccessResponse<T> = { success: true, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, responseInit);
}

export function apiError(
  code: string,
  message: string,
  status: number,
  options?: { fields?: Record<string, string[]>; details?: string[] },
) {
  const body: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(options?.fields ? { fields: options.fields } : {}),
      ...(options?.details ? { details: options.details } : {}),
    },
  };
  return NextResponse.json(body, { status });
}

export function apiFromZodError(error: ZodError) {
  const fields = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(([, v]) => v?.length),
  ) as Record<string, string[]>;
  return apiError('VALIDATION_ERROR', 'Request validation failed', 422, { fields });
}

export function apiForbidden(message = 'You do not have permission to perform this action') {
  return apiError('FORBIDDEN', message, 403);
}

export function apiPlanLimitExceeded(message = 'This feature requires a higher plan') {
  return apiError('PLAN_LIMIT_EXCEEDED', message, 403);
}

export function apiBusinessRuleViolation(message: string, details?: string[]) {
  return apiError('BUSINESS_RULE_VIOLATION', message, 422, { details });
}

export function apiInternalError(message = 'An unexpected error occurred') {
  return apiError('INTERNAL_ERROR', message, 500);
}

export function apiUnauthorized() {
  return apiError('UNAUTHORIZED', 'Authentication required', 401);
}

export function apiNotFound(message = 'Resource not found') {
  return apiError('NOT_FOUND', message, 404);
}
