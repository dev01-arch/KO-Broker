/**
 * GET /api/intelligence/cases/:caseId/preview — PRD-15 B6
 *
 * Assembles Case + Client + FactFind into the confirm-box payload.
 * Every field returned as { value, present } — missing = present: false,
 * never £0 or a fabricated number.
 *
 * Scope rules:
 *   - Route is org-scoped (orgId from session).
 *   - If the adviser is restricted (isRestrictedAdviser), the case must be
 *     assigned to this adviser (directly or via client member assignment).
 *   - Wrong org or invisible case → 404 (do not leak case existence).
 *
 * Auth: Clerk session + mortgage_intelligence feature gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createParamHandler } from '@/lib/api/handler';
import { getCurrentUser } from '@/lib/auth';
import { isRestrictedAdviser, caseAssignedToAdviserWhere } from '@/lib/auth/adviser-scope';
import { assembleCasePreview } from '@/lib/intelligence/case-preview';
import { prisma } from '@/lib/db';

export const GET = createParamHandler<unknown, { caseId: string }>({
  method: 'GET',
  requiredFeature: 'mortgage_intelligence',
  handler: async (_req: NextRequest, { orgId, user, params }): Promise<NextResponse> => {
    const { caseId } = params;

    // ── Adviser-scope check ────────────────────────────────────────────────────
    // Restricted advisers may only preview cases assigned to them.
    // We do this as a pre-check so we can return 404 (not 403) to avoid
    // leaking whether the case exists.
    const currentUser = user ?? (await getCurrentUser());
    if (isRestrictedAdviser(currentUser)) {
      const scopeWhere = caseAssignedToAdviserWhere(currentUser!.id);
      const visible = await prisma.case.findFirst({
        where: { id: caseId, orgId, ...scopeWhere },
        select: { id: true },
      });
      if (!visible) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
          { status: 404 },
        );
      }
    }

    // ── Assemble preview ──────────────────────────────────────────────────────
    const result = await assembleCasePreview(caseId, orgId!);

    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: result.preview });
  },
});
