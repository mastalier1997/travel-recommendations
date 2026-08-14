'use client';

import { useRef, useState } from 'react';
import type { DraftRow } from '@/lib/types';
import { CandidateRow } from './CandidateRow';
import styles from './import.module.css';

type Props = {
  rows: DraftRow[];
  unresolvedCount: number;
  onSelectCandidate: (rowId: string, index: number) => void;
  onSkip: (rowId: string) => void;
  onRetype: (rowId: string, raw: string) => void;
  onRetry: (rowId: string) => void;
  onCommit: () => void;
  committing: boolean;
  capWarning: string | null;
};

/** M3 — renders one CandidateRow per draft row, plus the sticky "Confirm N places" bar. */
export function ConfirmList({
  rows,
  unresolvedCount,
  onSelectCandidate,
  onSkip,
  onRetype,
  onRetry,
  onCommit,
  committing,
  capWarning,
}: Props) {
  const [showErrorSummary, setShowErrorSummary] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const unresolvedRows = rows.filter((r) => r.decision === null);

  const attemptCommit = () => {
    if (unresolvedCount > 0) {
      setShowErrorSummary(true);
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    onCommit();
  };

  return (
    <div>
      {showErrorSummary && unresolvedCount > 0 && (
        <div role="alert" ref={errorSummaryRef} tabIndex={-1} className={styles.errorSummary}>
          <p>
            Confirm {unresolvedCount} more place{unresolvedCount === 1 ? '' : 's'} before continuing:
          </p>
          <ul role="list">
            {unresolvedRows.map((r) => (
              <li key={r.id}>
                <a href={`#resolve-${r.id}`}>{r.raw}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol role="list" className={styles.rows}>
        {rows.map((row) => (
          <li key={row.id} className={styles.row}>
            <CandidateRow
              row={row}
              onSelectCandidate={(i) => onSelectCandidate(row.id, i)}
              onSkip={() => onSkip(row.id)}
              onRetype={(raw) => onRetype(row.id, raw)}
              onRetry={() => onRetry(row.id)}
            />
          </li>
        ))}
      </ol>

      <div className={styles.stickyBar}>
        {capWarning && (
          <p className={styles.warning} role="status">
            {capWarning}
          </p>
        )}
        <button type="button" onClick={attemptCommit} disabled={committing}>
          {committing ? 'Adding…' : `Confirm ${rows.length} place${rows.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
