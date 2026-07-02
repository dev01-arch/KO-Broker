import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SESSION_COOKIE = 'client_session';
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

export type PortalSessionPayload = {
  clientId: string;
  orgId: string;
  caseId: string;
  email: string;
};

function sessionSecret(): string {
  const secret = process.env.PORTAL_SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PORTAL_SESSION_SECRET is required in production');
  }
  return 'dev-portal-session-secret';
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function signPortalSession(payload: PortalSessionPayload): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
    }),
  );
  const signature = createHmac('sha256', sessionSecret())
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyPortalSession(token: string): PortalSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = createHmac('sha256', sessionSecret())
    .update(`${header}.${body}`)
    .digest('base64url');

  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as PortalSessionPayload & { exp?: number };
    if (!payload.clientId || !payload.orgId || !payload.caseId || !payload.email) return null;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      clientId: payload.clientId,
      orgId: payload.orgId,
      caseId: payload.caseId,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export function hashPortalPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPortalPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64).toString('hex');
  if (candidate.length !== hash.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

export function portalSessionCookieOptions(token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    path: '/',
    maxAge: SESSION_TTL_SEC,
  };
}

export function clearPortalSessionCookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}

export { SESSION_COOKIE };
