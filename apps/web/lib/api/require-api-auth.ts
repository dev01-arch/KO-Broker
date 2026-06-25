import { auth, currentUser } from '@clerk/nextjs/server';
import { slugify } from '@ko/utils';
import { apiUnauthorized, apiError } from '@/lib/api/responses';
import { createUserWithOrg, findUserByClerkId } from '@/lib/api/clients-data';
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
  };
  orgId: string;
};

type ApiAuthResult = ApiAuthSuccess | { response: Response };

export async function requireApiAuth(): Promise<ApiAuthResult> {
  const { userId } = await auth();
  if (!userId) {
    return { response: apiUnauthorized() };
  }

  try {
    let user = await findUserByClerkId(userId);

    if (!user) {
      const clerkUser = await currentUser();
      if (!clerkUser) {
        return { response: apiUnauthorized() };
      }

      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) {
        return {
          response: apiError('FORBIDDEN', 'A verified email address is required', 403),
        };
      }

      const orgName =
        clerkUser.fullName?.trim() ||
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
        'My Organisation';
      const baseSlug = slugify(orgName) || 'organisation';

      user = await createUserWithOrg({
        clerkId: userId,
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        orgName,
        slug: `${baseSlug}-${userId.slice(-6).toLowerCase()}`,
      });
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
