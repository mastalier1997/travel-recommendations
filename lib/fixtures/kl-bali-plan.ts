import type { Plan, Place, Route, RouteLeg } from '@/lib/types';
import { orderHash } from '@/lib/routing/order';
import { haversineDistance } from '@/lib/routing/haversine';
import { place } from './place';

/**
 * The exact shape of the reported bug: Kuala Lumpur -> Singapore -> Jakarta ->
 * Yogyakarta -> Bali. Three of these (Jakarta/Yogyakarta/Bali) share one
 * countryCode ('ID') but are ~1000km apart — the case the old clusterByGroup
 * (band + flat stop-count) collapsed into one badge once zoomed out past 'close'.
 *
 * `route` carries a real gap-tolerant shape (lib/routing/osrm.ts's
 * solveAndRouteFromTable): KL -> Singapore is a real drive (causeway), Singapore
 * -> Jakarta has no road route (a direct leg), Jakarta -> Borobudur is a real
 * drive (both on Java), Borobudur -> Uluwatu has no road route (the Bali strait —
 * another direct leg, and same-country this time, exercising PlaceCard's own
 * mode-aware leg row rather than only PlaceList's country-crossing one). This is
 * the MOCK-mode fixture, so distances/durations are illustrative, not live OSRM
 * numbers — but the direct legs' distances are real haversine, same as
 * production would compute them.
 */

const AT = '2026-08-04T09:00:00.000Z';

export const KL_BALI_PLACES: Place[] = [
  place({
    id: 'pl_kb_kl',
    addedAt: AT,
    countryCode: 'MY',
    name: 'Petronas Towers',
    lat: 3.1579,
    lon: 101.7116,
  }),
  place({
    id: 'pl_kb_sg',
    addedAt: AT,
    countryCode: 'SG',
    name: 'Merlion Park',
    lat: 1.2868,
    lon: 103.8545,
  }),
  place({
    id: 'pl_kb_jkt',
    addedAt: AT,
    countryCode: 'ID',
    name: 'Monas',
    lat: -6.1754,
    lon: 106.8272,
  }),
  place({
    id: 'pl_kb_yog',
    addedAt: AT,
    countryCode: 'ID',
    name: 'Borobudur',
    lat: -7.6079,
    lon: 110.2038,
  }),
  place({
    id: 'pl_kb_bali',
    addedAt: AT,
    countryCode: 'ID',
    name: 'Uluwatu Temple',
    lat: -8.8291,
    lon: 115.0849,
  }),
];

const [kl, sg, jkt, yog, bali] = KL_BALI_PLACES;

const directLeg = (from: Place, to: Place): RouteLeg => ({
  fromId: from.id,
  toId: to.id,
  distanceM: haversineDistance(from as { lat: number; lon: number }, to as { lat: number; lon: number }),
  mode: 'direct',
  geometry: {
    type: 'LineString',
    coordinates: [
      [from.lon as number, from.lat as number],
      [to.lon as number, to.lat as number],
    ],
  },
});

const roadLeg = (from: Place, to: Place, distanceM: number, durationS: number): RouteLeg => ({
  fromId: from.id,
  toId: to.id,
  distanceM,
  durationS,
  geometry: {
    type: 'LineString',
    coordinates: [
      [from.lon as number, from.lat as number],
      [to.lon as number, to.lat as number],
    ],
  },
});

const KL_BALI_LEGS: RouteLeg[] = [
  roadLeg(kl, sg, 350_000, 16_200), // KL -> Singapore: real drive via the causeway
  directLeg(sg, jkt), // Singapore -> Jakarta: no road route
  roadLeg(jkt, yog, 450_000, 25_200), // Jakarta -> Borobudur: real drive, both on Java
  directLeg(yog, bali), // Borobudur -> Uluwatu: no road route (the Bali strait)
];

export const KL_BALI_ROUTE: Route = {
  version: 1,
  provider: 'osrm',
  mode: 'driving',
  roundTrip: false,
  optimized: true,
  optimizationMethod: 'heuristic',
  orderHash: orderHash(KL_BALI_PLACES, 'driving', false),
  legs: KL_BALI_LEGS,
  totalDistanceM: KL_BALI_LEGS.reduce((n, l) => n + l.distanceM, 0),
  // Road legs only (16_200 + 25_200 = 41_400 → "11h 30m") — the two direct legs
  // have no real driving time to add, see RouteLeg.durationS.
  totalDurationS: KL_BALI_LEGS.reduce((n, l) => n + (l.durationS ?? 0), 0),
  geometry: {
    type: 'LineString',
    coordinates: KL_BALI_LEGS.flatMap((l) => l.geometry!.coordinates),
  },
  computedAt: AT,
  directLegCount: KL_BALI_LEGS.filter((l) => l.mode === 'direct').length,
};

export const KL_BALI_PLAN: Plan = {
  id: 'plan_kl_bali_2026',
  user_id: 'user_fixture',
  title: 'Kuala Lumpur to Bali',
  places: KL_BALI_PLACES,
  route: KL_BALI_ROUTE,
  schema_version: 1,
  version: 1,
  updated_at: AT,
};
