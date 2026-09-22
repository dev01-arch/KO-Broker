/**
 * GET  /api/cases/:id/notes — list all notes for a case (oldest first)
 * POST /api/cases/:id/notes — append a new note (INSERT-ONLY, no update/delete)
 *
 * PRD-16 W2. CaseNote is an append-only thread replacing Case.adviserNotes.
 * tag values: intel | disclosure | amend | system (optional, free string)
 */

import { NextRequest } from 'next/server';
import { CreateCaseNoteSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { createNoteForCase, listNotesForCase, serializeCaseNote } from '@/lib/api/notes-data';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;
    const { id } = await context.params;

    const result = await listNotesForCase(orgId, id);
    if ('error' in result) return apiNotFound('Case not found');

    return apiSuccess(result.notes.map(serializeCaseNote));
  } catch (error) {
    console.error('[GET /api/cases/:id/notes]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId, user } = authResult;
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = CreateCaseNoteSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const result = await createNoteForCase(orgId, id, parsed.data, user.id, 'ADVISER');
    if ('error' in result) return apiNotFound('Case not found');

    return apiSuccess(serializeCaseNote(result.note), { status: 201 });
  } catch (error) {
    console.error('[POST /api/cases/:id/notes]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
