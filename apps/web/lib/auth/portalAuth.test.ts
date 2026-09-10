import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getJwtSecret, signToken, verifyToken } from './portalAuth';

test('portalAuth - JWT security and fail-closed secret handling', async (t) => {
  const originalEnv = { ...process.env };

  t.afterEach(() => {
    process.env = { ...originalEnv };
  });

  await t.test('fails closed when JWT_SECRET is unset in production', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';

    assert.equal(getJwtSecret(), null);
    assert.throws(() => signToken({ clientId: 'client_123' }), {
      message: /JWT_SECRET is required to sign portal tokens/,
    });
    assert.equal(verifyToken('invalid.jwt.token'), null);
  });

  await t.test('rejects insecure static default secret in production', () => {
    process.env.JWT_SECRET = 'ko-broker-portal-super-secret-key-for-local-dev-12345!';
    process.env.NODE_ENV = 'production';

    assert.equal(getJwtSecret(), null);
    assert.throws(() => signToken({ clientId: 'client_123' }), {
      message: /JWT_SECRET is required to sign portal tokens/,
    });
  });

  await t.test('attacker token signed with old static key is rejected when real secret is set', () => {
    const realSecret = 'super-secure-production-random-secret-key-9876543210';
    process.env.JWT_SECRET = realSecret;
    process.env.NODE_ENV = 'production';

    // Attacker crafts a token using the leaked/hardcoded dev secret
    const attackerSecret = 'ko-broker-portal-super-secret-key-for-local-dev-12345!';
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ clientId: 'target-victim-id', exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url');
    const attackerSignature = crypto
      .createHmac('sha256', attackerSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');
    const forgedToken = `${header}.${payload}.${attackerSignature}`;

    const result = verifyToken(forgedToken);
    assert.equal(result, null, 'Forged token with old dev key must be rejected');
  });

  await t.test('successfully signs and verifies with valid configured secret', () => {
    const validSecret = 'valid-test-secret-at-least-32-characters-long';
    process.env.JWT_SECRET = validSecret;
    process.env.NODE_ENV = 'production';

    const token = signToken({ clientId: 'client_abc_123', orgId: 'org_xyz' });
    assert.ok(token);

    const verified = verifyToken(token);
    assert.ok(verified);
    assert.equal(verified.clientId, 'client_abc_123');
    assert.equal(verified.orgId, 'org_xyz');
  });

  await t.test('rejects expired tokens', () => {
    const validSecret = 'valid-test-secret-at-least-32-characters-long';
    process.env.JWT_SECRET = validSecret;
    process.env.NODE_ENV = 'production';

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ clientId: 'client_abc_123', exp: Math.floor(Date.now() / 1000) - 100 }),
    ).toString('base64url');
    const signature = crypto
      .createHmac('sha256', validSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');
    const expiredToken = `${header}.${payload}.${signature}`;

    assert.equal(verifyToken(expiredToken), null, 'Expired token must be rejected');
  });

  await t.test('rejects malformed tokens', () => {
    process.env.JWT_SECRET = 'valid-test-secret-key';
    assert.equal(verifyToken('not-a-token'), null);
    assert.equal(verifyToken('a.b'), null);
    assert.equal(verifyToken('a.b.c.d'), null);
  });
});
