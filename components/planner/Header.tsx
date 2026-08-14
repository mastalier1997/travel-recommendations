'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SaveStatus } from '@/lib/hooks/useAutosave';
import styles from './planner.module.css';

type Props = {
  title: string;
  currentId?: string;
  plans?: { id: string; title: string }[];
  /** Undefined in fixture mode, where nothing is being saved. */
  saveStatus?: SaveStatus;
};

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'All changes saved',
  conflict: 'Not saved',
  error: 'Not saved',
};

export function Header({ title, currentId, plans, saveStatus }: Props) {
  const router = useRouter();
  const options = plans?.length ? plans : [{ id: currentId ?? 'current', title }];

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <span className={styles.logo} aria-hidden="true" />
        <span className={styles.wordmark}>Wanderlist</span>

        <label className="sr-only" htmlFor="plan-switcher">
          Current plan
        </label>
        <select
          id="plan-switcher"
          className={styles.select}
          value={currentId ?? options[0].id}
          onChange={(e) => router.push(`/plans/${e.target.value}`)}
          disabled={!plans?.length}
        >
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        {plans ? (
          <Link href="/plans" className={styles.ghost}>
            All plans
          </Link>
        ) : (
          <button type="button" className={styles.ghost}>
            + New plan
          </button>
        )}
      </div>

      <div className={styles.headerRight}>
        {saveStatus && (
          /* Polite, and only ever a short phrase — this fires on every autosave. */
          <span className={styles.saveStatus} role="status">
            {SAVE_LABEL[saveStatus]}
          </span>
        )}
        {/* Track H hangs the KML/GPX/GeoJSON popover off this trigger. */}
        <button type="button" className={styles.ghost}>
          Export
        </button>
        <span className={styles.avatar} aria-hidden="true">
          MK
        </span>
      </div>
    </header>
  );
}
