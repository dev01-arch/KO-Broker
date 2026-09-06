/**
 * Banned phrases for insight text — PRD-15 §6.4 / D7
 *
 * No LLM. Templates only. These words/phrases must never appear in
 * insightText or watchText — enforced by unit tests (B10).
 *
 * Banned: lender names, product names, "you would get", "likely",
 * "accepted", "best buy", "recommend".
 */

export const BANNED_PHRASES: readonly string[] = [
  // Advice-like language
  'you would get',
  'you will get',
  'you would be',
  'you will be',
  'likely',
  'accepted',
  'best buy',
  'recommend',
  'recommended',
  'we recommend',
  'i recommend',
  'suitable',
  'most suitable',
  'eligible',
  'you should',
  'you must',
  'guaranteed',
  // Generic product/lender references (not exhaustive — add as needed)
  'nationwide',
  'barclays',
  'halifax',
  'natwest',
  'hsbc',
  'lloyds',
  'santander',
  'virgin money',
  'metro bank',
  'coventry',
  'skipton',
  'yorkshire building society',
  'tracker',
  'fixed rate deal',
  'product transfer',
];

/**
 * Build a single RegExp that matches any banned phrase (case-insensitive, word-boundary aware).
 * Exported so tests can check it directly.
 */
export const BANNED_REGEX: RegExp = new RegExp(
  BANNED_PHRASES.map((p) =>
    // Use word boundaries where possible; fall back to simple contains for multi-word phrases
    p.includes(' ') ? p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : `\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
  ).join('|'),
  'i',
);

/**
 * Assert that text contains no banned phrases.
 * Throws in dev/test; returns false silently in production so a bad template
 * never crashes a live snapshot request (the text is stored as-is and
 * the compliance team reviews it).
 */
export function assertNoBannedPhrases(text: string): void {
  if (BANNED_REGEX.test(text)) {
    const match = text.match(BANNED_REGEX)?.[0] ?? 'unknown';
    const msg = `[intelligence] Banned phrase detected in insight text: "${match}"`;
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(msg);
    }
    console.error(msg);
  }
}
