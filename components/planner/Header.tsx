'use client';

import styles from './planner.module.css';

type Props = {
  title: string;
  /** Track A replaces the single-option select with the user's real plan list. */
  plans?: { id: string; title: string }[];
};

export function Header({ title, plans }: Props) {
  const options = plans?.length ? plans : [{ id: 'current', title }];

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <span className={styles.logo} aria-hidden="true" />
        <span className={styles.wordmark}>Wanderlist</span>

        <label className="sr-only" htmlFor="plan-switcher">
          Current plan
        </label>
        <select id="plan-switcher" className={styles.select} defaultValue={options[0].id}>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <button type="button" className={styles.ghost}>
          + New plan
        </button>
      </div>

      <div className={styles.headerRight}>
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
