import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBoEResponse } from './boe-ingest.ts';

describe('parseBoEResponse', () => {
  it('parses tab-delimited CSV/TSV data correctly', () => {
    const tsvData = `Title\tMonthly average of quoted rates on new business 2 year fixed, 75 per cent LTV
2024 Jul\t4.53
2024 Aug\t4.41
2024 Sep\t4.43
`;
    const parsed = parseBoEResponse(tsvData, 'IUMBV42');
    assert.ok(parsed);
    assert.equal(parsed.value, 4.43);
    assert.equal(parsed.validFrom.toISOString(), '2024-09-01T00:00:00.000Z');
    assert.equal(parsed.rawRef, 'IUMBV42@2024 Sep');
  });

  it('parses comma-delimited data correctly and skips trailing empty or invalid rows', () => {
    const csvData = `"Title","Monthly average"
"2024 Jul","4.53"
"2024 Aug","4.41"
"2024 Sep","."
`;
    const parsed = parseBoEResponse(csvData, 'IUMBV42');
    assert.ok(parsed);
    assert.equal(parsed.value, 4.41);
    assert.equal(parsed.validFrom.toISOString(), '2024-08-01T00:00:00.000Z');
  });

  it('parses HTML tables returned by the BoE interactive database', () => {
    const htmlData = `
<!DOCTYPE html>
<html>
<body>
  <table class="data-table">
    <thead>
      <tr><th>Date</th><th>Rate (%)</th></tr>
    </thead>
    <tbody>
      <tr><td>31 Jul 2024</td><td>4.53</td></tr>
      <tr><td>31 Aug 2024</td><td>4.41</td></tr>
      <tr><td>30 Sep 2024</td><td>4.43</td></tr>
    </tbody>
  </table>
</body>
</html>
`;
    const parsed = parseBoEResponse(htmlData, 'IUMBV42');
    assert.ok(parsed);
    assert.equal(parsed.value, 4.43);
    assert.equal(parsed.validFrom.toISOString(), '2024-09-01T00:00:00.000Z');
  });

  it('returns null when response contains no parseable data rows', () => {
    const emptyHtml = `
<!DOCTYPE html>
<html>
<body>
  <div>Please search again</div>
</body>
</html>
`;
    const parsed = parseBoEResponse(emptyHtml, 'IUMBV42');
    assert.equal(parsed, null);
  });
});
