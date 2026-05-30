# Session Handoff

Date: 2026-05-30

## Progress This Session

- **Full requirements grilling completed** (10 rounds) for Darecky — shareable wishlist app with surprise mechanic (owner never sees reservation state).
- **Created `.mpx/CONTEXT.md`** — domain language (11 terms), relationships, feature index (21 features v1/v2), 20 constraints.
- **Created `.mpx/DECISIONS.md`** — 28 settled decisions across 9 domains (Product, Roles, Auth, UI, Sharing, Notifications, Data, Platform, Repo Structure).
- **Removed legacy stubs** `.mpx/REQUIREMENTS.md` and `.mpx/LESSONS_LEARNED.md`.
- **12 background research agents** completed covering: Grovekeeper conventions, mpx-claude-code skills/rules, SvelteKit remote functions, current template inventory, deployment options (2 rounds), BetterAuth + remote functions, Cloudflare + Hyperdrive + R2, template-sveltekit repo, Grovekeeper fallow setup, free deployment comparison.

## Key Decisions

See `.mpx/DECISIONS.md` for full 28-decision list. Most critical:

- **Owner surprise protection**: Owner NEVER sees reservation state. Core invariant.
- **Sharing locks owner editing**: After sharing, owner can only ADD (not edit/remove).
- **$0/month deployment**: Cloudflare Workers (free) + Neon Postgres via Hyperdrive (free) + R2 (free) + Resend (free). Keep current `adapter-cloudflare`.
- **Remote functions**: `query`/`form`/`command` for all client-server communication. Guarded wrappers for auth-protected endpoints.
- **BetterAuth**: `better-auth/minimal` (edge-compatible). `@node-rs/argon2` is unused (scrypt default). Auth routes stay as catch-all; app logic uses remote functions.
- **Fallow** replaces knip for dead-code detection. Regression-gated in CI and pre-push.
- **Component tiers**: `base/` (shadcn) → `derived/` (wrappers) → `blocks/` (feature-level).
- **Domain modules**: `src/lib/modules/` — wishlists, gifts, reservations, likes, notifications, themes, sharing.

## Dead Ends & Mistakes

- **"adapter-node required for Postgres"**: WRONG. The `postgres` v3.4.8 package supports Cloudflare Workers TCP via Hyperdrive. `better-auth/minimal` is edge-compatible. `@node-rs/argon2` is unused. The template was Cloudflare-ready all along.
- **Railway/Fly.io/Render as free options**: Railway has no real free tier ($5/mo). Fly.io removed free tier in 2024. Render free Postgres expires in 30 days.
- **Owner can edit/remove gifts**: Wrong — owner can only add. Edit/remove is moderator-only (except before sharing).
- **Two-step reservation**: Rejected. Single state (free ↔ reserved) is sufficient.

## Next Steps

1. **Template changes for Cloudflare + Neon**:
    - Update `wrangler.jsonc`: add Hyperdrive + R2 bindings, change `nodejs_als` → `nodejs_compat`, update compatibility_date
    - Rewrite `src/lib/server/db/index.ts`: use Hyperdrive binding, `prepare: false`, `fetch_types: false`
    - Update `src/app.d.ts`: add `Hyperdrive` and `R2Bucket` types
    - Remove `@node-rs/argon2` from `package.json`
    - Add `@cloudflare/workers-types` to devDependencies
    - Create `src/routes/api/auth/[...betterauth]/+server.ts` (explicit catch-all for Workers)
    - Update auth.ts to receive DB from locals instead of creating its own

2. **Replace knip with fallow**:
    - Add `fallow` + `@fallow-cli/win32-x64-msvc` to dependencies
    - Remove `knip` and `knip.config.ts`
    - Create `.fallowrc.json` with entry points, rules, ignore patterns
    - Create `fallow-baselines/` directory
    - Add scripts: `check:fallow`, `fallow:audit`, `fallow:save-baseline`
    - Update `check:all` to use fallow instead of knip

3. **Pre-push parallel checks**:
    - Create `scripts/pre-push-parallel.js` (fallow + svelte-check + eslint + vitest in parallel)
    - Update `.husky/pre-push`

4. **Rename component directories**:
    - `src/lib/components/ui/` → `src/lib/components/base/`
    - `src/lib/components/composed/` → `src/lib/components/derived/`
    - Create `src/lib/components/blocks/`
    - Update `components.json` shadcn alias

5. **Symlink rules**:
    - Symlink 4 rules from `C:\_MP_projects\mpx-claude-code\rules-per-project\` into `.claude/rules/`

6. **Create module structure**:
    - `src/lib/modules/wishlists/`, `gifts/`, `reservations/`, `likes/`, `notifications/`, `themes/`, `sharing/`
    - Each with `types.ts`, `*.remote.ts`, `*.context.svelte.ts`, `index.ts`

7. **Flip i18n default**: Czech as default (no URL prefix), English at `/en/`

8. **Guarded remote function helpers**: Create `src/lib/server/remote.ts` with `guardedQuery`, `guardedCommand`, `guardedForm`

9. **Database schema design**: Drizzle tables for wishlists, gifts, reservations, likes, moderator_assignments, notifications, wishlist_themes

10. **Design briefs**: Landing page, dashboard, wishlist view (owner/visitor/moderator), gift detail modal, sharing flow

## Critical Files

- `.mpx/CONTEXT.md` — Domain language, features, constraints. READ FIRST.
- `.mpx/DECISIONS.md` — 28 decisions with rationale. Check before proposing alternatives.
- `svelte.config.js` — `remoteFunctions: true`, `experimental.async: true`, `adapter-cloudflare`.
- `wrangler.jsonc` — Needs Hyperdrive + R2 bindings added.
- `src/lib/server/auth.ts` — `better-auth/minimal`, needs magic link plugin, needs DB from locals.
- `src/lib/server/db/index.ts` — Needs rewrite for Hyperdrive binding pattern.
- `src/lib/server/db/schema.ts` — Currently auth tables only. Needs domain schema.
- `src/app.css` — Tailwind 4 + OKLCH tokens. Needs wishlist theme presets.
- `src/app.d.ts` — Needs Hyperdrive + R2Bucket types in App.Platform.
- `package.json` — Remove `@node-rs/argon2`, add `@cloudflare/workers-types`, replace knip with fallow.

## Working Memory

- **Cloudflare free plan 10ms CPU limit**: BetterAuth scrypt hashing is borderline. Magic link (primary auth flow) doesn't hash passwords. Password auth only on sign-up/sign-in — rare. Acceptable for family app.
- **Neon cold starts**: 300-800ms after 5min idle. Acceptable for sporadic family use.
- **Hyperdrive requires `prepare: false`**: Mandatory. Also use `fetch_types: false` to halve first-query latency.
- **`nodejs_compat` flag**: When compatibility_date >= 2024-09-23, this enables both Node.js built-in APIs and polyfills. Supersedes `nodejs_als`.
- **Remote functions on Workers**: `getRequestEvent()` must be called synchronously before any `await` (no AsyncLocalStorage persistence across awaits in some Workers contexts).
- **BetterAuth on Workers**: Needs explicit `src/routes/api/auth/[...betterauth]/+server.ts` catch-all. The `svelteKitHandler` in hooks alone isn't enough — Workers don't pre-generate routes.
- **Grovekeeper theming**: Collapse 3 orthogonal axes into single `data-wishlist-theme` per wishlist + `data-theme` for dark/light.
- **Grovekeeper sorting**: Primary + secondary sort criteria UI. Reuse for gift sorting.
- **i18n flip**: Template has `/` = en, `/cs/` = Czech. Darecky needs `/` = Czech, `/en/` = English.
- **Fallow setup**: `.fallowrc.json` with entry points, `fallow-baselines/` for regression gate, `stale-suppressions: error`, parallel in pre-push via Node script.
- **`/mp-design-ui-3` skill**: Generates 3+ UI variants in 18 design styles. Use for wishlist page and dashboard design exploration.
