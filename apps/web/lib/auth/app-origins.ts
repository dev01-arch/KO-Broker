/**
 * Production is served on both apex and www. Clerk handshake (`azp`) and
 * redirect allow-lists must include every origin users actually land on.
 */

const LOCAL_ORIGINS = ['http://localhost:3001', 'http://localhost:3000'] as const;
const PRODUCTION_ORIGINS = ['https://ko-broker.com', 'https://www.ko-broker.com'] as const;

function withWwwVariant(origin: string): string[] {
  try {
    const url = new URL(origin.includes('://') ? origin : `https://${origin}`);
    const host = url.hostname;
    if (!host || host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return [`${url.protocol}//${url.host}`];
    }
    const altHost = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    const port = url.port ? `:${url.port}` : '';
    return [`${url.protocol}//${host}${port}`, `${url.protocol}//${altHost}${port}`];
  } catch {
    return [];
  }
}

export function appAuthorizedOrigins(): string[] {
  const origins = new Set<string>([...LOCAL_ORIGINS, ...PRODUCTION_ORIGINS]);
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  if (app) {
    for (const origin of withWwwVariant(app)) origins.add(origin);
  }
  return [...origins];
}

/** Clerk only accepts same-app paths here. Absolute www/apex URLs stall the widget. */
export function toSameOriginPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw?.trim()) return fallback;
  const value = raw.trim();
  const asPath = (path: string) => {
    if (!path.startsWith('/') || path.startsWith('//')) return fallback;
    if (path.startsWith('/sign-in') || path.startsWith('/sign-up')) return fallback;
    return path;
  };

  if (value.startsWith('/') && !value.startsWith('//')) {
    return asPath(value);
  }

  try {
    const url = new URL(value);
    return asPath(`${url.pathname}${url.search}${url.hash}` || fallback);
  } catch {
    return fallback;
  }
}
