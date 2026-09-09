import dns from 'node:dns';
import { PrismaClient } from '@prisma/client';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore where not supported
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

export { PrismaClient } from '@prisma/client';
export type * from '@prisma/client';
