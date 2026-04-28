/**
 * Database seed script — PRD-03
 *
 * Seeds realistic demo data:
 * - 1 Organisation: KO Financials (PROFESSIONAL plan)
 * - 3 Users: Admin (Sarah Davies), Adviser (James Osei), Compliance officer
 * - 15 LenderCriteria records
 * - 6 Clients across all employment types
 * - 6 Cases across all pipeline stages
 * - FactFinds, ProductConsidered, ComplianceRecords
 * - 1 complete approved SuitabilityReport
 * - Sample AuditLog and Message records
 */

// import { PrismaClient } from '@prisma/client';
// const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // TODO (PRD-03): Implement full seed script

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  });
