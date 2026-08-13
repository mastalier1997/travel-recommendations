-- Wanderlist initial schema.
--
-- One user-facing table (plans) plus three shared service tables. The service tables
-- hold public data (geocode results, Wikipedia extracts) and are cached globally, not
-- per user: RLS is enabled with zero policies, so only the service-role key reaches them.

create table plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  title          text not null default 'Untitled plan',
  places         jsonb not null default '[]'::jsonb,
  route          jsonb,
  schema_version int not null default 1,
  -- Optimistic concurrency. Writes are conditional on this value, so a second tab
  -- with a stale copy loses instead of silently overwriting a whole document.
  version        int not null default 1,
  updated_at     timestamptz not null default now()
);

create index plans_user_updated_idx on plans (user_id, updated_at desc);

alter table plans enable row level security;

create policy "own plans" on plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Shared caches. TTL is enforced at read time (fetched_at > now() - interval ...),
-- so there is no cron job and no eviction worker.
-- ---------------------------------------------------------------------------

-- key = sha1(provider || '|' || normalizedQuery || '|' || biasKey). TTL 60d, 7d for
-- zero-result rows so a bad query gets retried sooner than a good one expires.
create table geo_cache (
  key        text primary key,
  candidates jsonb not null,
  fetched_at timestamptz not null default now()
);

-- key = 'wd:Q243' where a Wikidata id exists, else 'wp:en:Title'. Wikidata-keyed rows
-- survive article renames. TTL 30d.
create table place_content (
  key         text primary key,
  description jsonb not null,
  fetched_at  timestamptz not null default now()
);

-- Postgres as the clock for provider rate limits. Serverless has no shared process,
-- so an in-memory queue cannot enforce Nominatim's 1 req/s. Claim a slot with:
--
--   update rate_gate
--      set next_allowed_at = greatest(next_allowed_at, now()) + interval '1050 milliseconds'
--    where provider = $1
--   returning next_allowed_at - interval '1050 milliseconds' as slot;
--
-- then sleep until `slot`. If the wait exceeds ~4s, return 429 + retryAfterMs and let
-- the client re-queue that row.
create table rate_gate (
  provider        text primary key,
  next_allowed_at timestamptz not null default now()
);

insert into rate_gate (provider) values ('nominatim');

alter table geo_cache enable row level security;
alter table place_content enable row level security;
alter table rate_gate enable row level security;
