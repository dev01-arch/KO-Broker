/**
 * Prisma client singleton — PRD-03
 *
 * Prevents connection pool exhaustion in development
 * by reusing the client across hot reloads.
 */

// TODO (PRD-03): Import from @ko/db and expose singleton

// import { PrismaClient } from '@prisma/client';
//
// const globalForPrisma = globalThis as unknown as {
//   prisma: PrismaClient | undefined;
// };
//
// export const prisma = globalForPrisma.prisma ?? new PrismaClient();
//
// if (process.env.NODE_ENV !== 'production') {
//   globalForPrisma.prisma = prisma;
// }

export {};
