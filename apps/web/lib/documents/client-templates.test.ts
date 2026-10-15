import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clientTemplateCatalog,
  isOutboundFeedbackSurvey,
  readClientTemplate,
} from './client-templates.ts';

describe('client document templates', () => {
  it('includes the disclosure, privacy, terms, and survey files', async () => {
    const catalog = clientTemplateCatalog();
    for (const id of ['idd', 'privacy', 'tob', 'survey'] as const) {
      assert.equal(catalog.find((entry) => entry.id === id)?.available, true, id);
      const file = await readClientTemplate(id);
      assert.ok(file && file.content.byteLength > 1000, id);
    }

    const idd = await readClientTemplate('idd');
    const privacy = await readClientTemplate('privacy');
    const tob = await readClientTemplate('tob');
    const survey = await readClientTemplate('survey');
    assert.match(idd!.storedName, /initial disclosure/i);
    assert.match(privacy!.storedName, /privacy/i);
    assert.match(tob!.storedName, /terms of business/i);
    assert.equal(isOutboundFeedbackSurvey(survey!.storedName), true);
    assert.equal(isOutboundFeedbackSurvey('Survey response.pdf'), false);
  });

  it('does not provide a research pack or ESIS template', () => {
    const catalog = clientTemplateCatalog();
    assert.equal(catalog.find((entry) => entry.id === 'research')?.available, false);
    assert.equal(catalog.find((entry) => entry.id === 'esis')?.available, false);
  });
});
