# Wishlist Gift Actions — Design Summary

**Base**: Variant A | **Refined**: 2026-08-30

## Refinements Applied

Variant A was chosen and refined with: nested desktop context menus retained, full-card selection tint including images, uninterrupted outer selection rings, adaptive complementary selection on blue wishlist surfaces, aligned grouped-list checkboxes, a conventional Actions icon, primary Done actions, and compact view removal. The selected-state treatment now uses explicit semantic selection tokens rather than assuming blue always contrasts with the wishlist surface. The optional hard-shadow appearance experiment is intentionally separate in #290.

## Component Map

### Codebase — Use As-Is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| WishlistDetailToolbar | `src/lib/components/blocks/wishlist/WishlistDetailToolbar.svelte` | Sticky host for normal and selection contents | Existing view/filter/sort/group props |
| Button | `src/lib/components/base/button/` | Bulk triggers, primary Hotovo, undo | `intent="outline" | "primary"`, `size="md"` |
| Checkbox | `src/lib/components/base/checkbox/` | Gift, global, and group tri-state controls | checked and indeterminate states |
| DropdownMenu | `src/lib/components/base/dropdown-menu/` | Wide bulk controls and narrow Akce menu | Root, Content, RadioGroup, Sub |
| Sheet | `src/lib/components/base/sheet/` | Mobile long-press actions | `side="bottom"` |
| GiftCard | `src/lib/components/blocks/gift/GiftCard.svelte` | Existing grid-card content under selection behavior | gift, role, archived and privacy props |
| GiftListItem | `src/lib/components/blocks/gift/GiftListItem.svelte` | Existing list-row content with shared selection column | gift, role, archived and privacy props |
| GiftSectionHeader | `src/lib/components/blocks/wishlist/GiftSectionHeader.svelte` | Group tri-state control and selected fraction | `section` plus new optional selection inputs |
| GiftReceivedToggle | `src/lib/components/blocks/gift/GiftReceivedToggle.svelte` | Source of received-state capability and copy | giftId, received, role, isArchived |
| GiftImage / ImageFrame | `src/lib/components/blocks/gift/` | Preserve image fit/background beneath selection tint | Existing target and image-mode props |
| Sonner toast host | existing app root | Copy feedback, bulk result, received undo | Existing toast actions |

### Adopt from shadcn-svelte / Bits UI

| Component | Source | Install command | Purpose |
| --- | --- | --- | --- |
| ContextMenu | shadcn-svelte / Bits UI | `pnpm dlx shadcn-svelte@latest add context-menu --yes --overwrite` | Desktop pointer anchoring, keyboard navigation, typeahead, dismissal, radio choices, and nested submenus |

### Build Custom

| Proposed Name | Description | Why existing components don't cover it |
| --- | --- | --- |
| GiftContextActions | Shared typed role-aware action tree with ContextMenu and Sheet renderers | Prevents desktop/mobile capability and copy drift |
| GiftLongPressTarget | 600 ms touch recognizer with movement and scroll cancellation | Built-in floating touch context menu cannot become the required bottom sheet |
| WishlistSelectionToolbar | Selection counts, hidden warning, field controls, primary Hotovo | Existing import-grid bulk bar has unrelated actions and state |
| WishlistGiftSelection | Selected-ID set and visible/group/hidden derivations | Wishlist display has no persistent cross-view selection model |
| GiftCard/GiftList selection adapters | Whole-surface hit target, full-image tint, full-card ring, and aligned checkbox placement | Browse surfaces currently own ordinary card actions and have no inert selection mode |

## Implementation Notes

- Keep selection state as gift IDs above the view renderer so filter, sort, grouping, and card/list changes do not discard it.
- Introduce semantic CSS variables `--selection-tint`, `--selection-image-tint`, `--selection-ring`, and `--selection-on-ring`. Neutral light surfaces use primary blue; blue wishlist surfaces switch to the palette's complementary accent pair.
- Render the image tint as a pointer-inert pseudo-element below badges and checkbox. Render the outer ring as a card-level overlay above every card child so the image cannot cover its top half.
- Use one explicit list selection-column width and padding value for both `GiftSectionHeader` and `GiftListItem`; do not align them with separate magic offsets.
- Consolidated Akce uses the project's Lucide `SlidersHorizontal` and `ChevronDown`. All mockup glyphs are illustrative only: implementation must use icons already exposed by the project's icon conventions or the matching Lucide icons, with project sizing and stroke treatment. Project component styling supersedes any custom icon markup visible in the HTML mockup.
- Compact view stays hidden and receives no new context-menu or multiselect work.
- Preserve the existing dark sticker shadows in this feature. The user-selectable hard-shadow experiment belongs to #290.
- Use a normalized action descriptor for role/state filtering, but render nested choices with ContextMenu submenus on desktop and Sheet drill-in navigation on touch.
- Restore heterogeneous received states by storing the exact pre-mutation map used by the undo action.
