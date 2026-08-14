-- Atomic slot claim for lib/geo/gate.ts. This has to be a single UPDATE...RETURNING
-- inside Postgres, not a read-then-write from the app: two concurrent serverless
-- invocations reading the same next_allowed_at and then both writing their own
-- "next slot" would let both through at once, defeating the whole point of the gate.
create or replace function claim_rate_slot(p_provider text, p_interval_ms integer)
returns timestamptz
language sql
as $$
  update rate_gate
     set next_allowed_at = greatest(next_allowed_at, now())
                            + make_interval(secs => p_interval_ms / 1000.0)
   where provider = p_provider
  returning next_allowed_at - make_interval(secs => p_interval_ms / 1000.0);
$$;
