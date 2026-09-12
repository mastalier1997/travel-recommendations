import type { Plan, Place, Route, RouteLeg } from '@/lib/types';
import { orderHash } from '@/lib/routing/order';
import { place } from './place';

/**
 * The desktop Planner screen from the design, as data. Every UI track (B, G, H) can
 * render the whole app from this with no network at all.
 *
 * Notes:
 *  - Place ids are readable rather than UUIDs on purpose; production uses randomUUID().
 *  - Coordinates are approximate. Wikidata ids are deliberately null — most real OSM
 *    POIs have none, which is exactly the case the description ladder exists for.
 *  - Legs sum exactly to totalDistanceM / totalDurationS. Keep it that way when editing:
 *    the summary bar and the inter-card leg rows read from the same numbers.
 */

const AT = '2026-08-01T09:00:00.000Z';

export const SAMPLE_PLACES: Place[] = [
  place({
    id: 'pl_fushimi',
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
    id: 'pl_nishiki',
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
    id: 'pl_kiyomizu',
    addedAt: AT,
    // The user typed something vague and confirmed a candidate — `raw` keeps the original.
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
    id: 'pl_arashiyama',
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
  place({
    id: 'pl_dotonbori',
    addedAt: AT,
    name: 'Dotonbori',
    lat: 34.6687,
    lon: 135.5013,
    address: 'Chuo-ku, Osaka',
    osm: { type: 'way', id: 46173216, class: 'place', tag: 'neighbourhood' },
    wikipedia: 'en:Dōtonbori',
    description: {
      text: 'Neon canal-front strip for takoyaki and kushikatsu; best after dark, loudest on weekends.',
      source: 'wikipedia',
      sourceUrl: 'https://en.wikipedia.org/wiki/D%C5%8Dtonbori',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_osakacastle',
    addedAt: AT,
    name: 'Osaka Castle',
    lat: 34.6873,
    lon: 135.5262,
    address: '1-1 Osakajō, Chuo-ku, Osaka',
    osm: { type: 'way', id: 24274316, class: 'historic', tag: 'castle' },
    wikipedia: 'en:Osaka Castle',
    description: {
      text: 'Climb the keep for the city view, then loop the moat park — about 90 minutes at an easy pace.',
      source: 'wikipedia',
      sourceUrl: 'https://en.wikipedia.org/wiki/Osaka_Castle',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_teamlab',
    addedAt: AT,
    raw: 'teamlab',
    name: 'teamLab Botanical Garden',
    lat: 34.61,
    lon: 135.518,
    address: 'Nagai Park, Higashisumiyoshi-ku, Osaka',
    osm: { type: 'way', id: 158942371, class: 'tourism', tag: 'attraction' },
    // No wikidata tag on the OSM object — this one came off the geosearch rung.
    description: {
      text: "Nagai Park's night-only light installations among real plants — timed entry, book a slot before 19:00.",
      source: 'wikipedia-geosearch',
      sourceUrl: 'https://en.wikipedia.org/wiki/Nagai_Park',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_nara',
    addedAt: AT,
    name: 'Nara Deer Park',
    lat: 34.6851,
    lon: 135.843,
    address: 'Nara, Nara Prefecture',
    osm: { type: 'way', id: 30021458, class: 'leisure', tag: 'park' },
    wikipedia: 'en:Nara Park',
    description: {
      text: "Free-roaming sika deer plus Tōdai-ji's Great Buddha; buy crackers at the stalls, not from your bag.",
      source: 'wikipedia',
      sourceUrl: 'https://en.wikipedia.org/wiki/Nara_Park',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_kobe',
    addedAt: AT,
    name: 'Kobe beef district, Sannomiya',
    lat: 34.6947,
    lon: 135.1955,
    address: 'Chuo-ku, Kobe, Hyogo',
    osm: { type: 'node', id: 1841283743, class: 'place', tag: 'neighbourhood' },
    // Nothing on any rung — the user wrote this one themselves.
    description: {
      text: 'Teppan counters within a few blocks of the station — lunch sets run roughly a third of dinner prices.',
      source: 'user',
      sourceUrl: null,
      lang: null,
      fetchedAt: AT,
    },
  }),
];

const LEGS: RouteLeg[] = [
  { fromId: 'pl_fushimi', toId: 'pl_nishiki', distanceM: 5_400, durationS: 960 },
  { fromId: 'pl_nishiki', toId: 'pl_kiyomizu', distanceM: 3_100, durationS: 660 },
  { fromId: 'pl_kiyomizu', toId: 'pl_arashiyama', distanceM: 14_200, durationS: 1_920 },
  { fromId: 'pl_arashiyama', toId: 'pl_dotonbori', distanceM: 52_000, durationS: 3_480 },
  { fromId: 'pl_dotonbori', toId: 'pl_osakacastle', distanceM: 4_200, durationS: 720 },
  { fromId: 'pl_osakacastle', toId: 'pl_teamlab', distanceM: 9_600, durationS: 1_440 },
  { fromId: 'pl_teamlab', toId: 'pl_nara', distanceM: 31_000, durationS: 2_460 },
  { fromId: 'pl_nara', toId: 'pl_kobe', distanceM: 66_500, durationS: 3_960 },
];

/**
 * Coarse stand-in. Real OSRM geometry is a few hundred points per leg; this is enough
 * to prove the polyline layer, its white casing, and fitBounds behave.
 */
const GEOMETRY_COORDS: [number, number][] = [
  [135.7727, 34.9671],
  [135.7688, 34.9862],
  [135.7649, 35.005],
  [135.7752, 34.9995],
  [135.785, 34.9949],
  [135.7301, 35.0104],
  [135.6717, 35.017],
  [135.5904, 34.8412],
  [135.5013, 34.6687],
  [135.5138, 34.678],
  [135.5262, 34.6873],
  [135.5221, 34.6486],
  [135.518, 34.61],
  [135.6805, 34.6476],
  [135.843, 34.6851],
  [135.5189, 34.6899],
  [135.1955, 34.6947],
];

export const SAMPLE_ROUTE: Route = {
  version: 1,
  provider: 'osrm',
  mode: 'driving',
  roundTrip: false,
  optimized: true,
  orderHash: orderHash(SAMPLE_PLACES, 'driving', false),
  legs: LEGS,
  totalDistanceM: LEGS.reduce((n, l) => n + l.distanceM, 0), // 186_000 → "186 km"
  totalDurationS: LEGS.reduce((n, l) => n + (l.durationS ?? 0), 0), // 15_600 → "4h 20m"
  geometry: { type: 'LineString', coordinates: GEOMETRY_COORDS },
  computedAt: AT,
};

export const SAMPLE_PLAN: Plan = {
  id: 'plan_japan_spring_2026',
  user_id: 'user_fixture',
  title: 'Japan – Spring 2026',
  places: SAMPLE_PLACES,
  route: SAMPLE_ROUTE,
  schema_version: 1,
  version: 1,
  updated_at: AT,
};
