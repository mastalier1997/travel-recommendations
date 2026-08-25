# Wanderlist — Implementation Plan

Trip route planner. Import places → map + list → optimize route → drag to override → export.
**Hard constraint: no LLM at runtime.** Descriptions and routing are deterministic APIs/algorithms.

Design source: `claude.ai/design/p/11d19f72-1b1c-4f88-8d10-1b714726625a` — 6 screens
(Planner 1440×900, Export popover, mobile M1–M4 at 390×844), plus a later "Turn 2"
addition: dark mode and a continental/multi-country scale view (see below).

---

## Stack

| Layer | Choice |
|---|---|
| App | Next.js App Router + TypeScript, Vercel |
| Map | MapLibre GL JS + free vector tiles (MapTiler key, referrer-restricted) |
| Data | Supabase Postgres + Auth. Plan = one row, `places`/`route` as jsonb |
| Geocode | Nominatim (`extratags=1`) in dev → MapTiler in prod. Server-proxied only |
| Descriptions | Wikipedia REST summary → Wikipedia geosearch → Wikidata description → OSM tag label |
| Routing | OSRM `/trip` (optimal order + road geometry in one call) |
| Import | Line split + bullet strip. Opt-in prose scan = capitalized n-grams validated by the geocoder |
| Files | `pdf-parse`, SheetJS, plain read → raw text → same line splitter |
| Export | Hand-built KML / GPX / GeoJSON strings, client-side Blob download |
| Reorder | Per-card actions menu (baseline) + dnd-kit (enhancement) |

Google My Maps has no write API. Export is a file the user imports manually.

---

## Phase 0 — The spine (BLOCKS EVERYTHING, ~2–3h)

Nothing else can start until this lands. It is small on purpose.

- `lib/types.ts` — `Plan`, `Place`, `Candidate`, `Route`, `ImportDraft`, `DraftRow`
- `lib/fixtures/sample-plan.ts` — the 9 Kyoto/Osaka stops from the design, fully populated
- `lib/fixtures/geocode-responses.json` — recorded Nominatim responses incl. the two ambiguous ones
- `app/api/{geocode,describe,optimize,parse-file}/route.ts` — return fixture JSON when `MOCK=1`
- `app/globals.css` — corrected design tokens (see Contrast below)
- `supabase/migrations/0001_init.sql` — `plans`, `geo_cache`, `place_content`, `rate_gate` + RLS

The mock route handlers **are** the contract. Write them first; they double as integration fixtures.

### Document shapes

```ts
type Plan = {
  id: string; user_id: string; title: string;
  places: Place[];        // ARRAY ORDER IS THE ITINERARY. Single source of truth.
  route: Route | null;
  schema_version: 1;
  version: number;        // optimistic concurrency
  updated_at: string;
};

type Place = {
  id: string;             // randomUUID, stable across reorder
  raw: string;            // exact input line, never mutated — allows re-geocoding
  status: 'confirmed' | 'unresolved' | 'manual';
  name: string;
  lat: number | null; lon: number | null;   // null only when unresolved
  address: string | null;
  osm: { type: 'node'|'way'|'relation'; id: number; class: string; tag: string } | null;
  wikidata: string | null;      // "Q243"
  wikipedia: string | null;     // "en:Fushimi Inari-taisha"
  description: {
    text: string;
    source: 'wikipedia' | 'wikipedia-geosearch' | 'wikidata' | 'osm-tag' | 'user';
    sourceUrl: string | null; lang: string | null; fetchedAt: string;
  } | null;
  notes: string | null;
  origin: 'line' | 'prose' | 'manual' | 'map-click';
  addedAt: string;
};

type Route = {
  version: 1; provider: 'osrm';
  mode: 'driving' | 'walking' | 'cycling';
  roundTrip: boolean;
  optimized: boolean;     // false once the user drags
  orderHash: string;      // sha1(place ids in order + mode + roundTrip)
  legs: { fromId: string; toId: string; distanceM: number; durationS: number }[];
  totalDistanceM: number; totalDurationS: number;
  geometry: GeoJSON.LineString;
  computedAt: string;
};
```

**No `route.order` array.** Order lives only in `places`. `orderHash` detects staleness — mismatch
greys the polyline and shows "Re-route". When OSRM returns an optimal permutation, reorder the
`places` array itself.

**Candidates never enter `Plan.places`.** Staging lives in `ImportDraft`, persisted to
`localStorage` under `wanderlist:draft:{planId}`. 50 rows × 5 candidates is ~150KB of dead weight
on every plan read, and every consumer (map, export, routing, drag) would have to filter it.

---

## Parallel tracks (all start after P0)

| Track | Owns | Needs | Verify with | Status |
|---|---|---|---|---|
| **A. Persistence + auth** | migrations, RLS, `plans/page.tsx`, `plans/[id]/actions.ts` | — | seed `SAMPLE_PLAN`, two-tab conflict test | ✅ done |
| **B. Planner shell** | `Planner`, `MapView`, `PlaceList`, `PlaceCard`, `BottomSheet`, breakpoints | — | `initialPlan = SAMPLE_PLAN`, zero network | ✅ done |
| **C. Parsing** | `split-lines`, `scan-prose`, `parse-file`, `draft.ts` reducer | — | vitest, pure functions, no UI | ✅ done |
| **D. Geocode service** | `/api/geocode`, `geo/*`, `geo_cache`, `rate_gate` | — | curl + recorded fixtures | ✅ done |
| **E. Descriptions** | `/api/describe`, `content/*`, OSM label table | — | `Place[]` fixture in, coverage % out | ✅ done |
| **F. Routing** | `/api/optimize`, `routing/osrm.ts`, `orderHash` | — | `{stops[]}` fixture in, `Route` out | ✅ done |
| **G. Reorder + gestures** | actions menu, dnd-kit, `interactionMode` | B | keyboard-only pass, NVDA + VoiceOver | ✅ done |
| **H. Export** | `export/{kml,gpx,geojson}.ts` | — | golden-file tests against `SAMPLE_PLAN` | ✅ done |
| **I. Import UI** | `ImportScreen` (M4), `ConfirmList` (M3), `CandidateRow` | C, D | axe, error-summary focus test | ✅ done |

Seams that make this work: `Candidate` is provider-normalized so B/C/G never learn which geocoder
answered; `Route` is a value object so B/H don't know OSRM exists; `MOCK=1` means UI tracks never
block on service tracks.

---

## Where each call lives

| Call | Location | Why |
|---|---|---|
| Vector tiles | Client → provider directly | Never proxy tiles through Vercel |
| Geocode | `app/api/geocode/route.ts` | Key secrecy, UA policy, shared cache, throttle |
| Wikipedia | `app/api/describe/route.ts` | Shared cache; batch in, fan out at concurrency 5 |
| OSRM | `app/api/optimize/route.ts` | Demo → self-hosted swap with no client change |
| pdf/xlsx | `app/api/parse-file/route.ts`, `runtime='nodejs'` | pdf-parse needs Node. Watch Vercel's 4.5MB body cap |
| Supabase read | RSC via cookie-bound SSR client | RLS applies, no client waterfall |
| Supabase write | Server actions, debounced ~1.5s | No extra API surface to secure |
| Export | Pure client, `Blob` + `createObjectURL` | No server involvement |

**Throttle.** Serverless has no shared process, so an in-memory queue can't enforce 1 req/s.
Use Postgres as the clock:

```sql
update rate_gate
   set next_allowed_at = greatest(next_allowed_at, now()) + interval '1050 milliseconds'
 where provider = $1
returning next_allowed_at - interval '1050 milliseconds' as slot;
```

Sleep until `slot`; if the wait exceeds ~4s return 429 + `retryAfterMs` and let the client re-queue.
Skip the gate entirely for MapTiler. This is a dev-mode mechanism.

**Client geocodes at concurrency 1** — one row at a time, awaited. Gives progressive fill of the M3
rows, per-row retry for free, and no 55-second lambda. Do not build a server-side batch loop.

**Cache = Postgres, not Redis.**

| Table | Key | TTL |
|---|---|---|
| `geo_cache` | `sha1(provider + '\|' + normQ + '\|' + biasKey)`, normQ = lowercased/collapsed/trimmed | 60d; 7d for zero-result |
| `place_content` | `wd:Q243` preferred, else `wp:en:Title` | 30d |

Global, not per-user — public data. Service-role access only. TTL enforced at read time; no cron.

---

## Import pipeline

Draft level:
```
idle ──paste──────────────► reading
     └─file──/api/parse-file─┘
reading ──split-lines | scan-prose──► extracted   (DraftRow[] all 'pending')
extracted ──user hits Find──────────► geocoding
geocoding ──per row, concurrency 1──► confirming  (no row left pending/resolving)
confirming ──all rows decided───────► committing ──► done (clear localStorage)
```

Per row:
```
pending → resolving → single    (auto-accept when importance ≥ 0.45)
                    → multiple  (user picks → accept)
                    → none      (retype → pending | skip | keep-unresolved)
                    → error     (429/network → retry → pending)
```

- Auto-accepting confident hits is what makes a 50-row confirm screen survivable. M3 becomes
  **review**, not data entry. Still render a "change" affordance on every row.
- The class/importance filter belongs in `resolving → single|multiple|none`, not in the prose
  extractor. Same code path, one flag.
- **Descriptions are fetched after commit, not during import.** `description: null` renders a
  skeleton that fills in. Import is already the slow step.

---

## Accessibility (built in per phase, not bolted on)

### Contrast — the design's tokens fail AA. Corrected set:

| Token | Value | Note |
|---|---|---|
| `--text` | `#26221e` | unchanged, 15.8:1 |
| `--text-muted` | `#726C64` | replaces `#89837a` (3.76:1 — fails) for 13px descriptions |
| `--text-subtle` | `#6F6960` | replaces `#8d8880` (3.52:1 — fails) for 11px metadata |
| `--icon-muted` | `#8d8880` | keep, **non-text only** |
| `--accent` | `#C2643F` | keep for ≥24px type, decorative fills, pin fill |
| `--accent-strong` | `#AF5430` | **all** accent text, links, primary button fill (`#C2643F` + white text = 4.05:1, fails) |
| `--border-control` | `#9A9288` | inputs, chips, buttons, drop zone (`#eae7e2` = 1.23:1) |
| `--border-hairline` | `#eae7e2` / `#ddd9d3` | decorative separators only |
| `--amber-edge` | `#B8801F` | card edge, chip border |
| `--amber-chip-bg` / `--amber-chip-text` | `#FBF1DC` / `#8A5F0F` | `#9a6c15` on `#D9A13B` is 2.01:1 |

**Polyline over unknown tiles can't be guaranteed 3:1 by colour.** Fix structurally: 6px `#C2643F`
line with a 10px white casing beneath. Pins get a 2px white ring + 1px `#26221e` hairline. Order is
never colour-only — the numbered badge carries it.

Implement the amber "needs review" edge and terracotta selection edge as `border-left`, not
`background` — backgrounds flatten under Windows High Contrast, borders re-colour.

### Reorder — two paths, menu ships first

SC 2.5.7 requires a **non-drag single-pointer** alternative; keyboard alone does not satisfy it.

- **Baseline (Track G, first):** per-card overflow `<button>` → menu with Move up / Move down /
  "Move to position…" (native `<select>` 1–N) / Remove. This is also where the hover-only
  affordances go on touch. Ship and sign off 2.5.7 here.
- **Enhancement:** dnd-kit `KeyboardSensor` + `sortableKeyboardCoordinates`,
  `restrictToVerticalAxis`. The grip is a real `<button>` carrying `{...listeners}`.
  Space/Enter lift → ↑/↓ → Space/Enter drop → Esc cancel. Esc must not propagate to the sheet.
- Override dnd-kit's default announcements (they say "sortable item" and use indices). Summary
  totals re-announce separately in a `role="status"`, debounced ~500ms after drop — not per keypress.
- The "Release to reorder" toast is `aria-hidden` — it duplicates the live region.

### Map is decorative; the list carries everything

- `map.getCanvas()` → `aria-hidden="true"`, `tabIndex=-1`. Construct with
  `{ attributionControl: false, keyboard: false }`; render attribution as real text outside.
  Own zoom `<button>`s outside the hidden subtree — not `NavigationControl`.
- The map conveys 4 things; all 4 must exist as text: **order** (in the card's accessible name,
  "Stop 3 of 9: Kiyomizu-dera"; badge `aria-hidden`), **leg distances** (a text row between cards —
  "12 km, 18 min from Fushimi Inari"; without this the polyline isn't decorative and 1.1.1 fails),
  **totals** (summary bar), **location context** ("Kyoto · Temple" on every card).
- `<ol role="list">` — Safari/VoiceOver drops list semantics under `list-style:none`.
- One state var `selectedStopId`. Card→pin: `easeTo`, or `jumpTo` under reduced motion, no focus
  move. Pin→card: `scrollIntoView({block:'nearest'})` + `focus({preventScroll:true})`.
- Card name is `<button aria-pressed={selected}>`. Not a listbox — avoids roving tabindex entirely.

### Bottom sheet — no focus trap

- The grab handle is a real `<button aria-expanded>` that cycles peek→full on tap. That's the
  2.5.7 alternative for resizing, which is otherwise drag-only. ≥44×44 hit area.
- At peek, the list is `inert` (React 19 boolean prop) so Tab can't walk into clipped cards.
- Focus stays on the handle across expand/collapse. Never yank it into the list. If focus is inside
  the list when collapsing, move it to the handle first.
- During drag: handle `disabled`; re-enable on `onDragEnd` **and** `onDragCancel`.
- SC 2.4.11: every scroll container gets
  `scroll-padding-block: 64px calc(var(--sticky-bar-h) + 8px)`.

### Confirm locations — radio group

`<fieldset>` + `<legend>` holding the raw text + `<input type="radio" required>` per candidate.
**"Skip this place" is the Nth radio, not a separate button** — turns an ambiguous tri-state into a
genuinely required single choice and lets `required` do real work.

- Thumbnails `alt=""` (the name + region text carries it).
- Rows are `<label>`-wrapped → whole 56px row is the target.
- On submit failure: `role="alert"` error summary at top, focused, linking to each unresolved group;
  per-group `aria-invalid` + inline message that names the fix.
- SC 3.3.7: persist resolutions keyed by normalized raw string. "kiyomizu temple" in a later import
  pre-selects the prior choice.
- Desktop inline card and M3 full-screen render the **same component** (3.2.4).

### Hover affordances

Hover may change appearance, never availability. `opacity:0` + reveal on
`:hover, :focus-within, [data-selected]`; permanently visible under `@media (hover:none)`. Never
`display:none` or unmounting. On touch, drop the inline `×` and use the actions menu.
After remove: focus card *n+1*, `role="status"` announcement, and an **Undo** for ≥10s.

### Standing gates

`@axe-core/playwright` per route failing the build · one keyboard-only pass per track · NVDA +
VoiceOver iOS at B, G, I · 400% zoom / 320px reflow · `forced-colors: active` pass.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| OSRM `/trip` waypoint cap + demo-server rate limits | **High** | Hard-cap 12 stops in the UI from day one with an explicit message. `routing/osrm.ts` is the only file that knows the wire format. Above the cap, swap to `/table` + nearest-neighbour + 2-opt (~80 lines, deterministic) and one `/route` call for geometry. Self-host before real users. |
| Wikipedia coverage is thin — most POIs lack `extratags.wikidata`, so cards read "Restaurant" | **High** | Four-step ladder in `content/describe.ts`: extratags→summary, then geosearch@150m + name match, then Wikidata `description`, then OSM tag label. Instrument `description.source` distribution on the first real import. |
| Whole-document jsonb write races (two tabs, autosave vs drag) | Medium | `version int` + `update … where id=$1 and version=$2`; conflict surfaces as "changed elsewhere — reload". `schema_version` in the doc for future migration. ~20 lines now vs an unreproducible data-loss bug later. |
| Nested gestures: drag inside scrollable sheet on pannable map | Medium | One var `interactionMode: 'map'\|'sheet'\|'drag'`. On `onDragStart`: `map.dragPan.disable()`, `map.touchZoomRotate.disable()`, lock snap point, `touch-action:none` on the card. `PointerSensor` `activationConstraint:{delay:200,tolerance:5}` on touch. |
| Nominatim 1 req/s vs 50-row import | Medium | Postgres rate gate + client concurrency 1 + 60d cache. A 50-row cold import takes ~55s — show per-row progress, not a spinner. |
| Vercel 4.5MB request body cap on file upload | Low | If it bites, move SheetJS to the client; keep only PDF server-side. |

---

## Deltas from the design (need adding)

1. Per-card **actions menu** — required by 2.5.7, not in the mockup.
2. **Leg distance/time rows** between cards — without them the polyline isn't decorative.
3. **"Skip" as a radio option** inside the group, replacing M3's separate Skip button.
4. **Token colour corrections** — closest-compliant values, look preserved.
5. **Undo** after remove (10s, in the status region).
6. **12-stop cap** messaging in the summary bar.

## Dark mode & continental scale (Turn 2)

Supersedes the old "dark mode is out of scope for v1" note in `app/globals.css`. `prefers-color-scheme`
only — the design has no manual toggle. Dark tokens live alongside the light set in `globals.css`,
corrected against the mockup's hexes the same way the light set was (several needed lifting for AA —
see the token comments). Map paint colours are threaded in separately via `lib/map/mapTheme.ts` since
MapLibre reads JS, not CSS custom properties; the keyless OpenFreeMap fallback has no dark tile style,
so a dark OS preference without a MapTiler key stays on the light basemap.

Continental scale (23-stop, 7-country trip) needs a routing decision first: OSRM's `/trip` cap is
12 stops (`MAX_STOPS_PER_ROUTE`, enforced in `app/api/optimize/route.ts`), so anything larger routes
via chunked `/route` calls at fixed order — no re-optimization above the cap. Country grouping,
sticky headers, and per-country subtotals are derived (`lib/plan/groupByCountry.ts`), not persisted;
`Place.countryCode` (set at geocode time) and `RouteLeg.mode` (for ferry/non-driving legs) are the
only new persisted fields.

## Turn 2 follow-up — map-side continental treatment, add-a-stop, import polish

A later design revision added the pieces the section above didn't cover, plus a feature this v1 plan
had put out of scope. All four landed together:

- **Map-side continental treatment**: country borders and city-label suppression (toggled on the
  basemap's own vector layers via `lib/map/basemapLayers.ts` — verified only for OpenFreeMap's
  keyless `liberty` style; any other style, including MapTiler's, silently gets none of this rather
  than a guessed layer id), a real accessible scale bar (`lib/map/scale.ts` — `maplibregl.ScaleControl`
  lives inside the map's `aria-hidden` canvas, so this is a plain readable element instead), and
  marker clustering by country group (`lib/map/clusterByGroup.ts`, grouped by itinerary order via
  `groupByCountry`, deliberately not MapLibre's proximity-based `cluster:true` — that would merge two
  separate visits to the same country into one blob). `Route.generalized` (declared, previously
  unused) is now set in `app/api/optimize/route.ts` via an RDP line-simplifier
  (`lib/geo/simplify.ts`) whenever a route is too large for OSRM's exact solver, and stated in
  `SummaryBar` rather than only as a map badge — it changes what the distance/time numbers mean.
- **Add-a-stop search**: `components/planner/AddStopSearch.tsx`, a full ARIA 1.2 combobox (the
  codebase's other menus are `popover="auto"` static menus, which can't do the
  `aria-activedescendant` typed-filter pattern this needs). Backed by `/api/nearby` — this
  **reverses** the "place recommendations via Overpass" out-of-scope line below — scoped to a short
  leg-window corridor (`lib/plan/suggest.ts`), never the whole route, with its own cache table
  (`poi_cache`, migration `0003`) and rate-gate provider. Detour cost is a haversine estimate
  (`lib/routing/detour.ts`), not a live OSRM call per candidate.
- **Sidebar polish**: a decorative km-by-country proportion bar in `SummaryBar` for grouped plans, and
  a "peek" partial reveal for country groups over 4 stops (`PlaceList.tsx` — a "+N more" button and a
  "Showing X of Y · Expand all" footer), independent of the existing collapse/expand state.
- **Import polish**: a category chip and a distance-outlier warning per geocode candidate
  (`lib/import/outlier.ts`) in the M3 confirm-locations flow — compared against the other rows in the
  same import batch, since that flow never receives the existing plan's places, only a count.

Explicitly **not** built: the design's "days/span" stat and "Group by Day" toggle, or per-stop
"nights" flavor text — no date field exists on `Place`, and multi-day itineraries stay out of scope
(next section, unchanged).

## Explicitly out of scope for v1

Multi-day itineraries, opening-hours awareness, time windows, collaboration, offline mode,
PWA share target.

## Complexity

**Large.** P0 ~3h. Tracks A–I roughly 4–10h each, fully parallelizable after P0.
Serial critical path ≈ P0 → B → G.
