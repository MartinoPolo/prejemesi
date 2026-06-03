# Session B Handoff — Architecture (PRD #33 follow-up)

Date: 2026-06-03
Branch context: work landed on `33-image-fitting-cropping-wishlist-visuals-and` (PR #59 → `dev`). Tier 1/2 cleanups done in `ee28eb4`. These four are the deferred **architecture** items — design decisions, not mechanical edits. Recommend running through `/mp-architecture-review` and deciding each before coding.

Ranked by ROI (value ÷ risk). Lead with #1.

---

## 1. Per-request app-background-theme lookup — consolidate (HIGHEST ROI)

**Problem.** `backgroundThemeHandle` runs a dedicated `SELECT app_background_theme FROM user WHERE id = ?` on **every authenticated SSR request** (`src/hooks.server.ts:38-42`), purely to inject `data-bg-theme` on `<html>` for flash-free first paint. On the settings page, `getUserProfile` then re-reads the _same row_ (incl. `appBackgroundTheme`) again (`settings/settings.remote.ts:28-34`). Two reads of one row per settings load; one extra PK read on every other authed page.

**Current mitigations already in place.** The hook query is wrapped in try/catch → degrades to `DEFAULT_BACKGROUND_THEME` instead of 500ing (landed in PR #59). So this is now a _perf/architecture_ concern, not a reliability one.

**Key constraint (the reason it's non-trivial).** better-auth is configured with `session.cookieCache` (5-min TTL, `auth.ts:48-53`) — the session user is served from a signed cookie, so `getSession` usually avoids a DB hit. But `appBackgroundTheme` is **not** in the session payload, hence the separate query. And `getUserProfile` deliberately reads name/image/theme from the DB (not the session) because **the cookie-cached session goes stale after a direct `user` table write** (documented inline at `settings.remote.ts:23-26`). Any consolidation must not reintroduce stale-after-write bugs.

**Options.**

- **A — better-auth `additionalFields` / `customSession` (cleanest).** Expose `appBackgroundTheme` as a session-user field so `event.locals.user.appBackgroundTheme` is available in the hook with **zero extra query**. Requires: (a) declaring the additional field in the better-auth user config, (b) invalidating/refreshing the cached session on `updateAppBackgroundTheme` (and `updateProfile`) so the 5-min cookie cache doesn't serve a stale tint/name for up to 5 min. Removes both the hook query and arguably the settings re-read. Highest payoff, highest care needed (session-write invalidation path).
- **B — shared `locals.fullUser` read (lower risk).** Add one handle (after `authHandle`) that loads the full `user` row once into `event.locals.fullUser`; `backgroundThemeHandle` and `getUserProfile` both read from it. Removes the _intra-request duplication_ and centralizes the read, but still ~1 query/authed request (no better than today on non-settings pages). Simple, safe, no session-cache semantics to reason about.
- **C — accept it.** It's a single indexed lookup by PK. Document as accepted and move on.

**Recommendation.** A if the team wants the round-trip genuinely gone and is comfortable owning the session-invalidation path; otherwise B as a safe middle ground. Avoid C only if profiling shows it matters — honestly it probably doesn't at current scale.

**Risk:** A = medium (session staleness regressions; test theme + name update → immediate reflect, no 5-min lag). B = low. **Effort:** A ≈ half day + tests; B ≈ 1–2 h.
**Acceptance:** authed non-settings SSR issues ≤1 user read for theme; settings page does not read the user row twice; updating theme or profile name reflects on next navigation with no stale window; `check:all` green; add/adjust a test asserting no stale-after-write.

---

## 2. Domain ↔ UI dependency boundary — finish the inversion

**Problem.** PR #59 fixed the worst of it: canonical `IMAGE_FIT_MODES` now lives in `images/fit_modes.ts` and `BACKGROUND_THEMES` in `settings/types.ts`, with UI barrels (`image_frame_fit.ts`, `base/theme/types.ts`) **re-exporting** so consumer imports stayed put. That unblocked the arrow direction but the re-export shim is a band-aid, not the final state.

**What to verify/finish.**

- `src/hooks.server.ts:6` still imports `BackgroundTheme` from `$lib/components/base/theme/types.js` (a UI path) in a **server** file. Should import from the domain (`settings/types.ts`).
- Audit `server/db/enums.ts` and `server/db/auth.schema.ts` — confirm no DB-layer file pulls theme/fit constants transitively through a `components/*` barrel (even type-only `import type` chains are a smell here, though runtime-harmless).
- Decide the **final ownership rule** and delete redundant re-exports where consumers can point at the domain directly. Document the rule in `DECISIONS.md`: _domain/server modules own constants; UI imports from domain, never the reverse._

**Recommendation.** Worth doing for a clean dependency graph, but it's hygiene — schedule after #1. Mostly mechanical once the rule is set; the "architecture" part is agreeing the rule and the canonical homes, then letting a follow-up executor do the import rewrites.

**Risk:** low (type-only / import-path churn, compiler-caught). **Effort:** 2–4 h.
**Acceptance:** no file under `server/` or `modules/` imports from `components/*`; re-export shims removed or explicitly justified; `DECISIONS.md` rule recorded; `pnpm check:all` + fallow green.

---

## 3. `GiftDetailForm.svelte` decomposition (~500 lines)

**Problem.** One component owns field editing + image-mode switch + crop/fit editing + delete + received-toggle (12 props, 4 callbacks). High cognitive load, hard to test in isolation, and it's where future image/crop changes will keep landing.

**Approach.** First split target = extract the **image/crop section** (mode toggle + `GiftImageCropCanvas` + preview slots + the `cropStateToImageMeta` wiring) into a child component (e.g. `GiftImageEditor.svelte`), passing in/out a single `ImageMetadata` value. This is also the natural home for the shared `FitModePanel` (#4) — do #4 _inside_ this extraction rather than separately. Keep the parent as field-editing + lifecycle (delete/received) orchestration.

**Recommendation.** Medium value (maintainability, not correctness). Do it when someone's next in that file anyway, or as a dedicated focused PR. Keep it behavior-preserving — no UX change, pure structure; lean on existing Storybook + unit coverage to prove parity.

**Risk:** medium (large surface; prop/callback threading; easy to introduce subtle reactivity regressions). **Effort:** ~half day. **Acceptance:** parent < ~300 lines; image/crop logic in a child with its own story; all existing gift tests + stories pass unchanged; svelte-autofixer clean.

---

## 4. Shared `FitModePanel` component

**Problem.** The fit-mode `ToggleGroup` markup + the "auto" help text are still duplicated between `GiftDetailForm.svelte` and `WishlistCropEditor.svelte`. (The _transform_ — `cropStateToImageMeta` — was already deduped in PR #59; only the UI block remains.)

**Approach.** Extract a small derived component `FitModePanel` (props: current `fitMode`, `onChange` guarded by `IMAGE_FIT_MODE_VALUES`, optional help-text slot/variant) and call from both editors. Per the project's shadcn tiering, this is a **Derived** component (pattern used ≥2×) with its own story.

**Recommendation.** Lowest-value of the four and the smallest. Best folded into #3's extraction so it's done once in the right place. If #3 is deferred, this can still ship standalone as a quick Derived-component extraction.

**Risk:** low. **Effort:** 1–2 h (or ~0 marginal if done within #3). **Acceptance:** both editors render the toggle via `FitModePanel`; one story; no duplicated toggle/help markup remains; `check:all` green.

---

## Suggested order

1 → 2 → 3 (with 4 folded in). #1 is the only item with real runtime payoff; 2–4 are maintainability. Run `/mp-architecture-review` first to ratify the approach for #1 (session enrichment vs shared-locals) and the ownership rule for #2 before coding.

## Open decisions to settle in review

- #1: better-auth session enrichment (A) vs shared `locals` read (B) vs accept (C)?
- #2: final canonical-ownership rule + whether to delete the re-export shims or keep for ergonomics.
- #3/#4: dedicated PR now, or opportunistic when next editing the gift form?
