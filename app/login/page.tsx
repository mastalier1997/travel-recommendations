import { LoginForm } from './LoginForm';
import { AutoFocusH1 } from './AutoFocusH1';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import styles from './login.module.css';

export const metadata = { title: 'Sign in · Wanderlist' };

const REASON_MESSAGE: Record<string, string> = {
  expired: 'For your security, we sign you out after 30 days. Sign in again to get back to your plans.',
  signedout: "You're signed out.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string; error?: string }>;
}) {
  const { next, reason, error } = await searchParams;

  const message =
    error === 'link'
      ? "That sign-in link didn't work — it may have expired. Enter your email to get a new one."
      : reason && REASON_MESSAGE[reason];

  return (
    <main className={styles.wrap}>
      <AutoFocusH1 className={styles.title} describedBy={message ? 'login-reason' : undefined}>
        Sign in to Wanderlist
      </AutoFocusH1>
      {message && (
        <p id="login-reason" className={styles.hint}>
          {message}
        </p>
      )}
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
