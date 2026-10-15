export const RATING_OPTIONS = [
  'Better than expected',
  'As expected',
  'Below expectation',
  'Not Applicable',
] as const;

export const YES_NO_OPTIONS = ['Yes', 'No'] as const;

export const EXPERIENCE_QUESTIONS = [
  { id: 'exp-explanation', label: 'The explanation given to you about the service offered by the firm:' },
  { id: 'exp-process', label: 'The process the broker went through to gain an understanding of your needs and circumstances:' },
  { id: 'exp-product', label: 'The explanation the broker gave you about the product:' },
  { id: 'exp-fees', label: 'The clarification and explanation of how the firm is to be paid:' },
  { id: 'exp-pressure', label: 'The ability of the broker to put you at ease and not make you feel you were under any undue pressure:' },
  { id: 'exp-timely', label: 'The timely delivery of the service and the arrangement of the product:' },
] as const;

export const COMMUNICATION_QUESTIONS = [
  { id: 'com-meetings', label: 'The timing and delivery of client meeting(s)?' },
  { id: 'com-documents', label: 'The clarity of any letters and any other documentation provided to you:' },
  { id: 'com-queries', label: 'The way you were treated by the firm when raising any queries:' },
  { id: 'com-overall', label: 'The overall standard of the communications received from the firm:' },
] as const;

export const YES_NO_QUESTIONS = [
  { id: 'outcome', label: 'Did you receive the outcome from our service that you expected? If no, please provide details in the comments box at the end:' },
  { id: 'support', label: 'Did the broker provide you with the necessary support to engage with the service? If no, please provide details in the comments box at the end:' },
  { id: 'value', label: 'Did you feel like you got value for money? If no, please provide details in the comments box at the end.' },
  { id: 'recommend', label: 'Would you recommend us to friends, relatives or colleagues? If no, please provide details in the comments box at the end.' },
] as const;

export const TEXT_QUESTIONS = [
  { id: 'stillQuestions', label: 'Do you still have any questions about the service or the product arranged?' },
  { id: 'improve', label: 'How can we improve the service we offer?' },
] as const;

const RATING_QUESTIONS = [...EXPERIENCE_QUESTIONS, ...COMMUNICATION_QUESTIONS];

/** Choice questions, kept for the public survey payload. */
export const FEEDBACK_QUESTIONS = [
  ...RATING_QUESTIONS.map((question) => ({ ...question, options: [...RATING_OPTIONS] })),
  ...YES_NO_QUESTIONS.map((question) => ({ ...question, options: [...YES_NO_OPTIONS] })),
] as const;

export type FeedbackAnswers = Record<string, string>;

const DATE_RE = /^(\d{2})-(\d{2})-(\d{4})$/;

export function feedbackDateValid(value: string): boolean {
  const match = DATE_RE.exec(value.trim());
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function surveyBelowExpected(answers: FeedbackAnswers): boolean {
  const ratingLow = RATING_QUESTIONS.some((question) => answers[question.id] === 'Below expectation');
  const answeredNo = YES_NO_QUESTIONS.some((question) => answers[question.id] === 'No');
  return ratingLow || answeredNo;
}

export function feedbackAnswersValid(answers: FeedbackAnswers): boolean {
  const ratings = RATING_QUESTIONS.every((question) =>
    (RATING_OPTIONS as readonly string[]).includes(answers[question.id] ?? ''),
  );
  const yesNo = YES_NO_QUESTIONS.every((question) =>
    (YES_NO_OPTIONS as readonly string[]).includes(answers[question.id] ?? ''),
  );
  const texts = TEXT_QUESTIONS.every((question) => {
    const value = (answers[question.id] ?? '').trim();
    return value.length > 0 && value.length <= 2000;
  });
  const firstName = (answers.firstName ?? '').trim();
  const lastName = (answers.lastName ?? '').trim();
  const comment = (answers.comment ?? '').trim();
  return (
    ratings &&
    yesNo &&
    texts &&
    firstName.length > 0 &&
    firstName.length <= 80 &&
    lastName.length > 0 &&
    lastName.length <= 80 &&
    feedbackDateValid(answers.responseDate ?? '') &&
    comment.length > 0 &&
    comment.length <= 2000
  );
}

export type SurveyReport = {
  from: string;
  to: string;
  sent: number;
  responses: number;
  belowExpected: number;
};

export function summarizeFeedbackSurveys(
  rows: Array<{ sentAt?: string | null; submittedAt?: string | null; belowExpected?: boolean }>,
  range: { from: string; to: string },
): SurveyReport {
  const from = range.from;
  const to = range.to;
  const inRange = (value?: string | null) => {
    if (!value) return false;
    const day = value.slice(0, 10);
    return day >= from && day <= to;
  };
  const sent = rows.filter((row) => inRange(row.sentAt)).length;
  const responded = rows.filter((row) => inRange(row.submittedAt));
  return {
    from,
    to,
    sent,
    responses: responded.length,
    belowExpected: responded.filter((row) => row.belowExpected).length,
  };
}
