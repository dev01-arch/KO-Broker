/**
 * PRD-16 W2 overview helpers.
 * Run: node --experimental-strip-types --test lib/cases/overview-ops.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appendNoteThread, dateInputToIso, isoToDateInput, parseNoteThread } from './overview-ops.ts';

describe('parseNoteThread', () => {
  it('returns empty for blank notes', () => {
    assert.deepEqual(parseNoteThread(''), []);
  });

  it('keeps a legacy single string as one entry', () => {
    const entries = parseNoteThread('Suitable because of rate and ERC.');
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.body, 'Suitable because of rate and ERC.');
  });

  it('splits stamped blocks', () => {
    const raw = '[21 Sep 2026, 23:14]\nNew figure\n\n[21 Sep 2026, 22:01]\nFirst note';
    const entries = parseNoteThread(raw);
    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.at, '21 Sep 2026, 23:14');
    assert.equal(entries[1]?.body, 'First note');
  });
});

describe('appendNoteThread', () => {
  it('prepends a stamped block without dropping the previous note', () => {
    const next = appendNoteThread('Older note', 'Fresh note', new Date('2026-09-21T22:14:00Z'));
    assert.match(next, /^\[/);
    assert.match(next, /Fresh note/);
    assert.match(next, /Older note/);
  });
});

describe('date spine ISO helpers', () => {
  it('maps a date input to midnight UTC and back', () => {
    assert.equal(dateInputToIso('2026-09-30'), '2026-09-30T00:00:00.000Z');
    assert.equal(isoToDateInput('2026-09-30T00:00:00.000Z'), '2026-09-30');
  });

  it('clears empty dates as null', () => {
    assert.equal(dateInputToIso(''), null);
    assert.equal(isoToDateInput(null), '');
  });
});
