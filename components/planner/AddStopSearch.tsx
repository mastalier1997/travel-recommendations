'use client';

import { useId, useMemo, useRef, useState } from 'react';
import type { Candidate, NearbyPoi, Place, Route } from '@/lib/types';
import { corridorAroundStop, buildSuggestions, type StopSuggestion } from '@/lib/plan/suggest';
import { estimateDetourMinutes } from '@/lib/routing/detour';
import { labelForOsmTag } from '@/lib/content/osm-labels';
import styles from './planner.module.css';

const RADIUS_M = 4000;
const GEOCODE_DEBOUNCE_MS = 350;

type Props = {
  places: Place[];
  route: Route | null;
  /** Anchors the "near this route" search — falls back to the last confirmed stop
   * when nothing is selected (see lib/plan/suggest.ts's corridorAroundStop). */
  selectedStopId: string | null;
  onAddPlace: (place: Place) => void;
};

type Option =
  | { kind: 'nearby'; suggestion: StopSuggestion }
  | { kind: 'geocode'; candidate: Candidate; detourMinutes: number | null }
  | { kind: 'custom'; query: string };

/**
 * Full ARIA 1.2 combobox — not the popover-menu pattern the rest of the planner
 * uses (ExportMenu, CardActions, ThemeToggle). Those are static menus with no
 * typed filter; here focus must stay in the input while arrow keys move a virtual
 * cursor via aria-activedescendant, which `popover="auto"` can't do across its
 * top-layer boundary. This is a genuinely new interaction pattern for this
 * codebase — see the WAI-ARIA APG combobox example for the reference shape.
 */
export function AddStopSearch({ places, route, selectedStopId, onAddPlace }: Props) {
  const uid = useId().replace(/:/g, '');
  const inputId = `add-stop-${uid}`;
  const listboxId = `add-stop-listbox-${uid}`;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Raw POIs, not the annotated StopSuggestion — alreadyAdded/detourMinutes are
  // derived fresh below on every render so they never go stale after `places`
  // changes without the corridor itself changing (e.g. adding a stop that doesn't
  // shift the anchor's leg window).
  const [rawPois, setRawPois] = useState<NearbyPoi[]>([]);
  const [geocodeResults, setGeocodeResults] = useState<Candidate[]>([]);
  const [announcement, setAnnouncement] = useState('');

  const corridorKeyRef = useRef<string | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetched once per corridor (the anchor stop's neighborhood), not on every
  // keystroke — the dropdown then filters this client-side as the user types.
  const fetchNearby = async () => {
    const corridor = corridorAroundStop(places, selectedStopId);
    const key = JSON.stringify(corridor);
    if (corridor.length === 0 || corridorKeyRef.current === key) return;
    corridorKeyRef.current = key;
    try {
      const res = await fetch('/api/nearby', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ corridor, radiusM: RADIUS_M }),
      });
      if (!res.ok) return;
      const { pois } = (await res.json()) as { pois: NearbyPoi[] };
      setRawPois(pois);
    } catch {
      // Silent: the input is still a working plain-text add-a-stop box without it.
    }
  };

  const runGeocodeSearch = (q: string) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (!q.trim()) {
      setGeocodeResults([]);
      return;
    }
    geocodeTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ q, near: lastConfirmedPoint(places) ?? undefined }),
        });
        if (!res.ok) return;
        const { candidates } = (await res.json()) as { candidates: Candidate[] };
        setGeocodeResults(candidates);
        setActiveIndex(-1);
      } catch {
        // Silent — nearby suggestions and the custom-stop fallback still work.
      }
    }, GEOCODE_DEBOUNCE_MS);
  };

  const nearby = useMemo(() => buildSuggestions(rawPois, places, route), [rawPois, places, route]);

  const q = query.trim().toLowerCase();
  const filteredNearby = q ? nearby.filter((s) => s.name.toLowerCase().includes(q)) : nearby;
  const nearbyOsmKeys = new Set(
    filteredNearby.map((s) => (s.osm ? `${s.osm.type}:${s.osm.id}` : null)).filter((k): k is string => !!k),
  );
  const extraGeocode = q
    ? geocodeResults.filter((c) => !(c.osm && nearbyOsmKeys.has(`${c.osm.type}:${c.osm.id}`)))
    : [];

  const options: Option[] = [
    ...filteredNearby.map((suggestion): Option => ({ kind: 'nearby', suggestion })),
    ...extraGeocode.map(
      (candidate): Option => ({
        kind: 'geocode',
        candidate,
        detourMinutes: estimateDetourMinutes(candidate, places, route)?.minutes ?? null,
      }),
    ),
  ];
  if (q) options.push({ kind: 'custom', query: query.trim() });

  const openDropdown = () => {
    setOpen(true);
    fetchNearby();
  };
  const closeDropdown = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const selectOption = (option: Option) => {
    if (option.kind === 'nearby' && option.suggestion.alreadyAdded) return; // no-op: not a real choice
    const place = toPlace(option);
    onAddPlace(place);
    setAnnouncement(`Added ${place.name} to your route. ${places.length + 1} stops.`);
    setQuery('');
    setGeocodeResults([]);
    closeDropdown();
  };

  const move = (delta: number) => {
    if (options.length === 0) return;
    setActiveIndex((i) => {
      const next = i + delta;
      if (next < 0) return options.length - 1;
      if (next >= options.length) return 0;
      return next;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openDropdown();
      else move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) move(-1);
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && options[activeIndex]) {
        e.preventDefault();
        selectOption(options[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        closeDropdown();
      }
    }
  };

  const activeId = open && activeIndex >= 0 && options[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className={styles.addStop}>
      <label htmlFor={inputId} className="sr-only">
        Search a place by name to add a stop
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        autoComplete="off"
        className={styles.addStopInput}
        placeholder="Search a place by name to add a stop"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(-1);
          runGeocodeSearch(e.target.value);
          if (!open) openDropdown();
        }}
        onFocus={openDropdown}
        onBlur={closeDropdown}
        onKeyDown={onKeyDown}
      />

      {open && (
        <div className={styles.addStopPanel}>
          {options.length === 0 ? (
            <p className={styles.addStopEmpty}>
              {q ? 'No matches — keep typing, or add it as a custom stop.' : 'Type to search, or see places near your route.'}
            </p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Places near your route" className={styles.addStopList}>
              {options.map((option, i) => (
                <li
                  key={optionKey(option, i)}
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  aria-disabled={option.kind === 'nearby' && option.suggestion.alreadyAdded}
                  className={styles.addStopOption}
                  data-active={i === activeIndex}
                  // Keeps focus in the input through the click, same trick as a
                  // native <select> — mousedown fires before blur would close this.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  {optionLabel(option)}
                </li>
              ))}
            </ul>
          )}
          <p className={styles.addStopHint} aria-hidden="true">
            ↑↓ to browse · ↵ to add · Esc to close
          </p>
        </div>
      )}

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function optionKey(option: Option, i: number): string {
  if (option.kind === 'nearby') return `nearby:${option.suggestion.id}`;
  if (option.kind === 'geocode') return `geocode:${i}:${option.candidate.name}`;
  return 'custom';
}

/** Every visual signal (category, detour cost, already-added) is stated as part of
 * the option's own text — never a color-only or icon-only chip — so it reaches the
 * accessible name exactly the same way it reaches the screen. */
function optionLabel(option: Option): string {
  if (option.kind === 'custom') {
    return `Add "${option.query}" as a custom stop — no map pin`;
  }
  if (option.kind === 'nearby') {
    const s = option.suggestion;
    const category = labelForOsmTag(s.class, s.tag);
    const parts = [s.name, category].filter(Boolean);
    if (s.alreadyAdded) parts.push('already on your route');
    else if (s.detourMinutes !== null) parts.push(`adds about ${s.detourMinutes} min`);
    return parts.join(', ');
  }
  const c = option.candidate;
  const category = labelForOsmTag(c.class, c.tag);
  const parts = [c.name, category ?? c.address];
  if (option.detourMinutes !== null) parts.push(`adds about ${option.detourMinutes} min`);
  return parts.filter(Boolean).join(', ');
}

function toPlace(option: Option, now: string = new Date().toISOString()): Place {
  if (option.kind === 'custom') {
    return {
      id: crypto.randomUUID(),
      raw: option.query,
      status: 'manual',
      name: option.query,
      lat: null,
      lon: null,
      address: null,
      osm: null,
      wikidata: null,
      wikipedia: null,
      description: null,
      notes: null,
      origin: 'manual',
      addedAt: now,
    };
  }
  const src = option.kind === 'nearby' ? option.suggestion : option.candidate;
  return {
    id: crypto.randomUUID(),
    raw: src.name,
    status: 'confirmed',
    name: src.name,
    lat: src.lat,
    lon: src.lon,
    address: 'address' in src ? src.address : null,
    osm: src.osm,
    wikidata: 'wikidata' in src ? src.wikidata : null,
    wikipedia: 'wikipedia' in src ? src.wikipedia : null,
    description: null,
    notes: null,
    origin: 'manual',
    addedAt: now,
  };
}

function lastConfirmedPoint(places: Place[]): { lat: number; lon: number } | null {
  for (let i = places.length - 1; i >= 0; i--) {
    const p = places[i];
    if (p.lat !== null && p.lon !== null) return { lat: p.lat, lon: p.lon };
  }
  return null;
}
