import { notFound } from 'next/navigation';
import { Planner } from '@/components/planner/Planner';
import { SAMPLE_PLAN } from '@/lib/fixtures/sample-plan';
import { SINGLE_AREA_PLAN } from '@/lib/fixtures/single-area-plan';
import { MULTI_COUNTRY_PLAN } from '@/lib/fixtures/multi-country-plan';
import { LARGE_TRIP_PLAN } from '@/lib/fixtures/large-trip-plan';
import { PEEK_PLAN } from '@/lib/fixtures/peek-plan';

const FIXTURES = {
  sample: SAMPLE_PLAN,
  'single-area': SINGLE_AREA_PLAN,
  'multi-country': MULTI_COUNTRY_PLAN,
  'large-trip': LARGE_TRIP_PLAN,
  peek: PEEK_PLAN,
};

// ponytail: local-only fixture preview, no DB writes — same NODE_ENV gate as
// /api/dev-login. Renders the Planner with no onSave, so nothing persists.
export default async function DevFixturePage({ params }: { params: Promise<{ name: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { name } = await params;
  const plan = FIXTURES[name as keyof typeof FIXTURES];
  if (!plan) notFound();

  // Stub identity only — onSave/plans stay unset, nothing persists. This exists so
  // the account menu (and its axe coverage) is exercisable with no real Supabase user.
  return <Planner initialPlan={plan} account={{ email: 'dev@example.com' }} />;
}
