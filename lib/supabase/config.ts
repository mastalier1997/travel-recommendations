export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * With no credentials the app still runs — `/` renders the fixture planner and
 * nothing persists. That property is what lets tracks C–I work without a project,
 * so check this before reaching for a client rather than letting it throw.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
