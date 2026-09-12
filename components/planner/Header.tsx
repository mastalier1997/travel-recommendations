'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SaveStatus } from '@/lib/hooks/useAutosave';
import type { Place, Route } from '@/lib/types';
import { normalizeTitle, MAX_TITLE_LENGTH, type RenameResult } from '@/lib/plan/title';
import { ExportMenu } from './ExportMenu';
import { ThemeToggle } from './ThemeToggle';
import { AccountMenu } from './AccountMenu';
import styles from './planner.module.css';

type Props = {
  title: string;
  /** Absent in fixture mode: nowhere real to persist a rename to — no trigger renders. */
  onRename?: (title: string) => Promise<RenameResult>;
  /** Called with the server's cleaned title once a rename actually succeeds. */
  onRenamed?: (title: string) => void;
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
  onRename,
  onRenamed,
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
  const baseOptions = plans?.length ? plans : [{ id: currentId ?? 'current', title }];
  // Overridden locally so the switcher reflects a rename instantly, regardless of
  // revalidatePath timing — the id-bound <select value> means changing an
  // option's text never disturbs the current selection.
  const options = baseOptions.map((p) => (p.id === currentId ? { ...p, title } : p));

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        {/* aria-label keeps the accessible name stable even though .wordmark's text
            is display:none below 768px — the logo mark alone is the mobile tap target. */}
        <Link href="/" className={styles.wordmarkLink} aria-label="Wanderlist — home">
          <span className={styles.logo} aria-hidden="true" />
          <span className={styles.wordmark}>Wanderlist</span>
        </Link>

        <PlanTitle title={title} onRename={onRename} onRenamed={onRenamed} />

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

type PlanTitleProps = {
  title: string;
  onRename?: (title: string) => Promise<RenameResult>;
  onRenamed?: (title: string) => void;
};

/**
 * The plan's real, visible <h1> — previously this text existed only inside the
 * plan-switcher <select>'s selected option and a screen-reader-only heading in
 * Planner.tsx. Rename lives here rather than on the switcher itself: overloading
 * one control with both "switch plans" and "rename this plan" would be genuinely
 * ambiguous, not just inconsistent.
 *
 * Not a popover (see CardActions) — popover="auto" light-dismisses on any outside
 * click, which would silently discard typed text. This stays open until an
 * explicit Save or Cancel.
 */
function PlanTitle({ title, onRename, onRenamed }: PlanTitleProps) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Guards the focus-restore effect below from firing on initial mount (editing
  // starts false) — it should only return focus to the trigger when editing was
  // just closed, never steal focus on first render.
  const wasEditingRef = useRef(false);
  // Monotonic request token: cancel() bumps it to invalidate whatever
  // handleSubmit call is currently in flight, so a response that resolves
  // AFTER the user has already cancelled can never apply itself anyway.
  const requestIdRef = useRef(0);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    if (editing) {
      wasEditingRef.current = true;
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (wasEditingRef.current) {
      wasEditingRef.current = false;
      triggerRef.current?.focus();
    }
  }, [editing]);

  const cancel = () => {
    requestIdRef.current++;
    setErrorMsg(null);
    setPending(false);
    setEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!onRename || pending) return;

    const normalized = normalizeTitle(inputRef.current?.value ?? '');
    if (!normalized.ok) {
      setErrorMsg('Enter a name for this plan.');
      inputRef.current?.focus();
      return;
    }
    // Nothing actually changed — close without a round trip (also skips an
    // unnecessary updated_at-adjacent write).
    if (normalized.title === title) {
      cancel();
      return;
    }

    const requestId = ++requestIdRef.current;
    setPending(true);
    setErrorMsg(null);
    const result = await onRename(normalized.title);
    // The user clicked Cancel (or fired another submit) while this was in
    // flight — requestIdRef has moved on, so ignore this response entirely,
    // even a success. Applying it now would silently un-cancel a title the
    // user explicitly backed out of.
    if (requestId !== requestIdRef.current) return;
    setPending(false);

    if (result.ok) {
      onRenamed?.(result.title);
      setEditing(false);
      return;
    }
    // Never silently revert what the user typed — the editor stays open with
    // their text intact so Save can just be pressed again.
    setErrorMsg('missing' in result ? "This plan could not be found any more — it may have been deleted." : result.error);
    inputRef.current?.focus();
  };

  // The <h1> stays mounted in both states — axe's page-has-heading-one rule (and
  // more generally, the page's own structure) shouldn't momentarily lose its only
  // level-one heading just because an edit is in progress. Editing shows the form
  // alongside it, a sibling, not a replacement.
  return (
    <div className={styles.planIdentity}>
      <h1 className={styles.planTitle}>{title}</h1>
      {editing ? (
        <form onSubmit={handleSubmit} className={styles.renameForm} noValidate>
          <label htmlFor={inputId} className="sr-only">
            New name for {title}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            name="title"
            className={styles.renameInput}
            defaultValue={title}
            maxLength={MAX_TITLE_LENGTH}
            required
            autoComplete="off"
            aria-invalid={errorMsg ? true : undefined}
            aria-describedby={errorMsg ? errorId : undefined}
            onKeyDown={(e) => {
              // stopPropagation: this header also hosts popover menus that
              // light-dismiss on Escape — without this, Escape here could bubble
              // into closing something else instead of just cancelling the rename.
              if (e.key === 'Escape') {
                e.stopPropagation();
                cancel();
              }
            }}
          />
          <button type="submit" className={styles.primary} disabled={pending} aria-label={`Save new name for ${title}`}>
            Save
          </button>
          <button type="button" className={styles.ghost} onClick={cancel} aria-label={`Cancel renaming ${title}`}>
            Cancel
          </button>
          {errorMsg && (
            <p id={errorId} role="alert" data-testid="rename-error" className={styles.fieldError}>
              {errorMsg}
            </p>
          )}
        </form>
      ) : (
        onRename && (
          <button
            type="button"
            ref={triggerRef}
            className={styles.renameTrigger}
            onClick={() => setEditing(true)}
            aria-label={`Rename plan, ${title}`}
          >
            <span aria-hidden="true">✎</span>
          </button>
        )
      )}
    </div>
  );
}
