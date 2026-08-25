'use client';

import { useId, useRef } from 'react';
import { usePopoverPosition } from '@/lib/hooks/usePopoverPosition';
import styles from './planner.module.css';

type Props = {
  name: string;
  index: number;
  total: number;
  onMove: (delta: number) => void;
  onMoveTo: (to: number) => void;
  onRemove: () => void;
};

/**
 * The single-pointer alternative to dragging. SC 2.5.7 wants something a touch or
 * switch user can *tap* — keyboard support alone does not satisfy it — so this is the
 * compliance floor and drag is the enhancement on top.
 *
 * Built on the native popover API: Escape, light dismiss and top-layer stacking come
 * for free, which is the whole reason not to hand-roll a menu here. On mobile this
 * renders as a full-width bottom sheet (`.menuSheet` — CSS only, same element, same
 * popover mechanics) matching the design's own mobile pattern, rather than the small
 * floating box desktop uses.
 */
export function CardActions({ name, index, total, onMove, onMoveTo, onRemove }: Props) {
  const id = useId().replace(/:/g, '');
  const menuId = `actions-${id}`;
  const identityId = `actions-identity-${id}`;
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  usePopoverPosition(triggerRef, ref, { width: 216, cssControlsMobile: true });

  // Explicit, not redundant with usePopoverPosition's own refocus-on-close: when
  // this runs, focus is still on the menu item that was just clicked, not <body>,
  // so that hook's `activeElement === document.body` check is false here — it
  // only fires for light-dismiss (Escape, click-outside), where nothing else
  // ever focuses anything.
  const close = () => {
    ref.current?.hidePopover();
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={styles.actionsTrigger}
        popoverTarget={menuId}
        aria-label={`Actions for stop ${index + 1}, ${name}`}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      <div
        id={menuId}
        popover="auto"
        ref={ref}
        className={`${styles.menu} ${styles.menuSheet}`}
        aria-labelledby={identityId}
      >
        <p id={identityId} className={styles.menuIdentity}>
          {name}
        </p>

        <button
          type="button"
          className={styles.menuItem}
          aria-disabled={index === 0}
          onClick={() => {
            if (index > 0) onMove(-1);
            close();
          }}
        >
          Move up
        </button>
        <button
          type="button"
          className={styles.menuItem}
          aria-disabled={index === total - 1}
          onClick={() => {
            if (index < total - 1) onMove(1);
            close();
          }}
        >
          Move down
        </button>

        <label className={styles.menuField}>
          Move to position
          {/* The only sane path for "stop 9 to position 2" on a touch screen. */}
          <select
            value={index + 1}
            onChange={(e) => {
              onMoveTo(Number(e.target.value) - 1);
              close();
            }}
          >
            {Array.from({ length: total }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>

        <hr className={styles.menuRule} />

        <button
          type="button"
          className={`${styles.menuItem} ${styles.menuDanger}`}
          onClick={() => {
            close();
            onRemove();
          }}
        >
          Remove from plan
        </button>

        {/* Mobile-only (hidden by CSS on desktop, not conditional render — avoids a
            hydration mismatch from useIsMobile). A full-bleed sheet can't be reliably
            dismissed by tapping "outside" it, and not everyone can reach Escape —
            this is the one dismissal guaranteed to work for anyone. */}
        <button type="button" className={styles.menuCancel} onClick={close}>
          Cancel
        </button>
      </div>
    </>
  );
}
