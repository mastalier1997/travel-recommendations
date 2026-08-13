import { MOCK, notImplemented } from '@/lib/mock';
import type { Description, DescribeRequest, DescribeResponse } from '@/lib/types';
import { SAMPLE_PLACES } from '@/lib/fixtures/sample-plan';

const BY_NAME = new Map(SAMPLE_PLACES.map((p) => [p.name.toLowerCase(), p.description]));

export async function POST(req: Request) {
  const { places } = (await req.json()) as DescribeRequest;
  if (!Array.isArray(places)) return Response.json({ error: 'places is required' }, { status: 400 });

  if (MOCK) {
    const descriptions: Record<string, Description | null> = {};
    for (const p of places) descriptions[p.id] = BY_NAME.get(p.name.toLowerCase()) ?? null;
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ descriptions } satisfies DescribeResponse);
  }

  // Track E: the ladder — extratags.wikidata → Wikipedia summary; else Wikipedia
  // geosearch @150m with name matching; else Wikidata `description`; else OSM tag label.
  // Fan out at concurrency 5. Record which rung answered in Description.source.
  return notImplemented('E');
}
