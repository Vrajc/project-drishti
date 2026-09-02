// ============================================================================
// Plate normalisation and matching.
//
// Kept separate from the match engine so it can be reasoned about, and tested,
// without Redis or a database in the way. Everything here is a pure function.
//
// The one rule that governs this file: a score is COMPUTED from the edit
// distance between two normalised plates. It is never assigned a
// plausible-looking constant, and a fuzzy match never borrows an exact match's
// confidence.
// ============================================================================

/**
 * Characters an OCR engine confuses on a number plate, folded to one side.
 *
 * This is deliberately narrow. Folding more pairs (S/5, B/8, Z/2) would raise
 * the hit rate and also start matching plates that are genuinely different -
 * on a watchlist, a false positive sends officers to the wrong vehicle.
 */
const CONFUSIONS: Record<string, string> = {
  O: '0',
  Q: '0',
  I: '1',
  L: '1',
};

/**
 * Canonical form used for comparison: uppercase, everything that is not a
 * letter or digit removed, then the confusable characters folded.
 *
 * The original text is always kept alongside this. Showing an operator a
 * normalised plate they did not type would be its own small lie.
 */
export function normalisePlate(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;

  const stripped = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (stripped === '') return null;

  let folded = '';
  for (const character of stripped) {
    folded += CONFUSIONS[character] ?? character;
  }
  return folded;
}

/**
 * Levenshtein distance, bounded.
 *
 * Returns `limit + 1` as soon as every cell in a row exceeds the limit, so a
 * comparison against a long, unrelated plate stops early instead of filling the
 * whole matrix. The exact value above the limit is never used.
 */
export function editDistance(a: string, b: string, limit = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;

  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMinimum = current[0];

    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
      if (current[j] < rowMinimum) rowMinimum = current[j];
    }

    if (rowMinimum > limit) return limit + 1;
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

export type PlateMatchType = 'PLATE_EXACT' | 'PLATE_FUZZY';

export interface PlateMatch {
  matchType: PlateMatchType;
  /**
   * 0..1, computed as the share of characters that agree:
   * `1 - distance / length`. An exact match is 1. A single substitution on an
   * Indian plate of ten characters is 0.9; on a six-character plate it is 0.83,
   * which is correct - one wrong character matters more on a shorter plate.
   */
  score: number;
  distance: number;
}

/**
 * Compares a detection's plate against a watchlist plate.
 *
 * Returns null when they are not a match at all. A distance of exactly 1 is a
 * *probable* match and is reported as PLATE_FUZZY with a score below any exact
 * match, so an operator can see at a glance that the system is not certain.
 *
 * Anything shorter than four characters is refused outright: a two-character
 * fragment is within edit distance 1 of a great many real plates, and matching
 * on it would generate confident nonsense.
 */
export function matchPlate(
  detected: string | null,
  watchlisted: string | null,
  options: { fuzzyDistance?: number } = {}
): PlateMatch | null {
  if (!detected || !watchlisted) return null;
  if (detected.length < 4 || watchlisted.length < 4) return null;

  if (detected === watchlisted) {
    return { matchType: 'PLATE_EXACT', score: 1, distance: 0 };
  }

  const limit = Math.max(0, options.fuzzyDistance ?? 1);
  if (limit === 0) return null;

  const distance = editDistance(detected, watchlisted, limit);
  if (distance > limit) return null;

  const longest = Math.max(detected.length, watchlisted.length);
  const score = 1 - distance / longest;

  return { matchType: 'PLATE_FUZZY', score: Number(score.toFixed(4)), distance };
}
