# Image Frame Foundation — Design Brief

> **Status**: Refined (Variant B)
> **Refined mockup**: `designs/image-frame-foundation/refined.html`
> **Summary**: `designs/image-frame-foundation/SUMMARY.md`
> **Refinements**: full state coverage (3 fit modes, 3 bg-fill tiers, loading/skeleton, empty/fallback, error, extreme aspect ratios tall/wide/tiny, focus-visible ring, light + dark mode, preset + custom palette, a11y/ARIA polish)

The shared presentation primitive that renders every fixed image box in Přejeme si (gift cards, gift detail, reservation modal, wishlist card/banner, profile avatar) through one token-aware system. It replaces ad hoc `object-cover` / `object-contain` choices scattered across components with three canonical fit modes (`auto`, `contain-padded`, `cover-crop`), a deterministic background-fill fallback chain, and the new wishlist/image-frame theme tokens. This brief is a **foundation/primitive** — it is not a page. The mockup is a Storybook-style gallery showcasing the renderer across representative slots, fit modes, aspect ratios, fallback states, and both color modes.

**Source**: Issue #34 (sub-issue of PRD #33). Blocks #35 (image metadata persistence), #36 (wishlist visuals), #37 (gift crop), #38 (app background), #39 (coverage).

---

## 1. Purpose

Images in Přejeme si come from two uncontrolled sources: external store URLs (any aspect ratio, no color extraction) and user uploads. Fixed component boxes — a 160px gift card thumbnail, a square avatar, a 280px detail panel — must present these without blindly cropping away the product or leaving ugly raw letterbox bars. Today each component hard-codes its own `object-cover`, which silently crops tall/wide images and hides important content (the AC explicitly calls this out: "Extreme aspect-ratio images can be contained without hiding important content").

The Image Frame Foundation answers, at a glance, four questions for any image slot:

1. **How is the image fitted?** — `auto` (smart: contain when extreme, cover when normal), `contain-padded` (always show whole image, pad the rest), or `cover-crop` (fill, crop overflow, honor focal point).
2. **What fills the leftover space** when an image is padded or while it loads? — the background-fill priority chain.
3. **What shows when there is no image?** — a theme-aware fallback (emoji/icon on a themed surface).
4. **Does it hold up in light and dark, across preset and custom wishlist palettes?** — yes, via the new token layer.

**Key value**: One renderer + one token contract = every image box in the app looks deliberate, never accidentally cropped, and always theme- and mode-correct.

---

## 2. Surrounding Context

This is a **reusable primitive**, not a screen. It has no single "home" — it is embedded inside many parents (gift card image area, detail modal image column, avatar, wishlist card). Per the design-brief skill, the mockup therefore frames the renderer as a primitive shown across representative slots and states: a **Storybook-style gallery**.

### What the gallery must show (every variant)

- **The 3 fit modes** side by side on the _same_ source image so the difference is unmistakable: `auto`, `contain-padded`, `cover-crop`.
- **The background-fill fallback priority** as a labeled 3-step chain:
    1. Extracted/manual image color (e.g. a swatch sampled from the upload).
    2. Wishlist token (`--wishlist-image-frame` / `--wishlist-surface`).
    3. Global token (`--surface-2`).
- **Extreme aspect ratios** in the _same fixed box_: very tall (e.g. 9:21 portrait poster), very wide (e.g. 32:9 panorama), tiny (e.g. 48×48 icon upscaled into a 160px box).
- **Fallback / empty state**: no image → theme-aware surface + large emoji/icon (the "icon/pattern" token).
- **Loading state**: skeleton shimmer using the frame's resolved fill.
- **Light + dark** rendering of the whole gallery.
- **Preset vs custom palette**: at least one section rendered under a preset wishlist theme (e.g. Birthday/rose) and one under a derived custom OKLCH color, proving tokens resolve in both modes.

### Representative slot sizes to demonstrate (real component dimensions)

| Slot                     | Box                         | Default fit          | Token source |
| ------------------------ | --------------------------- | -------------------- | ------------ |
| Gift card thumbnail      | `h-40` (160px) × full width | `auto`               | global       |
| Gift detail image column | 280px × ≥320px              | `auto`               | wishlist     |
| Reservation modal thumb  | ~96px square                | `cover-crop`         | wishlist     |
| Wishlist card / banner   | 16:9 wide                   | `cover-crop`         | wishlist     |
| Profile avatar           | circular, 40–96px           | `cover-crop` (focal) | global       |

**What parent provides**: each slot's outer box dimensions, border-radius, and which fit mode + token scope to use. The Image Frame fills only the _inside_ of that box.

**Must NOT include**: navigation chrome, page shells, real gift/reservation CRUD UI, the actual crop _editor_ (that is #37), the app background _settings UI_ (#38), or schema/persistence (#35). Those consume this primitive but are out of scope here.

**Mockup rendering instructions**:

- Render as a full-bleed gallery page at ~1440 wide, organized into clearly labeled sections.
- Each section is a labeled specimen: heading + small caption describing the state being shown.
- Show light and dark — either split-screen panels or a section that repeats in both modes.
- Variant label as an eyebrow at top.
- Use real, plausible Czech gift content (Sony sluchátka, kniha, svíčka, panoramatická fotka, atd.).

---

## 3. Requirements

### 3.1 Fit modes (REQ-1, REQ-2)

Three canonical modes, selected per slot or per image:

- **`auto`** (default for gift images): smart fit. If the image aspect ratio is within a "normal" band relative to the box (roughly 0.5–2.0× the box ratio), behave like `cover-crop` for a clean filled look. If the image is **extreme** (very tall or very wide beyond the band), fall back to `contain-padded` so the product stays fully visible. This single rule satisfies "extreme aspect-ratio images can be contained without hiding important content."
- **`contain-padded`**: the entire image is always visible (`object-fit: contain`), centered, with the leftover area filled by the resolved background (see 3.2). Used when whole-image visibility matters more than filling the box.
- **`cover-crop`**: image fills the box (`object-fit: cover`), overflow cropped, with an optional **focal point** (x%, y%) controlling which part stays centered. Default focal point is 50% 50%. Used for avatars, banners, deliberate crops.

Visual treatment notes:

- The renderer is a fixed-size box with `overflow: hidden` and the slot's border-radius.
- In `contain-padded`, the padding area shows the resolved fill color — never transparent, never raw white.
- The mode is a presentation property of the image assignment, not hard-coded per component.

### 3.2 Background-fill priority (REQ-3)

When fill is needed (padded letterbox area, loading, or transparent PNG), resolve the background color in **strict priority order**, first available wins:

1. **Extracted/manual image color** — a dominant color sampled from an uploaded image (or manually set). Unreliable/absent for external URLs and that's expected.
2. **Wishlist image-frame token** — `--wishlist-image-frame`, falling through to `--wishlist-surface`. Scopes the fill to the wishlist's identity.
3. **Global token** — `--surface-2` (app-level neutral). Always present, the guaranteed terminal fallback.

The mockup must show this as an explicit, labeled 3-step diagram with a real swatch for each tier and an arrow chain ("if none → next"). Demonstrate all three outcomes: an image with an extracted color, one falling to the wishlist token, one falling all the way to the global token.

### 3.3 Fallback / empty visual (REQ-4)

When there is **no image**:

- Show a theme-aware surface (resolved via the same priority chain, terminating at `--wishlist-surface` / global `--surface-2`).
- Centered large **emoji or icon** in the **icon/pattern token color** (`--wishlist-icon`). Emoji choice can vary by wishlist theme (🎁 default, 🎂 birthday, 🎄 christmas, ✨ elegant).
- Optional faint short label (e.g. category or "Bez obrázku").
- Must be visually distinct from a _loading_ skeleton.

### 3.4 New theme tokens (REQ-4, REQ-5)

Introduce a wishlist-scoped token group, extending the existing `--wishlist-*` family already in `app.css`. Treat **app background, wishlist identity, and image-frame fill as separate responsibilities** (issue Notes + PRD).

| Token                    | Purpose                                                                          | Light default (example)     | Dark default (example)      |
| ------------------------ | -------------------------------------------------------------------------------- | --------------------------- | --------------------------- |
| `--wishlist-preview`     | Wishlist card preview surface (the "actual themed background, not a thin strip") | tinted-from-primary, ~96% L | tinted-from-primary, ~22% L |
| `--wishlist-page`        | Wishlist page content background                                                 | ~98.5% L tint               | ~16% L tint                 |
| `--wishlist-icon`        | Icon/pattern fill color for fallback visuals                                     | primary @ ~55% L            | primary @ ~70% L            |
| `--wishlist-image-frame` | Image-frame letterbox fill (tier 2 of priority chain)                            | ~95% L neutral-warm         | ~20% L neutral              |

All derive from the wishlist's primary in **OKLCH** so a single custom color produces a coherent set. Preset palettes (Default/Birthday/Fun/Elegant/Christmas) ship explicit light + dark values; custom palettes derive them. Every token must be **dark-mode-safe** (sufficient contrast for the icon/text placed on it).

These tokens are **scoped to wishlist content** and must not leak into global app chrome (nav, sidebar). App background themes (`golden-hour`, `twilight`) live separately and must not override wishlist identity tokens.

### 3.5 States (REQ-2)

The renderer must visibly support: loaded image (each fit mode), padded fill, loading skeleton, empty/fallback, and error (broken URL → falls back to empty visual, not a broken-image glyph). See §4.

### 3.6 Storybook representation (Acceptance Criteria)

The gallery is the design analog of "Representative Storybook examples show common image-frame states." It must read like a Storybook page: titled specimens, captions, and a controls-style legend for fit mode / token tier.

---

## 4. States

| State                           | Visual Treatment                                      | Trigger                                   |
| ------------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| Loaded — `auto` (normal ratio)  | Image fills box, cropped like cover                   | Image ratio within normal band            |
| Loaded — `auto` (extreme ratio) | Image contained whole, padded fill                    | Image ratio outside band (very tall/wide) |
| Loaded — `contain-padded`       | Whole image centered, resolved fill in margins        | Mode set to contain-padded                |
| Loaded — `cover-crop`           | Image fills, cropped, focal point honored             | Mode set to cover-crop                    |
| Fill tier 1                     | Padding/loading shows extracted image color swatch    | Extracted/manual color present            |
| Fill tier 2                     | Padding shows `--wishlist-image-frame`                | No extracted color, in wishlist scope     |
| Fill tier 3                     | Padding shows `--surface-2`                           | No extracted color, no wishlist scope     |
| Loading                         | Skeleton shimmer over resolved fill (`dk-shimmer`)    | Image not yet loaded                      |
| Empty / fallback                | Theme surface + large emoji/icon in `--wishlist-icon` | No image assigned                         |
| Error                           | Same as Empty (graceful)                              | Image URL fails to load                   |
| Light mode                      | All of the above on light tokens                      | `:root`                                   |
| Dark mode                       | All of the above on `.dark` tokens                    | `.dark`                                   |
| Preset palette                  | Tokens from a named preset                            | Wishlist theme = preset                   |
| Custom palette                  | Tokens derived from one OKLCH color                   | Wishlist theme = custom                   |

---

## 5. Component Reuse Map

### Existing Components (MUST use / compose with)

| Component                          | Variant/Props         | Usage in This Design                                                                       |
| ---------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| `Skeleton` (base)                  | `class="size-full"`   | Loading state inside the frame (replaces `animate-pulse` divs)                             |
| `Badge` / `status-badge` (derived) | default / `reserved`  | Fit-mode tag and slot labels in the gallery legend                                         |
| `Tabs` (base)                      | —                     | Optional: switch the gallery between Light / Dark or Preset / Custom                       |
| `ToggleGroup` (base)               | 3 items               | Optional legend control to flip fit mode across specimens                                  |
| `Tooltip` (base)                   | —                     | Explain each fill tier / fit mode on hover in the legend                                   |
| `Separator` (base)                 | —                     | Divide gallery sections                                                                    |
| `Card` (base)                      | `Card.Root`/`Content` | Each specimen tile wrapper                                                                 |
| `image-upload` (derived)           | —                     | Reference only — its `preview` slot should be refactored to consume ImageFrame later (#36) |

### Components to Adopt (install from shadcn-svelte)

| Component | Source | Rationale                                                                                                                |
| --------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| —         | —      | None required. Avatar circular output is achieved by the ImageFrame in `cover-crop` + `rounded-full`; no new dependency. |

### Components to Design (new)

| Component                              | Description                                                                                                                                                                                                                                                              | Why New                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `ImageFrame` (derived)                 | The shared renderer: fixed box, `fitMode` prop (`auto`/`contain-padded`/`cover-crop`), `focal` (x/y %), `fillColor` (extracted), `tokenScope` (wishlist/global), `fallback` (emoji/icon), `loading`. Resolves fill via priority chain, swaps to fallback on empty/error. | No existing component owns fit-mode logic, fill priority, or fallback. This is the foundation the whole PRD #33 builds on. |
| `WishlistPreview` (derived, stub here) | Themed wishlist card preview surface using `--wishlist-preview` + emoji fallback.                                                                                                                                                                                        | Referenced by #36; this brief only establishes its token contract and fallback visual, not the full card.                  |

The `ImageFrame` follows the project's `tailwind-variants` (`image_frame_variants.ts` = source of truth) and `derived/` tier conventions.

---

## 6. Layout Constraints

- The frame is always a **fixed-size box** defined by its parent slot; the renderer never changes the box's outer dimensions — it only controls what happens _inside_.
- `overflow: hidden`; inherit the slot's border-radius (`--radius-md` cards, `--radius-full` avatars, `--radius-lg` banners).
- `contain-padded` padding fill spans the full box behind the contained image.
- Focal point is expressed as `object-position: x% y%` in `cover-crop`.
- Gallery grid: responsive, min specimen tile ~220px wide, `gap-4` (16px), section spacing `space-8` (32px).
- Aspect-ratio specimens use a single shared fixed box size per row so the fit-mode difference is the only variable.

---

## 7. Design Tokens

Reference `designs/tokens.css` (link in mockup `<head>`; never inline). Canonical production source is `src/app.css`.

- **Fonts**: `--font-sans` (Figtree), `--font-heading` (Noto Sans).
- **Existing wishlist tokens** (already in `app.css`): `--wishlist-primary`, `--wishlist-accent`, `--wishlist-surface`, `--wishlist-surface-hover`, `--wishlist-border`, `--wishlist-muted`, `--wishlist-muted-fg`.
- **New tokens introduced here** (§3.4): `--wishlist-preview`, `--wishlist-page`, `--wishlist-icon`, `--wishlist-image-frame`. Mockups define these inline as _new proposed values_ (they don't exist in tokens.css yet) but must reuse existing structural tokens for everything else.
- **Fill chain tokens**: extracted color (literal swatch) → `--wishlist-image-frame` / `--wishlist-surface` → `--surface-2`.
- **Surfaces / borders**: `--surface`, `--surface-2`, `--border`, `--border-strong`.
- **Text**: `--foreground`, `--foreground-muted`, `--foreground-subtle`.
- **Radii**: `--radius-md`, `--radius-lg`, `--radius-full`.
- **Motion**: `--ease-standard`, `dk-shimmer` keyframes for loading.
- **Color model**: all new color math in **OKLCH** (`color-mix(in oklch, …)` for derivations).
- Preset palette demonstration: use Birthday → rose family (`--rose-*`) and/or Christmas; custom → pick a single OKLCH hue and derive.

---

## 8. Design Constraints (Non-Negotiable)

- **One renderer for all fixed image boxes** — the gallery must make clear the same primitive serves card/detail/avatar/banner.
- **Background-fill priority order is fixed**: extracted/manual → wishlist token → global token. No reordering.
- **Three fit modes only**: `auto`, `contain-padded`, `cover-crop`. No others.
- **`auto` must contain extreme ratios** — never crop a 32:9 or 9:21 image to hide content.
- **Separation of responsibilities**: app background ≠ wishlist identity ≠ image-frame fill. Do not merge tokens.
- **Wishlist tokens scoped to content** — must not style nav/sidebar/global chrome.
- **Light + dark must both render correctly** for every specimen; tokens dark-mode-safe.
- **No raw colors** in the conceptual system — semantic tokens only (extracted swatch is the one literal, by definition).
- **Loading uses `Skeleton`/`dk-shimmer`**, not ad hoc pulse.
- **Error degrades to the empty fallback**, never a broken-image icon.
- Reference `tokens.css` via stylesheet link; do not inline the token file.

### Accessibility

- All `<img>` get meaningful `alt`; fallback visual gets an accessible label.
- Icon/emoji fallback color must meet contrast against its resolved surface in both modes.
- Frame is decorative-aware: when used as avatar, expose the name via `alt`/`aria-label`.

---

## 9. Design Freedom

- **Gallery layout/presentation approach** — the three variants should differ meaningfully here (split light/dark panels, a docs-style spec sheet, an interactive Storybook-canvas, etc.).
- How the fill-priority chain is visualized (vertical ladder, horizontal arrow flow, annotated swatches).
- How fit-mode comparison is laid out (side-by-side trio, toggle, overlay diff).
- Specimen tile styling, captions, legend chrome.
- Which preset theme(s) and which custom OKLCH hue to demonstrate.
- Emoji/icon choices for fallback visuals.
- Animation of skeleton/transitions.

---

## 10. Visual References

- **Internal**:
    - `designs/gift-detail-modal/variant-1.html` — current `object-fit: cover` image column + placeholder SVG (the pattern being generalized).
    - `src/lib/components/blocks/gift/gift_card_variants.ts` — current `imageArea`/`image`/`imagePlaceholder` slots (`object-cover`, gradient placeholder) to be replaced.
    - `src/lib/components/derived/image-upload/image_upload_variants.ts` — `preview: object-cover` to refactor onto ImageFrame.
    - `src/app.css` — existing `--wishlist-*` tokens (lines ~119–129, 338–348) and preset/palette color scales; `palette-colors.css` (golden-hour/twilight bg themes — kept _separate_).
    - `designs/wishlist-page/` and `designs/dashboard/` — slots that will consume the renderer.
- **External**: Storybook component "stories" pages (titled specimens + controls); object-fit visual explainers.

---

## 11. Not Included (Scope Exclusions)

- **Crop editor UI** with draggable rectangle / live previews — issue #37.
- **Wishlist image assignment + per-slot crop metadata UI/workflow** — issue #36.
- **App background theme settings UI** (`default`/`golden-hour`/`twilight` picker) — issue #38.
- **Schema / persistence** of image fit/crop/focal/extracted-color and user bg preference — issue #35.
- **Automatic color extraction implementation** (the algorithm) — only the _consumption_ of an extracted color is shown here.
- **Test coverage** — issue #39.
- Full `WishlistPreview` card — only its token contract + fallback visual are established here.
