/**
 * Order edits. Pure, so both the actions menu and the drag handler go through the
 * same code and can never disagree about what "move up" means.
 */

/** Move the item at `index` by `delta`, clamped. Returns the same array if nothing moves. */
export function moveBy<T>(items: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return items;
  return moveTo(items, index, to);
}

/** Move the item at `from` to sit at `to`. */
export function moveTo<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) {
    return items;
  }
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function removeAt<T>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length) return items;
  const next = items.slice();
  next.splice(index, 1);
  return next;
}

export function insertAt<T>(items: T[], index: number, item: T): T[] {
  const next = items.slice();
  next.splice(Math.max(0, Math.min(index, items.length)), 0, item);
  return next;
}

/**
 * Which card should take focus after the one at `removedIndex` disappears.
 * Prefer the card that slides into its place; fall back to the new last card.
 * -1 means the list is now empty and focus belongs on the list heading instead.
 */
export function focusIndexAfterRemove(removedIndex: number, previousTotal: number): number {
  const remaining = previousTotal - 1;
  if (remaining <= 0) return -1;
  return Math.min(removedIndex, remaining - 1);
}
