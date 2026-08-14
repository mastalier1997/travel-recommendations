/**
 * Wikipedia/Wikidata access for the description ladder. Parsing is pure and
 * exported separately from the fetch wrappers, so it's testable against recorded
 * JSON without a network mock — same split used for Nominatim in lib/geo/.
 */

function wikimediaHeaders(): HeadersInit {
  // Same shared contact used for Nominatim — one identifying UA for every
  // outbound API call this app makes, not a Nominatim-specific concept.
  const contact = process.env.NOMINATIM_CONTACT ?? 'no-contact-configured';
  return { 'User-Agent': `Wanderlist/1 (${contact})` };
}

// ---------------------------------------------------------------------------
// Wikipedia REST summary
// ---------------------------------------------------------------------------

export type Summary = { extract: string; url: string };

/**
 * Keeps cards short — raw REST summaries run 2-4 encyclopedic sentences.
 *
 * Splits with `.split()` on a lookbehind rather than `.match()` on a whole-pattern
 * regex. `.match()` here originally used `/[^.!?]+[.!?]+(\s|$)/g`, and a match
 * attempt that fails partway (e.g. a decimal like "2.5 mi" — the period isn't
 * followed by whitespace, so the pattern can't complete) makes the regex engine
 * silently advance and retry from the next character, which can drop an entire
 * real sentence rather than just mis-splitting it. `.split()` partitions the whole
 * string with no such failure mode — every character always ends up somewhere.
 */
export function truncateToSentences(text: string, maxSentences = 2, maxChars = 220): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  let out = sentences.slice(0, maxSentences).join(' ').trim();
  if (out.length > maxChars) {
    out = `${out.slice(0, maxChars).replace(/\s+\S*$/, '')}…`;
  }
  return out;
}

export function parseSummary(json: unknown, lang: string, title: string): Summary | null {
  const j = json as {
    extract?: string;
    type?: string;
    content_urls?: { desktop?: { page?: string } };
  };
  // A disambiguation page ("Springfield (disambiguation)") isn't a description of
  // anything — treat it the same as no summary at all.
  if (!j.extract || j.type === 'disambiguation') return null;
  return {
    extract: truncateToSentences(j.extract),
    url: j.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

export async function fetchSummary(title: string, lang: string): Promise<Summary | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: wikimediaHeaders() });
  if (!res.ok) return null;
  return parseSummary(await res.json(), lang, title);
}

// ---------------------------------------------------------------------------
// Wikidata: resolve a Q-id to its English Wikipedia title
// ---------------------------------------------------------------------------

export function parseEnglishTitle(json: unknown, qid: string): string | null {
  const entities = (json as { entities?: Record<string, unknown> }).entities;
  const entity = entities?.[qid] as { sitelinks?: { enwiki?: { title?: string } } } | undefined;
  return entity?.sitelinks?.enwiki?.title ?? null;
}

/**
 * Lets a non-English `wikipedia` OSM tag still resolve to the English article —
 * the raw tag reflects whichever language the OSM mapper happened to link, not
 * necessarily the language this English-first product wants.
 */
export async function resolveEnglishTitle(qid: string): Promise<string | null> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', qid);
  url.searchParams.set('props', 'sitelinks');
  url.searchParams.set('sitefilter', 'enwiki');
  url.searchParams.set('format', 'json');

  const res = await fetch(url, { headers: wikimediaHeaders() });
  if (!res.ok) return null;
  return parseEnglishTitle(await res.json(), qid);
}

// ---------------------------------------------------------------------------
// Wikidata: the entity's own short description
// ---------------------------------------------------------------------------

export function parseWikidataDescription(json: unknown, qid: string): string | null {
  const entities = (json as { entities?: Record<string, unknown> }).entities;
  const entity = entities?.[qid] as { descriptions?: { en?: { value?: string } } } | undefined;
  const text = entity?.descriptions?.en?.value;
  if (!text) return null;
  // Wikidata descriptions are lowercase by convention ("buddhist temple in
  // kyoto, japan") — they're disambiguation glosses, not sentences.
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function fetchWikidataDescription(qid: string): Promise<string | null> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', qid);
  url.searchParams.set('props', 'descriptions');
  url.searchParams.set('languages', 'en');
  url.searchParams.set('format', 'json');

  const res = await fetch(url, { headers: wikimediaHeaders() });
  if (!res.ok) return null;
  return parseWikidataDescription(await res.json(), qid);
}

// ---------------------------------------------------------------------------
// Wikipedia geosearch — nearby articles when there's no wikidata/wikipedia tag
// ---------------------------------------------------------------------------

export type GeosearchHit = { title: string; distanceM: number };

export function parseGeosearch(json: unknown): GeosearchHit[] {
  const hits = (json as { query?: { geosearch?: { title: string; dist: number }[] } }).query
    ?.geosearch;
  return (hits ?? []).map((h) => ({ title: h.title, distanceM: h.dist }));
}

export async function geosearchNear(
  lat: number,
  lon: number,
  radiusM = 150,
): Promise<GeosearchHit[]> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'geosearch');
  url.searchParams.set('gscoord', `${lat}|${lon}`);
  url.searchParams.set('gsradius', String(radiusM));
  url.searchParams.set('gslimit', '5');
  url.searchParams.set('format', 'json');

  const res = await fetch(url, { headers: wikimediaHeaders() });
  if (!res.ok) return [];
  return parseGeosearch(await res.json());
}
