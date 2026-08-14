/**
 * When MOCK=1 every /api route answers from lib/fixtures instead of calling out.
 * This is the seam that lets the UI tracks (B, G, H, I) run the whole app with no
 * keys, no network, and no dependency on the service tracks (D, E, F).
 */
export const MOCK = process.env.MOCK === '1';

/** Placeholder for the service tracks. Delete the call when the real path lands. */
export function notImplemented(track: string) {
  return Response.json(
    { error: `Not implemented yet — owned by track ${track}. Set MOCK=1 to use fixtures.` },
    { status: 501 },
  );
}
