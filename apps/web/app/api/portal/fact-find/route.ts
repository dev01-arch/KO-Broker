import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { requirePortalAuth } from '@/lib/auth/portalAuth';
import { FactFindUpdateSchema } from '@ko/types';
import { logAuditEvent, computeDiff } from '@/lib/compliance/audit';

export const GET = createHandler({
  method: 'GET',
  requireAuth: false,
  handler: async () => {
    const client = await requirePortalAuth();
    const activeCase = client.cases[0];

    if (!activeCase) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No active case found' } },
        { status: 404 }
      );
    }

    const factFind = await prisma.factFind.findUnique({
      where: { caseId: activeCase.id },
    });

    if (!factFind) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Fact-Find not initialized' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: factFind }, { status: 200 });
  },
});

export const PUT = createHandler({
  method: 'PUT',
  requireAuth: false,
  schema: FactFindUpdateSchema,
  handler: async (req: NextRequest, { body }) => {
    const client = await requirePortalAuth();
    const activeCase = client.cases[0];

    if (!activeCase) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No active case found' } },
        { status: 404 }
      );
    }

    // Retrieve current fact-find
    const factFind = await prisma.factFind.findUnique({
      where: { caseId: activeCase.id },
    });

    if (!factFind) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Fact-Find not initialized' } },
        { status: 404 }
      );
    }

    // Check if already complete/locked
    if (factFind.completedAt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'This fact-find is already complete and cannot be edited.',
          },
        },
        { status: 403 }
      );
    }

    // Save updates
    const updatedFactFind = await prisma.factFind.update({
      where: { caseId: activeCase.id },
      data: {
        // === FRONTEND ADDITION: cast JSON sections for Prisma InputJsonValue ===
        personalDetails: (body.personalDetails ?? undefined) as object | undefined,
        employmentDetails: (body.employmentDetails ?? undefined) as object | undefined,
        incomeDetails: (body.incomeDetails ?? undefined) as object | undefined,
        expenditureDetails: (body.expenditureDetails ?? undefined) as object | undefined,
        propertyDetails: (body.propertyDetails ?? undefined) as object | undefined,
        existingMortgages: (body.existingMortgages ?? undefined) as object | undefined,
        clientPreferences: (body.clientPreferences ?? undefined) as object | undefined,
        // === END FRONTEND ADDITION ===
      },
    });

    // Compute diff for audit logs
    const factFindDiff = computeDiff(
      (factFind ?? {}) as unknown as Record<string, unknown>,
      updatedFactFind as unknown as Record<string, unknown>
    );

    await logAuditEvent({
      orgId: client.orgId,
      entityType: 'Case',
      entityId: activeCase.id,
      action: 'FACT_FIND_UPDATED',
      diff: factFindDiff,
    });

    return NextResponse.json({ success: true, data: updatedFactFind }, { status: 200 });
  },
});
