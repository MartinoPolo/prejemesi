# Performance

## Preloading strategy

Public pages stay lean while the first in-app navigation stays fast:

- **No unconditional preloading.** The root `+layout.svelte` does **not** eagerly `preloadCode()` any routes, so public and auth pages never pull authenticated app code up front.
- **Intent-based preloading (everyone).** `<body data-sveltekit-preload-data="hover">` (in `src/app.html`) lets SvelteKit preload a route's code and data on hover or tap intent. Anonymous visitors on public wishlist pages rely on this alone.
- **Selective idle-time preloading (authenticated only).** `(app)/+layout.svelte` warms only `/followed` from the overview (the observed dominant destination), or `/home` from another authenticated route. It uses `requestIdleCallback` with a bounded Safari timer fallback and skips idle preloading when the optional Network Information API reports data-saving mode, `slow-2g`, or `2g`. Hover and tap intent remain the fallback everywhere.
- **Fonts.** `shouldPreloadAsset` in `src/hooks.server.ts` is the only font preload source: it preloads the DynaPuff and Geist latin and latin-ext files, which every Czech page renders above the fold. Other fonts (Fraunces and Caveat wishlist headings, other subsets) load through `@font-face` on first use.

> **Not the same as Vite dev warmup.** `server.warmup.clientFiles` in `vite.config.ts` also lists the primary routes, but it only makes the local dev server compile those modules ahead of time and has no effect on what a browser fetches in production. Do **not** add an unconditional root-layout `preloadCode()` to match the warmup list.

## Server timing

- Local dev, `pnpm preview` and staging responses carry a `Server-Timing` header (`src/lib/server/server_timing.ts`), visible in the browser's network panel: `auth` (session lookup), `app` (only the innermost resolve: load functions and SSR render), `db` (summed duration of the request's queries, so overlapping pipelined queries can exceed wall time, with the query count in `desc`; BEGIN/COMMIT round trips are not counted) and `total` (time to response headers, so a streamed response's later chunks are excluded); unrecorded metrics are omitted.
- Production sends no `Server-Timing`, because auth and database timings would be a side channel on real data. `exposesServerTiming` decides by the configured `ORIGIN`, not the request host, so preview URLs of production versions stay hidden too; an unset `ORIGIN` counts as production.

## Lazy dialogs

Anonymous visitors download the `(app)` layout and `/w/[id]`, so manager-only or rarely opened dialogs load on demand through `LazyDialog` (`src/lib/components/derived/lazy-dialog/`). Each dialog module has one module-level `lazyComponent` loader (`src/lib/components/blocks/wishlist/lazy_dialog_loaders.ts`), shared by every mount and trigger. Opening imports the chunk behind a status announcement, with a retry and reload error dialog; the loaded dialog mounts closed, opens a frame later, and then stays mounted, so its animation and focus handling behave as if it were eager. Bind the snippet's `dialog.open` to the loaded dialog. Start the import on intent (`loader.preload` from the trigger's hover or focus, or from opening the menu that holds it), or pass `preloadWhenIdle` only for dialogs a viewer usually opens; idle preloads run one chunk per idle period. Keep eager only what anonymous visitors need on first paint, such as the gift viewer and reserve flow. A loader only splits the chunk when no eagerly rendered component imports the dialog statically. A runtime value exported from a dialog's `<script module>` pulls the whole component into the importer's chunk; move it to a plain module.

## Public code isolation

[`tests/release/public-code-isolation.spec.ts`](../tests/release/public-code-isolation.spec.ts) fails when `/` or `/login` requests authenticated app code before user intent: `(app)` routes, the import, wishlist, gift and notification modules, or the app-shell navbar components. It also fails when an anonymous `/w/[id]` view requests one of the lazy dialogs above. The Vite dev server serves source modules unbundled, so request URLs name the exact files a page pulls in.

The landing demo server-renders the real gift views, so a small set of gift and wishlist presentation modules is allowed **on `/` only**, enumerated file by file in the spec. A forbidden request is a regression to fix by moving the needed logic into an allowed presentation module, not by widening the list. Add a file only after deciding it is public by design. `/login` allows nothing.

## Static asset caching

Never mark a URL `immutable` when its content can change in place.

- Vite-bundled assets (`src/lib/assets/`, including the wishlist background library) get content-hashed `/_app/immutable/` URLs, so changing a file changes its URL.
- Files under `static/demo/v1/` are served immutable by the root `_headers` rule. Changing an image means a new file name or a new version folder; never edit one in place. Other `static/` files keep the default revalidating cache.
- Server-side R2 puts set `UPLOADED_OBJECT_CACHE_CONTROL` (`src/lib/server/storage/r2.ts`) because every upload gets a fresh key. Presigned browser uploads cannot send `Cache-Control` while the bucket CORS (`scripts/generate-r2-cors.ts`) allows only `Content-Type`.

## Production delta report

The CI performance-report job runs only for PRs whose head branch starts with `perf/` or that carry the `performance-report` label. It builds the base and head commits and compares the production JS/CSS assets that `/` and `/login` load during startup.

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

Collection uses five fresh, no-cache Chromium contexts per route and reports medians with a fixed 390×844 viewport, 4× CPU throttling, 150 ms latency, and 1.6 Mbps download. Asset totals include responses through a fixed 2.5-second post-load startup window, so they may include dynamically loaded work in that bounded window. The workflow uploads the base JSON, head JSON, and Markdown summary for 14 days, appends the summary to the job page, and updates one marker-based PR comment.

Warnings highlight relative increases of **10% or more in startup-window JS/CSS Brotli bytes** and **15% or more in runtime metrics**. They are informational and nonblocking: build, browser, collection, missing-input, comparison, artifact, or comment failures must not gate a pull request, and failed reports remain visibly represented in the Markdown.

These figures are raw Chromium diagnostics. They are **not Lighthouse scores** and do not model deployed-edge behavior, production network routing, caches, or geographic latency. Autonomous agents must disclose significant regressions called out by this report in their completion summary, even though the report does not block merging.
