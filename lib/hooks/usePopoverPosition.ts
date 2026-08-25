'use client';

import { useEffect, type RefObject } from 'react';
import { useIsMobile } from './useMediaQuery';

const MARGIN = 8;
const GAP = 6;

export type Rect = { left: number; right: number; top: number; bottom: number };
export type Placement = { left: number; top: number | null; bottom: number | null };

/**
 * Pure placement math — split out from the DOM-touching hook below so it's
 * directly unit-testable. Prefers opening below the trigger; flips above when
 * there's no room below but there is above; otherwise clamps fully into the
 * viewport and leaves the rest to the menu's own `max-height`/`overflow-y`
 * (`.menu` in planner.module.css).
 *
 * `top`/`bottom` are mutually exclusive by design (only one is ever non-null) —
 * setting both would let a stale inline `bottom` from a previous "flip above"
 * placement silently override a new "open below" `top`, since CSS `inset`
 * properties don't reset each other.
 */
export function computePlacement(
  trigger: Rect,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): Placement {
  const left = Math.min(Math.max(MARGIN, trigger.right - menuWidth), viewportWidth - menuWidth - MARGIN);

  const roomBelow = viewportHeight - trigger.bottom - GAP;
  const roomAbove = trigger.top - GAP;
  const fitsBelow = menuHeight <= roomBelow;
  const fitsAbove = menuHeight <= roomAbove;

  if (fitsBelow) {
    // No extra ceiling clamp here — fitsBelow already guarantees
    // trigger.bottom + GAP + menuHeight <= viewportHeight. Clamping anyway (as
    // an earlier version did) could push the top edge above trigger.bottom,
    // overlapping the trigger by a pixel or two on a near-exact-fit menu.
    return { left, top: trigger.bottom + GAP, bottom: null };
  }
  if (fitsAbove) {
    return { left, top: null, bottom: Math.max(MARGIN, viewportHeight - trigger.top + GAP) };
  }
  return { left, top: MARGIN, bottom: null };
}

type Options = {
  /** Fixed CSS width of the menu — used for the horizontal clamp. Height isn't
   * configurable the same way: it varies with content and can only be measured
   * once the popover is actually shown (see below), so there's no equivalent
   * hardcode for the vertical clamp. */
  width: number;
  /** When true, this hook clears any inline position on mobile and leaves
   * placement entirely to CSS (a full-width bottom sheet, say) — inline styles
   * always outrank a class, so leftover left/top from a previous desktop-width
   * placement would otherwise fight the mobile override. */
  cssControlsMobile?: boolean;
};

/**
 * Positions a `popover="auto"` menu against its trigger — correctly, unlike
 * computing position inside the trigger's `onClick`. `showPopover()` (fired by
 * the native `popoverTarget` attribute) is the click's *default action*, which
 * runs AFTER any onClick handler — so a naive click-time measurement always
 * reads the menu at `display: none`, `offsetHeight === 0`. That's fine for a
 * hardcoded width, but makes a height-aware vertical clamp impossible: there's
 * nothing to clamp against.
 *
 * This instead listens to the popover's own toggle lifecycle, where the menu is
 * genuinely in the top layer and measurable:
 *  - `beforetoggle` (opening): clear stale placement so nothing flashes at last
 *    render's position before the new one is computed.
 *  - `toggle` (opened): measure and call computePlacement (see above).
 *  - `toggle` (closed): light-dismiss (Escape, click-outside) bypasses a menu's
 *    own close-and-refocus handler entirely — if that left focus stranded on
 *    `<body>`, return it to the trigger.
 */
export function usePopoverPosition(
  triggerRef: RefObject<HTMLButtonElement | null>,
  menuRef: RefObject<HTMLDivElement | null>,
  { width, cssControlsMobile }: Options,
) {
  const isMobile = useIsMobile();

  useEffect(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;

    const place = () => {
      if (cssControlsMobile && isMobile) {
        menu.style.left = '';
        menu.style.top = '';
        menu.style.bottom = '';
        menu.dataset.placed = 'true';
        return;
      }

      const t = trigger.getBoundingClientRect();
      const placement = computePlacement(t, width, menu.offsetHeight, window.innerWidth, window.innerHeight);
      menu.style.left = `${placement.left}px`;
      menu.style.top = placement.top === null ? 'auto' : `${placement.top}px`;
      menu.style.bottom = placement.bottom === null ? 'auto' : `${placement.bottom}px`;
      menu.dataset.placed = 'true';
    };

    // `.menu` is `position: fixed`, but its trigger can sit inside a scrollable
    // panel (`.panelScroll`/`.sheetBody`) — scrolling that container moves the
    // trigger while the menu stays put, visually detaching the two. Closing on
    // scroll is the cheapest correct behavior; capture phase catches scrolling
    // on any ancestor, not just window.
    const onScroll = () => menu.hidePopover();

    const onBeforeToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') menu.dataset.placed = 'false';
    };
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') {
        place();
        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
      } else {
        document.removeEventListener('scroll', onScroll, { capture: true });
        if (document.activeElement === document.body) trigger.focus();
      }
    };

    menu.addEventListener('beforetoggle', onBeforeToggle);
    menu.addEventListener('toggle', onToggle);
    return () => {
      menu.removeEventListener('beforetoggle', onBeforeToggle);
      menu.removeEventListener('toggle', onToggle);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [triggerRef, menuRef, width, cssControlsMobile, isMobile]);
}
