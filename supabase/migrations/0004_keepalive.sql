-- Dedicated single-row table for the keepalive workflow's ping. Supabase's free-tier
-- auto-pause tracks real database writes, not GET/SELECT traffic through PostgREST, so a
-- read-only ping (the previous approach) doesn't reset the 7-day inactivity clock. RLS is
-- enabled with zero policies, matching geo_cache/place_content/rate_gate, so only the
-- service-role key can touch it.
create table keepalive (
  id        int primary key default 1,
  pinged_at timestamptz not null default now(),
  constraint keepalive_singleton check (id = 1)
);

alter table keepalive enable row level security;

insert into keepalive (id) values (1);
