import { notFound } from 'next/navigation';
import { ImportFixture } from '@/components/import/ImportFixture';

export const metadata = { title: 'Add places (fixture) · Wanderlist' };

// ponytail: local-only fixture preview, no DB writes — same NODE_ENV gate as the
// Planner fixtures at /dev/fixture/[name].
export default function DevFixtureImportPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <ImportFixture />;
}
