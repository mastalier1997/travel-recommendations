import { notFound } from 'next/navigation';
import { Planner } from '@/components/planner/Planner';
import { SAMPLE_PLAN } from '@/lib/fixtures/sample-plan';
import { SINGLE_AREA_PLAN } from '@/lib/fixtures/single-area-plan';
import { MULTI_COUNTRY_PLAN } from '@/lib/fixtures/multi-country-plan';

const FIXTURES = {
  sample: SAMPLE_PLAN,
  'single-area': SINGLE_AREA_PLAN,
  'multi-country': MULTI_COUNTRY_PLAN,
};

// ponytail: local-only fixture preview, no DB writes — same NODE_ENV gate as
// /api/dev-login. Renders the Planner with no onSave, so nothing persists.
export default async function DevFixturePage({ params }: { params: Promise<{ name: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { name } = await params;
  const plan = FIXTURES[name as keyof typeof FIXTURES];
  if (!plan) notFound();

  return <Planner initialPlan={plan} />;
}
