import { Planner } from '@/components/planner/Planner';
import { SAMPLE_PLAN } from '@/lib/fixtures/sample-plan';

/**
 * Track A replaces the fixture with the user's real plan row loaded through the
 * cookie-bound Supabase client, and puts /plans in front of this.
 */
export default function Home() {
  return <Planner initialPlan={SAMPLE_PLAN} />;
}
