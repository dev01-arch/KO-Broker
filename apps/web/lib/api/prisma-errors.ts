export function isPrismaConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code) : '';
  if (code === 'P1001' || code === 'P1017') return true;
  const message = 'message' in error ? String(error.message) : '';
  return (
    message.includes("Can't reach database server") ||
    message.includes('Connection refused') ||
    message.includes('ECONNREFUSED')
  );
}

export function isPrismaUniqueConflict(error: unknown, field: string): boolean {
  if (!error || typeof error !== 'object') return false;
  if (!('code' in error) || String(error.code) !== 'P2002') return false;
  const meta = 'meta' in error ? (error as { meta?: { target?: unknown } }).meta : null;
  const target = meta?.target;
  return Array.isArray(target) && target.includes(field);
}

export function isPrismaAnyUniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return 'code' in error && String(error.code) === 'P2002';
}
