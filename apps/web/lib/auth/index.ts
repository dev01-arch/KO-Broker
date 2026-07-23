/**
 * Authentication helper functions — PRD-04
 *
 * Backend source: createHandler routes read x-user-id / x-org-id headers
 * (injected by proxy.ts from Clerk). Frontend deployment also accepts
 * Bearer session tokens when those headers are absent (cross-origin API).
 */

import { headers } from 'next/headers';
import { auth, currentUser } from '@clerk/nextjs/server';
import { slugify } from '@ko/utils';
import { prisma, type User, type Role } from '../db';
import { createUserWithOrg, findUserByClerkId, linkExistingUserToNewOrg } from '@/lib/api/clients-data';

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

async function findUserByClerkIdForAuth(clerkId: string): Promise<User | null> {
  const row = await prisma.user.findUnique({
    where: { clerkId },
    select: AUTH_USER_SELECT,
  });
  return row ? toAuthUser(row) : null;
}

async function findUserByIdForAuth(id: string): Promise<User | null> {
  const row = await prisma.user.findUnique({
    where: { id },
    select: AUTH_USER_SELECT,
  });
  return row ? toAuthUser(row) : null;
}

/**
 * Optionally enrich visibility flags after migration. Never throws schema errors upward.
 */
async function loadVisibilityFlags(user: User): Promise<User> {
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
    return { ...user, ...flags };
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
 * getCurrentUser() — reads headers (or Bearer), queries DB
 */
export async function getCurrentUser(): Promise<User | null> {
  const userId = await resolveClerkUserId();
  if (!userId) return null;

  const existing = await findUserByClerkIdForAuth(userId);
  if (existing) {
    // Load per-adviser visibility switches (safe no-op if columns missing).
    return loadVisibilityFlags(existing);
  }

  // === FRONTEND ADDITION: auto-provision on first API call ===
  const provisioned = await ensureDbUser(userId);
  return provisioned ? loadVisibilityFlags(provisioned) : null;
  // === END FRONTEND ADDITION ===
}

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
export function maskClientFinancials<T extends Record<string, any> | null | undefined>(client: T): T {
  if (!client) return client;
  return {
    ...client,
    annualIncome: null,
  };
}

/**
 * Mask case-specific financial information if the user is not allowed to see it.
 */
export function maskCaseFinancials<T extends Record<string, any> | null | undefined>(caseRecord: T): T {
  if (!caseRecord) return caseRecord;
  return {
    ...caseRecord,
    propertyValue: null,
    loanAmount: null,
    ltv: null,
    selectedRate: null,
    selectedFee: null,
    factFind: caseRecord.factFind
      ? {
          ...caseRecord.factFind,
          incomeDetails: null,
          expenditureDetails: null,
          existingMortgages: null,
        }
      : null,
    productsConsidered:
      caseRecord.productsConsidered?.map((p: any) => ({
        ...p,
        rate: null,
        fee: null,
      })) ?? [],
  };
}
