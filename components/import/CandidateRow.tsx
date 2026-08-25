'use client';

import { useId, useState } from 'react';
import type { DraftRow } from '@/lib/types';
import { labelForOsmTag } from '@/lib/content/osm-labels';
import { nearestDistanceM, OUTLIER_DISTANCE_M } from '@/lib/import/outlier';
import { formatDistance } from '@/lib/format';
import styles from './import.module.css';

type Props = {
  row: DraftRow;
  /** Every other row's best-guess point, for the "far from the rest of this
   * import" check — never this row's own (see ConfirmList's bestGuessPoint). */
  otherPoints: { lat: number; lon: number }[];
  onSelectCandidate: (index: number) => void;
  onSkip: () => void;
  onRetype: (raw: string) => void;
  onRetry: () => void;
  onRemove: () => void;
};

/**
 * The one component both the M3 full-screen confirm flow and a future desktop
 * inline-card variant render (PLAN.md: "must render the same component with the
 * same markup"). Candidates never carry a thumbnail — name + region text is the
 * whole identity, so there is nothing decorative to mark alt="" on here.
 */
export function CandidateRow({ row, otherPoints, onSelectCandidate, onSkip, onRetype, onRetry, onRemove }: Props) {
  const groupName = useId();
  const [retypeValue, setRetypeValue] = useState(row.raw);

  if (row.state === 'pending' || row.state === 'resolving') {
    return (
      <div id={`resolve-${row.id}`} className={styles.fieldset}>
        <p role="status" className={styles.meta}>
          Looking up &ldquo;{row.raw}&rdquo;…
        </p>
      </div>
    );
  }

  if (row.state === 'error') {
    return (
      <div id={`resolve-${row.id}`} className={styles.fieldset}>
        <p role="alert" className={styles.name}>
          {row.error ?? 'Could not reach the geocoder.'} &mdash;{' '}
          <span className={styles.mono}>&ldquo;{row.raw}&rdquo;</span>
        </p>
        <div className={styles.rowActions}>
          <button type="button" className={styles.retryBtn} onClick={onRetry}>
            Retry
          </button>
          <button type="button" className={styles.skipBtn} onClick={onSkip}>
            Skip &mdash; keep &ldquo;{row.raw}&rdquo; as plain text
          </button>
          <button
            type="button"
            className={styles.removeBtn}
            aria-label={`Remove "${row.raw}" from this import`}
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  if (row.state === 'none') {
    return (
      <div id={`resolve-${row.id}`} className={styles.fieldset}>
        <p className={styles.name}>
          No matches for <span className={styles.mono}>&ldquo;{row.raw}&rdquo;</span>.
        </p>
        <form
          className={styles.retypeRow}
          onSubmit={(e) => {
            e.preventDefault();
            if (retypeValue.trim()) onRetype(retypeValue.trim());
          }}
        >
          <label htmlFor={`retype-${row.id}`} className="sr-only">
            Retype &ldquo;{row.raw}&rdquo;
          </label>
          <input
            id={`retype-${row.id}`}
            value={retypeValue}
            onChange={(e) => setRetypeValue(e.target.value)}
          />
          <button type="submit">Search again</button>
        </form>
        <div className={styles.rowActions}>
          <button type="button" className={styles.skipBtn} onClick={onSkip}>
            Skip &mdash; keep &ldquo;{row.raw}&rdquo; as plain text
          </button>
          <button
            type="button"
            className={styles.removeBtn}
            aria-label={`Remove "${row.raw}" from this import`}
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  // 'single' or 'multiple'
  return (
    <fieldset className={styles.fieldset} id={`resolve-${row.id}`}>
      <legend>
        Which place is <span className={styles.mono}>&ldquo;{row.raw}&rdquo;</span>?
      </legend>

      {row.candidates.map((c, i) => {
        const category = labelForOsmTag(c.class, c.tag);
        const nearestM = nearestDistanceM(c, otherPoints);
        const isOutlier = nearestM !== null && nearestM > OUTLIER_DISTANCE_M;
        return (
          <label key={i} className={styles.candidateLabel}>
            <input
              type="radio"
              name={groupName}
              required
              checked={row.selectedIndex === i && row.decision === 'accept'}
              onChange={() => onSelectCandidate(i)}
            />
            <span className={styles.name}>{c.name}</span>
            <span className={styles.meta}>
              {category && <span className={styles.categoryChip}>{category}</span>}
              {c.address}
            </span>
            {/* Self-describing text, not a color-only warning — same rule the rest
                of the app follows for anything that isn't purely decorative. */}
            {isOutlier && (
              <span className={styles.outlierWarning}>
                {formatDistance(nearestM)} from the rest of this import — check this is right
              </span>
            )}
          </label>
        );
      })}

      <label className={styles.candidateLabel}>
        <input
          type="radio"
          name={groupName}
          required
          checked={row.decision === 'keep-unresolved'}
          onChange={onSkip}
        />
        <span className={styles.name}>Skip this place</span>
        <span className={styles.meta}>
          Keeps &ldquo;{row.raw}&rdquo; as plain text, no map pin
        </span>
      </label>
    </fieldset>
  );
}
