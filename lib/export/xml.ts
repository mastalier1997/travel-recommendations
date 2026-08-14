/** Shared by kml.ts and gpx.ts — an unescaped `&` in a place name or a Wikipedia
 * extract breaks the whole file, not just that field. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
