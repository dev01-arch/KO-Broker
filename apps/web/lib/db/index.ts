/**
 * Prisma client singleton — PRD-03
 *
 * Prevents connection pool exhaustion in development
 * by reusing the client across hot reloads.
 */

export { prisma } from '@ko/db';
