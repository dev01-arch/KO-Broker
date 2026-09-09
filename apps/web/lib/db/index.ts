/**
 * Prisma client singleton — PRD-03
 *
 * Prevents connection pool exhaustion in development
 * by reusing the client across hot reloads.
 */

import dns from 'node:dns';
import { PrismaClient } from '@ko/db';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore in environments where not supported
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let dbUrl = process.env.DATABASE_URL ?? '';
if (dbUrl && !dbUrl.includes('connection_limit')) {
  const delim = dbUrl.includes('?') ? '&' : '?';
  dbUrl = `${dbUrl}${delim}connection_limit=3&pool_timeout=60`;
}

export const prisma =
  globalForPrisma.prisma ??
  (dbUrl ? new PrismaClient({ datasources: { db: { url: dbUrl } } }) : new PrismaClient());

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { type User, type Organisation, type Role } from '@ko/db';
