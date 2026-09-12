import type { Plan, Place, Route, RouteLeg } from '@/lib/types';
import { orderHash } from '@/lib/routing/order';
import { place } from './place';

/**
 * A trip confined to one city — Kyoto only, unlike SAMPLE_PLAN's Kyoto+Osaka spread.
 * Exists alongside SAMPLE_PLAN, not in place of it: nothing in the MOCK API routes or
 * the fixture-mode home page reads from this file. See lib/fixtures/fixtures.test.ts
 * for the shared invariants every fixture plan has to satisfy.
 *
 * The first three legs are the exact SAMPLE_PLAN values for the same city pairs
 * (Fushimi → Nishiki → Kiyomizu) — already asserted in lib/format.test.ts, so reusing
 * them keeps the two fixtures from silently disagreeing about the same real trip.
 */

const AT = '2026-08-01T09:00:00.000Z';

export const SINGLE_AREA_PLACES: Place[] = [
  place({
    id: 'pl_kyoto_fushimi',
    addedAt: AT,
    name: 'Fushimi Inari Taisha',
    lat: 34.9671,
    lon: 135.7727,
    address: '68 Fukakusa Yabunouchichō, Fushimi-ku, Kyoto',
    osm: { type: 'way', id: 32952536, class: 'historic', tag: 'shrine' },
    wikipedia: 'en:Fushimi Inari-taisha',
    description: {
      text: 'Walk the tunnels of vermilion torii up Mt. Inari — the first 20 minutes are crowded, the upper loop is quiet.',
      source: 'wikipedia',
      sourceUrl: 'https://en.wikipedia.org/wiki/Fushimi_Inari-taisha',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_kyoto_nishiki',
    addedAt: AT,
    name: 'Nishiki Market',
    lat: 35.005,
    lon: 135.7649,
    address: 'Nakagyo-ku, Kyoto',
    osm: { type: 'way', id: 197325544, class: 'amenity', tag: 'marketplace' },
    wikipedia: 'en:Nishiki Market',
    description: {
      text: 'Five covered blocks of food stalls: tamagoyaki, tsukemono, fresh yuba, and knife shops worth a slow browse.',
      source: 'wikipedia',
      sourceUrl: 'https://en.wikipedia.org/wiki/Nishiki_Market',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_kyoto_kiyomizu',
    addedAt: AT,
    raw: 'kiyomizu temple',
    name: 'Kiyomizu-dera',
    lat: 34.9949,
    lon: 135.785,
    address: '1-294 Kiyomizu, Higashiyama-ku, Kyoto',
    osm: { type: 'way', id: 25778641, class: 'historic', tag: 'temple' },
    wikipedia: 'en:Kiyomizu-dera',
    description: {
      text: 'Wooden stage out over the Higashiyama hillside, with the Otowa waterfall below — calmest right at opening.',
      source: 'wikipedia',
      sourceUrl: 'https://en.wikipedia.org/wiki/Kiyomizu-dera',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
  place({
    // ~450m from Kiyomizu-dera — the short hop that finally exercises formatDistance's
    // metre branch; no existing fixture leg is under 3.1km.
    id: 'pl_kyoto_sannenzaka',
    addedAt: AT,
    name: 'Sannenzaka',
    lat: 34.9958,
    lon: 135.7797,
    address: 'Kiyomizu, Higashiyama-ku, Kyoto',
    osm: { type: 'way', id: 145820331, class: 'tourism', tag: 'attraction' },
    // No Wikipedia/Wikidata reference — this one lands on the OSM-tag rung.
    description: { text: 'Attraction', source: 'osm-tag', sourceUrl: null, lang: null, fetchedAt: AT },
  }),
  place({
    id: 'pl_kyoto_arashiyama',
    addedAt: AT,
    name: 'Arashiyama Bamboo Grove',
    lat: 35.017,
    lon: 135.6717,
    address: 'Ukyo-ku, Kyoto',
    osm: { type: 'way', id: 305293612, class: 'natural', tag: 'wood' },
    wikipedia: 'en:Arashiyama',
    description: {
      text: "Short walk through the bamboo, then Tenryū-ji's garden and the river boats at Togetsukyō bridge.",
      source: 'wikipedia',
      sourceUrl: 'https://en.wikipedia.org/wiki/Arashiyama',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
];

const LEGS: RouteLeg[] = [
  { fromId: 'pl_kyoto_fushimi', toId: 'pl_kyoto_nishiki', distanceM: 5_400, durationS: 960 },
  { fromId: 'pl_kyoto_nishiki', toId: 'pl_kyoto_kiyomizu', distanceM: 3_100, durationS: 660 },
  { fromId: 'pl_kyoto_kiyomizu', toId: 'pl_kyoto_sannenzaka', distanceM: 450, durationS: 240 },
  { fromId: 'pl_kyoto_sannenzaka', toId: 'pl_kyoto_arashiyama', distanceM: 14_300, durationS: 1_950 },
];

const GEOMETRY_COORDS: [number, number][] = [
  [135.7727, 34.9671],
  [135.7688, 34.9862],
  [135.7649, 35.005],
  [135.7752, 34.9995],
  [135.785, 34.9949],
  [135.7797, 34.9958],
  [135.7301, 35.0104],
  [135.6717, 35.017],
];

export const SINGLE_AREA_ROUTE: Route = {
  version: 1,
  provider: 'osrm',
  mode: 'driving',
  roundTrip: false,
  optimized: true,
  orderHash: orderHash(SINGLE_AREA_PLACES, 'driving', false),
  legs: LEGS,
  totalDistanceM: LEGS.reduce((n, l) => n + l.distanceM, 0), // 23_250 → "23 km"
  totalDurationS: LEGS.reduce((n, l) => n + (l.durationS ?? 0), 0), // 3_810 → "1h 3m"
  geometry: { type: 'LineString', coordinates: GEOMETRY_COORDS },
  computedAt: AT,
};

export const SINGLE_AREA_PLAN: Plan = {
  id: 'plan_kyoto_only_2026',
  user_id: 'user_fixture',
  title: 'Kyoto in a Day',
  places: SINGLE_AREA_PLACES,
  route: SINGLE_AREA_ROUTE,
  schema_version: 1,
  version: 1,
  updated_at: AT,
};
