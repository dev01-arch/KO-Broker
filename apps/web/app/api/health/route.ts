import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/health
 *
 * Health check endpoint. Returns the status of core services.
 * Polled by monitoring (UptimeRobot / Vercel uptime).
 */
export async function GET() {
  const health = {
    status: 'ok' as 'ok' | 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      db: false,
      ai: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    },
    version: '0.1.0',
  };

  if (process.env.DATABASE_URL) {
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('db timeout')), 2000),
        ),
      ]);
      health.services.db = true;
    } catch {
      health.status = 'degraded';
    }
  }

  return NextResponse.json(health, {
    status: health.status === 'ok' ? 200 : 503,
  });
}
