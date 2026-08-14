'use client';

import { useId, type ReactNode } from 'react';
import styles from './planner.module.css';

type Props = {
  expanded: boolean;
  onToggle: () => void;
  /** True while a drag is in flight (track G) — the handle is genuinely unavailable. */
  locked?: boolean;
  /** Stays interactive at peek. */
  header: ReactNode;
  /** Inert at peek, so Tab cannot walk into clipped, invisible cards. */
  children: ReactNode;
};

/**
 * Deliberately not a dialog and deliberately not focus-trapped. At peek the map is
 * interactive behind it; at full there is nothing behind worth trapping, and a trap
 * would strand keyboard users away from the header's plan and export controls.
 */
export function BottomSheet({ expanded, onToggle, locked, header, children }: Props) {
  const headingId = useId();
  const bodyId = useId();

  return (
    <section
      className={styles.sheet}
      data-expanded={expanded}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="sr-only">
        Stops
      </h2>

      <button
        type="button"
        className={styles.grab}
        onClick={onToggle}
        disabled={locked}
        aria-expanded={expanded}
        aria-controls={bodyId}
      >
        <span className={styles.grabPill} aria-hidden="true" />
        <span className="sr-only">{expanded ? 'Collapse stops list' : 'Expand stops list'}</span>
      </button>

      <p className="sr-only" role="status">
        {expanded ? 'Stops list expanded.' : 'Stops list collapsed.'}
      </p>

      <div className={styles.sheetHeader}>{header}</div>

      <div id={bodyId} className={styles.sheetBody} data-scroll inert={!expanded}>
        {children}
      </div>
    </section>
  );
}
