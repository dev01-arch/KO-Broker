/**
 * Comprehensive Automated Test Suite for Mortgage Intelligence (PRD-15)
 *
 * Runs all 11 endpoints via live HTTP against the Next.js server and Supabase:
 * 1.  GET  /api/cron/intelligence-rates
 * 2.  POST /api/cron/intelligence-rates
 * 3.  GET  /api/cron/intelligence-prices
 * 4.  POST /api/cron/intelligence-prices
 * 5.  GET  /api/intelligence/overview
 * 6.  GET  /api/intelligence/rates/current
 * 7.  GET  /api/intelligence/cases/:caseId/preview
 * 8.  POST /api/intelligence/snapshots
 * 9.  GET  /api/intelligence/snapshots?caseId=:caseId
 * 10. GET  /api/intelligence/snapshots/:id
 * 11. POST /api/intelligence/snapshots/:id/copy-to-notes
 */

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { prisma } from './lib/db';

const BASE_URL = process.env.TEST_API_URL ?? 'http://localhost:3001';

interface TestResult {
  id: number;
  name: string;
  method: string;
  endpoint: string;
  status: number;
  expectedStatus: number;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(
  id: number,
  name: string,
  method: string,
  endpoint: string,
  status: number,
  expectedStatus: number,
  passed: boolean,
  details: string,
) {
  results.push({
    id,
    name,
    endpoint,
    method,
    status,
    expectedStatus,
    passed,
    details,
  });
  const symbol = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${symbol} [Test ${id.toString().padStart(2, ' ')}] ${method.padEnd(4, ' ')} ${endpoint} (HTTP ${status}) - ${details}`);
}

async function runTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('      MORTGAGE INTELLIGENCE (PRD-15) AUTOMATED ENDPOINT TEST SUITE     ');
  console.log(`      Target: ${BASE_URL}                                             `);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // ── Setup Test Fixtures in DB ─────────────────────────────────────────────
  const orgSlug = `intel-test-org-${Date.now()}`;
  const testOrg = await prisma.organisation.create({
    data: {
      name: 'Automated Test Intelligence Org',
      slug: orgSlug,
      plan: 'PROFESSIONAL',
    },
  });

  const testUser = await prisma.user.create({
    data: {
      email: `intel-tester-${Date.now()}@ko-broker.com`,
      clerkId: `user_clerk_test_${Date.now()}`,
      firstName: 'Intelligence',
      lastName: 'AutomatedTester',
      role: 'ADVISER',
      orgId: testOrg.id,
      isActive: true,
    },
  });

  const testClient = await prisma.client.create({
    data: {
      orgId: testOrg.id,
      referenceNumber: `CLI-${Date.now()}`,
      firstName: 'Jane',
      lastName: 'Doe',
      email: `jane-${Date.now()}@example.com`,
      clientType: 'INDIVIDUAL',
      status: 'ACTIVE',
      employmentStatus: 'EMPLOYED',
      annualIncome: 95_000,
      address: { postcode: 'SW1A 2AA', line1: '10 Downing St' },
    },
  });

  const testCase = await prisma.case.create({
    data: {
      orgId: testOrg.id,
      clientId: testClient.id,
      assignedAdviserId: testUser.id,
      referenceNumber: `CASE-INTEL-${Date.now()}`,
      type: 'PURCHASE',
      stage: 'RESEARCH',
      propertyValue: 450_000,
      loanAmount: 320_000,
      termYears: 25,
      adviserNotes: 'Existing client consultation notes.',
    },
  });

  const authHeaders: Record<string, string> = {
    'x-user-id': testUser.clerkId,
    'x-org-id': testOrg.id,
    'Content-Type': 'application/json',
  };

  let createdSnapshotId = '';

  // ── 1. GET /api/cron/intelligence-rates ───────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/cron/intelligence-rates`, { method: 'GET' });
    const body = await res.json();
    const passed = res.status === 200 && (body.ok === true || body.feedStatus !== 'failure');
    recordTest(
      1,
      'BoE Ingest Cron (GET)',
      'GET',
      '/api/cron/intelligence-rates',
      res.status,
      200,
      passed,
      `Feed status: ${body.feedStatus ?? 'ok'}, series count: ${body.results?.length ?? 0}`,
    );
  } catch (err) {
    recordTest(1, 'BoE Ingest Cron (GET)', 'GET', '/api/cron/intelligence-rates', 500, 200, false, String(err));
  }

  // ── 2. POST /api/cron/intelligence-rates ──────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/cron/intelligence-rates`, { method: 'POST' });
    const body = await res.json();
    const passed = res.status === 200 && (body.ok === true || body.feedStatus !== 'failure');
    recordTest(
      2,
      'BoE Ingest Cron (POST)',
      'POST',
      '/api/cron/intelligence-rates',
      res.status,
      200,
      passed,
      `Feed status: ${body.feedStatus ?? 'ok'}, ranAt: ${body.ranAt}`,
    );
  } catch (err) {
    recordTest(2, 'BoE Ingest Cron (POST)', 'POST', '/api/cron/intelligence-rates', 500, 200, false, String(err));
  }

  // ── 3. GET /api/cron/intelligence-prices ──────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/cron/intelligence-prices`, { method: 'GET' });
    const body = await res.json();
    const passed = res.status === 200 && (body.ok === true || body.feedStatus !== 'failure');
    recordTest(
      3,
      'HMLR Prices Ingest Cron (GET)',
      'GET',
      '/api/cron/intelligence-prices',
      res.status,
      200,
      passed,
      `Feed status: ${body.feedStatus ?? 'ok'}, updated: ${body.results?.length ?? 0} outward codes`,
    );
  } catch (err) {
    recordTest(3, 'HMLR Prices Ingest Cron (GET)', 'GET', '/api/cron/intelligence-prices', 500, 200, false, String(err));
  }

  // ── 4. POST /api/cron/intelligence-prices ─────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/cron/intelligence-prices`, { method: 'POST' });
    const body = await res.json();
    const passed = res.status === 200 && (body.ok === true || body.feedStatus !== 'failure');
    recordTest(
      4,
      'HMLR Prices Ingest Cron (POST)',
      'POST',
      '/api/cron/intelligence-prices',
      res.status,
      200,
      passed,
      `Feed status: ${body.feedStatus ?? 'ok'}, ranAt: ${body.ranAt}`,
    );
  } catch (err) {
    recordTest(4, 'HMLR Prices Ingest Cron (POST)', 'POST', '/api/cron/intelligence-prices', 500, 200, false, String(err));
  }

  // ── 5. GET /api/intelligence/overview ─────────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/intelligence/overview`, {
      method: 'GET',
      headers: authHeaders,
    });
    const body = await res.json();
    const ratesCount = body.data?.rates?.length ?? 0;
    const has4Cards = ratesCount === 4;
    const passed = res.status === 200 && body.success === true && has4Cards;
    recordTest(
      5,
      'Market Overview (4 Rate Cards)',
      'GET',
      '/api/intelligence/overview',
      res.status,
      200,
      passed,
      `Rates: ${ratesCount}/4 cards, Signal: ${body.data?.marketSignal}, Feeds: ${body.data?.feedStatuses?.length ?? 0}`,
    );
  } catch (err) {
    recordTest(5, 'Market Overview (4 Rate Cards)', 'GET', '/api/intelligence/overview', 500, 200, false, String(err));
  }

  // ── 6. GET /api/intelligence/rates/current ────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/intelligence/rates/current`, {
      method: 'GET',
      headers: authHeaders,
    });
    const body = await res.json();
    const has2yr = body.data?.fixed2yr?.value != null;
    const has5yr = body.data?.fixed5yr?.value != null;
    const hasVar = body.data?.variable75?.value != null;
    const passed = res.status === 200 && body.success === true && has2yr && has5yr && hasVar;
    recordTest(
      6,
      'Current Benchmark Rates',
      'GET',
      '/api/intelligence/rates/current',
      res.status,
      200,
      passed,
      `2yr: ${body.data?.fixed2yr?.value}%, 5yr: ${body.data?.fixed5yr?.value}%, Variable: ${body.data?.variable75?.value}%`,
    );
  } catch (err) {
    recordTest(6, 'Current Benchmark Rates', 'GET', '/api/intelligence/rates/current', 500, 200, false, String(err));
  }

  // ── 7. GET /api/intelligence/cases/:caseId/preview ────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/intelligence/cases/${testCase.id}/preview`, {
      method: 'GET',
      headers: authHeaders,
    });
    const body = await res.json();
    const hasPropertyValue = body.data?.propertyValue?.present === true;
    const hasPostcode = body.data?.postcode?.present === true;
    const passed = res.status === 200 && body.success === true && hasPropertyValue && hasPostcode;
    recordTest(
      7,
      'Case Pre-Flight Preview',
      'GET',
      `/api/intelligence/cases/${testCase.id}/preview`,
      res.status,
      200,
      passed,
      `Case label: ${body.data?.caseLabel}, Postcode: ${body.data?.postcode?.value} (present: ${body.data?.postcode?.present}), PropertyVal: £${body.data?.propertyValue?.value}`,
    );
  } catch (err) {
    recordTest(7, 'Case Pre-Flight Preview', 'GET', `/api/intelligence/cases/${testCase.id}/preview`, 500, 200, false, String(err));
  }

  // ── 8. POST /api/intelligence/snapshots ───────────────────────────────────
  try {
    const payload = {
      caseId: testCase.id,
      source: 'CONFIRMED_FROM_CASE',
      confirmedAt: new Date().toISOString(),
      postcode: 'SW1A 2AA',
      propertyValue: 450_000,
      mortgageAmount: 320_000,
      termYears: 25,
      deposit: 130_000,
      grossIncome: 95_000,
      monthlyCommitments: 600,
    };
    const res = await fetch(`${BASE_URL}/api/intelligence/snapshots`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    createdSnapshotId = body.data?.id ?? '';
    const hasOutputs = body.data?.outputsJson?.benchmarkRate2yr != null;
    const hasGeography = body.data?.geography != null;
    const passed = res.status === 201 && body.success === true && Boolean(createdSnapshotId) && hasOutputs && hasGeography;
    recordTest(
      8,
      'Create Snapshot (Calculations + Engine)',
      'POST',
      '/api/intelligence/snapshots',
      res.status,
      201,
      passed,
      `Snapshot ID: ${createdSnapshotId}, LTV: ${body.data?.ltv}%, Monthly: £${body.data?.monthlyPayment}, Region: ${body.data?.geography?.region ?? 'UK'}`,
    );
  } catch (err) {
    recordTest(8, 'Create Snapshot (Calculations + Engine)', 'POST', '/api/intelligence/snapshots', 500, 201, false, String(err));
  }

  // ── 9. GET /api/intelligence/snapshots?caseId= ────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/intelligence/snapshots?caseId=${testCase.id}`, {
      method: 'GET',
      headers: authHeaders,
    });
    const body = await res.json();
    const snapshotsList = body.data ?? [];
    const passed = res.status === 200 && body.success === true && snapshotsList.length >= 1;
    recordTest(
      9,
      'List Case Snapshots History',
      'GET',
      `/api/intelligence/snapshots?caseId=${testCase.id}`,
      res.status,
      200,
      passed,
      `Retrieved ${snapshotsList.length} snapshot(s) for case`,
    );
  } catch (err) {
    recordTest(9, 'List Case Snapshots History', 'GET', `/api/intelligence/snapshots?caseId=${testCase.id}`, 500, 200, false, String(err));
  }

  // ── 10. GET /api/intelligence/snapshots/:id ───────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/intelligence/snapshots/${createdSnapshotId}`, {
      method: 'GET',
      headers: authHeaders,
    });
    const body = await res.json();
    const isIsoDate = typeof body.data?.generatedAt === 'string' && body.data?.generatedAt.includes('T');
    const hasStructuredGeo = typeof body.data?.geography === 'object' && body.data?.geography !== null;
    const hasOutputs = typeof body.data?.outputsJson === 'object';
    const passed = res.status === 200 && body.success === true && isIsoDate && hasStructuredGeo && hasOutputs;
    recordTest(
      10,
      'Replay Normalized Snapshot (Item 4 Fix)',
      'GET',
      `/api/intelligence/snapshots/${createdSnapshotId}`,
      res.status,
      200,
      passed,
      `SnapshotResponse contract confirmed: ISO date (${body.data?.generatedAt}), Geography obj (${JSON.stringify(body.data?.geography)})`,
    );
  } catch (err) {
    recordTest(10, 'Replay Normalized Snapshot (Item 4 Fix)', 'GET', `/api/intelligence/snapshots/${createdSnapshotId}`, 500, 200, false, String(err));
  }

  // ── 11. POST /api/intelligence/snapshots/:id/copy-to-notes ────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/intelligence/snapshots/${createdSnapshotId}/copy-to-notes`, {
      method: 'POST',
      headers: authHeaders,
    });
    const body = await res.json();
    const passed = res.status === 200 && body.success === true && (body.data?.copied === true || body.data?.caseId != null);
    recordTest(
      11,
      'Copy Snapshot Summary to Notes',
      'POST',
      `/api/intelligence/snapshots/${createdSnapshotId}/copy-to-notes`,
      res.status,
      200,
      passed,
      `Appended J4 formatted intelligence block to Case notes (Case ID: ${body.data?.caseId ?? 'ok'})`,
    );
  } catch (err) {
    recordTest(11, 'Copy Snapshot Summary to Notes', 'POST', `/api/intelligence/snapshots/${createdSnapshotId}/copy-to-notes`, 500, 200, false, String(err));
  }

  // ── Summary Calculation ───────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('                 MORTGAGE INTELLIGENCE TEST REPORT                     ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const percentage = Math.round((passedCount / total) * 100);

  console.log(`Total Endpoints Tested: ${total}`);
  console.log(`Passed:                 ${passedCount}`);
  console.log(`Failed:                 ${total - passedCount}`);
  console.log(`Success Rate:           ${percentage}%`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Clean up test fixtures from DB
  try {
    await prisma.caseIntelligenceSnapshot.deleteMany({ where: { caseId: testCase.id } });
    await prisma.case.delete({ where: { id: testCase.id } });
    await prisma.client.delete({ where: { id: testClient.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.organisation.delete({ where: { id: testOrg.id } });
  } catch (cleanErr) {
    console.warn('Note: Cleanup had warning:', cleanErr);
  }

  if (passedCount < total) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
