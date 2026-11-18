import type { Metadata } from 'next';
import './globals.css';
import { resolvedAccentTable } from '@/lib/theme/accent';

export const metadata: Metadata = {
  title: 'Wanderlist',
  description: 'Plan a trip from a list of places.',
};

// Storage keys must match lib/theme/themeStore.ts's STORAGE_KEY and
// ACCENT_STORAGE_KEY — this script can't import them, it has to be a standalone
// string that runs before any JS bundle loads. The accent table (every preset's
// resolved light/dark colour) is computed here on the server and inlined, so the
// picked colour is on screen from the first paint instead of flashing violet.
const ACCENTS = JSON.stringify(resolvedAccentTable());
const THEME_SCRIPT = `(function(){try{var v=localStorage.getItem('wanderlist:theme');var d=(v==='light'||v==='dark')?v:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d;var a=${ACCENTS}[localStorage.getItem('wanderlist:accent')];if(a){document.documentElement.style.setProperty('--accent-light',a.light);document.documentElement.style.setProperty('--accent-dark',a.dark);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script below sets data-theme/color-scheme on this
    // element before React hydrates, on purpose — that's what avoids a flash of the
    // wrong theme. Without this, React would warn about the SSR/client mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
