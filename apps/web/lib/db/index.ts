/**
 * Prisma client singleton — PRD-03
 *
 * Prevents connection pool exhaustion in development
 * by reusing the client across hot reloads.
 */

import { PrismaClient } from '@ko/db';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { type User, type Organisation, type Role } from '@ko/db';
