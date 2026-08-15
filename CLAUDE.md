# Working in this repo

## Verifying UI changes

Use Playwright, not ad-hoc screenshot tools (chrome-devtools MCP or similar).

```bash
npm run test:e2e        # headless
npm run test:e2e:ui     # interactive, for debugging a failure
```

Specs live in `e2e/`, against the `/dev/fixture/*` routes (no Supabase, nothing
persists — see `app/dev/fixture/page.tsx`). `playwright.config.ts` auto-starts
`next dev`. Prefer role/text/label queries (`getByRole`, `getByText`) over CSS-module
class names, which are hashed per build.

`e2e/a11y.spec.ts` runs `@axe-core/playwright` against every fixture route under both
`light` and `dark` `prefers-color-scheme` — a light-mode pass proves nothing about
dark, since contrast is computed per color. Add new fixture routes to its `FIXTURES`
array so they get covered automatically.

When a change touches visual/interactive behavior, add or extend a spec rather than
describing what you observed by eye.
