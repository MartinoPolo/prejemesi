# PRD Review: PRD #33 — Image fitting, cropping, wishlist visuals, and background themes

Generated: 2026-06-02 | Sub-issues: #34, #35, #36, #37, #38, #39, #50 | PRs: #40, #45, #46, #49, #55, #56

## Summary

PRD is functionally complete and broadly well-built: shared `ImageFrame` renderer, gift + wishlist crop editors, persisted image metadata, and a production app-background-theme setting all landed with strong unit/Storybook coverage. Health is good with two genuine blockers: one acceptance criterion (profile avatar via shared renderer) was never wired, and a WCAG keyboard-accessibility defect documented in #50 was abandoned (#50 closed NOT_PLANNED) but lives on in the code. Totals: **2 Critical, 12 Important, 18 Minor**, plus 6 unresolved/tracked items and a documentation refresh. Security review found no HIGH-confidence vulnerabilities (authorization, enum-bound `data-bg-theme`, and numeric input validation all correct).

## Execution Status (2026-06-03)

User chose: **fix Critical + Important now**; **#50 → document WCAG exception** (no canvas keyboard fix); **no GitHub issues**.

**Done & verified** (`check:all` exit 0, 530/530 unit tests pass):

- ✅ Critical — profile avatar now renders through `ImageFrame shape="circle"` (settings + navbar).
- ✅ Critical — #50 WCAG gap documented as an accepted exception (inline comment + DECISIONS.md entry); no code fix per decision.
- ✅ Important — domain↔UI dependency inversion (`IMAGE_FIT_MODES` → `images/fit_modes.ts`; `BACKGROUND_THEMES` → `settings/types.ts`; UI re-exports).
- ✅ Important — shared `cropStateToImageMeta` + `FULL_CROP_RECT` extracted to `crop.ts`; gift & wishlist editors + canvas use them (transform DRY done; shared `FitModePanel` UI extraction deferred — see below).
- ✅ Important — `IMAGE_FIT_MODE_VALUES` guard replaces unchecked `as ImageFitMode` cast (both editors).
- ✅ Important — `wishlistThemeEnum` derived from `WISHLIST_THEMES`.
- ✅ Important — `hooks.server.ts` theme query wrapped in try/catch + `replaceAll`.
- ✅ Important — wishlist upload-error toast (`toast_wishlist_image_upload_error`, cs/en).
- ✅ Important — `reorderGifts` N+1 → single batched `CASE WHEN` UPDATE.
- ✅ Important — orphaned `WishlistPreview` directory deleted.
- ✅ Important — duplicate `Focal` interface → `ImageFocalPoint`.
- ✅ Important — `GiftImagePreviewSlots` accepts `frame: ImageFrameProps` aggregate.
- ✅ Important — docs refreshed (CONTEXT.md terms/status, DECISIONS.md supersede + 7 new entries, README routes/schema).
- ✅ Minor (folded in) — zoom-clamp dedup, `aria-disabled` removal, `base.focal!` removed, crop.ts comment scoped.

**Deferred (still open in this doc):**

- ⏸ Important — **duplicate per-request theme lookup** consolidation: try/catch landed, but folding the hook query into the better-auth session / shared `locals` is a larger, riskier refactor — left for `/mp-architecture-review` (also the HITL item below).
- ⏸ Important — shared **`FitModePanel`** component extraction (the meta-transform was deduped; the toggle markup is still duplicated — lower value).
- ⏸ Unresolved AFK/HITL issues — not filed (user opted out): server-side OG crop, remaining e2e ASCII selectors, #50 fill chip, #50 dominant-color extraction, hooks lookup consolidation.
- ⏸ Remaining Minors (barrel/schema un-exports, i18n key dedup, `DashboardWishlistTheme` rename, ThemeSelector/frameFor memoization, GiftDetailForm decomposition, `hexToOklch` co-location, bgColor format validation).

**Architecture promotion candidates** (recommended for `/mp-architecture-review`): full domain↔UI boundary cleanup; GiftDetailForm decomposition; hooks/session lookup consolidation.

## Critical

### Spec Alignment — Profile avatar bypasses shared ImageFrame renderer (AC #3)

- [ ] **File:** src/lib/components/blocks/settings/SettingsProfileSection.svelte:79; src/lib/components/blocks/navbar/UserMenu.svelte:41
- **Finding:** AC #3 requires "Profile avatar rendering uses the shared image renderer with cropped circular output." Both avatar sites use raw `<img class="rounded-full object-cover">` and never pass through `ImageFrame`. `ImageFrame` already has a `circle` shape variant (built + storied for exactly this) but was never wired to the live avatar renders.
- **Action:** Replace both raw `<img>` avatars with `<ImageFrame shape="circle" fitMode="cover-crop" {src} {alt} />`.

### Best Practices / Accessibility — Gift crop canvas not keyboard-operable + nested interactive content (Issue #50, closed NOT_PLANNED)

- [ ] **File:** src/lib/components/blocks/gift/GiftImageCropCanvas.svelte:198 (role=button, no keyboard), :212 (nested `<button>`)
- **Finding:** Crop region is `role="button" tabindex="0"` with only `onpointerdown` — **zero keyboard handling** (no `onkeydown`), a WCAG 2.1 SC 2.1.1 failure. Eight resize handles are real `<button>` elements nested inside the `role="button"` region — invalid nested interactive content. The design brief §8.8 mandates WCAG AA. Issue #50 documented both gaps precisely, then was **closed as NOT_PLANNED** — the defect remains live in shipped code.
- **Action:** HITL decision required — reopen #50 and implement keyboard nudge/resize + fix nesting, OR confirm intentional deferral and record the WCAG exception. Recommended: implement (arrow-key move/resize on the region, move handles out of the role=button element).

## Important

### Architecture — Inverted dependency: domain `images/` imports from UI component barrel

- [ ] **File:** src/lib/modules/images/types.ts:2, crop.ts:10, wishlist_slots.ts:10; src/lib/modules/settings/types.ts:2
- **Finding:** Domain/persistence modules import `IMAGE_FIT_MODES`/`ImageFitMode` from `$lib/components/derived/image-frame` and `BACKGROUND_THEMES`/`BackgroundTheme` from `$lib/components/base/theme`. Dependency arrow runs UI→domain backwards; Drizzle schema + validation now transitively depend on component internals.
- **Action:** Move the canonical constants/types (`IMAGE_FIT_MODES`, `BACKGROUND_THEMES`) into the domain modules (or a shared constants file) and have the UI components import from there.

### Code Quality / Architecture — Duplicated fit-mode editor logic across gift & wishlist editors

- [ ] **File:** src/lib/components/blocks/gift/GiftDetailForm.svelte:146,373; src/lib/components/blocks/wishlist/WishlistCropEditor.svelte:99,245
- **Finding:** Both editors independently reimplement the three-option fit-mode `ToggleGroup`, the `isCropMode` derived flag, the "auto" help text, and a `buildImageMeta`/`slotMeta` transform that calls `cropRectToFocalZoom` and assembles `ImageMetadata`.
- **Action:** Extract `cropStateToImageMeta(fitMode, cropRect, bgColor?)` into `crop.ts`; extract a shared `FitModePanel` block for the toggle + help text. Call both from gift and wishlist editors.

### Best Practices — Unsafe `as ImageFitMode` cast over unvalidated ToggleGroup output

- [ ] **File:** src/lib/components/blocks/wishlist/WishlistCropEditor.svelte:138; src/lib/components/blocks/gift/GiftDetailForm.svelte:380
- **Finding:** Raw `string` from `ToggleGroup.onValueChange` is cast `as ImageFitMode` after only an empty-string check. `IMAGE_FIT_MODE_VALUES` allowlist already exists.
- **Action:** Guard with `IMAGE_FIT_MODE_VALUES.includes(value as ImageFitMode)` (or an `isImageFitMode` predicate) before assigning.

### Best Practices — `wishlistThemeEnum` hardcodes theme list instead of reusing `WISHLIST_THEMES`

- [ ] **File:** src/lib/server/db/enums.ts:9
- **Finding:** `pgEnum` declared with a hand-written `['default','christmas',...]` array; `appBackgroundThemeEnum` correctly reuses `BACKGROUND_THEMES`. New themes will silently diverge from the DB enum.
- **Action:** Derive the enum from `WISHLIST_THEMES` (`wishlists/types.ts`), matching the `appBackgroundThemeEnum` pattern.

### Error Handling — Unguarded DB query in `backgroundThemeHandle` 500s every authed request on DB error

- [ ] **File:** src/hooks.server.ts:37
- **Finding:** The per-request theme lookup runs unguarded; a connection/timeout/schema error propagates and crashes the SSR response instead of degrading to the default theme.
- **Action:** Wrap in try/catch, log, leave `bgTheme = DEFAULT_BACKGROUND_THEME` on failure.

### Error Handling — Wishlist image upload failure silently swallowed (no user feedback)

- [ ] **File:** src/lib/components/blocks/wishlist/WishlistCropEditor.svelte:127
- **Finding:** `handleUploadError` only `console.error`s; no toast, no inline error. Network/server upload failures leave the user unaware the image wasn't saved while state diverges.
- **Action:** Add `toastError(...)` in `handleUploadError` (and surface the `ImageUpload` error state for non-size failures).

### Performance — Duplicate per-request user lookup for app background theme

- [ ] **File:** src/hooks.server.ts:29; src/lib/modules/settings/settings.remote.ts:26
- **Finding:** `backgroundThemeHandle` issues a dedicated `SELECT app_background_theme` on every authenticated SSR request, on top of better-auth's session/user resolution; on the settings page `getUserProfile` then re-reads the same row including `appBackgroundTheme`. (Also tracked as unresolved/HITL below.)
- **Action:** Fold `appBackgroundTheme` into the better-auth session enrichment or a shared `locals.user` read so the extra round-trip is removed.

### Performance — `reorderGifts` issues N sequential UPDATEs (pre-existing, in changed file)

- [ ] **File:** src/lib/modules/gifts/gifts.remote.ts:417
- **Finding:** `for (const item of items) await database.update(...)` — one round-trip per gift; a 38-gift list costs ~40 round-trips per reorder. Likely pre-existing but sits in PRD-changed file.
- **Action:** Replace with a single batched `CASE WHEN id = … THEN …` / `VALUES` update via Drizzle `sql`. (Confirm pre-existing; fix can be a separate commit.)

### Cleanup — Orphaned `WishlistPreview` stub directory (superseded)

- [ ] **File:** src/lib/components/derived/wishlist-preview/ (WishlistPreview.svelte, index.ts, variants, story)
- **Finding:** The #34 stub's token contract is now owned by `WishlistFallbackHero` + `WishlistSlotImage` + `app.css` + `theme_presets.ts`. No production consumer imports it (only its own story).
- **Action:** Delete the directory; keep `WishlistFallbackHero` story for coverage.

### Code Quality / Cleanup — Duplicate `Focal` interface instead of `ImageFocalPoint`

- [ ] **File:** src/lib/components/derived/image-frame/ImageFrame.svelte:18; src/lib/components/blocks/gift/GiftImagePreviewSlots.svelte:11
- **Finding:** Both redeclare `interface Focal { x; y }` while the canonical `ImageFocalPoint` is exported from `images/types.ts`.
- **Action:** Import and use `ImageFocalPoint` in both.

### Code Quality / Cleanup — `FULL_CROP` identity rect duplicated across 3 components

- [ ] **File:** src/lib/components/blocks/gift/GiftDetailForm.svelte:105; GiftImageCropCanvas.svelte:37 (as `FULL_FRAME`); WishlistCropEditor.svelte:50
- **Finding:** `{ x:0, y:0, w:1, h:1 }` redefined three times under two names.
- **Action:** Export `FULL_CROP_RECT` from `crop.ts` (alongside `CENTERED_FOCAL`); import everywhere (incl. `wishlist_slots.ts`).

### Architecture — `GiftImagePreviewSlots` forwards flattened props instead of `ImageFrameProps` aggregate

- [ ] **File:** src/lib/components/blocks/gift/GiftImagePreviewSlots.svelte:16
- **Finding:** Accepts `fitMode`/`focal`/`zoom`/`fillColor` as 4 separate props; call site destructures `framePreview.*` to pass them. `WishlistSlotImage`/`SlotPreviewCard` accept the aggregate `frame: ImageFrameProps` — inconsistent, leaky.
- **Action:** Accept `frame: ImageFrameProps` and forward it, matching the wishlist path.

### Documentation — Stale/missing CONTEXT.md, DECISIONS.md, README entries

- [ ] See Documentation Updates section below.

## Minor

### Code Quality — Zoom clamp duplicated

- [ ] **File:** src/lib/components/blocks/wishlist/WishlistCropEditor.svelte:144
- **Finding:** `setZoom` re-implements the `clampZoom` already in `crop.ts` (which `focalZoomToCropRect` applies internally).
- **Action:** Pass raw zoom to `focalZoomToCropRect` (clamps internally) or export `clampImageZoom` from `crop.ts`.

### Best Practices — `aria-disabled` on container `<div>` has no effect

- [ ] **File:** src/lib/components/blocks/wishlist/WishlistCropEditor.svelte:270
- **Finding:** `aria-disabled` on a generic div isn't inherited; the Slider already has functional `disabled`.
- **Action:** Remove `aria-disabled`; use `opacity-50` conditional for visual dimming if desired.

### Code Quality — `DashboardWishlistTheme` alias duplicated in two routes

- [ ] **File:** src/routes/(app)/w/[id]/+page.svelte:32; src/routes/(app)/w/[id]/settings/+page.svelte:19
- **Finding:** Both alias `WishlistTheme` (from `wishlist_theme.ts`) to avoid collision with `themes/types.ts`.
- **Action:** Rename the type at source in `wishlist_theme.ts` (e.g. `LegacyWishlistTheme`).

### Code Quality — Redundant duplicate i18n keys

- [ ] **File:** messages/en.json, messages/cs.json (`wishlist_image_crop_region_label`, `wishlist_image_crop_reset`)
- **Finding:** Char-for-char identical to the `gift_image_crop_*` defaults the canvas already falls back to.
- **Action:** Drop the 4 wishlist keys; let `WishlistCropEditor` use the canvas defaults.

### Code Quality — `refresh()` re-queries wishlist twice

- [ ] **File:** src/routes/(app)/w/[id]/settings/+page.svelte:40
- **Finding:** Calls `.refresh()` then re-calls the query; sibling page does it in one step.
- **Action:** Collapse to a single `await getWishlistByShortId(shortId).refresh()` (verify remote returns fresh value).

### Best Practices — Non-null assertion `base.focal!`

- [ ] **File:** src/lib/modules/images/wishlist_slots.ts:56
- **Finding:** Asserts non-null on optional `focal`; safe today but fragile to `DEFAULT_IMAGE_METADATA` changes.
- **Action:** Narrow explicitly or use a dedicated `DEFAULT_FOCAL` constant.

### Spec Alignment — Stale "one crop, all slots" comment in crop.ts

- [ ] **File:** src/lib/modules/images/crop.ts:3
- **Finding:** Comment implies one crop for every surface; true for gifts but contradicts wishlist per-slot metadata (helpers serve both).
- **Action:** Scope the statement to gift images; note wishlist uses per-slot metadata.

### Spec Alignment — Gift detail preview ratio may not match modal render (AC #6)

- [ ] **File:** src/lib/components/blocks/gift/GiftImagePreviewSlots.svelte:44
- **Finding:** Detail slot previews `aspect-[3/4]`, but the detail modal image column isn't constrained to 3:4 — preview vs production mismatch.
- **Action:** Verify the detail modal's actual ratio; align the preview tile or the modal.

### Cleanup — Unused public exports from image-frame barrel

- [ ] **File:** src/lib/components/derived/image-frame/index.ts (`ResolvedImageFit`:17, `AUTO_CONTAIN_RATIO_THRESHOLD`:14, `IMAGE_FRAME_SHAPES`/`IMAGE_FRAME_FIT_MODES`:6-7)
- **Finding:** Re-exported but no external consumer; `IMAGE_FRAME_FIT_MODES` duplicates `IMAGE_FIT_MODE_VALUES`. `ResolvedImageFit` also duplicates `ImageFrameResolvedFit`.
- **Action:** Drop unused barrel exports; collapse to one canonical resolved-fit type and one fit-mode-values source; tests import direct from module files.

### Cleanup — Internal-only schemas exported

- [ ] **File:** src/lib/modules/images/types.ts:49 (`ImageCropRectSchema`, `ImageFocalPointSchema`)
- **Finding:** Only consumed internally by `ImageMetadataSchema`.
- **Action:** Drop `export` (barrel re-exports `*` so this removes them from the public surface).

### Cleanup — `createDefaultWishlistSlots` test-only + duplicated by `initSlots`

- [ ] **File:** src/lib/modules/images/wishlist_slots.ts:49; WishlistCropEditor.svelte:58
- **Finding:** Exported helper only called from tests; production `initSlots` reimplements the same default-seeding loop.
- **Action:** Call `createDefaultWishlistSlots()` in `initSlots` (dedupe), or demote helper to test fixture.

### Error Handling — No `onerror` on crop-stage `<img>`

- [ ] **File:** src/lib/components/blocks/gift/GiftImageCropCanvas.svelte:179
- **Finding:** Failed image load leaves draggable handles over an empty box with a browser broken-image glyph; no feedback.
- **Action:** Add `onerror` → error state; hide handles / show placeholder when `naturalRatio === null`.

### Error Handling — `replace` vs `replaceAll` for `%app.bgTheme%`

- [ ] **File:** src/hooks.server.ts:50
- **Finding:** `String.replace` replaces only the first placeholder occurrence; latent fragility.
- **Action:** Use `replaceAll`.

### Best Practices — Non-null assertion `imageUrl!`

- [ ] **File:** src/lib/components/blocks/wishlist/WishlistCropEditor.svelte:216
- **Finding:** Structurally safe under `{#if hasImage}` but lint-suppressed assertion is noise.
- **Action:** Narrow to a local `const url = imageUrl` inside the guard.

### Architecture — `hexToOklch` approximation co-located with authoritative palette logic

- [ ] **File:** src/lib/modules/themes/oklch_palette.ts:242
- **Finding:** Approximate sRGB→OKLCH adapter exported alongside authoritative derivation; muddies module responsibility.
- **Action:** Optional — split the I/O adapter out or annotate as approximate.

### Architecture — `ImageUpload` preview uses raw `<img>`

- [ ] **File:** src/lib/components/derived/image-upload/ImageUpload.svelte:186
- **Finding:** Transient upload preview bypasses `ImageFrame`; intentional but diverges if `ImageFrame` gains required wrappers.
- **Action:** Optional — note as accepted bypass.

### Performance — `deriveOklchPalette` computed twice per custom-color change

- [ ] **File:** src/lib/components/blocks/theme/ThemeSelector.svelte:43,140
- **Finding:** Validity `$derived` and the render `{@const}` each call `deriveOklchPalette` on every color-picker input event.
- **Action:** Single `$derived` holding the nullable palette (null = invalid).

### Performance — `frameFor(slot)` recomputed per render in preview strip

- [ ] **File:** src/lib/components/blocks/wishlist/WishlistCropEditor.svelte:119,295
- **Finding:** 4 slots × pure recompute on every pointer-move; low cost, redundant.
- **Action:** Optional — memoize into a `$derived` record.

### Architecture / Decomposition — `GiftDetailForm` ~500 lines, mixed responsibilities

- [ ] **File:** src/lib/components/blocks/gift/GiftDetailForm.svelte
- **Finding:** Field editing + image mode switch + crop/fit editing + delete + received toggle in one component (12 props, 4 callbacks).
- **Action:** First split target = image/crop section into a child component. (Promotion candidate — see below.)

### Security — `bgColor` validated only as `v.string()` (defense-in-depth)

- [ ] **File:** src/lib/modules/images/types.ts:66
- **Finding:** No HIGH-confidence exploit (Svelte `style:` uses `setProperty`, invalid CSS is a no-op), but the field is an unconstrained string flowing into `--frame-fill`.
- **Action:** Optional hardening — validate as a CSS color (hex/oklch pattern) in the valibot schema.

## Unresolved Items

### Needs AFK Issue

- [ ] **Server-side cropped OG image** — `og:image` in src/routes/(app)/w/[id]/+page.svelte:651 points at the raw source URL; the persisted social-slot crop is in-app only. Scoped out in #49, not tracked. Suggested title: "Serve cropped social-slot image for wishlist OG tags".
- [ ] **E2E suite ASCII-label breakage (partial fix)** — commit dbd4afc added a warning comment but specs still use diacritic-less labels: tests/e2e/wishlist.spec.ts:50,56,57 (`Pridat prani`/`Nazev`/`Pridat darek`) and tests/e2e/likes-followers.spec.ts:39,59,90,120 (`Pridat/Odebrat do/z oblibenych`). Fails locally, invisible in CI (CI skips e2e). Suggested title: "Fix remaining diacritic-less selectors in e2e specs".

### Needs HITL Issue

- [ ] **Issue #50 — keyboard-accessible gift crop canvas** (also Critical above) — closed NOT_PLANNED but the WCAG defect is live. Reopen + implement, or formally accept the exception? Open question: is keyboard crop in scope for v1 or deferred with a documented a11y exception?
- [ ] **#50 — bg-fill tier "fill chip"** — no UI chip naming the active fill tier in GiftDetailForm. Open question: was the chip a shipped design requirement or aspirational? Is current behavior legible enough without it?
- [ ] **#50 — tier-1 dominant-color extraction** — no canvas/`getImageData` extraction exists; `bgColor` is fully manual, so tier-1 fill can never auto-apply. Open question: is auto-extraction still wanted (client canvas or server analysis), or is manual `bgColor` sufficient for v1?
- [ ] **hooks.server.ts per-request theme lookup** — fold into better-auth session / shared `locals` (also Performance Important above). Open question: enrich the better-auth session, add a shared `getLocalsUser`, or accept the PK lookup?

### Resolved (verified, no action)

- **Full per-wishlist palette dark-mode-awareness** — deferred in #34/#49, since RESOLVED via `toModeAwarePalette()` + `light-dark()` wrapping (commit 4f250f3, src/lib/modules/themes/apply_theme.ts + oklch_palette.ts). Verified complete.

### Already Tracked

- (none found)

## Documentation Updates

- [ ] **.mpx/CONTEXT.md § Domain Language** — add: ImageFrame, fit mode, focal point, crop rect, image slot, background theme, wishlist theme tokens (app-bg / wishlist-identity / frame-fill), OKLCH palette.
- [ ] **.mpx/CONTEXT.md § Core Features** — Theming → Implemented/In Progress; Gift management & Profile/settings → In Progress (image fit/crop + appearance setting shipped).
- [ ] **.mpx/DECISIONS.md** — supersede the "Separate banner/thumbnail uploads per wishlist" entry (now single `image_key` + `image_slots`); add entries for: single shared ImageFrame renderer; focal+zoom canonical with cropRect persisted for editor restore; one-crop-all-slots (gifts) vs per-slot (wishlists); separated token responsibilities; `data-bg-theme` on `<html>` via SSR hook; native Slider replacing bits-ui Slider.
- [ ] **README.md** — add `w/[id]/settings` route to Project Structure; note new DB columns (gift.image_meta, wishlist.image_key + image_slots, user.app_background_theme) in the schema description.

## Architecture Promotion Candidates

- **Domain↔UI dependency inversion** (images/ + settings/ importing from component barrels) — recommended for `/mp-architecture-review`.
- **GiftDetailForm decomposition** (~500 lines, ≥3 responsibilities) — recommended for `/mp-architecture-review`.
