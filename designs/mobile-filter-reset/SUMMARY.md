# Mobile Filter Reset — Design Summary

**Base**: Variant A | **Refined**: 2026-11-12

## Refinements Applied

Variant A was chosen and refined with: pill row outside the sticky toolbar, the sticky Display-sheet footer from variant C, and a fourth state for the footer with no active filters. See the design brief for full requirements. Key changes from the base variant: the sheet gains a footer with „Zrušit filtry“ and „Zobrazit N přání“ above the tab bar, and the ghost „Zrušit filtry“ at the end of the filter list is removed.

## Component Map

### Codebase — Use As-Is

| Component          | Path                                                      | Usage                                   | Key Props/Variants                                                      |
| ------------------ | --------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| ActiveFilterPills  | `src/lib/components/derived/filter-menu/`                 | Mobile pill row below the toolbar card  | `items`, `clearAllLabel`, `onclearall`, `removeFilterLabel`, `triggerElement` |
| Button             | `src/lib/components/base/button/`                         | Sheet footer actions                    | `intent="secondary"` / `intent="primary"`, `size="lg"`                  |
| WishlistBottomSheet | `src/lib/components/blocks/wishlist/`                    | Display sheet surface hosting the footer | existing                                                               |
| SegmentedToggle    | `src/lib/components/derived/segmented-toggle/`            | Unchanged sheet switcher below the footer | `presentation="tab-bar"`                                              |

### Build Custom

| Proposed Name | Description | Why existing components don't cover it |
| ------------- | ----------- | -------------------------------------- |
| `ActiveFilterPills` scroll layout | A non-wrapping, horizontally scrolling layout with 40 px pill hit areas | The component always wraps (`flex-wrap`) and its remove button is a 24 px target |

## Implementation Notes

- Render the mobile pill row from `WishlistDetailToolbar.svelte`'s mobile branch but outside `.wishlist-toolbar-sticky`, so it scrolls with the page; the desktop `activeFilterRegion` is unchanged.
- Reuse `clearGiftFilters` for both the pill row and the sheet footer; ⋯ → „Obnovit výchozí zobrazení“ stays as the reset for sort and grouping too.
- „Zobrazit N přání“ reads the filtered gift count from `gifts.context.svelte.ts` (`filteredGifts`) and needs a pluralised message; the footer sits outside `mobile-sheet-scroll` so it never scrolls away.
- Focus after removing a pill follows the existing `ActiveFilterPills` rule (next pill, then the Display trigger); the footer's „Zrušit filtry“ keeps focus inside the open sheet.
- Replaces the 2026-10-26 decision „without active-filter pills or another sticky toolbar row“ and 2026-07-15 „narrow layouts show an active count and clear action instead of pills“; the no-extra-sticky-row rule is kept.
