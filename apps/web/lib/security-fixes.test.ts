import test from 'node:test';
import assert from 'node:assert/strict';
import { portalSessionCookieOptions, clearPortalSessionCookieOptions } from './api/portal-session';

test('security-fixes - cookie and session configuration', async (t) => {
  const originalEnv = { ...process.env };

  t.afterEach(() => {
    process.env = { ...originalEnv };
  });

  await t.test('portalSessionCookieOptions sets sameSite: "lax" in production (preventing CSRF)', () => {
    process.env.NODE_ENV = 'production';
    const opts = portalSessionCookieOptions('mock-token');
    assert.equal(opts.sameSite, 'lax');
    assert.equal(opts.secure, true);
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.path, '/');
  });

  await t.test('portalSessionCookieOptions sets sameSite: "lax" in development', () => {
    process.env.NODE_ENV = 'development';
    const opts = portalSessionCookieOptions('mock-token');
    assert.equal(opts.sameSite, 'lax');
    assert.equal(opts.secure, false);
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.path, '/');
  });

  await t.test('clearPortalSessionCookieOptions sets sameSite: "lax"', () => {
    const opts = clearPortalSessionCookieOptions();
    assert.equal(opts.sameSite, 'lax');
    assert.equal(opts.maxAge, 0);
  });
});

test('security-fixes - webhook fail-closed enforcement', async (t) => {
  const originalEnv = { ...process.env };

  t.afterEach(() => {
    process.env = { ...originalEnv };
  });

  await t.test('Stripe webhook fails closed with 500 when secret is unconfigured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import('../app/api/webhooks/stripe/route');
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    const res = await POST(req);
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.equal(text, 'Webhook secret not configured');
  });

  await t.test('Stripe webhook returns 400 when stripe-signature is missing', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_123';
    const { POST } = await import('../app/api/webhooks/stripe/route');
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const text = await res.text();
    assert.equal(text, 'Missing stripe-signature header');
  });

  await t.test('Stripe webhook returns 400 when stripe-signature is invalid', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_123';
    const { POST } = await import('../app/api/webhooks/stripe/route');
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 't=12345,v1=invalidsignature' },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const text = await res.text();
    assert.match(text, /Webhook Error:/);
  });

  await t.test('Email webhook fails closed with 500 when secret is unconfigured', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
    const { POST } = await import('../app/api/webhooks/email/route');
    const req = new Request('http://localhost/api/webhooks/email', {
      method: 'POST',
      body: JSON.stringify({ from: { email: 'client@example.com' } }),
    });
    const res = await POST(req);
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.equal(text, 'Webhook secret not configured');
  });

  await t.test('Email webhook returns 401 when signature headers are missing', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_secret_123';
    const { POST } = await import('../app/api/webhooks/email/route');
    const req = new Request('http://localhost/api/webhooks/email', {
      method: 'POST',
      body: JSON.stringify({ from: { email: 'client@example.com' } }),
    });
    const res = await POST(req);
    assert.equal(res.status, 401);
    const text = await res.text();
    assert.equal(text, 'Missing signature headers');
  });
});

