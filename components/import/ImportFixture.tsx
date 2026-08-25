'use client';

import { ImportFlow } from './ImportFlow';

// ponytail: local-only stub — no persistence, nothing to await for real. Split out
// of the page component because a Server Component can't pass a function prop
// (onCommit) to a Client Component.
export function ImportFixture() {
  return (
    <ImportFlow
      planId="dev-fixture-import"
      version={1}
      existingPlaceCount={0}
      onCommit={async () => ({ ok: true, version: 2 })}
    />
  );
}
