import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { planFromRow } from '@/lib/plan/fromRow';
import { Planner } from '@/components/planner/Planner';
import { savePlan } from './actions';

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS does the ownership filter, so there is no user_id clause here. A plan
  // belonging to someone else simply returns no row.
  const [{ data: row }, { data: all }] = await Promise.all([
    supabase.from('plans').select('*').eq('id', id).maybeSingle(),
    supabase.from('plans').select('id, title').order('updated_at', { ascending: false }),
  ]);

  if (!row) notFound();

  return (
    <Planner
      initialPlan={planFromRow(row)}
      onSave={savePlan.bind(null, id)}
      plans={(all ?? []) as { id: string; title: string }[]}
    />
  );
}
