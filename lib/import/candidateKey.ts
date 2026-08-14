import type { Candidate } from '@/lib/types';

/**
 * Stable identity for a candidate across separate geocode responses — providers
 * don't return a persistent id, so this is what SC 3.3.7's "same choice as last
 * time" lookup keys on. OSM ref wins when present; falls back to name+address.
 */
export function candidateKey(c: Candidate): string {
  return c.osm ? `osm:${c.osm.type}:${c.osm.id}` : `${c.name}|${c.address}`;
}
