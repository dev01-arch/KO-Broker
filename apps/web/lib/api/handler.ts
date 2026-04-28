/**
 * API Handler Factory — PRD-05
 *
 * All route handlers must use createHandler(config) which provides:
 * - Consistent error handling
 * - Auth enforcement
 * - Zod body validation
 * - Typed response envelopes
 *
 * See PRD-05 for the full response envelope spec.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';

interface HandlerConfig<TBody = unknown> {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  requireAuth?: boolean;
  requiredRole?: string;
  schema?: ZodSchema<TBody>;
  handler: (
    req: NextRequest,
    context: {
      body: TBody;
      // user: User; // TODO (PRD-04)
      // orgId: string; // TODO (PRD-04)
    }
  ) => Promise<NextResponse>;
}

/**
 * Creates a standardised route handler.
 * TODO (PRD-04/05): Wire up auth, role checks, and org scoping.
 */
export function createHandler<TBody = unknown>(config: HandlerConfig<TBody>) {
  return async (req: NextRequest) => {
    try {
      // TODO (PRD-04): Auth checks
      // if (config.requireAuth !== false) { ... }
      // if (config.requiredRole) { ... }

      let body = {} as TBody;
      if (config.schema && ['POST', 'PATCH', 'PUT'].includes(config.method)) {
        const raw = await req.json();
        body = config.schema.parse(raw);
      }

      return await config.handler(req, { body });
    } catch (error) {
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

      console.error('[API Error]', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        { status: 500 }
      );
    }
  };
}
