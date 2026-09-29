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
  prismaUrl: string | undefined;
};

let dbUrl = process.env.DATABASE_URL ?? '';
if (dbUrl && !dbUrl.includes('connection_limit')) {
  const delim = dbUrl.includes('?') ? '&' : '?';
  // Dashboard bootstrap runs several queries at once. A pool of 3 queued
  // those behind each other and made every API call wait.
  dbUrl = `${dbUrl}${delim}connection_limit=10&pool_timeout=20`;
}

if (
  process.env.NODE_ENV !== 'production' &&
  globalForPrisma.prisma &&
  globalForPrisma.prismaUrl !== dbUrl
) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma =
  globalForPrisma.prisma ??
  (dbUrl ? new PrismaClient({ datasources: { db: { url: dbUrl } } }) : new PrismaClient());

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaUrl = dbUrl;
}

export { type User, type Organisation, type Role } from '@ko/db';
