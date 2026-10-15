import { prisma } from '@/lib/db';
import { caseAssignedToAdviserWhere } from '@/lib/auth/adviser-scope';
import { vulnerabilityReportRange } from '@/lib/reports/vulnerability-report';
import { summarizeFeedbackSurveys, type SurveyReport } from '@/lib/survey/feedback-survey';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function getSurveyReportForOrg(
  orgId: string,
  asOf?: string | null,
  options?: { restrictToAdviserUserId?: string },
): Promise<SurveyReport> {
  const range = vulnerabilityReportRange(asOf);
  const adviser = options?.restrictToAdviserUserId;
  const factFinds = await prisma.factFind.findMany({
    where: {
      case: {
        orgId,
        ...(adviser ? caseAssignedToAdviserWhere(adviser) : {}),
      },
    },
    select: { clientPreferences: true },
    take: 5000,
  });
  const rows = factFinds.map((row) => {
    const preferences = asRecord(row.clientPreferences);
    const access = asRecord(preferences?.surveyAccess);
    const response = asRecord(preferences?.feedbackSurvey);
    return {
      sentAt: typeof access?.sentAt === 'string' ? access.sentAt : null,
      submittedAt: typeof response?.submittedAt === 'string' ? response.submittedAt : null,
      belowExpected: response?.belowExpected === true,
    };
  });
  return summarizeFeedbackSurveys(rows, { from: range.fromLabel, to: range.toLabel });
}
