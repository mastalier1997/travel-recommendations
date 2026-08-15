'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Place } from '@/lib/types';
import { MAX_STOPS_PER_ROUTE } from '@/lib/types';
import type { SaveResult } from '@/lib/plan/saveState';
import { useImportDraft } from '@/lib/import/useImportDraft';
import { ImportScreen } from './ImportScreen';
import { ConfirmList } from './ConfirmList';
import styles from './import.module.css';

type Props = {
  planId: string;
  version: number;
  existingPlaceCount: number;
  onCommit: (input: { newPlaces: Place[]; version: number }) => Promise<SaveResult>;
};

/** Owns the draft hook and wires M4 (ImportScreen) to M3 (ConfirmList). The commit
 * step is the only network write here — everything before it is local/localStorage. */
export function ImportFlow({ planId, version, existingPlaceCount, onCommit }: Props) {
  const router = useRouter();
  const draft = useImportDraft(planId);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/parse-file', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) {
        setUploadError(body.error ?? 'Could not read that file.');
        return;
      }
      draft.addRows(body.text, 'line');
    } catch {
      setUploadError('Could not read that file.');
    } finally {
      setUploading(false);
    }
  };

  const commit = async () => {
    setCommitting(true);
    setCommitError(null);
    const newPlaces = draft.toPlaces();
    const result = await onCommit({ newPlaces, version });
    setCommitting(false);
    if (!result.ok) {
      setCommitError(
        'conflict' in result ? 'This plan changed elsewhere — reload and try again.' : result.error,
      );
      return;
    }
    draft.clear();
    router.push(`/plans/${planId}`);
  };

  const decidedCount = draft.draft.rows.filter(
    (r) => r.decision === 'accept' || r.decision === 'keep-unresolved',
  ).length;
  const capWarning =
    existingPlaceCount + decidedCount > MAX_STOPS_PER_ROUTE
      ? `This plan will have ${existingPlaceCount + decidedCount} stops — order auto-optimizes up to ${MAX_STOPS_PER_ROUTE}; this trip will route in whatever order you leave it.`
      : null;

  return (
    <main className={styles.wrap}>
      <ImportScreen
        onSubmitText={draft.addRows}
        onUploadFile={uploadFile}
        uploading={uploading}
        error={uploadError}
      />

      {draft.draft.rows.length > 0 && (
        <>
          {commitError && (
            <p role="alert" className={styles.error}>
              {commitError}
            </p>
          )}
          <ConfirmList
            rows={draft.draft.rows}
            unresolvedCount={draft.unresolvedCount}
            onSelectCandidate={draft.selectCandidate}
            onSkip={(rowId) => draft.decide(rowId, 'keep-unresolved')}
            onRetype={draft.retype}
            onRetry={draft.retry}
            onCommit={commit}
            committing={committing}
            capWarning={capWarning}
          />
        </>
      )}
    </main>
  );
}
