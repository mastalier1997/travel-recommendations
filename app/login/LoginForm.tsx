'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import styles from './login.module.css';

/**
 * Magic link only. Nothing to store, no reset flow, and it satisfies SC 3.3.8
 * Accessible Authentication without a password manager in the loop.
 */
export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const redirectTo = (path: string) =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo(next) },
    });

    if (error) {
      setState('error');
      setMessage(error.message);
    } else {
      setState('sent');
      setMessage(`Check ${email} for a sign-in link.`);
    }
  }

  async function onGoogleClick() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo(next) },
    });
    if (error) {
      setState('error');
      setMessage(error.message);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onGoogleClick}
        className={styles.google}
        disabled={state === 'sending' || state === 'sent'}
      >
        Continue with Google
      </button>

      <div className={styles.divider}>or</div>

      <form onSubmit={onSubmit} className={styles.form}>
        <label htmlFor="email" className={styles.label}>
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
          aria-describedby="email-hint"
          disabled={state === 'sending' || state === 'sent'}
        />
        <p id="email-hint" className={styles.hint}>
          We email you a link — there is no password to remember.
        </p>

        <button
          type="submit"
          className={`${styles.submit} on-accent`}
          disabled={state === 'sending' || state === 'sent'}
        >
          {state === 'sending' ? 'Sending…' : 'Email me a link'}
        </button>

        {message && (
          <p className={styles.message} role={state === 'error' ? 'alert' : 'status'}>
            {message}
          </p>
        )}
      </form>
    </>
  );
}
