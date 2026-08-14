import type { Plan } from '@/lib/types';
import { escapeXml } from './xml';

export function toGpx(plan: Pick<Plan, 'title' | 'places' | 'route'>): string {
  const waypoints = plan.places
    .filter((p) => p.lat !== null && p.lon !== null)
    .map(
      (p) => `  <wpt lat="${p.lat}" lon="${p.lon}">
    <name>${escapeXml(p.name)}</name>
    <desc>${escapeXml(p.description?.text ?? '')}</desc>
  </wpt>`,
    )
    .join('\n');

  const track = plan.route
    ? `  <trk>
    <name>${escapeXml(plan.title)}</name>
    <trkseg>
${plan.route.geometry.coordinates.map(([lon, lat]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`).join('\n')}
    </trkseg>
  </trk>\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wanderlist" xmlns="http://www.topografix.com/GPX/1/1">
${waypoints}
${track}</gpx>
`;
}
