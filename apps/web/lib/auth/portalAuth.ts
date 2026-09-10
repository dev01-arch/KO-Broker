import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '../db';
import { AuthError } from './index';
import { verifyPortalSession } from '@/lib/api/portal-session';

const INSECURE_DEV_SECRET = 'ko-broker-portal-super-secret-key-for-local-dev-12345!';

export function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) {
    if (process.env.NODE_ENV === 'production' && secret === INSECURE_DEV_SECRET) {
      console.error('[portalAuth] Insecure static default JWT_SECRET cannot be used in production.');
      return null;
    }
    return secret;
  }

  // Allow a mock secret in automated test environments only
  if (process.env.NODE_ENV === 'test') {
    return 'test-jwt-secret-ko-broker-portal-test-only';
  }

  // Strictly fail closed in all other non-test environments when JWT_SECRET is unset
  return null;
}

// ── JWT Utilities (HS256 implementation using native crypto) ────────────────

export function signToken(payload: Record<string, unknown>): string {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT_SECRET is required to sign portal tokens but is not configured');
  }

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  
  // Set expiration to 7 days
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const payloadStr = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payloadStr}`)
    .digest('base64url');
    
  return `${header}.${payloadStr}.${signature}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verifyToken(token: string): Record<string, any> | null {
  const secret = getJwtSecret();
  if (!secret) {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, payloadStr, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payloadStr}`)
      .digest('base64url');
      
    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

// ── Password Hashing Utilities (PBKDF2) ──────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split(':');
    if (parts.length !== 2) return false;
    
    const [salt, originalHash] = parts;
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === originalHash;
  } catch {
    return false;
  }
}

// ── Cookie Session Helpers ───────────────────────────────────────────────────

export async function getPortalClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get('client_session')?.value;
  if (!token) return null;

  // Backend JWT (JWT_SECRET) OR frontend portal-session (PORTAL_SESSION_SECRET)
  const backendPayload = verifyToken(token);
  const frontendPayload = verifyPortalSession(token);
  const clientId = backendPayload?.clientId ?? frontendPayload?.clientId;
  if (!clientId) return null;

  return await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      cases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          factFind: true,
        },
      },
    },
  });
}

export async function requirePortalAuth() {
  const client = await getPortalClient();
  if (!client) {
    throw new AuthError('UNAUTHORIZED', 'You must be signed in to access this resource');
  }
  return client;
}
