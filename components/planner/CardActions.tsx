'use client';

import { useId, useRef } from 'react';
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
 * for free, which is the whole reason not to hand-roll a menu here.
 */
export function CardActions({ name, index, total, onMove, onMoveTo, onRemove }: Props) {
  const id = useId().replace(/:/g, '');
  const menuId = `actions-${id}`;
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => ref.current?.hidePopover();

  // Anchor positioning (`anchor()`) is not portable yet, so place it by hand on open.
  const position = () => {
    const t = triggerRef.current;
    const m = ref.current;
    if (!t || !m) return;
    const r = t.getBoundingClientRect();
    m.style.left = `${Math.max(8, r.right - 216)}px`;
    m.style.top = `${r.bottom + 6}px`;
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={styles.actionsTrigger}
        popoverTarget={menuId}
        onClick={position}
        aria-label={`Actions for stop ${index + 1}, ${name}`}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      <div id={menuId} popover="auto" ref={ref} className={styles.menu}>
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
      </div>
    </>
  );
}
