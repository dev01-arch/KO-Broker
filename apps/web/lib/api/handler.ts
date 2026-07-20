/**
 * API Handler Factory — PRD-05
 *
 * createHandler()      — for collection routes (/api/clients, /api/cases, etc.)
 * createParamHandler() — for dynamic segment routes (/api/clients/[id], etc.)
 *
 * Both enforce auth, Zod validation, and consistent error/response envelopes.
 * Zero raw try/catch blocks are permitted in route files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { requireAuth, requireRole, getOrgId, AuthError } from '../auth';
import { type User, type Role } from '../db';
import { orgHasFeature } from '@/lib/api/plan-access';
import { isPrismaConnectionError, isPrismaMissingColumnError } from '@/lib/api/prisma-errors';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface HandlerContext<TBody> {
  body: TBody;
  user?: User;
  orgId?: string;
}

export interface ParamHandlerContext<TBody, TParams extends Record<string, string>> {
  body: TBody;
  user?: User;
  orgId?: string;
  params: TParams;
}

interface BaseConfig<TBody> {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  requireAuth?: boolean;
  requiredRole?: Role;
  requiredFeature?: string;
  schema?: ZodSchema<TBody>;
}

interface HandlerConfig<TBody = unknown> extends BaseConfig<TBody> {
  handler: (req: NextRequest, context: HandlerContext<TBody>) => Promise<NextResponse>;
}

interface ParamHandlerConfig<TBody = unknown, TParams extends Record<string, string> = Record<string, string>>
  extends BaseConfig<TBody> {
  handler: (
    req: NextRequest,
    context: ParamHandlerContext<TBody, TParams>
  ) => Promise<NextResponse>;
}

// ── Shared auth + validation logic ────────────────────────────────────────────

async function resolveAuth(config: BaseConfig<unknown>): Promise<{ user?: User; orgId?: string }> {
  if (config.requireAuth === false) return {};

  let user: User | undefined;
  if (config.requiredRole) {
    user = await requireRole(config.requiredRole);
  } else {
    user = await requireAuth();
  }
  const orgId = await getOrgId();

  // === FRONTEND ADDITION: soft plan gate via KO_ENFORCE_PLAN_LIMITS ===
  if (config.requiredFeature && orgId) {
    const hasAccess = await orgHasFeature(orgId, config.requiredFeature);
    if (!hasAccess) {
      throw new AuthError(
        'FORBIDDEN',
        `Feature '${config.requiredFeature}' is not available on your plan.`
      );
    }
  }
  // === END FRONTEND ADDITION ===

  return { user, orgId };
}

async function parseBody<TBody>(config: BaseConfig<TBody>, req: NextRequest): Promise<TBody> {
  if (config.schema && ['POST', 'PATCH', 'PUT'].includes(config.method)) {
    const raw = await req.json();
    return config.schema.parse(raw);
  }
  return {} as TBody;
}

function handleError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 422 }
    );
  }
  // === FRONTEND ADDITION: clearer DB outage / schema-drift responses ===
  if (isPrismaConnectionError(error)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database is unavailable. Check DATABASE_URL / Supabase connectivity.',
        },
      },
      { status: 503 }
    );
  }
  if (isPrismaMissingColumnError(error)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message:
            'Database schema is behind the app. Run: pnpm --filter @ko/db exec prisma db push',
        },
      },
      { status: 503 }
    );
  }
  // === END FRONTEND ADDITION ===
  console.error('[API Error]', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    { status: 500 }
  );
}

// ── createHandler — collection routes (/api/resource) ────────────────────────

export function createHandler<TBody = unknown>(config: HandlerConfig<TBody>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const { user, orgId } = await resolveAuth(config as BaseConfig<unknown>);
      const body = await parseBody(config, req);
      return await config.handler(req, { body, user, orgId });
    } catch (error) {
      return handleError(error);
    }
  };
}

// ── createParamHandler — dynamic segment routes (/api/resource/[id]) ─────────

export function createParamHandler<
  TBody = unknown,
  TParams extends Record<string, string> = Record<string, string>,
>(config: ParamHandlerConfig<TBody, TParams>) {
  return async (
    req: NextRequest,
    { params }: { params: Promise<TParams> }
  ): Promise<NextResponse> => {
    try {
      const { user, orgId } = await resolveAuth(config as BaseConfig<unknown>);
      const body = await parseBody(config, req);
      const resolvedParams = await params;
      return await config.handler(req, { body, user, orgId, params: resolvedParams });
    } catch (error) {
      return handleError(error);
    }
  };
}
