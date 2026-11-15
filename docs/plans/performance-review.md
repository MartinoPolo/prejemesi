# Performance review (2026-11)

A full-app review of page load, interaction latency, scrolling and bundle size, measured before (`00347f03`) and after (`9a875a1a`) the fixes below.

## Method

- The harness lives outside the repository at `C:\_temp\prejemesi.perf-review\harness` (`run.sh`, `perf.mjs`, `report.mjs`, `bundle.mjs`, `serve.sh`, `fixture-big-wishlist.sql`). It drives the project's Playwright against a production build served by `wrangler dev --local`, with its own `prejemesi_perf` database in the local Postgres container, and records 5 runs per scenario. Each table value below is the median.
    - **Load:** cold cache; waits for `html[data-app-hydrated="true"]`, then a 3 s settle.
    - **Interactions:** the first interaction after a fresh load, warm cache. INP is the longest Event Timing entry; "visible" runs from the trusted input until the target is visible.
    - **Scroll:** a synthesized 6000 px gesture at 2000 px/s.
    - **Bundle:** Brotli sizes per route, with source-map module attribution.
    - **Profiles:** desktop is 1440×900 at 1× CPU; mobile is 390×844, DPR 3, 4× CPU. The network is not throttled.
- The fixture grows `/w/xmas2026` (`seed-wl-xmas26`) to 78 gifts. Petr views it as the gifter and Martin as the owner.
- To re-run: build with `vite build --sourcemap hidden` in a worktree whose `.env` points at `prejemesi_perf` and the serving port. Migrate and seed that database, then load the fixture and upload the seed images (`harness/upload-seed-images.mjs`). Finally `bash harness/serve.sh <worktree> <port>` and `bash harness/run.sh --base http://localhost:<port> --runs 5 --baseline <results.json> --out <dir>`. A full run takes 25–60 minutes. The `perf-baseline` worktree and the `prejemesi_perf` database were kept for re-runs.
- Recommendation: commit the harness under `scripts/perf/`, with the database URL, port and fixture as parameters instead of machine paths. `pnpm perf:collect` (see [PERFORMANCE.md](../PERFORMANCE.md#production-delta-report)) covers only the startup of `/` and `/login`. The authenticated, large-list wishlist scenarios are where every regression in this review showed up.

## Before and after

Medians in ms unless noted. Wishlist rows are `/w/xmas2026` with 78 gifts, as the gifter unless marked.

| Metric | Desktop before | Desktop after | Mobile before | Mobile after |
| --- | --: | --: | --: | --: |
| Wishlist LCP (gifter) | 7976 | 2772 | 24392 | 5956 |
| Wishlist LCP (owner) | 7036 | 2028 | 29112 | 9444 |
| Wishlist hydrated (gifter) | 5670 | 1501 | 9770 | 2162 |
| Wishlist TBT (gifter) | 2963 | 809 | 11906 | 4668 |
| My lists LCP | 3656 | 1108 | 12260 | 1504 |
| Followed LCP | 3740 | 1072 | 7784 | 1632 |
| Settings hydrated | 3676 | 1014 | 8916 | 1636 |
| Wishlist scroll FPS | 4.4 | 51.1 | 22.2 | 58.8 |
| Wishlist scroll dropped frames | 240 | 30 | 140 | 3 |
| Wishlist scroll max frame | 667 | 50 | 525 | 50 |
| Wishlist filter toggle INP | 840 | 256 | — | — |
| Wishlist sort INP | 856 | 336 | — | — |
| Kebab menu open INP | 304 | 160 | 1592 | 248 |
| Gift detail open INP | 256 | 88 | 1176 | 192 |
| Reserve dialog open INP | 216 | 168 | 1144 | 264 |
| Reserve confirm, label visible | 308 | 225 | 3360 | 443 |
| My lists → wishlist navigation, visible | 1527 | 970 | 8487 | 4014 |
| Mobile drawer open INP | — | — | 584 | 144 |
| `/(app)/w/[id]` JS, KB br | 488.6 | 304.2 |  |  |
| `/(app)/followed` JS, KB br | 359.4 | 224.5 |  |  |

Caveats:

- The baseline ran while other agents built and tested on the same machine; the final run had only unrelated background jobs. Part of the TTFB and FCP gain, about 100–800 ms, is that difference rather than the code.
- Dashboard CSS grew by about 7 KB br (+17%), and authenticated pages make about 25% more requests because of the lazy dialog chunks.
- On mobile, unreserve now settles at 1.9 s (was 1.1 s), and LoAF blocking in my lists → wishlist navigation rose to 4.9 s. The visible result arrives sooner, but the work lands in fewer, longer frames after it. Settle now includes the regroup motion, which previously did not run.

## What changed

- [#673](https://github.com/MartinoPolo/prejemesi/pull/673): overlays grow from their trigger; collapsible motion; one shared tooltip provider; cheaper hover lifts and shimmer.
- [#675](https://github.com/MartinoPolo/prejemesi/pull/675): preload only the critical fonts, and give the LCP image `fetchpriority`.
- [#676](https://github.com/MartinoPolo/prejemesi/pull/676): correlated per-wishlist dashboard counts, and an index on active moderator assignments.
- [#677](https://github.com/MartinoPolo/prejemesi/pull/677): one database client per request.
- [#678](https://github.com/MartinoPolo/prejemesi/pull/678): `Server-Timing` (auth, app, db) outside production.
- [#679](https://github.com/MartinoPolo/prejemesi/pull/679): overlay enter and exit as interruptible CSS transitions.
- [#680](https://github.com/MartinoPolo/prejemesi/pull/680): independent page-load queries run concurrently.
- [#681](https://github.com/MartinoPolo/prejemesi/pull/681): static images under immutable cache URLs.
- [#682](https://github.com/MartinoPolo/prejemesi/pull/682): toolbar blur only over a backdrop; overscroll containment; shared resize and intersection observers.
- [#683](https://github.com/MartinoPolo/prejemesi/pull/683): manager-only dialogs load lazily. This is most of the `/w/[id]` and dashboard JS drop.
- [#684](https://github.com/MartinoPolo/prejemesi/pull/684): gift motion no longer re-measures on unrelated scrolls or layout-inert mutations; the collection layout is measured without restyling every card; display state is cached; one cancel per click. This is most of the scroll, filter and sort gain.
- [#685](https://github.com/MartinoPolo/prejemesi/pull/685): follow-ups to #684.
- [#686](https://github.com/MartinoPolo/prejemesi/pull/686): dialog and sheet overlays block the page, instead of `pointer-events` on `<body>`, which restyled every element. This is most of the mobile overlay-open gain.

## Remaining opportunities

- **Mobile wishlist load:** LCP is still 6–9 s and TBT 4.7–6.8 s at 4× CPU. Hydrating 78 gift cards dominates. Candidates are rendering below-the-fold groups later (`content-visibility` or incremental mounting), and starting the gifts query before hydration. The query change conflicts with the Worker CPU budget, so it needs an owner decision.
- **Navigation into a large wishlist on mobile:** 4 s until visible, with long frames after; it shares the hydration cost above.
- **Wishlist filter and sort:** INP is still 256–336 ms on desktop, almost all presentation delay from re-laying out the grid.
- **Bundle:** `@sentry/replay` (124 KB minified) could load lazily or only for sampled sessions; that is an owner decision, tied to the replay sampling in [PRODUCTION_OPERATIONS.md](../PRODUCTION_OPERATIONS.md#sentry). The `tldts` trie (112 KB) ships to the client for `gift_url.ts`. Paraglide ships both locales for every message (235 KB). `papaparse`, `urlpattern-polyfill` and the bits-ui calendar are still in shared chunks. The root CSS is 280 KB raw.
- **E-15, `scrollbar-gutter: stable` on `main.app-content`** (owner decision): it removes the 7.5 px horizontal jump of the content column when a filter removes the classic Windows scrollbar, at the cost of a permanently empty 15 px gutter on short pages. Scrolling is unaffected; the prototype figures are below.
- **Scroll-time gift motion prototype** (owner decision): it stops re-measuring on scroll events and re-measures once at `scrollend`. The trade-off is that cards scrolled into view mid-gesture have no recorded position until the scroll ends, so an action during a scroll fades them instead of moving them. The prototype figures are below.

Prototype scroll figures for the gifter wishlist: 5-run medians, each measured next to a control run of the final build. The E-15 runs keep classic scrollbars visible, because headless Chrome hides them by default.

| Build | Desktop FPS | Desktop dropped | Desktop max frame | Desktop script | Mobile FPS | Mobile dropped | Mobile max frame |
| --- | --: | --: | --: | --: | --: | --: | --: |
| Final, control | 49.3 | 36 | 67 | 2279 | 49.0 | 37 | 83 |
| Scroll-motion prototype | 59.1 | 2 | 33 | 344 | 58.0 | 6 | 83 |
| Final, control, scrollbars shown | 51.9 | 27 | 50 | 2210 | 49.0 | 37 | 83 |
| E-15 gutter, scrollbars shown | 47.5 | 42 | 50 | 2281 | 51.6 | 28 | 83 |

The scroll-motion prototype removes most of the remaining desktop scroll script and holds 59 FPS. The E-15 differences are within run-to-run noise; mobile varied between 49 and 59 FPS across control runs of the same build.
