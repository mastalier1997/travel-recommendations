'use client';

import { useId, useRef, useState } from 'react';
import type { Place, Route } from '@/lib/types';
import { toKml } from '@/lib/export/kml';
import { toGpx } from '@/lib/export/gpx';
import { toGeoJson } from '@/lib/export/geojson';
import { slugify } from '@/lib/export/filename';
import { downloadText } from '@/lib/export/download';
import styles from './planner.module.css';

type Props = {
  title: string;
  places: Place[];
  route: Route | null;
  isMobile: boolean;
};

type Format = 'kml' | 'gpx' | 'geojson';

const GENERATE: Record<Format, (plan: { title: string; places: Place[]; route: Route | null }) => string> = {
  kml: toKml,
  gpx: toGpx,
  geojson: toGeoJson,
};

const EXT: Record<Format, string> = { kml: 'kml', gpx: 'gpx', geojson: 'geojson' };
const MIME: Record<Format, string> = {
  kml: 'application/vnd.google-earth.kml+xml',
  gpx: 'application/gpx+xml',
  geojson: 'application/geo+json',
};

/**
 * Built on the native popover API, same pattern as CardActions — Escape, light
 * dismiss and top-layer stacking come for free.
 */
export function ExportMenu({ title, places, route, isMobile }: Props) {
  const id = useId().replace(/:/g, '');
  const menuId = `export-${id}`;
  const kmlHintId = `export-kml-hint-${id}`;
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState('');

  const position = () => {
    const t = triggerRef.current;
    const m = ref.current;
    if (!t || !m) return;
    const r = t.getBoundingClientRect();
    m.style.left = `${Math.max(8, r.right - 216)}px`;
    m.style.top = `${r.bottom + 6}px`;
  };

  const runExport = (format: Format) => {
    const filename = `${slugify(title)}.${EXT[format]}`;
    const content = GENERATE[format]({ title, places, route });
    downloadText(filename, MIME[format], content);
    setAnnouncement(`Downloading ${filename}`);
    // hidePopover() alone can drop focus to <body> — return it to the trigger.
    ref.current?.hidePopover();
    triggerRef.current?.focus();
  };

  const kmlOption = (
    <button
      type="button"
      className={styles.menuItem}
      aria-describedby={kmlHintId}
      aria-disabled={isMobile}
      onClick={() => !isMobile && runExport('kml')}
    >
      Google My Maps (KML)
      <span id={kmlHintId} className={styles.menuHint}>
        {isMobile ? 'Easier on desktop' : 'Download, then import as a layer in My Maps'}
      </span>
    </button>
  );

  const gpxOption = (
    <button type="button" className={styles.menuItem} onClick={() => runExport('gpx')}>
      GPX
      {isMobile && <span className={styles.menuHint}>Opens in Organic Maps, Komoot, Garmin</span>}
    </button>
  );

  const geojsonOption = (
    <button type="button" className={styles.menuItem} onClick={() => runExport('geojson')}>
      GeoJSON
    </button>
  );

  return (
    <>
      <button type="button" ref={triggerRef} className={styles.ghost} popoverTarget={menuId} onClick={position}>
        Export
      </button>

      <div id={menuId} popover="auto" ref={ref} className={styles.menu}>
        {isMobile ? (
          <>
            {gpxOption}
            {geojsonOption}
            {kmlOption}
          </>
        ) : (
          <>
            {kmlOption}
            {gpxOption}
            {geojsonOption}
          </>
        )}
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
