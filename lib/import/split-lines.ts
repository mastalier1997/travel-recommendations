/**
 * One line = one candidate place. Strips the bullet/heading/number markers people
 * naturally type in a list, but only one layer of them — nested-list markers are
 * out of scope here, the geocoder confirm step catches anything that slips through.
 */
const PREFIX = /^\s*(?:[-*•]|#{1,6}|\d+[.)])\s+/;

export function splitLines(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(PREFIX, '').trim())
    .filter(Boolean);
}
