import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AccountMenu } from '@/components/planner/AccountMenu';
import { createPlan, deletePlan } from './actions';
import styles from './plans.module.css';

export const metadata = { title: 'Your plans · Wanderlist' };

export default async function PlansPage() {
  const supabase = await createClient();
  const [{ data }, { data: userData }] = await Promise.all([
    supabase.from('plans').select('id, title, places, updated_at').order('updated_at', { ascending: false }),
    supabase.auth.getUser(),
  ]);

  const plans = data ?? [];

  return (
    <main className={styles.wrap}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Your plans</h1>
        {userData.user && <AccountMenu email={userData.user.email ?? ''} />}
      </div>

      <form action={createPlan} className={styles.newForm}>
        <label htmlFor="new-title" className="sr-only">
          New plan name
        </label>
        <input
          id="new-title"
          name="title"
          className={styles.input}
          placeholder="Japan – Spring 2026"
          maxLength={120}
        />
        <button type="submit" className={`${styles.primary} on-accent`}>
          Create plan
        </button>
      </form>

      {plans.length === 0 ? (
        <p className={styles.empty}>No plans yet. Name one above to get started.</p>
      ) : (
        <ul className={styles.list} role="list">
          {plans.map((p) => {
            const count = Array.isArray(p.places) ? p.places.length : 0;
            return (
              <li key={p.id} className={styles.row}>
                <div>
                  <Link href={`/plans/${p.id}`} className={styles.link}>
                    {p.title}
                  </Link>
                  <p className={styles.meta}>
                    {count} stop{count === 1 ? '' : 's'} · updated{' '}
                    {new Date(p.updated_at).toISOString().slice(0, 10)}
                  </p>
                </div>

                <form action={deletePlan}>
                  <input type="hidden" name="id" value={p.id} />
                  {/* Unique accessible name across otherwise identical rows — voice
                      control users say "click delete Japan". */}
                  <button type="submit" className={styles.delete} aria-label={`Delete ${p.title}`}>
                    Delete
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
