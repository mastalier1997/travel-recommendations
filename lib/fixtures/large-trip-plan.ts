import type { Plan, Place } from '@/lib/types';
import { place } from './place';

/**
 * 15 stops — deliberately above OSRM_TRIP_MAX_STOPS (12) but under MAX_STOPS_SOLVED
 * (100), to exercise the heuristic solver (lib/routing/solve.ts) rather than OSRM's
 * own /trip. Not in lib/fixtures/fixtures.test.ts's shared PLANS invariants — that
 * suite specifically asserts small, exactly-solvable fixtures, which this one isn't
 * by design. `route: null` on purpose: the point of this fixture is clicking
 * "Optimize route" and watching it actually reorder, not viewing a precomputed one.
 * Minimal place data (no descriptions) — this exists to test a stop-count threshold,
 * not to be a narrative demo like SAMPLE_PLAN.
 */

const AT = '2026-08-03T09:00:00.000Z';

export const LARGE_TRIP_PLACES: Place[] = [
  place({ id: 'pl_lg_01', addedAt: AT, name: 'Kyoto Station', lat: 34.9858, lon: 135.7588 }),
  place({ id: 'pl_lg_02', addedAt: AT, name: 'Fushimi Inari Taisha', lat: 34.9671, lon: 135.7727 }),
  place({ id: 'pl_lg_03', addedAt: AT, name: 'Kiyomizu-dera', lat: 34.9949, lon: 135.785 }),
  place({ id: 'pl_lg_04', addedAt: AT, name: 'Gion District', lat: 35.0037, lon: 135.7752 }),
  place({ id: 'pl_lg_05', addedAt: AT, name: 'Nijo Castle', lat: 35.014, lon: 135.7481 }),
  place({ id: 'pl_lg_06', addedAt: AT, name: 'Kinkaku-ji', lat: 35.0394, lon: 135.7292 }),
  place({ id: 'pl_lg_07', addedAt: AT, name: 'Arashiyama Bamboo Grove', lat: 35.017, lon: 135.6717 }),
  place({ id: 'pl_lg_08', addedAt: AT, name: 'Nishiki Market', lat: 35.005, lon: 135.7649 }),
  place({ id: 'pl_lg_09', addedAt: AT, name: 'Osaka Castle', lat: 34.6873, lon: 135.5262 }),
  place({ id: 'pl_lg_10', addedAt: AT, name: 'Dotonbori', lat: 34.6687, lon: 135.5015 }),
  place({ id: 'pl_lg_11', addedAt: AT, name: 'Umeda Sky Building', lat: 34.7052, lon: 135.4903 }),
  place({ id: 'pl_lg_12', addedAt: AT, name: 'Nara Park', lat: 34.6851, lon: 135.8431 }),
  place({ id: 'pl_lg_13', addedAt: AT, name: 'Todai-ji', lat: 34.6889, lon: 135.8398 }),
  place({ id: 'pl_lg_14', addedAt: AT, name: 'Kobe Harborland', lat: 34.6816, lon: 135.1816 }),
  place({ id: 'pl_lg_15', addedAt: AT, name: 'Himeji Castle', lat: 34.8394, lon: 134.6939 }),
];

export const LARGE_TRIP_PLAN: Plan = {
  id: 'plan_kansai_large_2026',
  user_id: 'user_fixture',
  title: 'Kansai — 15 Stops',
  places: LARGE_TRIP_PLACES,
  route: null,
  schema_version: 1,
  version: 1,
  updated_at: AT,
};
