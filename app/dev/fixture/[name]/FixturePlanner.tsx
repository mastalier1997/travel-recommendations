'use client';

import { Planner } from '@/components/planner/Planner';
import type { Plan } from '@/lib/types';
import { normalizeTitle, type RenameResult } from '@/lib/plan/title';

/**
 * Client wrapper so the fixture route can give Planner a working (but purely
 * local, nothing-persists) onRename — the same reason app/dev/fixture/[name]/
 * page.tsx already stubs `account`, so the rename UI (and its axe coverage) is
 * exercisable with no real Supabase plan row. Recognizes the same
 * 'trigger X error' sentinel idiom app/api/geocode/route.ts uses, so the failure
 * branches are reachable from e2e specs without stubbing any network call.
 */
export function FixturePlanner({ plan }: { plan: Plan }) {
  const onRename = async (title: string): Promise<RenameResult> => {
    // Test-only hook, dead code in production (same idiom as MapView.tsx's
    // __mapResizeObserverFired): lets a spec assert the same-title no-op path
    // in Header.tsx actually skips calling onRename at all, not just that it
    // "looks like" a no-op from timing alone.
    if (process.env.NODE_ENV !== 'production') {
      const w = window as unknown as { __renameCallCount?: number };
      w.__renameCallCount = (w.__renameCallCount ?? 0) + 1;
    }

    if (title === 'trigger rename error') return { ok: false, error: 'Simulated failure for testing.' };
    if (title === 'trigger rename missing') return { ok: false, missing: true };
    if (title === 'trigger rename slow') {
      // Long enough for a test to click Cancel before this resolves — exercises
      // Header.tsx's requestId guard against a stale success applying itself
      // after the user already backed out.
      await new Promise((r) => setTimeout(r, 500));
      return { ok: true, title };
    }

    const normalized = normalizeTitle(title);
    if (!normalized.ok) return { ok: false, error: 'Enter a name for this plan.' };
    return { ok: true, title: normalized.title };
  };

  return <Planner initialPlan={plan} account={{ email: 'dev@example.com' }} onRename={onRename} />;
}
