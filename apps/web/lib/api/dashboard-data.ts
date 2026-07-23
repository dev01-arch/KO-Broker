import { listCasesForOrg } from '@/lib/api/cases-data';
import { listClientsForOrg } from '@/lib/api/clients-data';
import { serializeCaseSummary } from '@/lib/api/cases';
import { serializeClientSummary } from '@/lib/api/clients';
import { getOrgProfile, listInvitedAdvisersForOrg } from '@/lib/api/settings-data';
import { maskCaseFinancials, maskClientFinancials } from '@/lib/auth';

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
