# Segmented selection slide — Design Summary

**Base**: Variant 1 · Slide | **Refined**: 2026-10-07

## Refinements Applied

Variant 1 refined with: slide only (hover lift removed), no tab press scale, default tray hugs its
options. See the
design brief and #455 for full requirements. Structural change from the study: the shipped instant
baseline, the hover-lift variant and the dark-shadow experiment are gone, so only the final
behaviour remains.

## Component Map

### Codebase — use as-is

| Component        | Path                                                       | Usage                                       | Key Props/Variants                      |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------- | --------------------------------------- |
| SegmentedToggle  | `src/lib/components/derived/segmented-toggle/`             | Gift view switcher, dashboard, image source | `presentation="connected" \| "default"` |
| ToggleGroup      | `src/lib/components/base/toggle-group/`                    | Primitive under SegmentedToggle             | radio items with `data-state`           |
| Tabs / Tab       | `src/lib/components/base/tabs/`                            | Wishlist settings dialog                    | `tabs_variants.ts` active class swap    |
| AuthFormCard     | `src/lib/components/blocks/auth/AuthFormCard.svelte`       | Login/registration tabs                     | `nav.auth-tabs`, `aria-current="page"`  |
| GiftViewSwitcher | `src/lib/components/blocks/gift/GiftViewSwitcher.svelte`   | Wishlist toolbar                            | connected presentation                  |

### Adopt

None.

### Build custom

| Proposed Name           | Description                                                           | Why existing components don't cover it                                  |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Shared selection slider | One indicator per group that tracks the selected option's face rect | Neither Bits UI ToggleGroup nor the project Tabs animate the selection |

## Implementation Notes

- Draw one indicator per group behind the options and hide the per-item selected decoration, so
  the resting look stays exactly the same. The prototype copies the face's computed background,
  border or ink outline, radius and shadow; production should apply the same classes to the indicator.
- Connected switcher: the face is the inner `.elevation-surface`; the tinted `::before` backing
  stays put.
- Measure with layout offsets (`offsetLeft`/`offsetTop` up to the group), not bounding rects:
  opening dialogs animate their transform and would skew the first measurement.
- Animate only on a selection change; place without transition on mount, resize (ResizeObserver),
  depth or palette changes. Login tabs are route links, so the indicator must survive navigation
  between `/login` and `/register` (or start from the previous route's position).
- Settings tab track scrolls horizontally; the indicator lives inside the scroller so it scrolls
  with its tab.
- Press feedback is the slide alone: drop `active:scale-[0.97]` from the base `Tab`
  (`tabs_variants.ts`); the other controls already stay unscaled on press.
- Tray fix: add `w-fit` to the default `segmentedToggleVariants` root. Stories wrap toggles in
  `items-start`, so add a story inside a stretching parent to keep the regression visible.
