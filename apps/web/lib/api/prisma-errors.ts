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
