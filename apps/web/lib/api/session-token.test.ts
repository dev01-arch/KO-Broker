import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearCachedSessionToken,
  getCachedSessionToken,
  peekCachedSessionToken,
  sessionTokenExpiresAt,
} from './session-token.ts';

function jwtWithExp(expSeconds: number) {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url');
  return `header.${payload}.sig`;
}

test('sessionTokenExpiresAt reads the JWT exp claim', () => {
  const exp = 1_800_000_000;
  assert.equal(sessionTokenExpiresAt(jwtWithExp(exp)), exp * 1000);
});

test('getCachedSessionToken shares one in-flight getToken call', async () => {
  clearCachedSessionToken();
  let calls = 0;
  const token = jwtWithExp(Math.floor(Date.now() / 1000) + 120);
  const getToken = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return token;
  };

  const [a, b] = await Promise.all([
    getCachedSessionToken(getToken),
    getCachedSessionToken(getToken),
  ]);

  assert.equal(a, token);
  assert.equal(b, token);
  assert.equal(calls, 1);
  assert.equal(peekCachedSessionToken(), token);
  clearCachedSessionToken();
});
