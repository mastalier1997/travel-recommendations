'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import styles from './planner.module.css';

/** Height of the sheet at peek. planner.module.css hardcodes the same 190px (the
 * sheet's peek transform, and the map controls/attribution lifted above it) —
 * keep them in sync. MapView uses it to keep fitted stops out from under the sheet. */
export const SHEET_PEEK_PX = 190;

/** Movement before a press counts as a drag rather than a tap. */
const DRAG_SLOP_PX = 6;
/** Release speed (px/ms) that decides the direction on its own, however far the
 * sheet travelled: a quick flick up opens it, a quick flick down closes it. */
const FLING_PX_PER_MS = 0.5;

type Props = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** True while a drag is in flight (track G) — the handle is genuinely unavailable. */
  locked?: boolean;
  /** Stays interactive at peek. */
  header: ReactNode;
  /** Inert at peek, so Tab cannot walk into clipped, invisible cards. */
  children: ReactNode;
};

type Drag = {
  pointerId: number;
  startY: number;
  /** translateY when the press began: 0 open, `travel` at peek. */
  from: number;
  travel: number;
  moved: boolean;
  lastY: number;
  lastT: number;
  /** Latest pointer speed, px/ms; positive = downwards. */
  vy: number;
};

/**
 * Deliberately not a dialog and deliberately not focus-trapped. At peek the map is
 * interactive behind it; at full there is nothing behind worth trapping, and a trap
 * would strand keyboard users away from the header's plan and export controls.
 *
 * The handle and the summary under it can be dragged: the sheet follows the
 * pointer, then snaps open or closed by how far and how fast it was moved. The
 * handle stays a real button, so a tap or the keyboard still toggles it — the
 * single-pointer, non-drag path WCAG 2.5.7 asks for.
 */
export function BottomSheet({ expanded, onExpandedChange, locked, header, children }: Props) {
  const headingId = useId();
  const bodyId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const drag = useRef<Drag | null>(null);
  const swallowClick = useRef(false);
  const stopListening = useRef<(() => void) | null>(null);
  const [dragging, setDragging] = useState(false);
  // The release handler runs from a window listener added at press time — read
  // the latest props through refs rather than that render's closure.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const onChangeRef = useRef(onExpandedChange);
  onChangeRef.current = onExpandedChange;

  useEffect(() => () => stopListening.current?.(), []);

  const clampY = (d: Drag, y: number) => Math.min(d.travel, Math.max(0, d.from + y - d.startY));

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (locked || !e.isPrimary || e.button !== 0) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const travel = sheet.offsetHeight - SHEET_PEEK_PX;
    drag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      from: expanded ? 0 : travel,
      travel,
      moved: false,
      lastY: e.clientY,
      lastT: e.timeStamp,
      vy: 0,
    };
    // Moves are followed on the window, not this element: a quick flick leaves
    // the handle within its first frame. Not pointer capture either — capturing
    // on press would retarget the click away from the buttons in here (Optimize,
    // the handle itself), and a press only becomes a drag after DRAG_SLOP_PX.
    stopListening.current?.();
    const end = (ev: PointerEvent) => onPointerEnd(ev);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    stopListening.current = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      stopListening.current = null;
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved) {
      if (Math.abs(e.clientY - d.startY) < DRAG_SLOP_PX) return;
      d.moved = true;
      setDragging(true);
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.vy = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    // Straight to the DOM: a re-render per pointer frame would be wasted work.
    sheetRef.current!.style.transform = `translateY(${clampY(d, e.clientY)}px)`;
  };

  const onPointerEnd = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    stopListening.current?.();
    if (!d.moved) return; // a tap — the handle's own click toggles

    // The click the browser fires after this release isn't a tap; let it pass
    // if none comes (the release landed elsewhere), so it can't eat a real one.
    swallowClick.current = true;
    setTimeout(() => (swallowClick.current = false), 0);

    const y = clampY(d, e.clientY);
    const open =
      e.type === 'pointercancel'
        ? expandedRef.current
        : d.vy < -FLING_PX_PER_MS
          ? true
          : d.vy > FLING_PX_PER_MS
            ? false
            : y < d.travel / 2;
    setDragging(false);
    onChangeRef.current(open);
  };

  // Release: the inline transform still holds the sheet where the finger left it.
  // Clearing it a frame AFTER the transition is back on animates from there to
  // the snap point, instead of jumping to the old resting position first.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (dragging || !sheet?.style.transform) return;
    const frame = requestAnimationFrame(() => {
      sheet.style.transform = '';
    });
    return () => cancelAnimationFrame(frame);
  }, [dragging, expanded]);

  return (
    <section
      ref={sheetRef}
      className={styles.sheet}
      data-expanded={expanded}
      data-dragging={dragging}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="sr-only">
        Stops
      </h2>

      <div
        className={styles.sheetDragArea}
        data-testid="sheet-drag-area"
        onPointerDown={onPointerDown}
        onClickCapture={(e) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <button
          type="button"
          className={styles.grab}
          onClick={() => onExpandedChange(!expanded)}
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
      </div>

      <div id={bodyId} className={styles.sheetBody} data-scroll inert={!expanded}>
        {children}
      </div>
    </section>
  );
}
