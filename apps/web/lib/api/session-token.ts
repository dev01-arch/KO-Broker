/**
 * Clerk session JWTs are valid for about a minute. Dashboard code used to call
 * getToken() before every request, so parallel loads each waited on Clerk.
 * One in-flight refresh is shared, and a still-valid token is reused.
 */

const EXPIRY_SKEW_MS = 15_000;
const FALLBACK_TTL_MS = 50_000;

let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

function decodeBase64Url(part: string): string {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') return atob(padded);
  return Buffer.from(padded, 'base64').toString('utf8');
}

/** Epoch ms when this JWT expires, or a short fallback if it cannot be read. */
export function sessionTokenExpiresAt(token: string, now = Date.now()): number {
  try {
    const part = token.split('.')[1];
    if (!part) return now + FALLBACK_TTL_MS;
    const payload = JSON.parse(decodeBase64Url(part)) as { exp?: unknown };
    if (typeof payload.exp === 'number') return payload.exp * 1000;
  } catch {
    // Malformed token — treat it as short-lived so the next call refreshes.
  }
  return now + FALLBACK_TTL_MS;
}

export function peekCachedSessionToken(now = Date.now()): string | null {
  if (!cached) return null;
  if (cached.expiresAt - EXPIRY_SKEW_MS <= now) return null;
  return cached.token;
}

export function clearCachedSessionToken() {
  cached = null;
}

/**
 * Returns a session JWT. Concurrent callers share one getToken() round-trip.
 * Same null contract as Clerk's getToken().
 */
export async function getCachedSessionToken(
  getToken: () => Promise<string | null>,
): Promise<string | null> {
  const hit = peekCachedSessionToken();
  if (hit) return hit;

  if (!inflight) {
    inflight = getToken()
      .then((token) => {
        if (token) {
          cached = { token, expiresAt: sessionTokenExpiresAt(token) };
        }
        return token ?? null;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}
