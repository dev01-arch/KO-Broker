/**
 * Demo login pairs from env. Usernames are fixed; passwords are set in `.env.local`.
 * NEXT_PUBLIC_* values are embedded in the client bundle — light staging gate only.
 *
 * Use `base64:<payload>` so passwords containing `$` are not mangled by dotenv.
 */

function readEnvPassword(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  if (v.startsWith('base64:')) {
    const b64 = v.slice('base64:'.length).trim();
    try {
      return atob(b64);
    } catch {
      return undefined;
    }
  }
  return v;
}

const USERS: Record<string, () => string | undefined> = {
  KingOlu: () =>
    readEnvPassword(process.env.NEXT_PUBLIC_AUTH_KINGOLU_PASSWORD),
  Development: () =>
    readEnvPassword(process.env.NEXT_PUBLIC_AUTH_DEVELOPMENT_PASSWORD),
};

export const ALLOWED_USERNAMES = ['KingOlu', 'Development'] as const;

export function validateLogin(username: string, password: string): boolean {
  const key = username.trim();
  const getSecret = USERS[key];
  if (!getSecret) return false;
  const expected = getSecret()?.trim();
  if (!expected || expected.length < 12) return false;
  return expected === password.trim();
}

export function isAuthConfigured(): boolean {
  return ALLOWED_USERNAMES.every((name) => {
    const pw = USERS[name]?.()?.trim();
    return Boolean(pw && pw.length >= 12);
  });
}
