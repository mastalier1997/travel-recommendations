import type { Plan, Place } from '@/lib/types';
import { place } from './place';

/**
 * The exact shape of the reported bug: Kuala Lumpur -> Singapore -> Jakarta ->
 * Yogyakarta -> Bali. Three of these (Jakarta/Yogyakarta/Bali) share one
 * countryCode ('ID') but are ~1000km apart — the case the old clusterByGroup
 * (band + flat stop-count) collapsed into one badge once zoomed out past 'close'.
 * `route: null`, same as LARGE_TRIP_PLAN — this fixture exists to exercise map
 * clustering, not routing, and an intercontinental-scale trip is exactly what
 * OSRM's public demo server can't route anyway (see lib/routing/osrm.ts's notes).
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

export const KL_BALI_PLAN: Plan = {
  id: 'plan_kl_bali_2026',
  user_id: 'user_fixture',
  title: 'Kuala Lumpur to Bali',
  places: KL_BALI_PLACES,
  route: null,
  schema_version: 1,
  version: 1,
  updated_at: AT,
};
