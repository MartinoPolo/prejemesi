# Testing

## Local test environments

Before database-backed verification, check `docker info`. If Docker Desktop is installed but not
running, agents may start it (`docker desktop start`, or PowerShell `Start-Process` using its
resolved installed path) without asking. Bound startup/readiness checks to five minutes. Once Docker
is ready and shared verification resources are available, run `pnpm.cmd run db:start` and confirm
Compose reports `db` healthy; verify the app's local database connection before testing. Recover
startup failures rather than stopping at connection refused. Never reset volumes, restart another
run's database, or change production configuration; leave shared Docker/database services running.

`pnpm run test` runs all client, server, and Storybook Vitest project groups serially because
concurrent projects race on shared SvelteKit generated state. Tests within each project remain
parallel.

To run only the server project, use `pnpm exec vitest run --project server`.

For browser verification without automatic failure screenshots, set
`VITEST_SCREENSHOT_FAILURES=false`. This opt-out is applied inside both browser project
configurations; a top-level CLI flag alone may be overridden by their project settings. Run browser
projects serially in the same checkout to avoid races in generated SvelteKit state. Wishlist E2E
attachment helpers accept `E2E_SCREENSHOT_ATTACHMENTS=false` for numeric-only verification;
behavioral assertions still run.

`pnpm run test:e2e` starts its own localhost-only development server with a non-production signing
secret. R2 variables are intentionally absent, so uploads use the local in-memory fallback. It uses
`PLAYWRIGHT_BASE_URL=http://localhost:8300` by default. Every automation server uses that exact port
with Vite strict-port mode, preventing a test from attaching to a different process.

When the default port is occupied, choose an explicit free origin rather than reusing that server:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8301 pnpm run test:e2e
```

## Parallel work and browser ownership

Default to **one browser-heavy workflow at a time on this machine**, coordinated by the agents;
there is no automatic queue. If occupied, continue independent work and recheck the owner's
completion and resource availability every five minutes, for at most 30 minutes before reporting the
blocker. Do not infer ownership from a port alone or kill another run's processes. Reads and
independent Node-only tests can continue in parallel. Vite/Vitest port and worker settings apply to
one process, not all active checkouts.

- Different ports do not isolate data. Checkouts share the `prejemesi` Compose database/volume by
  default, and some tests mutate seeded rows. Do not reseed, migrate, or interact with shared test
  data during verification. Concurrent app runs require separately prepared databases, not just
  fresh browser contexts.
- Do not run builds, code generation, or another Vite/Vitest process against the same checkout's
  `.svelte-kit` and generated files while verification is using them. Stop the owned server first.
- For deliberately concurrent runs in separate checkouts, assign distinct app ports and
  `VITEST_CLIENT_PORT` / `VITEST_STORYBOOK_PORT` values. The existing strict-port settings reject
  collisions; retain Playwright's `reuseExistingServer: false` default. External-server mode
  requires manually confirming that the exact origin serves the intended checkout and local
  database.
- Raw Playwright launches own separate processes/profiles; contexts isolate cookies/storage, not
  backend data. Localhost cookies are not port-isolated within a shared context. Never share an
  MCP/CDP-controlled page or personal browser profile; close only browsers this run launched.
- Screenshots require an explicit origin and get unique filenames, even with `--name`. Confirm the
  server's checkout yourself; there is no identity endpoint or automatic server discovery:

    ```bash
    MSYS_NO_PATHCONV=1 node scripts/shot.mjs /my-lists --base http://localhost:8300 --user martin
    ```

Keep reports checkout-local and runs in that checkout sequential. After cancellation, confirm the
owned browser/server has stopped before starting the next workflow; never kill all Chrome or Node
processes. These are operating rules, not enforced isolation. Port changes alone cannot provide safe
shared-database concurrency or prevent laptop overload.

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

## Rendered geometry assertions

Use `tests/helpers/pixel-assertions.mjs` with the current runner's `expect` for rendered pixel
sizes, positions, alignment, and containment. Its near/minimum/maximum helpers allow 0.5 CSS pixels
by default. Preserve polling and animation readiness; tolerance is not a substitute for either. Keep
design-token strings, counts, dimensionless ratios, and pure calculations exact or under their own
meaningful precision. Explicit tolerance overrides require a requirement-specific reason.

For gift-card image seams, geometry assertions do not detect native-pixel paint gaps. Against an
already-running Storybook in the intended checkout (`pnpm.cmd exec storybook dev -p 6017 --ci`),
run:

```bash
node scripts/verify-gift-card-image-seam.mjs --base http://127.0.0.1:6017
```

Add `--output <directory>` to save screenshots. Optional `--baseline` deliberately restores the old
layout and is expected to fail. Do not start or stop a parent- or user-owned Storybook process for
this check.

For gift image corner checks, use the Grid and List stories under
`Blocks/Wishlist/WishlistGiftDisplay`. They render the production collection with photos,
transparent/Fit images, placeholders, state overlays, and category/priority badges. Compare
desktop/mobile in light/dark themes; rectangular crop geometry alone does not prove that rounded
corners clip correctly.
