/**
 * POST /api/intelligence/snapshots/:id/copy-to-notes — PRD-15 B9
 *
 * Appends the J4-format block to Case.adviserNotes:
 *
 *   [Mortgage Intelligence · {date}]
 *   {insightText}
 *   {watchText?}
 *   Sources: BoE quoted rates ({asAt}); HMLR sold prices ({district}).
 *   Market context only. Not a recommendation.
 *
 * Rules:
 *   - 409 if the snapshot has no caseId (MANUAL snapshots, copy-to-notes disabled).
 *   - 404 if the snapshot is not in this org, or the linked case is not in this org.
 *   - Org-scoped on both snapshot and the target case.
 *   - Audit log: entityType Case / action INTELLIGENCE_COPIED_TO_NOTES.
 *
 * Auth: Clerk session + mortgage_intelligence feature gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createParamHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';

// ── J4 block builder ──────────────────────────────────────────────────────────

function buildJ4Block(snapshot: {
  generatedAt: Date;
  insightText: string;
  watchText: string | null;
  sourcesJson: unknown;
  outwardCode: string;
}): string {
  const dateLabel = snapshot.generatedAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const sources = snapshot.sourcesJson as {
    rates?: { asAt?: string };
    localPrices?: { outwardCode?: string; asOf?: string };
  };

  const ratesAsAt = sources?.rates?.asAt
    ? new Date(sources.rates.asAt).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      })
    : 'date unknown';

  const localPricesPart = sources?.localPrices
    ? `; HMLR sold prices (${sources.localPrices.outwardCode ?? snapshot.outwardCode})`
    : '';

  const lines: string[] = [
    `[Mortgage Intelligence · ${dateLabel}]`,
    snapshot.insightText,
  ];

  if (snapshot.watchText) {
    lines.push(snapshot.watchText);
  }

  lines.push(`Sources: BoE quoted rates (${ratesAsAt})${localPricesPart}.`);
  lines.push('Market context only. Not a recommendation.');

  return lines.join('\n');
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const POST = createParamHandler<unknown, { id: string }>({
  method: 'POST',
  requiredFeature: 'mortgage_intelligence',
  handler: async (_req: NextRequest, { orgId, user, params }): Promise<NextResponse> => {
    // ── 1. Fetch snapshot (org-scoped) ────────────────────────────────────────
    const snapshot = await prisma.caseIntelligenceSnapshot.findFirst({
      where: { id: params.id, orgId },
      select: {
        id: true,
        caseId: true,
        generatedAt: true,
        insightText: true,
        watchText: true,
        sourcesJson: true,
        outwardCode: true,
      },
    });

    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Snapshot not found' } },
        { status: 404 },
      );
    }

    // ── 2. 409 if no caseId (MANUAL snapshot) ────────────────────────────────
    if (!snapshot.caseId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'This snapshot is not linked to a case. Copy to notes is only available for case-linked snapshots.',
          },
        },
        { status: 409 },
      );
    }

    // ── 3. Fetch target case (org-scoped) ─────────────────────────────────────
    const caseRow = await prisma.case.findFirst({
      where: { id: snapshot.caseId, orgId },
      select: { id: true, adviserNotes: true },
    });

    if (!caseRow) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Linked case not found' } },
        { status: 404 },
      );
    }

    // ── 4. Build and append the J4 block ─────────────────────────────────────
    const j4Block = buildJ4Block(snapshot);
    const existingNotes = caseRow.adviserNotes ?? '';
    const separator = existingNotes.length > 0 ? '\n\n' : '';
    const updatedNotes = `${existingNotes}${separator}${j4Block}`;

    await prisma.case.update({
      where: { id: caseRow.id },
      data: { adviserNotes: updatedNotes },
    });

    // ── 5. Audit log (fire-and-forget) ────────────────────────────────────────
    void logAuditEvent({
      orgId: orgId!,
      userId: user?.id,
      entityType: 'Case',
      entityId: caseRow.id,
      action: 'INTELLIGENCE_COPIED_TO_NOTES',
      diff: { after: { snapshotId: snapshot.id } },
    });

    return NextResponse.json({
      success: true,
      data: { caseId: caseRow.id, snapshotId: snapshot.id },
    });
  },
});
