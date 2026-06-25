import { NextRequest } from 'next/server';
import { CheckoutSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { apiError, apiFromZodError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const checkoutUrl = !stripeKey
      ? `${req.nextUrl.origin}/dashboard?demo_checkout=1&plan=${parsed.data.plan}`
      : `${req.nextUrl.origin}/dashboard`;

    return apiSuccess({
      url: checkoutUrl,
      checkoutUrl,
      sessionId: stripeKey ? `stripe_${Date.now()}` : `demo_${Date.now()}`,
      plan: parsed.data.plan,
    });
  } catch (error) {
    console.error('[POST /api/billing/checkout]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
