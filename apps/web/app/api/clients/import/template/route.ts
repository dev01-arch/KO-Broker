/**
 * GET /api/clients/import/template — ADMIN-only KO client CSV template (PRD-17).
 */

import { NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { buildClientImportTemplateCsv } from '@/lib/api/clients-import';

export const GET = createHandler({
  method: 'GET',
  requiredRole: 'ADMIN',
  handler: async () => {
    const csv = buildClientImportTemplateCsv();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="kompass-clients-template.csv"',
        'Cache-Control': 'no-store',
      },
    });
  },
});
