import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AI_AVAILABLE, MODEL_NAME } from '@/lib/ai/azureClient';

/**
 * GET /api/health
 *
 * Health check endpoint. Returns the live status of core services.
 * Polled by monitoring (UptimeRobot / Vercel uptime) every 5 minutes.
 * Auth is NOT required — listed as a public route in proxy.ts.
 */
export async function GET() {
    // Live DB connectivity check
    let db = false;
    try {
        await prisma.$queryRaw`SELECT 1`;
        db = true;
    } catch {
        // DB is unavailable — log but don't throw (health check must always return 200)
        console.error('[health] DB ping failed');
    }

    return NextResponse.json(
        {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                db,
                openrouter: AI_AVAILABLE,
                openrouterModel: MODEL_NAME,
            },
            version: process.env.npm_package_version ?? '0.1.0',
        },
        { status: 200 }
    );
}
