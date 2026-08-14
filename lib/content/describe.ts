import type { Description, DescribeRequest } from '@/lib/types';
import {
  fetchSummary,
  fetchWikidataDescription,
  geosearchNear,
  resolveEnglishTitle,
  type GeosearchHit,
  type Summary,
} from './wikipedia';
import { labelForOsmTag } from './osm-labels';

export type DescribePlace = DescribeRequest['places'][number];

type Deps = {
  resolveEnglishTitle: (qid: string) => Promise<string | null>;
  fetchSummary: (title: string, lang: string) => Promise<Summary | null>;
  geosearchNear: (lat: number, lon: number) => Promise<GeosearchHit[]>;
  fetchWikidataDescription: (qid: string) => Promise<string | null>;
};

const defaultDeps: Deps = { resolveEnglishTitle, fetchSummary, geosearchNear, fetchWikidataDescription };

function toDescription(
  text: string,
  source: Description['source'],
  sourceUrl: string | null,
  lang: string | null,
): Description {
  return { text, source, sourceUrl, lang, fetchedAt: new Date().toISOString() };
}

// Words too generic to count as a real match on their own — two unrelated places
// both named "The X" share only "the", which isn't evidence of anything.
const STOPWORDS = new Set(['the', 'and', 'for', 'des', 'del', 'las', 'los']);

/**
 * Loose title match for a nearby geosearch hit against the place's own name —
 * "close by" alone isn't enough (a train station can sit 100m from a shrine), so
 * this is what keeps rung 2 from attaching a wildly unrelated article.
 */
export function nameMatches(candidateTitle: string, placeName: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const a = norm(candidateTitle);
  const b = norm(placeName);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;

  const significant = (w: string) => w.length >= 3 && !STOPWORDS.has(w);
  const wordsA = new Set(a.split(' ').filter(significant));
  return b.split(' ').filter(significant).some((w) => wordsA.has(w));
}

/**
 * The four-rung ladder. Most real POIs have no Wikidata tag at all — rung 1 alone
 * would leave the majority of cards on the rung-4 fallback, which is why rungs 2-3
 * exist. Instrument `description.source`'s distribution on a real import; if most
 * land on 'osm-tag' the list will read as broken even though every card has text.
 */
export async function describeOne(place: DescribePlace, deps: Deps = defaultDeps): Promise<Description | null> {
  // Rung 1: a Wikidata id, or a Wikipedia tag, we already have.
  if (place.wikidata) {
    const title = await deps.resolveEnglishTitle(place.wikidata);
    if (title) {
      const summary = await deps.fetchSummary(title, 'en');
      if (summary) return toDescription(summary.extract, 'wikipedia', summary.url, 'en');
    }
  }
  if (place.wikipedia?.includes(':')) {
    const [lang, ...rest] = place.wikipedia.split(':');
    const title = rest.join(':');
    const summary = await deps.fetchSummary(title, lang);
    if (summary) return toDescription(summary.extract, 'wikipedia', summary.url, lang);
  }

  // Rung 2: nearby Wikipedia articles, matched by name.
  if (place.lat != null && place.lon != null) {
    const hits = await deps.geosearchNear(place.lat, place.lon);
    const match = hits.find((h) => nameMatches(h.title, place.name));
    if (match) {
      const summary = await deps.fetchSummary(match.title, 'en');
      if (summary) return toDescription(summary.extract, 'wikipedia-geosearch', summary.url, 'en');
    }
  }

  // Rung 3: Wikidata's own short description, if we at least have the Q-id.
  if (place.wikidata) {
    const text = await deps.fetchWikidataDescription(place.wikidata);
    if (text) return toDescription(text, 'wikidata', `https://www.wikidata.org/wiki/${place.wikidata}`, 'en');
  }

  // Rung 4: an OSM tag → human label, if we know the category at all.
  if (place.osm) {
    const label = labelForOsmTag(place.osm.class, place.osm.tag);
    if (label) return toDescription(label, 'osm-tag', null, null);
  }

  return null;
}

/** Concurrency-limited fan-out — no queue library, just N workers pulling off a shared index. */
export async function describeMany(
  places: DescribePlace[],
  concurrency = 5,
  deps: Deps = defaultDeps,
): Promise<Record<string, Description | null>> {
  const results: Record<string, Description | null> = {};
  let next = 0;

  async function worker() {
    while (next < places.length) {
      const place = places[next++];
      results[place.id] = await describeOne(place, deps).catch(() => null);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, places.length) }, worker));
  return results;
}
