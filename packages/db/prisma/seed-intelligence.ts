/**
 * Seed initial Mortgage Intelligence data — PRD-15
 *
 * Populates:
 * 1. RateSeriesPoint:
 *    - Current and 12-month historical benchmark points for all 5 BoE series
 *      (FIXED_2YR_75LTV, FIXED_5YR_75LTV, VARIABLE_75LTV, EFFECTIVE_NEW, EFFECTIVE_OUTSTANDING)
 *    - Ensures Overview cards show real values and 12m changes.
 *    - Ensures marketSignal computes as IMPROVING (-45bps / -42bps).
 *    - Prevents 503 RATE_DATA_NOT_READY on snapshot generation.
 * 2. LocalPriceStat:
 *    - Typical London / UK outward codes (SW1A, E1, NW1, W1, M1, B1) so snapshot
 *      local median price comparisons work.
 * 3. DataFeedStatus:
 *    - Sets healthy status for 'BOE_RATES' and 'HMLR_PRICES'.
 */

import { PrismaClient } from '@prisma/client';

let databaseUrl = process.env.DATABASE_URL ?? '';
if (databaseUrl && !databaseUrl.includes('connection_limit')) {
  const delimiter = databaseUrl.includes('?') ? '&' : '?';
  databaseUrl = `${databaseUrl}${delimiter}connection_limit=1&pool_timeout=60`;
}

const prisma = new PrismaClient({
  datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
});

async function seedIntelligence() {
  console.log('📊 Seeding Mortgage Intelligence data...');

  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const twelveMonthsAgo = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));

  // ── 1. RateSeriesPoint ───────────────────────────────────────────────────
  const seriesData = [
    {
      seriesId: 'IUMBV42',
      label: '2yr Fixed (75% LTV)',
      currentVal: 4.43,
      historicalVal: 4.88, // -45 bps (Improving)
      rawRefCurrent: 'IUMBV42@latest',
      rawRefHist: 'IUMBV42@12m_ago',
    },
    {
      seriesId: 'IUMBV44',
      label: '5yr Fixed (75% LTV)',
      currentVal: 4.18,
      historicalVal: 4.60, // -42 bps (Improving)
      rawRefCurrent: 'IUMBV44@latest',
      rawRefHist: 'IUMBV44@12m_ago',
    },
    {
      seriesId: 'IUMBV46',
      label: 'Variable Rate (75% LTV)',
      currentVal: 5.75,
      historicalVal: 6.25, // -50 bps
      rawRefCurrent: 'IUMBV46@latest',
      rawRefHist: 'IUMBV46@12m_ago',
    },
    {
      seriesId: 'IUMWTFA',
      label: 'Effective Rate (New)',
      currentVal: 4.35,
      historicalVal: 4.70, // -35 bps
      rawRefCurrent: 'IUMWTFA@latest',
      rawRefHist: 'IUMWTFA@12m_ago',
    },
    {
      seriesId: 'IUMTLMV',
      label: 'Effective Rate (Outstanding)',
      currentVal: 3.75,
      historicalVal: 3.50, // +25 bps
      rawRefCurrent: 'IUMTLMV@latest',
      rawRefHist: 'IUMTLMV@12m_ago',
    },
  ];

  for (const s of seriesData) {
    // 12m ago historical point (validTo closed out)
    await prisma.rateSeriesPoint.deleteMany({
      where: {
        seriesId: s.seriesId,
        validFrom: { in: [twelveMonthsAgo, currentMonthStart] },
      },
    });

    await prisma.rateSeriesPoint.create({
      data: {
        seriesId: s.seriesId,
        label: s.label,
        value: s.historicalVal,
        validFrom: twelveMonthsAgo,
        validTo: currentMonthStart,
        retrievedAt: now,
        source: 'BOE_API',
        rawRef: s.rawRefHist,
      },
    });

    // Current point (validTo: null)
    await prisma.rateSeriesPoint.create({
      data: {
        seriesId: s.seriesId,
        label: s.label,
        value: s.currentVal,
        validFrom: currentMonthStart,
        validTo: null,
        retrievedAt: now,
        source: 'BOE_API',
        rawRef: s.rawRefCurrent,
      },
    });
  }
  console.log('✅ Rate series points seeded for 5 series (current + 12m ago)');

  // ── 2. LocalPriceStat ────────────────────────────────────────────────────
  const sampleStats = [
    {
      outwardCode: 'SW1A',
      medianPrice: 850_000,
      medianPrice12m: 820_000,
      change12mPct: 3.65,
      txnCount12m: 48,
    },
    {
      outwardCode: 'E1',
      medianPrice: 520_000,
      medianPrice12m: 510_000,
      change12mPct: 1.96,
      txnCount12m: 112,
    },
    {
      outwardCode: 'NW1',
      medianPrice: 710_000,
      medianPrice12m: 690_000,
      change12mPct: 2.89,
      txnCount12m: 85,
    },
    {
      outwardCode: 'W1',
      medianPrice: 1_250_000,
      medianPrice12m: 1_200_000,
      change12mPct: 4.16,
      txnCount12m: 62,
    },
    {
      outwardCode: 'M1',
      medianPrice: 245_000,
      medianPrice12m: 235_000,
      change12mPct: 4.25,
      txnCount12m: 130,
    },
    {
      outwardCode: 'B1',
      medianPrice: 220_000,
      medianPrice12m: 215_000,
      change12mPct: 2.32,
      txnCount12m: 95,
    },
  ];

  for (const stat of sampleStats) {
    await prisma.localPriceStat.upsert({
      where: {
        outwardCode_asOf: {
          outwardCode: stat.outwardCode,
          asOf: currentMonthStart,
        },
      },
      create: {
        outwardCode: stat.outwardCode,
        asOf: currentMonthStart,
        medianPrice: stat.medianPrice,
        medianPrice12m: stat.medianPrice12m,
        change12mPct: stat.change12mPct,
        txnCount12m: stat.txnCount12m,
        retrievedAt: now,
        source: 'HMLR_PPD',
      },
      update: {
        medianPrice: stat.medianPrice,
        medianPrice12m: stat.medianPrice12m,
        change12mPct: stat.change12mPct,
        txnCount12m: stat.txnCount12m,
        retrievedAt: now,
      },
    });
  }
  console.log('✅ Local price stats seeded for outward codes: SW1A, E1, NW1, W1, M1, B1');

  // ── 3. DataFeedStatus ────────────────────────────────────────────────────
  const feeds = [
    { feedId: 'BOE_RATES', lastSuccessAt: now, lastAttemptAt: now, lastError: null },
    { feedId: 'HMLR_PRICES', lastSuccessAt: now, lastAttemptAt: now, lastError: null },
    { feedId: 'POSTCODES_IO', lastSuccessAt: now, lastAttemptAt: now, lastError: null },
  ];

  for (const f of feeds) {
    await prisma.dataFeedStatus.upsert({
      where: { feedId: f.feedId },
      create: f,
      update: f,
    });
  }
  console.log('✅ Data feed status initialized for BOE_RATES, HMLR_PRICES, POSTCODES_IO');
}

seedIntelligence()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
