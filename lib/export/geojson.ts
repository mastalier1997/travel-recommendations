import type { Plan } from '@/lib/types';

export function toGeoJson(plan: Pick<Plan, 'places' | 'route'>): string {
  const features: GeoJSON.Feature[] = plan.places
    .filter((p) => p.lat !== null && p.lon !== null)
    .map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon as number, p.lat as number] },
      properties: { name: p.name, description: p.description?.text ?? null },
    }));

  if (plan.route) {
    features.push({
      type: 'Feature',
      geometry: plan.route.geometry,
      properties: { name: 'Route' },
    });
  }

  const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
  return JSON.stringify(collection, null, 2);
}
