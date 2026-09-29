import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthUserCache } from './user-cache.ts';

test('auth user cache reuses a user until ttl, then drops it', () => {
  const cache = createAuthUserCache<{ id: string; clerkId: string; role: string }>();
  const now = 1_000_000;
  cache.set({ id: 'user_1', clerkId: 'clerk_1', role: 'ADMIN' }, now);

  assert.equal(cache.get('clerk_1', now + 1_000)?.role, 'ADMIN');
  assert.equal(cache.get('clerk_1', now + 30_000), undefined);
});

test('auth user cache invalidates by user id', () => {
  const cache = createAuthUserCache<{ id: string; clerkId: string }>();
  cache.set({ id: 'user_1', clerkId: 'clerk_1' }, 0);
  cache.invalidate({ userId: 'user_1' });
  assert.equal(cache.get('clerk_1', 1), undefined);
});
