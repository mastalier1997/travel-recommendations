import { LoginForm } from './LoginForm';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import styles from './login.module.css';

export const metadata = { title: 'Sign in · Wanderlist' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>Sign in to Wanderlist</h1>
      {isSupabaseConfigured ? (
        <>
          <LoginForm next={next ?? '/plans'} />
          {process.env.NODE_ENV !== 'production' && (
            <p className={styles.hint}>
              Dev shortcut: <a href="/api/dev-login">sign in as dev@local.test</a> ·{' '}
              <a href="/dev/fixture">preview fixtures</a>
            </p>
          )}
        </>
      ) : (
        <p className={styles.hint}>
          Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY, or use the demo planner on the home page.
        </p>
      )}
    </main>
  );
}
