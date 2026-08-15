'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SaveStatus } from '@/lib/hooks/useAutosave';
import type { Place, Route } from '@/lib/types';
import { ExportMenu } from './ExportMenu';
import { ThemeToggle } from './ThemeToggle';
import { AccountMenu } from './AccountMenu';
import styles from './planner.module.css';

type Props = {
  title: string;
  currentId?: string;
  plans?: { id: string; title: string }[];
  /** Undefined in fixture mode, where nothing is being saved. */
  saveStatus?: SaveStatus;
  places: Place[];
  route: Route | null;
  isMobile: boolean;
  /** False in fixture mode — there is no real plan row to import into. */
  canImport: boolean;
  /** Undefined in fixture mode — there is no signed-in user to show or sign out. */
  account?: { email: string };
};

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'All changes saved',
  conflict: 'Not saved',
  error: 'Not saved',
};

/**
 * Only 'saved' gets announced through the live region. 'saving' is stale by the
 * time a screen reader reads it out (saves settle in well under a second), and
 * conflict/error already get a more informative role="alert" elsewhere (see the
 * conflict/error banners in Planner.tsx) — a second polite announcement here would
 * just race that alert. The visible chip below still shows all four states.
 */
function announcedLabel(status: SaveStatus): string {
  return status === 'saved' ? SAVE_LABEL[status] : '';
}

export function Header({
  title,
  currentId,
  plans,
  saveStatus,
  places,
  route,
  isMobile,
  canImport,
  account,
}: Props) {
  const router = useRouter();
  const options = plans?.length ? plans : [{ id: currentId ?? 'current', title }];

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        {/* aria-label keeps the accessible name stable even though .wordmark's text
            is display:none below 768px — the logo mark alone is the mobile tap target. */}
        <Link href="/" className={styles.wordmarkLink} aria-label="Wanderlist — home">
          <span className={styles.logo} aria-hidden="true" />
          <span className={styles.wordmark}>Wanderlist</span>
        </Link>

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
          <>
            {/* Visible to everyone; not itself a live region — see announcedLabel. */}
            <span className={styles.saveStatus} aria-hidden="true">
              {SAVE_LABEL[saveStatus]}
            </span>
            <span role="status" className="sr-only">
              {announcedLabel(saveStatus)}
            </span>
          </>
        )}
        {canImport && currentId && (
          <Link href={`/plans/${currentId}/import`} className={styles.ghost}>
            Import places
          </Link>
        )}
        <ExportMenu title={title} places={places} route={route} isMobile={isMobile} />
        <ThemeToggle />
        {account ? (
          <AccountMenu email={account.email} />
        ) : (
          <span className={styles.avatar} aria-hidden="true">
            ··
          </span>
        )}
      </div>
    </header>
  );
}
