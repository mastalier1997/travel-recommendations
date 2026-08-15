import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-instrument-sans',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'Wanderlist',
  description: 'Plan a trip from a list of places.',
};

// Storage key must match lib/theme/themeStore.ts's STORAGE_KEY — this script can't
// import it, it has to be a standalone string that runs before any JS bundle loads.
const THEME_SCRIPT = `(function(){try{var v=localStorage.getItem('wanderlist:theme');var d=(v==='light'||v==='dark')?v:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script below sets data-theme/color-scheme on this
    // element before React hydrates, on purpose — that's what avoids a flash of the
    // wrong theme. Without this, React would warn about the SSR/client mismatch.
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
