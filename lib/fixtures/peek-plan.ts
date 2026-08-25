import type { Plan, Place } from '@/lib/types';
import { place } from './place';

/**
 * One country group past PlaceList's PEEK_N (4) so the "+N more — Expand" partial
 * reveal and the "Showing X of Y · Expand all" footer actually have something to
 * do — MULTI_COUNTRY_PLAN's biggest group tops out at exactly 4, which never
 * triggers peeking. Minimal place data (no descriptions), same reasoning as
 * LARGE_TRIP_PLAN: this exists to exercise a threshold, not to be a narrative demo.
 * `route: null` on purpose — peeking doesn't depend on having a solved route.
 */

const AT = '2026-08-04T09:00:00.000Z';

export const PEEK_PLACES: Place[] = [
  place({ id: 'pl_pk_01', addedAt: AT, name: 'Porto Cathedral', lat: 41.1457, lon: -8.6109, countryCode: 'PT' }),
  place({ id: 'pl_pk_02', addedAt: AT, name: 'Livraria Lello', lat: 41.1469, lon: -8.6148, countryCode: 'PT' }),
  place({ id: 'pl_pk_03', addedAt: AT, name: 'Dom Luís I Bridge', lat: 41.1396, lon: -8.6109, countryCode: 'PT' }),
  place({ id: 'pl_pk_04', addedAt: AT, name: 'Ribeira District', lat: 41.1405, lon: -8.6118, countryCode: 'PT' }),
  place({ id: 'pl_pk_05', addedAt: AT, name: 'Palácio da Bolsa', lat: 41.1414, lon: -8.6132, countryCode: 'PT' }),
  place({ id: 'pl_pk_06', addedAt: AT, name: 'Clérigos Tower', lat: 41.1456, lon: -8.6142, countryCode: 'PT' }),
  place({ id: 'pl_pk_07', addedAt: AT, name: 'Alcázar of Seville', lat: 37.3838, lon: -5.99, countryCode: 'ES' }),
  place({ id: 'pl_pk_08', addedAt: AT, name: 'Plaza de España', lat: 37.3773, lon: -5.9869, countryCode: 'ES' }),
];

export const PEEK_PLAN: Plan = {
  id: 'plan_peek_demo',
  user_id: 'user_fixture',
  title: 'Peek Demo — Porto & Seville',
  places: PEEK_PLACES,
  route: null,
  schema_version: 1,
  version: 1,
  updated_at: AT,
};
