import type { Plan } from '@/lib/types';
import { escapeXml } from './xml';

export function toKml(plan: Pick<Plan, 'title' | 'places' | 'route'>): string {
  const placemarks = plan.places
    .filter((p) => p.lat !== null && p.lon !== null)
    .map(
      (p) => `    <Placemark>
      <name>${escapeXml(p.name)}</name>
      <description>${escapeXml(p.description?.text ?? '')}</description>
      <Point><coordinates>${p.lon},${p.lat},0</coordinates></Point>
    </Placemark>`,
    )
    .join('\n');

  const route = plan.route
    ? `    <Placemark>
      <name>Route</name>
      <LineString>
        <coordinates>${plan.route.geometry.coordinates.map(([lon, lat]) => `${lon},${lat},0`).join(' ')}</coordinates>
      </LineString>
    </Placemark>\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(plan.title)}</name>
${placemarks}
${route}  </Document>
</kml>
`;
}
