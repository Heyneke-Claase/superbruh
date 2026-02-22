/**
 * Shared, framework-agnostic utilities.
 * Safe to import in both Server Components and Client Components.
 */

/**
 * Derives the predicted/actual margin category from a match status string.
 * e.g. "England won by 51 runs" → "Easy"
 *      "India won by 3 wickets" → "Comfortable"
 */
export function getActualMargin(status: string | null): string | null {
  if (!status || typeof status !== 'string') return null;

  try {
    // Already embedded in status from a previous run
    const parenthesized = status.match(/\((Narrow|Comfortable|Easy|Thrashing)\)/i);
    if (parenthesized) return parenthesized[1];

    // Super Over → always Narrow
    if (status.toLowerCase().includes('super over')) return 'Narrow';

    // Won by runs (batted first)
    const runsMatch = status.match(/won by (\d+) runs?/i);
    if (runsMatch) {
      const runs = parseInt(runsMatch[1], 10);
      if (runs <= 9)  return 'Narrow';
      if (runs <= 24) return 'Comfortable';
      if (runs <= 39) return 'Easy';
      return 'Thrashing';
    }

    // Won by wickets (batted second)
    const wktsMatch =
      status.match(/won by (\d+) wkts?/i) ||
      status.match(/won by (\d+) wickets?/i);
    if (wktsMatch) {
      const wkts = parseInt(wktsMatch[1], 10);
      if (wkts <= 2) return 'Narrow';
      if (wkts <= 5) return 'Comfortable';
      if (wkts <= 8) return 'Easy';
      return 'Thrashing';
    }
  } catch (err) {
    console.error('Error parsing margin:', err);
  }

  return null;
}
