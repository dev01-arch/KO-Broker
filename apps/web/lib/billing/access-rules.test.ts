import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeOrgAccess, isComplimentaryEmail, parsePaywallStart } from './access-rules.ts';

const paywallStartsAt = new Date('2026-11-01T00:00:00Z');
const now = new Date('2026-12-15T12:00:00Z');
const newOrg = { plan: 'STARTER' as const, createdAt: new Date('2026-11-10T00:00:00Z') };

describe('computeOrgAccess', () => {
  it('changes nothing while the paywall is off', () => {
    const access = computeOrgAccess({ ...newOrg, plan: 'PROFESSIONAL' }, { paywallStartsAt: null, now });
    assert.equal(access.allowed, true);
    assert.equal(access.reason, 'paywall_off');
    assert.equal(access.effectivePlan, 'PROFESSIONAL');
  });

  it('gives complimentary orgs Enterprise without a subscription', () => {
    const access = computeOrgAccess({ ...newOrg, accessGrant: 'COMPLIMENTARY' }, { paywallStartsAt, now });
    assert.deepEqual([access.allowed, access.reason, access.effectivePlan], [true, 'complimentary', 'ENTERPRISE']);
  });

  it('grandfathers orgs created before the paywall started', () => {
    const access = computeOrgAccess(
      { plan: 'STARTER', createdAt: new Date('2026-05-01T00:00:00Z') },
      { paywallStartsAt, now },
    );
    assert.deepEqual([access.allowed, access.reason, access.effectivePlan], [true, 'grandfathered', 'ENTERPRISE']);
  });

  it('gives a 30-day Enterprise trial from creation', () => {
    const during = computeOrgAccess(newOrg, { paywallStartsAt, now: new Date('2026-12-09T00:00:00Z') });
    assert.deepEqual([during.allowed, during.reason, during.effectivePlan], [true, 'trial', 'ENTERPRISE']);
    assert.equal(during.trialEndsAt, '2026-12-10T00:00:00.000Z');

    const after = computeOrgAccess(newOrg, { paywallStartsAt, now: new Date('2026-12-10T00:00:01Z') });
    assert.deepEqual([after.allowed, after.reason], [false, 'trial_ended']);
  });

  it('honours a manually extended trial end', () => {
    const access = computeOrgAccess(
      { ...newOrg, trialEndsAt: new Date('2027-01-31T00:00:00Z') },
      { paywallStartsAt, now },
    );
    assert.equal(access.allowed, true);
  });

  it('uses the paid plan for active subscriptions', () => {
    const access = computeOrgAccess(
      { ...newOrg, plan: 'PROFESSIONAL', subscriptionStatus: 'active' },
      { paywallStartsAt, now },
    );
    assert.deepEqual([access.allowed, access.reason, access.effectivePlan], [true, 'subscribed', 'PROFESSIONAL']);
  });

  it('blocks immediately when a payment fails or the subscription ends', () => {
    for (const status of ['past_due', 'unpaid']) {
      const access = computeOrgAccess({ ...newOrg, subscriptionStatus: status }, { paywallStartsAt, now });
      assert.deepEqual([access.allowed, access.reason], [false, 'payment_failed']);
    }
    const canceled = computeOrgAccess({ ...newOrg, subscriptionStatus: 'canceled' }, { paywallStartsAt, now });
    assert.deepEqual([canceled.allowed, canceled.reason], [false, 'canceled']);
  });

  it('keeps the trial running if a payment attempt fails during it', () => {
    const access = computeOrgAccess(
      { ...newOrg, subscriptionStatus: 'incomplete' },
      { paywallStartsAt, now: new Date('2026-11-20T00:00:00Z') },
    );
    assert.equal(access.reason, 'trial');
  });
});

describe('isComplimentaryEmail', () => {
  const config = { domains: 'theluxcity.co.uk', emails: 'Client@Example.com, other@firm.co.uk' };

  it('matches the exact domain only', () => {
    assert.equal(isComplimentaryEmail('Ade@TheLuxCity.co.uk', config), true);
    assert.equal(isComplimentaryEmail('ade@team.theluxcity.co.uk', config), false);
    assert.equal(isComplimentaryEmail('ade@theluxcity.co.uk.evil.com', config), false);
    assert.equal(isComplimentaryEmail('theluxcity.co.uk@gmail.com', config), false);
  });

  it('matches exact addresses case-insensitively', () => {
    assert.equal(isComplimentaryEmail('client@example.com', config), true);
    assert.equal(isComplimentaryEmail('someone@example.com', config), false);
  });

  it('ignores empty input and empty config', () => {
    assert.equal(isComplimentaryEmail('', config), false);
    assert.equal(isComplimentaryEmail('a@theluxcity.co.uk', { domains: '', emails: undefined }), false);
  });
});

describe('parsePaywallStart', () => {
  it('treats empty or invalid values as paywall off', () => {
    assert.equal(parsePaywallStart(''), null);
    assert.equal(parsePaywallStart('not a date'), null);
    assert.equal(parsePaywallStart('2026-11-01T00:00:00Z')?.toISOString(), '2026-11-01T00:00:00.000Z');
  });
});
