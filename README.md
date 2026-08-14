# Wanderlist

Trip route planner. Import a list of places, see them on a map with short
descriptions, generate an efficient route, drag to override it, export the result.

**No LLM at runtime** — descriptions come from Wikipedia/Wikidata/OSM tags and
routing is a deterministic solver. See [PLAN.md](PLAN.md) for the full design and
the track breakdown.

## Run it

```bash
npm install
npm run dev
```

With no environment at all, `/` renders a fixture planner with nine Kyoto/Osaka
stops and nothing persists. That is deliberate: tracks C–I can be built without a
Supabase project or any API keys.

Set `MOCK=1` in `.env.local` to make the four `/api` routes answer from
`lib/fixtures` instead of calling out.

## Full setup

Copy `.env.example` to `.env.local` and fill in what you need:

| Variable | Needed for |
|---|---|
| `MOCK=1` | Fixture-backed API routes (leave set until tracks D/E/F land) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sign-in and saved plans |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side geocode/description caches |
| `NEXT_PUBLIC_MAPTILER_KEY` | Real map tiles (without it the map still draws the route and pins on a plain background) |

Then apply `supabase/migrations/0001_init.sql` to your project, and enable email
sign-in — auth is magic-link only, there is no password to store.

Once `NEXT_PUBLIC_SUPABASE_URL` and the anon key are present, `/` redirects to
`/plans` and the fixture planner is no longer reachable.

## Checks

```bash
npm test && npx tsc --noEmit && npm run build
```
