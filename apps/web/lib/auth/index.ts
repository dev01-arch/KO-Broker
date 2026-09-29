/**
 * Authentication helper functions — PRD-04
 *
 * Backend source: createHandler routes read x-user-id / x-org-id headers
 * (injected by proxy.ts from Clerk). Frontend deployment also accepts
 * Bearer session tokens when those headers are absent (cross-origin API).
 */

import { cache } from 'react';
import { headers } from 'next/headers';
import { auth, currentUser } from '@clerk/nextjs/server';
import { slugify } from '@ko/utils';
import { prisma, type User, type Role } from '../db';
import { createUserWithOrg, findUserByClerkId, linkExistingUserToNewOrg } from '@/lib/api/clients-data';
import { isPrismaMissingColumnError } from '@/lib/api/prisma-errors';
import { readCachedAuthUser, writeCachedAuthUser } from '@/lib/auth/user-cache';

export { invalidateCachedAuthUser } from '@/lib/auth/user-cache';

export class AuthError extends Error {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NO_ORG';
  statusCode: number;

  constructor(code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NO_ORG', message: string) {
    super(message);
    this.code = code;
    this.statusCode = code === 'UNAUTHORIZED' ? 401 : 403;
    this.name = 'AuthError';
  }
}

function orgNameFromClerkUser(clerkUser: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  return (
    clerkUser.fullName?.trim() ||
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
    'My Organisation'
  );
}

/**
 * Auth select — only columns that exist pre- and post-adviser-invite migration.
 * Visibility / invite fields are defaulted (see toAuthUser) so hot paths never
 * SELECT missing columns (that caused intermittent 503s on /api/messages polls).
 */
const AUTH_USER_SELECT = {
  id: true,
  clerkId: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Visibility columns in the same query. Falls back if the database is unmigrated. */
const AUTH_USER_SELECT_WITH_FLAGS = {
  ...AUTH_USER_SELECT,
  canViewAllClients: true,
  canViewAccountDetails: true,
  canViewAiSummaries: true,
  invitePending: true,
} as const;

type AuthUserRow = {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  isActive: boolean;
  orgId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toAuthUser(row: AuthUserRow): User {
  return {
    ...row,
    inviteToken: null,
    inviteTokenExpiry: null,
    invitePending: false,
    // Defaults until loadVisibilityFlags enriches (or columns missing → stay false)
    canViewAllClients: false,
    canViewAccountDetails: false,
    canViewAiSummaries: false,
  };
}

function userFromAuthRow(
  row: AuthUserRow & {
    canViewAllClients?: boolean;
    canViewAccountDetails?: boolean;
    canViewAiSummaries?: boolean;
    invitePending?: boolean;
  },
): User {
  return {
    ...toAuthUser(row),
    canViewAllClients: row.canViewAllClients ?? false,
    canViewAccountDetails: row.canViewAccountDetails ?? false,
    canViewAiSummaries: row.canViewAiSummaries ?? false,
    invitePending: row.invitePending ?? false,
  };
}

async function findAuthUser(
  where: { clerkId: string } | { id: string },
): Promise<User | null> {
  try {
    const row = await prisma.user.findUnique({
      where,
      select: AUTH_USER_SELECT_WITH_FLAGS,
    });
    return row ? userFromAuthRow(row) : null;
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error;
  }

  const row = await prisma.user.findUnique({
    where,
    select: AUTH_USER_SELECT,
  });
  if (!row) return null;
  return loadVisibilityFlags(toAuthUser(row));
}

async function findUserByClerkIdForAuth(clerkId: string): Promise<User | null> {
  return findAuthUser({ clerkId });
}

async function findUserByIdForAuth(id: string): Promise<User | null> {
  return findAuthUser({ id });
}

/**
 * Optionally enrich visibility flags after migration. Never throws schema errors upward.
 */
async function loadVisibilityFlags(user: User): Promise<User> {
  const cached = readCachedAuthUser<User>(user.clerkId);
  if (cached && cached.id === user.id) return cached;

  try {
    const flags = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        canViewAllClients: true,
        canViewAccountDetails: true,
        canViewAiSummaries: true,
        invitePending: true,
      },
    });
    if (!flags) return user;
    const next = { ...user, ...flags };
    if (next.orgId) writeCachedAuthUser(next);
    return next;
  } catch {
    return user;
  }
}

/**
 * Resolve Clerk user id from proxy headers or Bearer session token.
 */
async function resolveClerkUserId(): Promise<string | null> {
  const headerList = await headers();
  const fromHeader = headerList.get('x-user-id');
  if (fromHeader) return fromHeader;

  // === FRONTEND ADDITION: cross-origin Bearer when proxy headers are absent ===
  const { userId, isAuthenticated } = await auth({ acceptsToken: 'session_token' });
  if (isAuthenticated && userId) return userId;
  return null;
  // === END FRONTEND ADDITION ===
}

/**
 * Ensure a DB user (+ org) exists for this Clerk id (first-login provisioning).
 */
async function ensureDbUser(clerkId: string): Promise<User | null> {
  let user = await findUserByClerkId(clerkId);
  if (user?.orgId) {
    return findUserByIdForAuth(user.id);
  }

  const clerkUser = await currentUser();
  if (!clerkUser) return user ? findUserByIdForAuth(user.id) : null;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const orgName = orgNameFromClerkUser(clerkUser);
  const baseSlug = slugify(orgName) || 'organisation';
  const slug = `${baseSlug}-${clerkId.slice(-6).toLowerCase()}`;

  if (!user) {
    user = await createUserWithOrg({
      clerkId,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      orgName,
      slug,
    });
  } else {
    user = await linkExistingUserToNewOrg(user.id, { orgName, slug });
  }

  return findUserByIdForAuth(user.id);
}

/**
 * getCurrentUser() — reads headers (or Bearer), queries DB.
 * Memoized for the request and for a short TTL so a dashboard burst
 * does not repeat the user lookup.
 */
async function loadCurrentUser(): Promise<User | null> {
  const userId = await resolveClerkUserId();
  if (!userId) return null;

  const cached = readCachedAuthUser<User>(userId);
  if (cached?.orgId) return cached;

  let existing = await findUserByClerkIdForAuth(userId);

  // === FRONTEND ADDITION: auto-provision on first API call ===
  // Also covers a user row that exists but is not linked to an organisation yet.
  if (!existing?.orgId) {
    const provisioned = await ensureDbUser(userId);
    existing = provisioned ?? existing;
  }
  // === END FRONTEND ADDITION ===

  if (!existing) return null;
  if (existing.orgId) writeCachedAuthUser(existing);
  return existing;
}

export const getCurrentUser = cache(loadCurrentUser);

/**
 * requireAuth() — throws AuthError (401) if not authenticated, (403) if deactivated
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError('UNAUTHORIZED', 'You must be signed in to access this resource');
  }
  if (!user.isActive) {
    throw new AuthError('FORBIDDEN', 'Your account has been deactivated. Please contact your administrator.');
  }
  return user;
}

/**
 * requireRole(role) — throws AuthError (403) if wrong role
 */
export async function requireRole(role: Role): Promise<User> {
  const user = await requireAuth();

  // ADMIN can do anything
  if (user.role === 'ADMIN') return user;

  if (user.role !== role) {
    throw new AuthError('FORBIDDEN', `Insufficient permissions. Required role: ${role}`);
  }
  return user;
}

/**
 * getOrgId() — throws if no org in session
 */
export async function getOrgId(): Promise<string> {
  const headerList = await headers();
  const headerOrgId = headerList.get('x-org-id');

  // === FRONTEND ADDITION ===
  // Proxy injects Clerk org ids (`org_…`). Those are not Organisation.id in our DB.
  // Looking them up caused a failed query on every createHandler request (slow / 503).
  const isClerkOrgId = Boolean(headerOrgId?.startsWith('org_'));

  if (headerOrgId && !isClerkOrgId) {
    const org = await prisma.organisation.findFirst({
      where: {
        OR: [{ id: headerOrgId }, { slug: headerOrgId }],
      },
      select: { id: true },
    });
    if (org) return org.id;
  }

  const user = await requireAuth();
  if (!user.orgId) {
    throw new AuthError('NO_ORG', 'No organisation selected in session');
  }
  return user.orgId;
  // === END FRONTEND ADDITION ===
}

/**
 * requireActiveUser() — throws AuthError (403) if the user account is deactivated.
 * Called automatically by requireAuth() so all authed routes enforce this.
 */
export async function requireActiveUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError('UNAUTHORIZED', 'You must be signed in to access this resource');
  }
  if (!user.isActive) {
    throw new AuthError('FORBIDDEN', 'Your account has been deactivated. Please contact your administrator.');
  }
  return user;
}

/**
 * Per-adviser visibility switch names (mirrors the User model fields).
 */
export type VisibilitySwitch =
  | 'canViewAllClients'
  | 'canViewAccountDetails'
  | 'canViewAiSummaries';

/**
 * requireVisibility(switch) — ADMIN always bypasses.
 * ADVISER must have the named switch enabled or receives a 403.
 */
export async function requireVisibility(sw: VisibilitySwitch): Promise<User> {
  let user = await requireActiveUser();
  if (user.role === 'ADMIN') return user; // admin always bypasses

  user = await loadVisibilityFlags(user);

  if (!(user as Record<string, unknown>)[sw]) {
    throw new AuthError(
      'FORBIDDEN',
      `Access denied: '${sw}' is not enabled for your account. Contact your administrator.`
    );
  }
  return user;
}

/**
 * Mask client-specific financial information if the user is not allowed to see it.
 */
export function maskClientFinancials<T extends Record<string, unknown> | null | undefined>(client: T): T {
  if (!client) return client;
  return {
    ...client,
    annualIncome: null,
  };
}

/**
 * Mask case-specific financial information if the user is not allowed to see it.
 */
export function maskCaseFinancials<T extends Record<string, unknown> | null | undefined>(caseRecord: T): T {
  if (!caseRecord) return caseRecord;
  const factFind =
    caseRecord.factFind && typeof caseRecord.factFind === 'object'
      ? {
          ...(caseRecord.factFind as Record<string, unknown>),
          incomeDetails: null,
          expenditureDetails: null,
          existingMortgages: null,
        }
      : null;
  const productsConsidered = Array.isArray(caseRecord.productsConsidered)
    ? caseRecord.productsConsidered.map((p) => ({
        ...(p as Record<string, unknown>),
        rate: null,
        fee: null,
      }))
    : [];
  return {
    ...caseRecord,
    propertyValue: null,
    loanAmount: null,
    ltv: null,
    selectedRate: null,
    selectedFee: null,
    factFind,
    productsConsidered,
  };
}
