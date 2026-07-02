import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifyPortalSession, type PortalSessionPayload } from '@/lib/api/portal-session';
import { apiUnauthorized } from '@/lib/api/responses';

export type PortalAuthResult =
  | { session: PortalSessionPayload }
  | { response: NextResponse };

export async function requirePortalAuth(): Promise<PortalAuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return { response: apiUnauthorized() };
  }

  const session = verifyPortalSession(token);
  if (!session) {
    return { response: apiUnauthorized() };
  }

  return { session };
}
