# Testing

## Local test environments

`pnpm run test` runs all client, server, and Storybook Vitest project groups serially because concurrent projects race on shared SvelteKit generated state. Tests within each project remain parallel.

To run only the server project, use `pnpm exec vitest run --project server`.

`pnpm run test:e2e` starts its own localhost-only development server with a non-production signing secret. R2 variables are intentionally absent, so uploads use the local in-memory fallback. Free the configured port or select one with `PLAYWRIGHT_DEV_SERVER_PORT` before running it.

Never point either command at production.

The ingestion endpoint depends on the `GIFT_INGESTION_RATE_LIMIT` Workers binding. `pnpm preview`
uses local Wrangler, which simulates this binding from `wrangler.jsonc`. The normal Vite-backed e2e
server remains supported for application tests, but intentionally has no Workers binding; if ingestion
credentials are configured there, ingestion fails closed with HTTP 503 rather than bypassing the limit.
