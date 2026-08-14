import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { planFromRow } from '@/lib/plan/fromRow';
import { ImportFlow } from '@/components/import/ImportFlow';
import { commitImportedPlaces } from '../actions';

export const metadata = { title: 'Add places · Wanderlist' };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase.from('plans').select('*').eq('id', id).maybeSingle();
  if (!row) notFound();

  const plan = planFromRow(row);

  return (
    <ImportFlow
      planId={id}
      version={plan.version}
      existingPlaceCount={plan.places.length}
      onCommit={commitImportedPlaces.bind(null, id)}
    />
  );
}
