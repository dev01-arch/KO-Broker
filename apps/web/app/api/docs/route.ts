/**
 * GET /api/docs
 *
 * Returns the full API specification as JSON — endpoint definitions,
 * tag groups, and metadata. No auth required (public reference).
 *
 * Response shape:
 *   {
 *     version: string,
 *     generatedAt: string,   // ISO timestamp
 *     tagGroups: TagGroup[],
 *     endpoints: EndpointDef[],
 *   }
 *
 * Designed to be consumed by external tooling, a custom doc UI, or
 * imported into Postman/Insomnia via a fetch-from-url collection.
 */

import { NextResponse } from 'next/server';
import { ENDPOINTS, TAG_GROUPS } from '@/lib/api/spec';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    tagGroups: TAG_GROUPS,
    endpoints: ENDPOINTS,
  });
}
