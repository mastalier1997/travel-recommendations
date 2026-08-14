/**
 * Pulls candidate place names out of free text: runs of capitalized words, with a
 * short allow-list of lowercase connectors so "Statue of Liberty" survives as one
 * phrase instead of splitting on "of".
 *
 * This is deliberately loose — "Monday" and a sentence-initial "On" come out as
 * candidates too. The real filter is downstream: lib/import/classify.ts keeps only
 * geocode hits whose OSM class is in PLACE_CLASSES and whose importance clears the
 * bar, so junk candidates just resolve to zero usable hits and disappear.
 */

// Deliberately excludes "and"/"at"/"in": those routinely join two *unrelated*
// capitalized words in ordinary trip narration ("Kyoto and Osaka", "lunch at
// Namba"), which would merge two real places into one bad query.
const CONNECTORS = new Set(['of', 'de', 'du', 'la', 'no', 'the']);

const isCapitalized = (word: string) =>
  word[0] !== undefined && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();

export function scanProse(text: string, max = 50): string[] {
  // No trailing '.' in the continuation set — otherwise a sentence-ending period
  // gets swallowed into the word ("Inari." instead of "Inari").
  const words = [...text.matchAll(/[\p{L}][\p{L}'’-]*/gu)];
  const phrases: string[] = [];
  let current: string[] = [];
  let prevEnd = -1;

  const flush = () => {
    // A trailing connector with nothing after it ("Statue of") is noise, not a name.
    while (current.length && CONNECTORS.has(current[current.length - 1].toLowerCase())) {
      current.pop();
    }
    if (current.length) phrases.push(current.join(' '));
    current = [];
  };

  for (const match of words) {
    const word = match[0];
    const start = match.index;
    // Anything other than a single plain space between two words — a sentence-
    // ending period, a comma, a newline — breaks the run. Without this, every
    // sentence in the document collapses into one giant phrase: sentence-initial
    // words are capitalized too, so the regex match stream alone can't tell "New
    // York" (one place) from "Kyoto. We" (two unrelated capitals).
    const adjacent = prevEnd >= 0 && text.slice(prevEnd, start) === ' ';
    prevEnd = start + word.length;
    if (!adjacent) flush();

    if (isCapitalized(word)) current.push(word);
    else if (current.length > 0 && CONNECTORS.has(word.toLowerCase())) current.push(word);
    else flush();
  }
  flush();

  return [...new Set(phrases)].slice(0, max);
}
