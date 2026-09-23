/**
 * GET  /api/admin/lenders — list all lenders (including INACTIVE, with FRN)
 * POST /api/admin/lenders — manually add a new lender to the directory
 *
 * PRD-16 (FCA lender maintenance). New lenders are NOT discovered automatically.
 * D&E reviews the Other-usage report, confirms a name on the FCA register,
 * and adds it here with the confirmed FRN.
 *
 * Admin only. Requires ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { z } from 'zod';

// ── Schemas ───────────────────────────────────────────────────────────────────

const AddLenderSchema = z.object({
  name: z.string().min(2, 'Lender name must be at least 2 characters').max(200),
  fcaFrn: z.string().min(1).max(20).optional(),
  status: z.enum(['ACTIVE', 'LEGACY']).default('ACTIVE'),
});

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── GET /api/admin/lenders ────────────────────────────────────────────────────

export const GET = createHandler({
  method: 'GET',
  requiredRole: 'ADMIN',
  handler: async () => {
    const lenders = await prisma.lender.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        normalizedName: true,
        fcaFrn: true,
        status: true,
        source: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: lenders,
      meta: {
        total: lenders.length,
        active: lenders.filter((l) => l.status === 'ACTIVE').length,
        legacy: lenders.filter((l) => l.status === 'LEGACY').length,
        inactive: lenders.filter((l) => l.status === 'INACTIVE').length,
        withFrn: lenders.filter((l) => l.fcaFrn).length,
      },
    });
  },
});

// ── POST /api/admin/lenders ───────────────────────────────────────────────────

export const POST = createHandler({
  method: 'POST',
  requiredRole: 'ADMIN',
  schema: AddLenderSchema,
  handler: async (_req: NextRequest, { body, user, orgId }) => {
    const normalizedName = normalise(body.name);

    // Check for duplicate
    const existing = await prisma.lender.findUnique({
      where: { normalizedName },
      select: { id: true, name: true, status: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: `A lender with this name already exists: "${existing.name}" (status: ${existing.status}). If it is INACTIVE, update it instead of adding a duplicate.`,
          },
        },
        { status: 409 },
      );
    }

    // If FRN is provided, check it isn't already on another row
    if (body.fcaFrn) {
      const existingFrn = await prisma.lender.findFirst({
        where: { fcaFrn: body.fcaFrn },
        select: { id: true, name: true },
      });
      if (existingFrn) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONFLICT',
              message: `FRN ${body.fcaFrn} is already assigned to "${existingFrn.name}".`,
            },
          },
          { status: 409 },
        );
      }
    }

    const lender = await prisma.lender.create({
      data: {
        name: body.name.trim(),
        normalizedName,
        fcaFrn: body.fcaFrn ?? null,
        status: body.status,
        source: 'SEED', // manually-added lenders use SEED source
        lastSeenAt: body.fcaFrn ? new Date() : null,
      },
    });

    void logAuditEvent({
      orgId: orgId!,
      userId: user?.id,
      entityType: 'Lender',
      entityId: lender.id,
      action: 'LENDER_ADDED',
      diff: {
        after: {
          name: lender.name,
          fcaFrn: lender.fcaFrn,
          status: lender.status,
          source: lender.source,
        },
      },
    });

    return NextResponse.json({ success: true, data: lender }, { status: 201 });
  },
});
