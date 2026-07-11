import { listCasesForOrg } from '@/lib/api/cases-data';
import { listClientsForOrg } from '@/lib/api/clients-data';
import { serializeCaseSummary } from '@/lib/api/cases';
import { serializeClientSummary } from '@/lib/api/clients';
import { getOrgProfile, listAdvisersForOrg } from '@/lib/api/settings-data';

const DASHBOARD_LIST_PARAMS = { page: 1, perPage: 100 } as const;

export async function getDashboardBootstrap(
  orgId: string,
  user: { role: string },
) {
  const [org, clientsResult, casesResult, advisers] = await Promise.all([
    getOrgProfile(orgId, user),
    listClientsForOrg(orgId, DASHBOARD_LIST_PARAMS),
    listCasesForOrg(orgId, DASHBOARD_LIST_PARAMS),
    listAdvisersForOrg(orgId),
  ]);

  return {
    org,
    clients: clientsResult.clients.map(serializeClientSummary),
    cases: casesResult.cases.map(serializeCaseSummary),
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
