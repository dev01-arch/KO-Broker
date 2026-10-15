import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { feedbackAnswersValid, summarizeFeedbackSurveys, surveyBelowExpected } from './feedback-survey.ts';

const complete = {
  firstName: 'Amira',
  lastName: 'Khan',
  responseDate: '15-10-2026',
  'exp-explanation': 'As expected',
  'exp-process': 'As expected',
  'exp-product': 'As expected',
  'exp-fees': 'As expected',
  'exp-pressure': 'Better than expected',
  'exp-timely': 'Not Applicable',
  'com-meetings': 'As expected',
  'com-documents': 'As expected',
  'com-queries': 'As expected',
  'com-overall': 'As expected',
  outcome: 'Yes',
  support: 'Yes',
  value: 'Yes',
  recommend: 'Yes',
  stillQuestions: 'No further questions.',
  improve: 'Nothing to add.',
  comment: 'Clear throughout.',
};

describe('feedback survey', () => {
  it('accepts a complete Jotform response and flags a below-expectation or a no', () => {
    assert.equal(feedbackAnswersValid(complete), true);
    assert.equal(surveyBelowExpected(complete), false);
    assert.equal(surveyBelowExpected({ ...complete, 'exp-product': 'Below expectation' }), true);
    assert.equal(surveyBelowExpected({ ...complete, recommend: 'No' }), true);
    assert.equal(feedbackAnswersValid({ ...complete, responseDate: '2026-10-15' }), false);
  });

  it('counts sends and responses inside the chosen dates only', () => {
    const report = summarizeFeedbackSurveys(
      [
        { sentAt: '2026-02-01', submittedAt: '2026-02-02', belowExpected: false },
        { sentAt: '2026-03-01', submittedAt: '2026-03-02', belowExpected: true },
        { sentAt: '2025-12-01', submittedAt: '2025-12-02', belowExpected: true },
        { sentAt: '2026-04-01' },
      ],
      { from: '2026-01-01', to: '2026-10-14' },
    );
    assert.equal(report.sent, 3);
    assert.equal(report.responses, 2);
    assert.equal(report.belowExpected, 1);
  });
});
