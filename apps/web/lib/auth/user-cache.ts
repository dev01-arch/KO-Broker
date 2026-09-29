/**
 * Process-local cache for the signed-in database user.
 * Dashboard loads fire many API routes at once; without this, each one
 * queries the user row before it can run the actual request.
 */

export const AUTH_USER_CACHE_TTL_MS = 30_000;

type CacheEntry<T> = { value: T; expiresAt: number };

export type AuthCacheIdentity = { id: string; clerkId: string };

export function createAuthUserCache<T extends AuthCacheIdentity>() {
  const byClerkId = new Map<string, CacheEntry<T>>();
  const clerkIdByUserId = new Map<string, string>();

  function invalidate(target?: { clerkId?: string | null; userId?: string | null }) {
    if (!target?.clerkId && !target?.userId) {
      byClerkId.clear();
      clerkIdByUserId.clear();
      return;
    }

    const clerkId =
      target.clerkId ?? (target.userId ? clerkIdByUserId.get(target.userId) : undefined);
    if (target.userId) clerkIdByUserId.delete(target.userId);
    if (!clerkId) return;

    const entry = byClerkId.get(clerkId);
    if (entry) clerkIdByUserId.delete(entry.value.id);
    byClerkId.delete(clerkId);
  }

  return {
    get(clerkId: string, now = Date.now()): T | undefined {
      const hit = byClerkId.get(clerkId);
      if (!hit) return undefined;
      if (hit.expiresAt <= now) {
        clerkIdByUserId.delete(hit.value.id);
        byClerkId.delete(clerkId);
        return undefined;
      }
      return hit.value;
    },
    set(value: T, now = Date.now()) {
      byClerkId.set(value.clerkId, {
        value,
        expiresAt: now + AUTH_USER_CACHE_TTL_MS,
      });
      clerkIdByUserId.set(value.id, value.clerkId);
    },
    invalidate,
  };
}

const authUserCache = createAuthUserCache<AuthCacheIdentity>();

export function readCachedAuthUser<T extends AuthCacheIdentity>(clerkId: string): T | undefined {
  return authUserCache.get(clerkId) as T | undefined;
}

export function writeCachedAuthUser<T extends AuthCacheIdentity>(user: T) {
  authUserCache.set(user);
}

export function invalidateCachedAuthUser(target?: {
  clerkId?: string | null;
  userId?: string | null;
}) {
  authUserCache.invalidate(target);
}
