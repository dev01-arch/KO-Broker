/**
 * Authentication helper functions — PRD-04
 *
 * getCurrentUser() — reads headers, queries DB
 * requireAuth() — throws AuthError (401) if not authenticated
 * requireRole(role) — throws AuthError (403) if wrong role
 * getOrgId() — throws if no org in session
 */

// TODO (PRD-04): Implement auth helpers using Clerk + Prisma

export async function getCurrentUser() {
  // Placeholder — will read x-user-id header and query DB
  return null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireRole(_role: string) {
  const user = await requireAuth();
  // TODO: Check user role
  return user;
}

export function getOrgId(): string {
  // TODO: Read from headers
  throw new Error('No organisation in session');
}
