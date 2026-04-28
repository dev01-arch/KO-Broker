import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Health check endpoint. Returns the status of core services.
 * Polled by monitoring (UptimeRobot / Vercel uptime).
 */
export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      db: false, // Will be true once Prisma client is connected (PRD-03)
      ai: false, // Will be true once Azure AI Foundry API key is set (PRD-09)
    },
    version: '0.1.0',
  };

  // TODO (PRD-03): Check DB connectivity
  // try {
  //   await prisma.$queryRaw`SELECT 1`;
  //   health.services.db = true;
  // } catch {}

  // TODO (PRD-09): Check AI connectivity
  // if (process.env.AZURE_AI_FOUNDRY_API_KEY) {
  //   health.services.ai = true;
  // }

  return NextResponse.json(health, { status: 200 });
}
