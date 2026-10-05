# Performance

## Preloading strategy

Public pages stay lean while the first in-app navigation stays fast:

- **No unconditional preloading.** The root `+layout.svelte` does **not** eagerly `preloadCode()`
  any routes, so public and auth pages never pull authenticated app code up front.
- **Intent-based preloading (everyone).** `<body data-sveltekit-preload-data="hover">` (in
  `src/app.html`) lets SvelteKit preload a route's code and data on hover or tap intent. Anonymous
  visitors on public wishlist pages rely on this alone.
- **Selective idle-time preloading (authenticated only).** `(app)/+layout.svelte` warms only
  `/followed` from the overview (the observed dominant destination), or `/home` from another
  authenticated route. It uses `requestIdleCallback` with a bounded Safari timer fallback and skips
  idle preloading when the optional Network Information API reports data-saving mode, `slow-2g`, or
  `2g`. Hover and tap intent remain the fallback everywhere.

> **Not the same as Vite dev warmup.** `server.warmup.clientFiles` in `vite.config.ts` also lists
> the primary routes, but it only makes the local dev server compile those modules ahead of time and
> has no effect on what a browser fetches in production. Do **not** add an unconditional root-layout
> `preloadCode()` to match the warmup list.

## Production delta report

The CI performance-report job runs only for PRs whose head branch starts with `perf/` or that carry
the `performance-report` label. It builds the base and head commits and compares the production
JS/CSS assets that `/` and `/login` load during startup.

Run a checkout locally with a dedicated port and commit label. On Windows Git Bash use:

```bash
pnpm.exe perf:collect -- --project . --output performance-reports/head.json --port 8402 --commit HEAD --runs 5
pnpm.exe perf:compare -- --base performance-reports/base.json --head performance-reports/head.json --output performance-reports/summary.md
```

On macOS or Linux use:

```sh
pnpm perf:collect -- --project . --output performance-reports/head.json --port 8402 --commit HEAD --runs 5
pnpm perf:compare -- --base performance-reports/base.json --head performance-reports/head.json --output performance-reports/summary.md
```

Collection uses five fresh, no-cache Chromium contexts per route and reports medians with a fixed
390×844 viewport, 4× CPU throttling, 150 ms latency, and 1.6 Mbps download. Asset totals include
responses through a fixed 2.5-second post-load startup window, so they may include dynamically
loaded work in that bounded window. The workflow uploads the base JSON, head JSON, and Markdown
summary for 14 days, appends the summary to the job page, and updates one marker-based PR comment.

Warnings highlight relative increases of **10% or more in startup-window JS/CSS Brotli bytes** and
**15% or more in runtime metrics**. They are informational and nonblocking: build, browser,
collection, missing-input, comparison, artifact, or comment failures must not gate a pull request,
and failed reports remain visibly represented in the Markdown.

These figures are raw Chromium diagnostics. They are **not Lighthouse scores** and do not model
deployed-edge behavior, production network routing, caches, or geographic latency. Autonomous agents
must disclose significant regressions called out by this report in their completion summary, even
though the report does not block merging.
