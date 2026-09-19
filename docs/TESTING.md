# Testing

## Local test environments

`pnpm run test` runs all client, server, and Storybook Vitest project groups serially because
concurrent projects race on shared SvelteKit generated state. Tests within each project remain
parallel.

To run only the server project, use `pnpm exec vitest run --project server`.

For browser verification without automatic failure screenshots, set
`VITEST_SCREENSHOT_FAILURES=false`. This opt-out is applied inside both browser project
configurations; a top-level CLI flag alone may be overridden by their project settings. Run browser
projects serially in the same checkout to avoid races in generated SvelteKit state.

`pnpm run test:e2e` starts its own localhost-only development server with a non-production signing
secret. R2 variables are intentionally absent, so uploads use the local in-memory fallback. It uses
`PLAYWRIGHT_BASE_URL=http://localhost:8300` by default. Every automation server uses that exact port
with Vite strict-port mode, preventing a test from attaching to a different process.

Parallel agents must choose distinct explicit origins, for example:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8301 pnpm run test:e2e
```

Any valid loopback port is accepted. Port isolation does not isolate PostgreSQL data: concurrent
full suites must use distinct prepared local databases through `DATABASE_URL`, while focused runs
that do not mutate the same fixtures may share the ordinary seeded database. Concurrent browser-mode
Vitest processes must likewise set distinct `VITEST_CLIENT_PORT` and `VITEST_STORYBOOK_PORT` values;
their ports remain strict so collisions fail visibly.

The setup project allows extra navigation time for cold Vite compilation without relaxing the warmed
application's navigation limits. Interaction tests must await actual readiness: opening autofocus
before moving keyboard focus, and accordion height animations before filling or scrolling clipped
descendants. Visibility alone does not establish either condition; use focus assertions and
animation completion rather than fixed sleeps.

Never point either command at production.

The ingestion endpoint depends on the `GIFT_INGESTION_RATE_LIMIT` Workers binding. `pnpm preview`
uses local Wrangler, which simulates this binding from `wrangler.jsonc`. The normal Vite-backed e2e
server remains supported for application tests, but intentionally has no Workers binding; if
ingestion credentials are configured there, ingestion fails closed with HTTP 503 rather than
bypassing the limit.
