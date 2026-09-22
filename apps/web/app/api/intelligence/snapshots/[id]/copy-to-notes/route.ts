/**
 * POST /api/intelligence/snapshots/:id/copy-to-notes — PRD-15 B9 + PRD-16 W2
 *
 * Inserts the J4-format block as a CaseNote (source: INTEL, tag: intel).
 *
 * PRD-16 W2 change: no longer writes to Case.adviserNotes. The note is
 * appended to the insert-only CaseNote thread so it is never lost by a
 * later overwrite of the old single-string field.
 *
 * Rules:
 *   - 409 if the snapshot has no caseId (MANUAL snapshots).
 *   - 404 if snapshot or linked case not found in this org.
 *   - Org-scoped on both snapshot and target case.
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
  if (snapshot.watchText) lines.push(snapshot.watchText);
  lines.push(`Sources: BoE quoted rates (${ratesAsAt})${localPricesPart}.`);
  lines.push('Market context only. Not a recommendation.');

  return lines.join('\n');
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const POST = createParamHandler<unknown, { id: string }>({
  method: 'POST',
  requiredFeature: 'mortgage_intelligence',
  handler: async (_req: NextRequest, { orgId, user, params }): Promise<NextResponse> => {
    // 1. Fetch snapshot (org-scoped)
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

    // 2. 409 if MANUAL snapshot (no caseId)
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

    // 3. Fetch target case (org-scoped)
    const caseRow = await prisma.case.findFirst({
      where: { id: snapshot.caseId, orgId },
      select: { id: true },
    });

    if (!caseRow) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Linked case not found' } },
        { status: 404 },
      );
    }

    // 4. Insert the J4 block as a CaseNote (PRD-16 W2 — INSERT-ONLY thread)
    const j4Block = buildJ4Block(snapshot);
    await prisma.caseNote.create({
      data: {
        orgId: orgId!,
        caseId: caseRow.id,
        body: j4Block,
        tag: 'intel',
        source: 'INTEL',
        authorUserId: user?.id ?? null,
      },
    });

    // 5. Audit log
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
