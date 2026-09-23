/**
 * PRD-16 W1 lender directory search.
 * Run: node --experimental-strip-types --test lib/lenders/directory.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LENDER_DIRECTORY_SEED,
  OTHER_LENDER_NAME,
  findLenderName,
  normalizeLenderName,
  resolveLenderSelection,
  searchLenders,
} from './directory.ts';

describe('searchLenders', () => {
  it('returns Clydesdale Bank PLC for clydes', () => {
    const names = searchLenders('clydes').map((hit) => hit.name);
    assert.ok(names.includes('Clydesdale Bank PLC'));
  });

  it('always appends Other last', () => {
    const hits = searchLenders('natwest');
    assert.equal(hits.at(-1)?.name, OTHER_LENDER_NAME);
    assert.equal(hits.at(-1)?.isOther, true);
    assert.ok(hits.some((hit) => hit.name === 'NatWest'));
  });

  it('keeps Other last on empty query and respects limit', () => {
    const hits = searchLenders('', 5);
    assert.equal(hits.length, 6);
    assert.equal(hits.at(-1)?.isOther, true);
    assert.equal(hits.filter((hit) => hit.isOther).length, 1);
  });

  it('does not treat Coutts as Couts', () => {
    assert.equal(findLenderName('Couts'), null);
    assert.equal(findLenderName('Coutts'), 'Coutts');
  });
});

describe('normalizeLenderName', () => {
  it('strips punctuation for dedupe', () => {
    assert.equal(normalizeLenderName('Clydesdale Bank PLC'), 'clydesdale bank plc');
    assert.equal(normalizeLenderName('LV — Liverpool Victoria'), 'lv liverpool victoria');
  });
});

describe('resolveLenderSelection', () => {
  it('maps a directory name', () => {
    const resolved = resolveLenderSelection('  NatWest ');
    assert.equal(resolved.selectedName, 'NatWest');
    assert.equal(resolved.otherName, '');
  });

  it('maps unknown names to Other', () => {
    const resolved = resolveLenderSelection('Cornerstone Bridging Ltd');
    assert.equal(resolved.selectedName, OTHER_LENDER_NAME);
    assert.equal(resolved.otherName, 'Cornerstone Bridging Ltd');
  });
});

describe('seed uniqueness', () => {
  it('has unique normalised names', () => {
    const seen = new Set<string>();
    for (const name of LENDER_DIRECTORY_SEED) {
      const key = normalizeLenderName(name);
      assert.equal(seen.has(key), false, `duplicate: ${name}`);
      seen.add(key);
    }
  });
});
