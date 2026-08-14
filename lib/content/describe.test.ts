import { describe, it, expect, vi } from 'vitest';
import { describeOne, describeMany, nameMatches, type DescribePlace } from './describe';

const place = (over: Partial<DescribePlace> = {}): DescribePlace => ({
  id: 'p1',
  name: 'Kiyomizu-dera',
  lat: 34.9949,
  lon: 135.785,
  wikidata: null,
  wikipedia: null,
  osm: null,
  ...over,
});

const summary = (extract: string, url = 'https://en.wikipedia.org/wiki/X') => ({ extract, url });

// A deps object where every branch fails unless a test overrides it — so each
// test proves the ladder actually stops at the rung it's checking, not that it
// merely didn't crash.
const noHits = () => ({
  resolveEnglishTitle: vi.fn().mockResolvedValue(null),
  fetchSummary: vi.fn().mockResolvedValue(null),
  geosearchNear: vi.fn().mockResolvedValue([]),
  fetchWikidataDescription: vi.fn().mockResolvedValue(null),
});

describe('nameMatches', () => {
  it('matches identical names', () => {
    expect(nameMatches('Kiyomizu-dera', 'Kiyomizu-dera')).toBe(true);
  });

  it('matches when one contains the other', () => {
    expect(nameMatches('Kiyomizu-dera Temple', 'Kiyomizu-dera')).toBe(true);
  });

  it('matches on a shared significant word', () => {
    expect(nameMatches('Fushimi Inari Taisha', 'Fushimi Inari')).toBe(true);
  });

  it('does not match unrelated names', () => {
    expect(nameMatches('Kyoto Station', 'Kiyomizu-dera')).toBe(false);
  });

  it('does not match on trivial short words alone', () => {
    expect(nameMatches('The Inn', 'The Cafe')).toBe(false);
  });

  it('is diacritic- and case-insensitive on ASCII casing', () => {
    expect(nameMatches('KIYOMIZU-DERA', 'kiyomizu dera')).toBe(true);
  });
});

describe('describeOne — rung 1 (wikidata/wikipedia reference)', () => {
  it('resolves via wikidata to an English summary', async () => {
    const deps = noHits();
    deps.resolveEnglishTitle.mockResolvedValue('Kiyomizu-dera');
    deps.fetchSummary.mockImplementation(async (title: string, lang: string) =>
      title === 'Kiyomizu-dera' && lang === 'en' ? summary('Buddhist temple in Kyoto.') : null,
    );

    const d = await describeOne(place({ wikidata: 'Q221716' }), deps);
    expect(d).toMatchObject({ text: 'Buddhist temple in Kyoto.', source: 'wikipedia', lang: 'en' });
    expect(deps.geosearchNear).not.toHaveBeenCalled();
  });

  it('falls back to the raw wikipedia tag in its own language when wikidata resolution fails', async () => {
    const deps = noHits();
    deps.fetchSummary.mockImplementation(async (title: string, lang: string) =>
      title === '清水寺' && lang === 'ja' ? summary('清水寺は京都にある寺院。') : null,
    );

    const d = await describeOne(place({ wikipedia: 'ja:清水寺' }), deps);
    expect(d).toMatchObject({ source: 'wikipedia', lang: 'ja' });
  });

  it('prefers the wikidata route over the raw tag when both are present', async () => {
    const deps = noHits();
    deps.resolveEnglishTitle.mockResolvedValue('Kiyomizu-dera');
    deps.fetchSummary.mockImplementation(async (title: string) =>
      title === 'Kiyomizu-dera' ? summary('English summary.') : summary('WRONG'),
    );

    const d = await describeOne(place({ wikidata: 'Q221716', wikipedia: 'ja:清水寺' }), deps);
    expect(d?.lang).toBe('en');
    expect(d?.text).toBe('English summary.');
  });
});

describe('describeOne — rung 2 (geosearch)', () => {
  it('skips a closer hit that fails the name match and uses the first one that passes', async () => {
    const deps = noHits();
    // "Unrelated Bridge" is closer but shares no word with the place's name —
    // this proves the ladder is filtering by nameMatches, not just taking dist[0].
    deps.geosearchNear.mockResolvedValue([
      { title: 'Unrelated Bridge', distanceM: 5 },
      { title: 'Kiyomizu-dera', distanceM: 40 },
    ]);
    deps.fetchSummary.mockImplementation(async (title: string) =>
      title === 'Kiyomizu-dera' ? summary('Temple nearby.') : summary('WRONG'),
    );

    const d = await describeOne(place(), deps);
    expect(d).toMatchObject({ text: 'Temple nearby.', source: 'wikipedia-geosearch' });
  });

  it('is skipped entirely when the place has no coordinates', async () => {
    const deps = noHits();
    await describeOne(place({ lat: null, lon: null }), deps);
    expect(deps.geosearchNear).not.toHaveBeenCalled();
  });

  it('falls through when no nearby hit matches the name', async () => {
    const deps = noHits();
    deps.geosearchNear.mockResolvedValue([{ title: 'Totally Unrelated Place', distanceM: 10 }]);
    const d = await describeOne(place({ osm: { type: 'way', id: 1, class: 'historic', tag: 'temple' } }), deps);
    expect(d?.source).toBe('osm-tag');
  });
});

describe('describeOne — rung 3 (wikidata description)', () => {
  it('is used when rungs 1-2 produce nothing but a wikidata id exists', async () => {
    const deps = noHits();
    deps.fetchWikidataDescription.mockResolvedValue('Buddhist temple in Kyoto, Japan');

    const d = await describeOne(place({ wikidata: 'Q221716', lat: null, lon: null }), deps);
    expect(d).toMatchObject({
      text: 'Buddhist temple in Kyoto, Japan',
      source: 'wikidata',
      sourceUrl: 'https://www.wikidata.org/wiki/Q221716',
    });
  });

  it('is never attempted without a wikidata id', async () => {
    const deps = noHits();
    await describeOne(place({ lat: null, lon: null }), deps);
    expect(deps.fetchWikidataDescription).not.toHaveBeenCalled();
  });
});

describe('describeOne — rung 4 (osm tag) and no match', () => {
  it('falls all the way to the OSM label when nothing else answers', async () => {
    const deps = noHits();
    const d = await describeOne(
      place({ osm: { type: 'way', id: 1, class: 'amenity', tag: 'restaurant' } }),
      deps,
    );
    expect(d).toMatchObject({ text: 'Restaurant', source: 'osm-tag', sourceUrl: null, lang: null });
  });

  it('returns null when every rung comes up empty', async () => {
    const deps = noHits();
    expect(await describeOne(place({ lat: null, lon: null }), deps)).toBeNull();
  });
});

describe('describeMany', () => {
  it('maps every place id to a result, in any order', async () => {
    const deps = noHits();
    deps.fetchWikidataDescription.mockResolvedValue('A place.');
    const places = [
      place({ id: 'a', wikidata: 'Q1', lat: null, lon: null }),
      place({ id: 'b', wikidata: 'Q2', lat: null, lon: null }),
      place({ id: 'c', lat: null, lon: null }), // no signal at all -> null
    ];

    const out = await describeMany(places, 5, deps);
    expect(Object.keys(out).sort()).toEqual(['a', 'b', 'c']);
    expect(out.a?.text).toBe('A place.');
    expect(out.c).toBeNull();
  });

  it('never runs more than `concurrency` lookups at once', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const deps = noHits();
    deps.fetchWikidataDescription.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return 'ok';
    });

    const places = Array.from({ length: 12 }, (_, i) =>
      place({ id: `p${i}`, wikidata: 'Q1', lat: null, lon: null }),
    );
    await describeMany(places, 3, deps);
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it('isolates a failure in one lookup — the rest still resolve', async () => {
    const deps = noHits();
    deps.fetchWikidataDescription.mockImplementation(async (qid: string) => {
      if (qid === 'BOOM') throw new Error('network error');
      return 'fine';
    });
    const places = [
      place({ id: 'a', wikidata: 'BOOM', lat: null, lon: null }),
      place({ id: 'b', wikidata: 'Q1', lat: null, lon: null }),
    ];

    const out = await describeMany(places, 2, deps);
    expect(out.a).toBeNull();
    expect(out.b?.text).toBe('fine');
  });
});
