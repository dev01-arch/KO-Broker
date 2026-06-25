import { ApiError } from '@/lib/api/client';

/** Standard API error codes — see API docs → Error codes. */
export const API_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Used when DB or dependent services are unavailable (503). */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: 'Session expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  PLAN_LIMIT_EXCEEDED: 'This feature requires a higher plan. Upgrade your subscription to continue.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  BUSINESS_RULE_VIOLATION: 'This action is not allowed for the current case state.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again shortly.',
};

export function isApiErrorCode(err: unknown, code: ApiErrorCode): boolean {
  return err instanceof ApiError && err.code === code;
}

export function getApiErrorCode(err: unknown): string | undefined {
  return err instanceof ApiError ? err.code : undefined;
}

export function getApiErrorFields(err: unknown): Record<string, string[]> | undefined {
  return err instanceof ApiError ? err.fields : undefined;
}

export function getApiErrorFieldMap(err: unknown): Record<string, string> | undefined {
  const fields = getApiErrorFields(err);
  if (!fields) return undefined;
  return Object.fromEntries(
    Object.entries(fields).map(([key, messages]) => [key, messages[0] ?? '']),
  );
}

export function getApiErrorDetails(err: unknown): string[] | undefined {
  return err instanceof ApiError ? err.details : undefined;
}

/** Maps API validation field errors onto a form state object. */
export function mapApiFieldsToForm<T extends Record<string, string>>(
  err: unknown,
  fieldKeys: (keyof T)[],
): Partial<T> | undefined {
  const fields = getApiErrorFields(err);
  if (!fields) return undefined;
  const mapped = {} as Partial<T>;
  for (const key of fieldKeys) {
    const messages = fields[String(key)];
    if (messages?.[0]) mapped[key] = messages[0] as T[keyof T];
  }
  return Object.keys(mapped).length ? mapped : undefined;
}

/** Throws ApiError with code UNAUTHORIZED when no Clerk session token is available. */
export async function requireAuthToken(
  getToken: () => Promise<string | null>,
): Promise<string> {
  const token = await getToken();
  if (!token) {
    throw new ApiError(API_ERROR_CODES.UNAUTHORIZED, DEFAULT_MESSAGES.UNAUTHORIZED, undefined, 401);
  }
  return token;
}

/**
 * Maps API errors (and unknown errors) to user-facing messages.
 * Prefers the server message when present; falls back to code defaults.
 */
export function formatApiError(
  err: unknown,
  options?: { fallback?: string },
): string {
  if (err instanceof ApiError) {
    const known = DEFAULT_MESSAGES[err.code as ApiErrorCode];
    if (known && err.code !== API_ERROR_CODES.VALIDATION_ERROR && err.code !== API_ERROR_CODES.BUSINESS_RULE_VIOLATION) {
      return err.message || known;
    }
    if (known) return err.message || known;
    return err.message || options?.fallback || DEFAULT_MESSAGES.INTERNAL_ERROR;
  }
  if (err instanceof Error && err.message) return err.message;
  return options?.fallback ?? DEFAULT_MESSAGES.INTERNAL_ERROR;
}
