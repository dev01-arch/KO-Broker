import { listCasesForOrg } from '@/lib/api/cases-data';
import { listClientsForOrg } from '@/lib/api/clients-data';
import { serializeCaseSummary } from '@/lib/api/cases';
import { serializeClientSummary } from '@/lib/api/clients';
import { getOrgProfile, listInvitedAdvisersForOrg } from '@/lib/api/settings-data';
import { maskCaseFinancials, maskClientFinancials } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { caseAssignedToAdviserWhere } from '@/lib/auth/adviser-scope';

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

  // Adviser scope filter for radar counts (mirrors list scoping)
  const adviserScope = isAdviserWithRestriction
    ? caseAssignedToAdviserWhere(user.id)
    : {};

  const activeStages = { stage: { notIn: ['COMPLETION', 'ARCHIVED'] as ('COMPLETION' | 'ARCHIVED')[] } };

  const [org, clientsResult, casesResult, advisers, offersEnding14d, ratesEnding90d] =
    await Promise.all([
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
      // PRD-16 W6: offers ending within 14 days
      prisma.case.count({
        where: {
          orgId,
          ...activeStages,
          ...adviserScope,
          offerExpiresAt: { gte: now, lte: in14Days },
        },
      }),
      // PRD-16 W6: initial rate periods ending within 90 days
      prisma.case.count({
        where: {
          orgId,
          ...activeStages,
          ...adviserScope,
          initialRateEndsAt: { gte: now, lte: in90Days },
        },
      }),
    ]);

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
