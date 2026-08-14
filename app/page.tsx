import { redirect } from 'next/navigation';
import { Planner } from '@/components/planner/Planner';
import { SAMPLE_PLAN } from '@/lib/fixtures/sample-plan';
import { isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * With Supabase configured this is just the door to /plans. Without it, the fixture
 * planner still runs — that is what lets the remaining tracks work with no project
 * and no credentials.
 */
export default function Home() {
  if (isSupabaseConfigured) redirect('/plans');
  return <Planner initialPlan={SAMPLE_PLAN} />;
}
