import { listCasesForOrg } from '@/lib/api/cases-data';
import { listClientsForOrg } from '@/lib/api/clients-data';
import { serializeCaseSummary } from '@/lib/api/cases';
import { serializeClientSummary } from '@/lib/api/clients';
import { getOrgProfile, listInvitedAdvisersForOrg } from '@/lib/api/settings-data';
import { maskCaseFinancials, maskClientFinancials } from '@/lib/auth';
import { caseAssignedToAdviserWhere } from '@/lib/auth/adviser-scope';
import { prisma } from '@/lib/db';

const DASHBOARD_LIST_PARAMS = { page: 1, perPage: 100 } as const;

type BootstrapUser = {
  id: string;
  role: string;
  canViewAllClients?: boolean;
  canViewAccountDetails?: boolean;
  canViewAiSummaries?: boolean;
};

export async function getDashboardBootstrap(orgId: string, user: BootstrapUser) {
  const isAdviserWithRestriction = user.role === 'ADVISER' && !user.canViewAllClients;
  const hideAccountDetails = user.role === 'ADVISER' && !user.canViewAccountDetails;

  const now = new Date();
  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);
  const in90Days = new Date(now);
  in90Days.setDate(in90Days.getDate() + 90);

  const [org, clientsResult, casesResult, advisers] = await Promise.all([
    getOrgProfile(orgId, user),
    listClientsForOrg(orgId, {
      ...DASHBOARD_LIST_PARAMS,
      restrictToAdviserUserId: isAdviserWithRestriction ? user.id : undefined,
    }),
    listCasesForOrg(orgId, {
      ...DASHBOARD_LIST_PARAMS,
      restrictToAdviserUserId: isAdviserWithRestriction ? user.id : undefined,
    }),
    listInvitedAdvisersForOrg(orgId),
  ]);

  const inWindow = (value: unknown, start: number, end: number) => {
    if (!value || (typeof value !== 'string' && !(value instanceof Date))) return false;
    const at = new Date(value).getTime();
    return Number.isFinite(at) && at >= start && at <= end;
  };
  const offersEnding14d = casesResult.cases.filter((row) => {
    if (row.stage === 'COMPLETION' || row.stage === 'ARCHIVED') return false;
    const expires = 'offerExpiresAt' in row ? row.offerExpiresAt : undefined;
    return inWindow(expires, now.getTime(), in14Days.getTime());
  }).length;
  const ratesEnding90d = casesResult.cases.filter((row) => {
    if (row.stage === 'COMPLETION' || row.stage === 'ARCHIVED') return false;
    const ends = 'initialRateEndsAt' in row ? row.initialRateEndsAt : undefined;
    return inWindow(ends, now.getTime(), in90Days.getTime());
  }).length;

  let clients = clientsResult.clients.map(serializeClientSummary);
  let cases = casesResult.cases.map(serializeCaseSummary);

  if (hideAccountDetails) {
    clients = clients.map((c) => maskClientFinancials(c));
    cases = cases.map((c) => maskCaseFinancials(c));
  }

  return {
    org,
    clients,
    cases,
    advisers,
    // PRD-16 W6: radar stat cards
    offersEnding14d,
    ratesEnding90d,
    meta: {
      clients: {
        total: clientsResult.total,
        page: DASHBOARD_LIST_PARAMS.page,
        perPage: DASHBOARD_LIST_PARAMS.perPage,
      },
      cases: {
        total: casesResult.total,
        page: DASHBOARD_LIST_PARAMS.page,
        perPage: DASHBOARD_LIST_PARAMS.perPage,
      },
    },
  };
}

const PIPELINE_CASE_SELECT = {
  id: true,
  referenceNumber: true,
  clientId: true,
  type: true,
  stage: true,
  loanAmount: true,
  ltv: true,
  updatedAt: true,
  offerExpiresAt: true,
  initialRateEndsAt: true,
  client: {
    select: {
      id: true,
      clientType: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} as const;

/**
 * Case rows for the overview kanban only.
 * Skips client lists, adviser invites, and per-row message/document counts
 * so the board can render before the full bootstrap finishes.
 */
export async function getDashboardPipeline(orgId: string, user: BootstrapUser) {
  const isAdviserWithRestriction = user.role === 'ADVISER' && !user.canViewAllClients;
  const hideAccountDetails = user.role === 'ADVISER' && !user.canViewAccountDetails;

  const rows = await prisma.case.findMany({
    where: {
      orgId,
      ...(isAdviserWithRestriction ? caseAssignedToAdviserWhere(user.id) : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: DASHBOARD_LIST_PARAMS.perPage,
    select: PIPELINE_CASE_SELECT,
  });

  let cases = rows.map((row) =>
    serializeCaseSummary({
      ...row,
      adviser: null,
      _count: { messages: 0, documents: 0 },
    }),
  );

  if (hideAccountDetails) {
    cases = cases.map((row) => maskCaseFinancials(row));
  }

  return cases;
}
