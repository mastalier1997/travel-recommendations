-- POI suggestions along a route corridor (Overpass), same shared-cache shape as
-- geo_cache in 0001_init.sql — global, not per-user, RLS on with zero policies so
-- only the service-role key (lib/geo/poi-cache.ts) reaches it. TTL enforced at read
-- time (7d — see lib/geo/poi-cache-key.ts), no cron/eviction worker.
create table poi_cache (
  key        text primary key,
  pois       jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table poi_cache enable row level security;

-- Overpass's public instance needs real breathing room between dense corridor
-- queries — see lib/geo/gate-decision.ts's per-provider MIN_INTERVAL_MS.
insert into rate_gate (provider) values ('overpass');
