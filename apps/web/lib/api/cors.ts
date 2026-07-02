import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LOCAL_ORIGINS = ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:3002'];

function parseExtraOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/** Origins allowed to call /api/* cross-origin (Vercel frontend → Render API). */
export function getAllowedOrigins(): string[] {
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  return [...new Set([...LOCAL_ORIGINS, ...parseExtraOrigins(), ...(appOrigin ? [appOrigin] : [])])];
}

export function corsHeadersForOrigin(origin: string | null): Record<string, string> | null {
  if (!origin) return null;
  const normalized = origin.replace(/\/$/, '');
  if (!getAllowedOrigins().includes(normalized)) return null;
  return {
    'Access-Control-Allow-Origin': normalized,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function applyCorsHeaders(req: NextRequest, res: Response): Response {
  const cors = corsHeadersForOrigin(req.headers.get('origin'));
  if (!cors) return res;
  for (const [key, value] of Object.entries(cors)) {
    res.headers.set(key, value);
  }
  return res;
}

/** Respond to browser preflight before route handlers run. */
export function handleApiCorsPreflight(req: NextRequest): NextResponse | null {
  if (!req.nextUrl.pathname.startsWith('/api/') || req.method !== 'OPTIONS') {
    return null;
  }
  const cors = corsHeadersForOrigin(req.headers.get('origin'));
  if (!cors) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: cors });
}
