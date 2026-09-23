/**
 * GET /api/admin/lenders/other-usage — PRD-16 (FCA lender maintenance)
 *
 * Returns a ranked list of free-text lender names that advisers have entered
 * via the "Other" sentinel when creating products. These are names that are
 * NOT yet in the lender directory.
 *
 * This is the discovery signal. When the same name appears multiple times,
 * D&E looks it up on the FCA register, confirms the FRN, and adds it via
 * POST /api/admin/lenders.
 *
 * Response is ranked by usage count descending. Only OUTSTANDING names are
 * shown — once a lender is added to the directory (normalizedName match),
 * it will no longer appear as an "Other" selection for new products.
 *
 * Admin only. Requires ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';

export const GET = createHandler({
  method: 'GET',
  requiredRole: 'ADMIN',
  handler: async (_req: NextRequest, { orgId }) => {
    // Find the Other sentinel lender
    const otherSentinel = await prisma.lender.findFirst({
      where: { source: 'OTHER' },
      select: { id: true },
    });

    if (!otherSentinel) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Find all products where Other was selected and a name was typed
    const otherProducts = await prisma.productConsidered.findMany({
      where: {
        lenderId: otherSentinel.id,
        lenderOtherName: { not: null },
        // Scope to this org via the case
        case: { orgId },
      },
      select: {
        lenderOtherName: true,
        createdAt: true,
        case: {
          select: {
            id: true,
            referenceNumber: true,
            orgId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by normalised name and count occurrences
    const grouped = new Map<
      string,
      { displayName: string; count: number; firstSeen: Date; lastSeen: Date; caseRefs: string[] }
    >();

    for (const p of otherProducts) {
      const raw = p.lenderOtherName!.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const existing = grouped.get(key);
      if (existing) {
        existing.count++;
        if (p.createdAt < existing.firstSeen) existing.firstSeen = p.createdAt;
        if (p.createdAt > existing.lastSeen) existing.lastSeen = p.createdAt;
        if (!existing.caseRefs.includes(p.case.referenceNumber)) {
          existing.caseRefs.push(p.case.referenceNumber);
        }
      } else {
        grouped.set(key, {
          displayName: raw,
          count: 1,
          firstSeen: p.createdAt,
          lastSeen: p.createdAt,
          caseRefs: [p.case.referenceNumber],
        });
      }
    }

    // Cross-check: filter out names already in the lender directory
    // (normalizedName match) — they were added since the product was created
    const allNormalised = Array.from(grouped.keys()).map((k) =>
      k.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(),
    );

    const alreadyAdded = await prisma.lender.findMany({
      where: { normalizedName: { in: allNormalised } },
      select: { normalizedName: true },
    });
    const addedSet = new Set(alreadyAdded.map((l) => l.normalizedName));

    // Build ranked response
    const results = Array.from(grouped.entries())
      .map(([key, v]) => {
        const normalised = key.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
        return {
          name: v.displayName,
          normalizedName: normalised,
          count: v.count,
          alreadyInDirectory: addedSet.has(normalised),
          firstSeen: v.firstSeen.toISOString(),
          lastSeen: v.lastSeen.toISOString(),
          caseRefs: v.caseRefs.slice(0, 10), // cap at 10 for readability
        };
      })
      // Sort: not-yet-added first, then by count descending
      .sort((a, b) => {
        if (a.alreadyInDirectory !== b.alreadyInDirectory) {
          return a.alreadyInDirectory ? 1 : -1;
        }
        return b.count - a.count;
      });

    return NextResponse.json({
      success: true,
      data: results,
      meta: {
        total: results.length,
        pendingReview: results.filter((r) => !r.alreadyInDirectory).length,
      },
    });
  },
});
