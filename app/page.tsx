import { SAMPLE_PLAN } from '@/lib/fixtures/sample-plan';
import { isRouteStale } from '@/lib/routing/order';

/**
 * Placeholder. Proves the fixture, the tokens and the build all load.
 * Track B replaces this with the real planner; track A adds /plans in front of it.
 */
export default function Home() {
  const { title, places, route } = SAMPLE_PLAN;
  const km = Math.round((route?.totalDistanceM ?? 0) / 1000);
  const h = Math.floor((route?.totalDurationS ?? 0) / 3600);
  const m = Math.round(((route?.totalDurationS ?? 0) % 3600) / 60);

  return (
    <main style={{ padding: 56, maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>{title}</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' }}>
        {places.length} stops · {h}h {m}m · {km} km ·{' '}
        {isRouteStale(places, route) ? 'route stale' : 'route current'}
      </p>
      <ol role="list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {places.map((p, i) => (
          <li key={p.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border-hairline)' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {i + 1}. {p.name}
            </span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)' }}>
              {p.description?.text}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
