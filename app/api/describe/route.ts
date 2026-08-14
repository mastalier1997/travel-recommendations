import { MOCK } from '@/lib/mock';
import type { Description, DescribeRequest, DescribeResponse } from '@/lib/types';
import { SAMPLE_PLACES } from '@/lib/fixtures/sample-plan';
import { describeMany } from '@/lib/content/describe';

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

  const descriptions = await describeMany(places);
  return Response.json({ descriptions } satisfies DescribeResponse);
}
