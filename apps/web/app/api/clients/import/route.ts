/**
 * POST /api/clients/import — ADMIN-only batch client create (PRD-17).
 * Body is mapped JSON rows. Spreadsheets are parsed in the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { ImportClientsSchema } from '@ko/types';
import { importClientsForOrg } from '@/lib/api/clients-import';

export const POST = createHandler({
  method: 'POST',
  requiredRole: 'ADMIN',
  schema: ImportClientsSchema,
  handler: async (_req: NextRequest, { body, user, orgId }) => {
    const result = await importClientsForOrg(orgId!, user?.id, body);

    if ('error' in result) {
      if (result.error === 'TOO_LARGE') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'IMPORT_TOO_LARGE',
              message: 'Split the file (max 1,000 rows per import).',
            },
          },
          { status: 422 },
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one row is required',
          },
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  },
});
