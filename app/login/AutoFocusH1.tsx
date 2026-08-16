'use client';

import { useEffect, useRef } from 'react';

/**
 * Server Action redirects (e.g. sign-out → /login) are a client-side router
 * transition, not a full page load — the browser's automatic "focus moves to the
 * new document" behavior never fires. Land focus on the heading ourselves.
 */
export function AutoFocusH1({
  children,
  className,
  describedBy,
}: {
  children: React.ReactNode;
  className?: string;
  describedBy?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className={className} aria-describedby={describedBy}>
      {children}
    </h1>
  );
}
