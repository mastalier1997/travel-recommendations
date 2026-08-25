import { describe, it, expect } from 'vitest';
import { computePlacement, type Rect } from './usePopoverPosition';

const VW = 1200;
const VH = 800;

const trigger = (over: Partial<Rect>): Rect => ({ left: 100, right: 128, top: 400, bottom: 428, ...over });

describe('computePlacement', () => {
  it('opens below when there is plenty of room', () => {
    const p = computePlacement(trigger({}), 216, 200, VW, VH);
    expect(p.top).toBe(428 + 6);
    expect(p.bottom).toBeNull();
  });

  it('never overlaps the trigger on a near-exact-fit menu (regression: the last-card cutoff bug)', () => {
    // Room below is exactly 100px (VH - t.bottom - GAP); a 100px-tall menu just fits.
    const t = trigger({ bottom: VH - 100 - 6 });
    const p = computePlacement(t, 216, 100, VW, VH);
    expect(p.top).not.toBeNull();
    // The menu's top edge must never sit above the trigger's own bottom edge.
    expect(p.top as number).toBeGreaterThanOrEqual(t.bottom);
  });

  it('flips above the trigger when there is no room below but there is above', () => {
    // Trigger near the bottom of the viewport — the original bug's exact scenario.
    const t = trigger({ top: VH - 40, bottom: VH - 12 });
    const p = computePlacement(t, 216, 200, VW, VH);
    expect(p.top).toBeNull();
    expect(p.bottom).toBe(VH - t.top + 6);
  });

  it('clamps into the viewport when the menu fits neither above nor below', () => {
    const t = trigger({ top: VH / 2, bottom: VH / 2 + 10 });
    const p = computePlacement(t, 216, VH, VW, VH); // menu taller than the whole viewport
    expect(p.top).toBe(8);
    expect(p.bottom).toBeNull();
  });

  it('clamps the left edge so the menu never runs off the right of the viewport', () => {
    const t = trigger({ left: VW - 20, right: VW - 4 });
    const p = computePlacement(t, 216, 100, VW, VH);
    expect(p.left).toBeLessThanOrEqual(VW - 216 - 8);
  });

  it('clamps the left edge so the menu never runs off the left of the viewport', () => {
    const t = trigger({ left: 2, right: 30 });
    const p = computePlacement(t, 216, 100, VW, VH);
    expect(p.left).toBeGreaterThanOrEqual(8);
  });
});
