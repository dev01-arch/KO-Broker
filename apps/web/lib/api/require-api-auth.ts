import { getCurrentUser } from '@/lib/auth';
import { apiUnauthorized, apiError } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type ApiAuthSuccess = {
  user: {
    id: string;
    orgId: string;
    clerkId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    isActive: boolean;
    canViewAllClients: boolean;
    canViewAccountDetails: boolean;
    canViewAiSummaries: boolean;
  };
  orgId: string;
};

type ApiAuthResult = ApiAuthSuccess | { response: Response };

/**
 * Resolves the signed-in user for route handlers.
 * Uses the same request-scoped user as getCurrentUser(), so a route that
 * calls both does not hit Clerk or the database twice.
 * Proxy middleware already verified the session and set x-user-id.
 */
export async function requireApiAuth(): Promise<ApiAuthResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { response: apiUnauthorized() };
    }

    const orgId = user.orgId;
    if (!orgId) {
      return {
        response: apiError('FORBIDDEN', 'No organisation linked to this account', 403),
      };
    }

    return {
      user: { ...user, orgId },
      orgId,
    };
  } catch (error) {
    if (isPrismaConnectionError(error)) {
      return {
        response: apiError(
          'SERVICE_UNAVAILABLE',
          'Database is unavailable. Start PostgreSQL locally or continue in development using the built-in local store after restarting the dev server.',
          503,
        ),
      };
    }
    throw error;
  }
}
