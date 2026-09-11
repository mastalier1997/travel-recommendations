import { notFound } from 'next/navigation';

const FIXTURES: { slug: string; label: string }[] = [
  { slug: 'sample', label: 'Sample plan — Kyoto + Osaka, 9 stops' },
  { slug: 'single-area', label: 'Single area — Kyoto only, 5 stops' },
  { slug: 'multi-country', label: 'Multi-country — Austria + Germany, 8 stops' },
  { slug: 'large-trip', label: 'Large trip — Kansai, 15 stops (heuristic solve)' },
  { slug: 'kl-bali', label: 'Kuala Lumpur to Bali — 5 stops, continental-scale map clustering' },
];

// ponytail: dev-only index of the fixture-preview routes, same NODE_ENV gate as
// /api/dev-login and /dev/fixture/[name].
export default function DevFixtureIndexPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main style={{ maxWidth: 480, margin: '56px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Fixture previews</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Renders the Planner directly from fixture data — no Supabase, nothing persists.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {FIXTURES.map((f) => (
          <li key={f.slug} style={{ padding: '10px 0', borderTop: '1px solid var(--border-hairline)' }}>
            <a href={`/dev/fixture/${f.slug}`}>{f.label}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
