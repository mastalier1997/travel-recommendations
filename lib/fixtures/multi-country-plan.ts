import type { Plan, Place, Route, RouteLeg } from '@/lib/types';
import { orderHash } from '@/lib/routing/order';
import { place } from './place';

/**
 * A trip spanning multiple countries — Austria and Germany, with two border
 * crossings, chosen because they're genuinely drivable on the same continent
 * (an intercontinental spread is what OSRM's public demo server can't route at
 * all — see lib/routing/osrm.ts's track notes).
 *
 * Leg distances/durations below are approximate (±10%, same standard as
 * SAMPLE_PLAN's own "Coordinates are approximate" disclaimer) — hand-estimated,
 * not pulled from a live routing call. They will NOT match what a live OSRM
 * request returns (the public demo's free-flow car profile has no traffic model
 * and consistently comes back 10-20% faster than real-world driving times).
 * Do not write a test that asserts these against a live OSRM response — that
 * tests OSRM's mood that day, not this fixture.
 *
 * Deliberately covers gaps in SAMPLE_PLAN's field-value coverage: a
 * description.source of 'osm-tag' and 'wikidata' (not just 'wikipedia'/'user'),
 * an origin of 'manual' and 'map-click', a non-null `notes`, a non-null
 * `wikidata` id, and — the load-bearing one — a real German-language
 * description (lang: 'de'), which is the first fixture data to exercise the
 * `lang` attribute PlaceCard now renders on the description paragraph.
 */

const AT = '2026-08-02T09:00:00.000Z';

export const MULTI_COUNTRY_PLACES: Place[] = [
  place({
    id: 'pl_at_vienna',
    addedAt: AT,
    name: "St. Stephen's Cathedral",
    lat: 48.2085,
    lon: 16.3735,
    address: 'Stephansplatz 3, Vienna, Austria',
    osm: { type: 'way', id: 24893217, class: 'historic', tag: 'church' },
    wikipedia: "en:St. Stephen's Cathedral, Vienna",
    description: {
      text: "Vienna's Gothic landmark, best known for its 230,000-tile roof — climb the south tower for the view, not the lift-served north one.",
      source: 'wikipedia',
      sourceUrl: "https://en.wikipedia.org/wiki/St._Stephen's_Cathedral,_Vienna",
      lang: 'en',
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_at_melk',
    addedAt: AT,
    name: 'Melk Abbey',
    lat: 48.2281,
    lon: 15.3336,
    address: 'Abt-Berthold-Dietmayr-Straße 1, Melk, Austria',
    osm: { type: 'way', id: 27461098, class: 'historic', tag: 'monastery' },
    wikipedia: 'de:Stift Melk',
    description: {
      text: 'Barockes Benediktinerstift hoch über der Donau, berühmt für seine Bibliothek und den Blick vom Terrassengang.',
      source: 'wikipedia',
      sourceUrl: 'https://de.wikipedia.org/wiki/Stift_Melk',
      lang: 'de',
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_at_hallstatt',
    addedAt: AT,
    name: 'Hallstatt',
    lat: 47.5622,
    lon: 13.6493,
    address: 'Seestraße, Hallstatt, Austria',
    osm: { type: 'node', id: 240815773, class: 'place', tag: 'village' },
    // No direct wikidata/wikipedia tag on the OSM object — this one came off the geosearch rung.
    description: {
      text: 'UNESCO-listed lakeside village wedged between the Dachstein cliffs and Lake Hallstatt — arrive by the first boat, before the tour buses.',
      source: 'wikipedia-geosearch',
      sourceUrl: 'https://en.wikipedia.org/wiki/Hallstatt',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_at_salzburg',
    addedAt: AT,
    name: 'Hohensalzburg Fortress',
    lat: 47.795,
    lon: 13.047,
    address: 'Mönchsberg 34, Salzburg, Austria',
    osm: { type: 'way', id: 28934651, class: 'historic', tag: 'castle' },
    // Illustrative Wikidata id — not independently verified, kept short-form on purpose
    // since rung 3 (lib/content/describe.ts) always resolves to English regardless of place.
    wikidata: 'Q182367',
    description: {
      text: "Medieval hilltop fortress overlooking Salzburg's old town.",
      source: 'wikidata',
      sourceUrl: 'https://www.wikidata.org/wiki/Q182367',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_de_koenigssee',
    addedAt: AT,
    name: 'Königssee',
    lat: 47.5877,
    lon: 12.988,
    address: 'Königssee, Schönau am Königssee, Germany',
    osm: { type: 'way', id: 31207845, class: 'natural', tag: 'water' },
    // No Wikipedia/Wikidata reference — lands on the OSM-tag rung, like SAMPLE_PLAN's pl_kobe.
    description: { text: 'Lake', source: 'osm-tag', sourceUrl: null, lang: null, fetchedAt: AT },
  }),
  place({
    id: 'pl_de_munich',
    addedAt: AT,
    name: 'Marienplatz',
    lat: 48.1374,
    lon: 11.5755,
    address: 'Marienplatz, Munich, Germany',
    osm: { type: 'way', id: 33982104, class: 'place', tag: 'square' },
    origin: 'manual',
    notes: 'Check Glockenspiel chime times before planning around it — seasonal.',
    // Nothing on any rung — the user wrote this one themselves.
    description: {
      text: "Munich's central square — catch the Glockenspiel chime at 11am, then duck into the Viktualienmarkt for lunch.",
      source: 'user',
      sourceUrl: null,
      lang: null,
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_de_neuschwanstein',
    addedAt: AT,
    name: 'Neuschwanstein Castle',
    lat: 47.5576,
    lon: 10.7498,
    address: 'Neuschwansteinstraße 20, Schwangau, Germany',
    osm: { type: 'way', id: 26718340, class: 'historic', tag: 'castle' },
    wikipedia: 'en:Neuschwanstein Castle',
    origin: 'map-click',
    description: {
      text: "Mad King Ludwig's fairytale castle above the Pöllat gorge — book the timed ticket online, walk-ups often sell out by midday.",
      source: 'wikipedia',
      sourceUrl: 'https://en.wikipedia.org/wiki/Neuschwanstein_Castle',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
  place({
    id: 'pl_at_innsbruck',
    addedAt: AT,
    name: 'Innsbruck',
    lat: 47.2683,
    lon: 11.3933,
    address: 'Herzog-Friedrich-Straße 15, Innsbruck, Austria',
    osm: { type: 'way', id: 29187456, class: 'place', tag: 'city' },
    wikipedia: 'en:Innsbruck',
    description: {
      text: 'Alpine capital ringed by the Nordkette peaks, with the Golden Roof marking the old town centre.',
      source: 'wikipedia',
      sourceUrl: 'https://en.wikipedia.org/wiki/Innsbruck',
      lang: 'en',
      fetchedAt: AT,
    },
  }),
];

const LEGS: RouteLeg[] = [
  { fromId: 'pl_at_vienna', toId: 'pl_at_melk', distanceM: 90_000, durationS: 3_900 },
  { fromId: 'pl_at_melk', toId: 'pl_at_hallstatt', distanceM: 175_000, durationS: 7_800 },
  { fromId: 'pl_at_hallstatt', toId: 'pl_at_salzburg', distanceM: 75_000, durationS: 4_500 },
  // Austria → Germany.
  { fromId: 'pl_at_salzburg', toId: 'pl_de_koenigssee', distanceM: 35_000, durationS: 2_400 },
  { fromId: 'pl_de_koenigssee', toId: 'pl_de_munich', distanceM: 155_000, durationS: 7_200 },
  { fromId: 'pl_de_munich', toId: 'pl_de_neuschwanstein', distanceM: 120_000, durationS: 6_300 },
  // Germany → Austria.
  { fromId: 'pl_de_neuschwanstein', toId: 'pl_at_innsbruck', distanceM: 110_000, durationS: 6_000 },
];

/**
 * Coarse stand-in — the 8 stop coordinates in order. See SAMPLE_PLAN's geometry
 * comment: enough to prove the polyline layer, its white casing, and fitBounds
 * behave, not a real road-following trace.
 */
const GEOMETRY_COORDS: [number, number][] = [
  [16.3735, 48.2085],
  [15.3336, 48.2281],
  [13.6493, 47.5622],
  [13.047, 47.795],
  [12.988, 47.5877],
  [11.5755, 48.1374],
  [10.7498, 47.5576],
  [11.3933, 47.2683],
];

export const MULTI_COUNTRY_ROUTE: Route = {
  version: 1,
  provider: 'osrm',
  mode: 'driving',
  roundTrip: false,
  optimized: true,
  orderHash: orderHash(MULTI_COUNTRY_PLACES, 'driving', false),
  legs: LEGS,
  totalDistanceM: LEGS.reduce((n, l) => n + l.distanceM, 0), // 760_000 → "760 km"
  totalDurationS: LEGS.reduce((n, l) => n + l.durationS, 0), // 38_100 → "10h 35m"
  geometry: { type: 'LineString', coordinates: GEOMETRY_COORDS },
  computedAt: AT,
};

export const MULTI_COUNTRY_PLAN: Plan = {
  id: 'plan_austria_germany_2026',
  user_id: 'user_fixture',
  title: 'Austria & Germany Road Trip',
  places: MULTI_COUNTRY_PLACES,
  route: MULTI_COUNTRY_ROUTE,
  schema_version: 1,
  version: 1,
  updated_at: AT,
};
