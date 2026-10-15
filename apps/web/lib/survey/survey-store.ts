import { randomBytes } from 'node:crypto';
import { Prisma } from '@ko/db';
import { prisma } from '@/lib/db';
import { createDocumentForOrg } from '@/lib/api/documents-data';
import { sendComplianceEmail } from '@/lib/notifications/email';
import { uploadToR2 } from '@/lib/storage/r2';
import {
  COMMUNICATION_QUESTIONS,
  EXPERIENCE_QUESTIONS,
  FEEDBACK_QUESTIONS,
  TEXT_QUESTIONS,
  YES_NO_QUESTIONS,
  feedbackAnswersValid,
  surveyBelowExpected,
  type FeedbackAnswers,
} from '@/lib/survey/feedback-survey';

const SURVEY_DAYS = 120;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function mergePreferences(
  caseId: string,
  existing: unknown,
  patch: Record<string, unknown>,
) {
  const previous = asRecord(existing) ?? {};
  const clientPreferences = { ...previous, ...patch } as Prisma.InputJsonValue;
  return prisma.factFind.upsert({
    where: { caseId },
    create: { caseId, clientPreferences },
    update: { clientPreferences },
  });
}

export async function sendCaseSurveyLink(input: {
  orgId: string;
  caseId: string;
  origin: string;
  userId?: string;
}) {
  const caseRecord = await prisma.case.findFirst({
    where: { id: input.caseId, orgId: input.orgId },
    include: {
      client: { select: { id: true, firstName: true, email: true } },
      factFind: { select: { clientPreferences: true } },
      organisation: { select: { name: true } },
    },
  });
  if (!caseRecord) return { ok: false as const, code: 'NOT_FOUND' as const, message: 'Case not found' };
  const email = caseRecord.client.email?.trim();
  if (!email) return { ok: false as const, code: 'NO_EMAIL' as const, message: 'This client has no email address.' };

  const token = randomBytes(24).toString('hex');
  const sentAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SURVEY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await mergePreferences(caseRecord.id, caseRecord.factFind?.clientPreferences, {
    surveyAccess: { token, sentAt, expiresAt },
  });

  const link = `${input.origin.replace(/\/$/, '')}/survey/${token}`;
  const firm = caseRecord.organisation?.name || 'Your adviser';
  const safeName = (caseRecord.client.firstName || 'Client').replace(/[&<>"]/g, '');
  const sent = await sendComplianceEmail({
    orgId: input.orgId,
    caseId: caseRecord.id,
    clientId: caseRecord.client.id,
    to: email,
    subject: 'We would like your feedback',
    body: `Please tell us about the service you received: ${link}`,
    html: `<p>Dear ${safeName},</p><p>${firm} would like your feedback on the service you received.</p><p><a href="${link}">Open the feedback survey</a></p>`,
  });
  if (!sent) return { ok: false as const, code: 'DELIVERY_FAILED' as const, message: 'The email could not be delivered.' };

  const note = Buffer.from(`Feedback survey link sent ${sentAt}\n`);
  const storageUrl = await uploadToR2(
    note,
    `orgs/${input.orgId}/cases/${caseRecord.id}/survey-sent-${Date.now()}.txt`,
    'text/plain',
  );
  await createDocumentForOrg(input.orgId, {
    name: 'Client Feedback Survey sent.txt',
    documentType: 'COMPLIANCE',
    caseId: caseRecord.id,
    clientId: caseRecord.client.id,
    storageUrl,
    mimeType: 'text/plain',
    sizeBytes: note.byteLength,
    uploadedBy: input.userId,
  });

  return { ok: true as const, sent: true };
}

export async function readSurveyInvite(token: string) {
  const factFind = await prisma.factFind.findFirst({
    where: { clientPreferences: { path: ['surveyAccess', 'token'], equals: token } },
    include: {
      case: {
        include: {
          organisation: { select: { name: true } },
          client: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!factFind) return { error: 'NOT_FOUND' as const };
  const access = asRecord(asRecord(factFind.clientPreferences)?.surveyAccess);
  const expiresAt = typeof access?.expiresAt === 'string' ? access.expiresAt : '';
  if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) return { error: 'EXPIRED' as const };
  const response = asRecord(asRecord(factFind.clientPreferences)?.feedbackSurvey);
  return {
    factFind,
    firmName: factFind.case.organisation?.name || 'Your adviser',
    firstName: factFind.case.client.firstName || '',
    lastName: factFind.case.client.lastName || '',
    submitted: Boolean(response?.submittedAt),
  };
}

export async function saveSurveyResponse(token: string, answers: FeedbackAnswers, comment: string) {
  const stored: FeedbackAnswers = {
    ...Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, String(value ?? '').trim()])),
    comment: comment.trim(),
  };
  if (!feedbackAnswersValid(stored)) {
    return { ok: false as const, message: 'Please answer each question.' };
  }
  const invite = await readSurveyInvite(token);
  if ('error' in invite) {
    return { ok: false as const, message: invite.error === 'EXPIRED' ? 'This survey link has expired.' : 'This survey link is not valid.' };
  }
  if (invite.submitted) return { ok: true as const, alreadySubmitted: true };

  const submittedAt = new Date().toISOString();
  const belowExpected = surveyBelowExpected(stored);
  const savedComment = stored.comment.slice(0, 2000);
  await mergePreferences(invite.factFind.caseId, invite.factFind.clientPreferences, {
    feedbackSurvey: { submittedAt, answers: stored, comment: savedComment, belowExpected },
  });

  const lines = [
    `Submitted ${submittedAt}`,
    `Name: ${stored.firstName} ${stored.lastName}`,
    `Date: ${stored.responseDate}`,
    `Below expected: ${belowExpected ? 'yes' : 'no'}`,
    '',
    'Your experience',
    ...EXPERIENCE_QUESTIONS.map((question) => `${question.label} ${stored[question.id]}`),
    '',
    'Communications',
    ...COMMUNICATION_QUESTIONS.map((question) => `${question.label} ${stored[question.id]}`),
    '',
    ...YES_NO_QUESTIONS.map((question) => `${question.label} ${stored[question.id]}`),
    ...TEXT_QUESTIONS.map((question) => `${question.label} ${stored[question.id]}`),
    '',
    `Additional comments: ${savedComment}`,
  ];
  const body = Buffer.from(`${lines.join('\n')}\n`);
  const storageUrl = await uploadToR2(
    body,
    `orgs/${invite.factFind.case.orgId}/cases/${invite.factFind.caseId}/survey-response-${Date.now()}.txt`,
    'text/plain',
  );
  await createDocumentForOrg(invite.factFind.case.orgId, {
    name: 'Survey response.txt',
    documentType: 'COMPLIANCE',
    caseId: invite.factFind.caseId,
    clientId: invite.factFind.case.clientId,
    storageUrl,
    mimeType: 'text/plain',
    sizeBytes: body.byteLength,
  });

  return { ok: true as const, alreadySubmitted: false };
}

export { FEEDBACK_QUESTIONS };
