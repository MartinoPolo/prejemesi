# Approved unavailable-gift treatment: implementation handoff

## Start here

The user approved the refined design on 2026-09-24. The treatment is implemented; this file keeps the acceptance contract and verification approach.

- Authoritative requirements: [design brief](DESIGN_BRIEF_UNAVAILABLE_GIFT_COMPARISON.md).
- Approved visual reference: [refined.html](refined.html), its initial 50% setting, not the alternative preset gallery.
- Component map: [SUMMARY.md](SUMMARY.md).
- Durable choice: `.mpx/DECISIONS.md`, Wishlist browsing & actions, 2026-09-24. The superseded normal-contrast body/image-veil rule was removed.

### Checkout and delivery context

Continue in the user-selected checkout. At handoff, branch is `martas/dim-secondary-badges-on-unavailable-gift-images`, HEAD `8db5b4ab9e1a61448bbb67270337956be729c11a`. The earlier subtle badge-only change was merged into `dev` by PR [#415](https://github.com/MartinoPolo/prejemesi/pull/415), closing [#391](https://github.com/MartinoPolo/prejemesi/issues/391). This stronger treatment is a follow-up, not already implemented by that PR.

The design directory is untracked and `.mpx/DECISIONS.md` is modified. Preserve these artifacts. Recheck status before work; do not reset, clean, switch or manage worktrees, or synchronize branches autonomously. User requested a plan, not a commit/push/new Issue/deployment. A future execution request/workflow establishes delivery authorization.

## Acceptance contract

| Layer | Unavailable treatment |
| --- | --- |
| Image composition, placeholder, title, description, source links, price, ordinary quantity content | 50% retained visibility, applied once |
| Category and priority badges | 50% opacity, no extra desaturation |
| Outer border, shadow, image/body separator | Half-strength paint; unchanged geometry |
| Reservation/received status and authorized identity/support group | Full contrast |
| Action controls, including Like, More, footer and selection/reorder controls | No additional dimming; preserve their existing disabled/pending semantics |

Available appearance remains unchanged. Keep a visible horizontal image/body separator in Grid and vertical separator in List, for both states. Replace the existing image veil; do not stack it with opacity. Use existing `presentation.isDimmed` eligibility, not a second reservation calculation. Preserve image-free Compact, privacy, crops, responsive layout, and action permissions. Quantity is treated as ordinary content under the user's “everything except action buttons” instruction; authorized reservation support remains with the crisp state group.

## Why the previous fix was insufficient

Real-component Chromium verification established that both secondary badges use 90% opacity and `saturate(0.5)` today. Neutral category colors barely respond to desaturation. Images receive a much stronger background-colored veil. Earlier tests proved a style existed, not that unavailability was visually obvious.

The prototype separator defect was overflowing image art covering the border. It is fixed in `refined.html`. **Do not assume that defect exists in the app:** Grid already has a foreground separator and fractional-pixel seam correction. Verify rendered application geometry before changing it.

## Implementation sequence

### 1. Read and establish baseline

Read applicable native/MPX rules, `.mpx/CONTEXT.md`, all `.mpx/DECISIONS.md`, `docs/TESTING.md`, package scripts and current configured checks. Inspect working state and current source before applying this plan. Keep changes scoped to browse presentation, associated tests and necessary documentation; no schema/API or production-data work.

### 2. Add requirement-based coverage

Expand `src/lib/components/blocks/gift/gift_secondary_badges.svelte.test.ts` using real Card/List hosts. Replace old expectations for veil, saturation and undimmed body because the approved requirement changed.

Create matched fixtures with a visibly painted image, title, description, links, price, category AND priority. Existing fixture image is an empty SVG; use a real painted local fixture for visual evidence. Explicitly specify reservation fields because shared fixture defaults can include an own reservation. Change only reservation state between available/reserved copies.

Assert effective opacity including ancestor multiplication: content/badges 0.5, actions/status/identity 1; a child's computed opacity alone is insufficient. Assert no veil/desaturation, unchanged available rendering, state transitions, restored styles, and unchanged layout/hit targets. Avoid nested fades producing 0.25 visibility.

### 3. Separate content from controls

Production paths under `src/lib/components/blocks/gift/`:

- `GiftCard.svelte`: fade image composition separately from image overlays. Body may fade once because footer actions are siblings. Category and Like share a top-overlay container: never fade that entire container. Preserve overlay clearance and collection alignment selectors.
- `GiftListItem.svelte`: keep content-column/title-row ancestors opaque because they contain Like and actions. Fade ordinary content regions independently. Preserve genuine horizontal mobile List and current crop window.
- `gift_card_variants.ts`: remove obsolete veil slot; retain available elevation and dimmed non-lift behavior.
- `GiftCategoryBadge.svelte`, `GiftPriorityBadge.svelte`: replace `opacity-90 saturate-50` with `opacity-50` for `isDimmed`, retaining the default false. Do not fade their parent again. Compact's priority badge remains unaffected.

Reuse `GiftStateOverlay` and `GiftActionRow` without changing capabilities. Avoid global `ImageFrame` changes for a browse-only treatment. Keep source links operable despite their content fade.

### 4. Soften frame paint without fading nested controls

Use dedicated gift-scoped frame color/shadow values, derived from canonical `src/app.css`, for outer frame and separators only. Do not override inherited `--ink`, `--hard-shadow`, or shared elevation tokens at the gift root: nested buttons and status stickers consume those too.

Suggested frame paint: mix existing frame ink 50% with card background; halve shadow alpha while retaining offsets and viewer soft/ink/black depth preference. Preserve the exact available paint. Grid's pseudo-element border and seam-correction shadow must soften consistently. List halves its existing sticker shadow; do not invent a new one.

Keep separator thickness and layout unchanged. Preserve Grid's foreground separator. Add List art clipping/foreground protection only if actual paint evidence requires it. Never clip the whole card to solve an image problem, since action shadows need clearance.

### 5. Verify behavior and visual parity

Cover available, fully reserved by self/others, partial reservations, received, contextual display, hidden reservation state, self-promoted recipient and moderator identity. Keep `src/lib/modules/gifts/gift_display_state.ts` semantics unchanged. Hidden reservation differences must not affect recipient appearance. Preserve archived action rules.

Exercise Like, Reserve/Cancel, Received/Undo, Purchased/Undo and More where eligible. Use local mocked mutations or established seeded fixtures, never production. Verify Compact stays unchanged.

Relevant existing suites in the gift directory:

- `gift_card.image.svelte.test.ts`, `gift_card.role-privacy.svelte.test.ts`, `gift_card.whole-card-lift.svelte.test.ts`.
- Card actions/responsive-actions tests.
- `gift_list_item.svelte.test.ts` (old veil assertions), List actions/responsive tests.
- `gift_state_overlay.svelte.test.ts`.
- Compact: `src/lib/components/blocks/wishlist/wishlist_gift_compact_table.svelte.test.ts`.

Add durable matched comparison stories/fixtures using actual components, not a hand-coded HTML recreation. Capture and inspect identical available/unavailable gifts with both badges for desktop/mobile, light/dark, Grid/List and photo/placeholder. Include received and authorized identity, long labels and depth preferences. Check separators in rendered pixels, not only CSS declarations. Save links to screenshots and record exact states inspected.

### 6. Run checks, review and report

Run narrow checks first, sequentially with explicit tool timeouts:

```bash
pnpm.cmd exec vitest run --project client src/lib/components/blocks/gift/gift_secondary_badges.svelte.test.ts
pnpm.cmd exec vitest run --project server src/lib/modules/gifts/gift_display_state.test.ts
pnpm.cmd exec vitest run --project client src/lib/components/blocks/gift
pnpm.cmd run check
pnpm.cmd run check:all
pnpm.cmd run build
```

Run Compact and focused Playwright privacy/action coverage as appropriate, plus exact configured fast/full checks discovered for the execution workflow. `check:all` may format files: inspect the resulting diff. Full E2E belongs to CI. Do not overlap browser tests/builds/servers that share generated SvelteKit state.

Discover Storybook/dev commands and verify actual readiness/URL. Use raw Playwright, not browser MCP. Retain existing native-pixel seam regression (`scripts/verify-gift-card-image-seam.mjs --base <verified-storybook-origin>`); it alone is not coverage for all new states. Stop only workflow-owned servers; preserve shared DB services/data.

Review for accidental 25% fades, faded action ancestors, inherited softened ink, double veil, altered privacy, layout/crop regressions, and selectors broken by wrappers. Measure/report contrast and keyboard usability: approved 50% visuals may fail text contrast, and approval is not accessibility certification. Do not silently change the approved intensity to claim compliance; surface measured conflicts.

## Evidence and resumption

Existing design verification and screenshots are under `$MPX_AI_GENERATED/prejemesi/unavailable-gift-comparison/refined/`; `verify.mjs` tests the standalone mockup, **not the application**. Actual old-badge verification is in the sibling `verification/` directory. Root values must come from current MPX environment variables.

Suggested next-session instruction:

> Implement the approved unavailable-gift treatment in `designs/unavailable-gift-comparison/IMPLEMENTATION_PLAN.md`. Read its linked brief and approved mockup first. Preserve the uncommitted design and decision artifacts, use the current checkout, and verify matched actual-component screenshots. Do not treat the earlier merged badge-only PR as completion of this follow-up.
