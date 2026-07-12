# Initial-Load Performance Budget

Guards the two public entry pages — landing (`/`) and login (`/login`) — against
two regressions (issue #106):

1. **Code fan-out** — an anonymous visitor must never download authenticated app
   code (dashboards, settings, import wizard, wishlist/gift management, the app
   shell) before they interact.
2. **Payload creep** — the initial JavaScript request count and transferred bytes
   must stay within a measured budget.

The gate is the automated Playwright spec
[`tests/e2e/performance-budget.spec.ts`](../tests/e2e/performance-budget.spec.ts).

---

## The budget

| Page             | Max JS requests | Max transferred JS bytes |
| ---------------- | --------------- | ------------------------ |
| Landing (`/`)    | **232**         | **12,300,040**           |
| Login (`/login`) | **202**         | **12,110,852**           |

Budget = **measured baseline + ~25% headroom** (`ceil(measured × 1.25)`), per
page, for both request count and bytes. The headroom absorbs benign churn (a new
icon, a copy string) while still catching a real code-fan-out regression.

### Measured baseline (2026-07-12)

| Page    | JS requests | Transferred JS bytes |
| ------- | ----------- | -------------------- |
| Landing | 185         | 9,840,032            |
| Login   | 161         | 9,688,681            |

> **These are Vite _dev-mode_ module counts and bytes, not production chunk
> sizes.** The e2e suite is local-only and runs against the dev server
> (`pnpm run dev`), where modules arrive unbundled and untransformed — so a
> "request" is one source module and "bytes" is uncompressed dev output. The
> numbers are large and would look alarming as production figures; they are not.
> What makes them useful is that they are **deterministic for a given source
> tree**: the same commit always fans out to the same module graph. That makes
> them a reliable **code-fan-out regression gate**, which is the point — not an
> estimate of what ships to users.

---

## What the fan-out gate forbids

Before any user interaction, a request URL from `/` or `/login` matching any of
these path fragments fails the test:

| Forbidden fragment                                 | What it is                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `/routes/(app)/`                                   | All authenticated routes (dashboards, settings, `/w/` management) |
| `/lib/modules/import/`                             | Import wizard                                                     |
| `/lib/modules/wishlists/`                          | Wishlist management module                                        |
| `/lib/modules/gifts/`                              | Gift management module                                            |
| `/lib/modules/notifications/`                      | Authenticated shell notifications                                 |
| `/lib/components/blocks/navbar/Navbar.svelte`      | Authenticated app-shell root                                      |
| `/lib/components/blocks/navbar/UserMenu.svelte`    | App-shell user menu                                               |
| `/lib/components/blocks/navbar/MobileNav.svelte`   | App-shell mobile nav                                              |
| `/lib/components/blocks/navbar/NavDropdown.svelte` | App-shell nav dropdown                                            |

The navbar entries are listed individually on purpose: the `navbar/` folder also
contains `LogoMark.svelte`, a dependency-light shared logo used by the **public**
`LandingNav`/`LandingFooter` and the auth pages. Guarding the whole folder would
false-positive on that shared logo, so only the true app-shell components are
listed. `Navbar.svelte` is the shell root and transitively pulls the others, so
gating it already covers the real authenticated chrome.

---

## Preloading strategy

The budget is only meaningful alongside the preloading rules that keep public
pages lean while still making the first in-app navigation fast:

- **No unconditional preloading.** The root `+layout.svelte` does **not**
  eagerly `preloadCode()` any routes. Public and auth pages therefore never pull
  authenticated app code up front.
- **Intent-based preloading (everyone).** `<body data-sveltekit-preload-data="hover">`
  (in `src/app.html`) lets SvelteKit preload a route's code + data on hover / tap
  intent. Anonymous visitors on public wishlist pages rely on this alone.
- **Bounded idle-time preloading (authenticated only).** `(app)/+layout.svelte`
  warms the primary nav routes (`/my-lists`, `/moderated`, `/followed`,
  `/settings`) during idle time via `requestIdleCallback` (3s timeout, with a
  `setTimeout` fallback for Safari). It is gated to run **only when a user is
  logged in**, so it never affects the public-page budget.

> **Not the same as vite dev-warmup.** `server.warmup.clientFiles` in
> `vite.config.ts` also lists these primary routes, but that is a **dev-server
> pre-transform** optimization only — it makes the local dev server compile those
> modules ahead of time and has no effect on what a browser fetches in production.
> It is independent of the runtime `preloadCode()` strategy above and is
> intentionally retained. Do **not** re-add an unconditional root-layout
> `preloadCode()` to "match" the warmup list — that is exactly the fan-out this
> budget guards against.

---

## Running the gate

Prerequisites: a seeded local DB (`pnpm db:seed`, idempotent). The spec's
`webServer` starts its own dev server.

Port 5173 is often held by another worktree's dev server; because
`reuseExistingServer` is `true`, point the run at a dedicated free port so it
doesn't reuse the wrong code:

```powershell
$env:PLAYWRIGHT_DEV_SERVER_PORT = 5199
pnpm exec playwright test tests/e2e/performance-budget.spec.ts --project=chromium
```

(`PLAYWRIGHT_DEV_SERVER_PORT` overrides both the Playwright `baseURL` and the
`webServer` port; default is 5173.)

---

## Re-baselining after an intentional change

If a legitimate change moves a page's module graph (adds a section, a real new
dependency, etc.) and the budget assertion — not the fan-out assertion — fails:

1. **First confirm the fan-out assertion still passes.** If the test fails
   because a _forbidden_ authenticated module is now being fetched, that is a
   **real regression** to investigate, not a budget to relax. Do not raise the
   budget to hide it.
2. Run the spec (command above) and read the `[budget]` console lines, e.g.:
    ```
    [budget] landing: 185 JS requests, 9840032 bytes
    [budget] login: 161 JS requests, 9688825 bytes
    ```
3. Set each new budget constant in `tests/e2e/performance-budget.spec.ts`
   (`LANDING_BUDGET` / `LOGIN_BUDGET`) to `ceil(measured × 1.25)` for both
   request count and bytes.
4. Update the **budget** and **measured baseline** tables in this doc (and the
   measurement date), so the numbers and their rationale stay in sync with the
   spec.
