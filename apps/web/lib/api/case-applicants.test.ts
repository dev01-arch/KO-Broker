import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCaseApplicants } from './cases.ts';

describe('case applicants', () => {
  it('keeps a second applicant on the same case', () => {
    const joint = readCaseApplicants({
      hasJointApplicant: true,
      portalFactFindForm: {
        hasJointApplicant: true,
        client2Personal: { firstName: 'Jordan', lastName: 'Khan' },
      },
    });
    assert.equal(joint.applicantMode, 'joint');
    assert.equal(joint.jointApplicantName, 'Jordan Khan');
  });

  it('stays single when there is no second applicant', () => {
    assert.deepEqual(readCaseApplicants({ hasJointApplicant: false }), {
      applicantMode: 'single',
    });
    assert.deepEqual(readCaseApplicants(null), { applicantMode: 'single' });
  });
});
