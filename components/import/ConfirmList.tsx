'use client';

import { useEffect, useRef, useState } from 'react';
import type { DraftRow } from '@/lib/types';
import { CandidateRow } from './CandidateRow';
import styles from './import.module.css';

/** This row's own reference point — its explicitly accepted candidate — used as
 * this row's contribution to every OTHER row's "how far is this from the rest of
 * the batch" comparison. Only `decision === 'accept'` counts: a row the user
 * skipped never becomes a place (see draft.ts's toPlaces), so its coordinates
 * shouldn't anchor anyone else's outlier check; an undecided row's top match is
 * likewise not a real commitment yet, and using it would make a sibling row's
 * warning flip on/off purely because someone else's selection changed. */
function bestGuessPoint(row: DraftRow): { lat: number; lon: number } | null {
  if (row.decision !== 'accept' || row.selectedIndex === null) return null;
  const c = row.candidates[row.selectedIndex];
  return c ? { lat: c.lat, lon: c.lon } : null;
}

type Props = {
  rows: DraftRow[];
  unresolvedCount: number;
  onSelectCandidate: (rowId: string, index: number) => void;
  onSkip: (rowId: string) => void;
  onRetype: (rowId: string, raw: string) => void;
  onRetry: (rowId: string) => void;
  onRemove: (rowId: string) => void;
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
  onRemove,
  onCommit,
  committing,
  capWarning,
}: Props) {
  const [showErrorSummary, setShowErrorSummary] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [liveMessage, setLiveMessage] = useState('');
  // Queued, not a single slot — two removals can land before this effect runs once
  // (e.g. a fast double-click), and a single slot would silently drop the first.
  // Captured at click time (before the row is actually gone) so the effect below
  // knows what disappeared and where it used to sit in the list.
  const pendingRemovalsRef = useRef<{ rowId: string; index: number; raw: string }[]>([]);

  const unresolvedRows = rows.filter((r) => r.decision === null);

  const attemptCommit = () => {
    if (unresolvedCount > 0) {
      setShowErrorSummary(true);
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    onCommit();
  };

  const handleRemove = (rowId: string) => {
    const index = rows.findIndex((r) => r.id === rowId);
    pendingRemovalsRef.current.push({ rowId, index, raw: rows[index]?.raw ?? '' });
    onRemove(rowId);
  };

  // Removing a row unmounts its own Remove button — without this, focus would fall to
  // <body> and both keyboard and screen-reader users would lose their place.
  useEffect(() => {
    const pending = pendingRemovalsRef.current;
    pendingRemovalsRef.current = [];
    const removed = pending.filter((p) => !rows.some((r) => r.id === p.rowId));
    if (removed.length === 0) return;

    const last = removed[removed.length - 1];
    // ponytail: rows.length === 0 leaves nextRow undefined and focus falls to <body> —
    // ImportFlow unmounts this whole component once the draft is empty, so there is
    // nothing left here to move focus to anyway.
    const nextRow = rows[last.index] ?? rows[Math.max(0, last.index - 1)] ?? rows[rows.length - 1];
    const container = nextRow && document.getElementById(`resolve-${nextRow.id}`);
    container?.querySelector<HTMLElement>('button, input, a[href]')?.focus();

    const names = removed.map((r) => `"${r.raw}"`).join(', ');
    setLiveMessage(`Removed ${names}. ${rows.length} place${rows.length === 1 ? '' : 's'} left.`);
  }, [rows]);

  return (
    <div>
      {/* Row's own alert/status already announces its own change; this covers the
          one thing that has no DOM node left to announce from once it fires. */}
      <p role="status" className="sr-only">
        {liveMessage}
      </p>

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
              // Every other row's best guess — never this row's own, or a candidate
              // would end up flagged as "far from itself".
              otherPoints={rows.filter((r) => r.id !== row.id).map(bestGuessPoint).filter((p) => p !== null)}
              onSelectCandidate={(i) => onSelectCandidate(row.id, i)}
              onSkip={() => onSkip(row.id)}
              onRetype={(raw) => onRetype(row.id, raw)}
              onRetry={() => onRetry(row.id)}
              onRemove={() => handleRemove(row.id)}
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
