# Image Frame Foundation – Design Summary

**Base**: Variant B | **Refined**: 2026-06-02

## Refinements Applied

Variant B was chosen as-is and refined with: full state coverage (all 3 fit modes, all 3 bg-fill
tiers, loading/skeleton, empty/fallback, error, focus-visible ring, extreme aspect ratios
tall/wide/tiny), light + dark mode, preset + custom palette, a11y/affordance polish. See the design
brief for full requirements. Key changes from the base variant: added explicit live fill-tier
specimens (one per tier, labeled with badges) below the arrow diagram; added a focus-visible ring
demo specimen in the States section; added an a11y callout note with WCAG AA and ARIA contract
summary; all decorative role="img" / aria-label / aria-hidden attributes applied throughout.

## Component Map

### Codebase – Use As-Is

| Component   | Path                                     | Usage                                                     | Key Props/Variants         |
| ----------- | ---------------------------------------- | --------------------------------------------------------- | -------------------------- |
| Skeleton    | src/lib/components/base/skeleton/        | Loading state inside the frame (full-size)                | class="size-full"          |
| Badge       | src/lib/components/base/badge/           | Fit-mode tier labels in fill-priority specimen row        | variant="primary", default |
| Card        | src/lib/components/base/card/            | Specimen tile wrapper in Svelte implementation            | Card.Root / Card.Content   |
| Separator   | src/lib/components/base/separator/       | Section dividers between gallery blocks                   | default horizontal         |
| Tooltip     | src/lib/components/base/tooltip/         | Explain fill tier / fit mode on hover in legend           | default                    |
| Tabs        | src/lib/components/base/tabs/            | Optional light/dark or preset/custom mode switcher        | –                          |
| ToggleGroup | src/lib/components/base/toggle-group/    | Optional legend control to flip fit mode across specimens | 3 items                    |
| StatusBadge | src/lib/components/derived/status-badge/ | Slot-label chips in the slot-map table                    | default                    |

### Adopt from shadcn-svelte / Bits UI

| Component | Source | Install command | Purpose                                                                                       |
| --------- | ------ | --------------- | --------------------------------------------------------------------------------------------- |
| –         | –      | –               | None required. Avatar circular output is achieved by ImageFrame in cover-crop + rounded-full. |

### Build Custom

| Proposed Name   | Description                                                                                                                                                                                                 | Why existing components don't cover it                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ImageFrame      | Fixed box renderer: fitMode (auto/contain-padded/cover-crop), focal (x/y%), fillColor (extracted), tokenScope, fallback emoji, loading. Resolves fill via priority chain, swaps to fallback on empty/error. | No existing component owns fit-mode logic, fill priority chain, or skeleton+fallback+error handling.   |
| WishlistPreview | Stub: themed wishlist card preview surface using --wishlist-preview token + emoji fallback.                                                                                                                 | Establishes token contract + fallback visual for #36; no existing card covers wishlist-scoped theming. |

## Implementation Notes

**ImageFrame Svelte contract**:

- Props: fitMode: 'auto' | 'contain-padded' | 'cover-crop' (default 'auto'), src: string | null,
  alt: string, focal: { x: number; y: number } (default { x: 50, y: 50 }),
  fillColor: string | null (extracted/manual), tokenScope: 'wishlist' | 'global' (default 'global'),
  fallbackEmoji: string (default '🎁').
- Internal state: loading: boolean, error: boolean – driven by img on:load / on:error.
- auto mode: detect image natural dimensions on load; if max(ratio/boxRatio, boxRatio/ratio) > 2,
  switch to contain-padded, else cover-crop. Computed client-side after load.
- Fill resolution: inline CSS custom property --frame-fill set to the first available tier value;
  background of the frame element reads from --frame-fill.
- Skeleton: render <Skeleton class="size-full"> while loading is true; background of Skeleton
  is --frame-fill (resolves to extracted color if available).
- Error: set error = true on img on:error; render fallback component (same as empty).
- Fallback: <div role="img" aria-label={alt}> with centered emoji in --wishlist-icon color.
- Focus: tabindex="0" only when the frame is interactive (e.g. opens crop editor). Use
  outline: var(--focus-ring-width) solid var(--ring); outline-offset: var(--focus-ring-offset).
- Animation: dk-shimmer keyframes from tokens.css – no custom animation needed.
- Variants file: src/lib/components/derived/image-frame/image_frame_variants.ts using
  tailwind-variants. Expose fitMode, tokenScope, shape (square/circle) as variant axes.
- Token contract: --wishlist-preview, --wishlist-page, --wishlist-icon, --wishlist-image-frame
  are new and must be added to src/app.css per-theme blocks before implementation.
- a11y: decorative img (avatar) -> alt="" + aria-hidden="true" on wrapper; content image ->
  meaningful alt; fallback div -> role="img" + aria-label; loading div -> role="status" +
  aria-label="Nacitani...".
