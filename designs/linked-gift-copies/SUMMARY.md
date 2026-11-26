# Linked Gift Copies — Design Summary

**Base**: Variant A | **Refined**: 2026-11-26

## Refinements Applied

Variant A refined with: none, adopted as is. See the design brief for full requirements. `refined.html` only re-points the stylesheet and photo paths to its folder level and relabels the eyebrow.

## Component Map

### Codebase — use as-is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| Badge | `src/lib/components/base/badge` | Link sticker look in the image overlay row | `badgeStyle="overlay"`, sticker shadow |
| Popover | `src/lib/components/base/popover` | „Také na seznamech“ on desktop | `Root/Trigger/Content` |
| SimpleTooltip | `src/lib/components/base/tooltip` | „Propojeno“ label of the icon-only sticker | `text` |
| WishlistBottomSheet | `src/lib/components/blocks/wishlist/WishlistBottomSheet.svelte` | Linked lists on mobile; copy dialog on mobile | as today |
| GiftStateOverlay | `src/lib/components/blocks/gift/GiftStateOverlay.svelte` | „Rezervováno na jiném seznamu“ | `kind="unavailable"`; new label in `src/lib/modules/gifts/gift_display.ts` |
| GiftCategoryBadges | `src/lib/components/blocks/gift/GiftCategoryBadges.svelte` | Shares the overlay row with the sticker | as today |
| Checkbox, Label, HelpText | `src/lib/components/base/{checkbox,label,help-text}` | „Propojit kopie“ in `GiftBulkCopyDialog.svelte` | same geometry as the move control |
| GiftDetailForm, GiftNameField | `src/lib/components/blocks/gift/` | Editor host; name-lock note styling | edit mode |
| Button | `src/lib/components/base/button` | Per-row „Odpojit“ | `intent="outline"`, small |
| ConfirmDialog | `src/lib/components/derived/confirm-dialog` | Unlink confirm | `confirmIntent="primary-destructive"`, pending „Odpojuji…“ |
| GiftContextActions | `src/lib/components/blocks/wishlist/GiftContextActions.svelte` | „Odpojit kopie“ menu item | new item in the gift group |

### Adopt

None.

### Build custom

| Proposed Name | Description | Why existing components don't cover it |
| --- | --- | --- |
| `GiftLinkChip` | Sticker button (lucide `Link2` + count of other lists) opening the Popover or the mobile sheet | No chip conveys a cross-list relation |
| `GiftLinkedCopiesSection` | Compact rows (list title link, occasion, status, „Odpojit“) after `GiftCategoryField`, plus the shared-fields note | The editor has no relation section |

## Implementation Notes

- **Placement:** the sticker is the last item of the image's top overlay row, after category badges; on List rows it sits in the thumbnail's top-left corner. It never moves the title, price or the action footer lane.
- **Count:** the number is the count of other copies the viewer can see listed (deleted lists excluded).
- **Mobile List categories:** with the sticker in the 104 px thumbnail, more than one category collapses into one truncated badge such as „Stavebnice +1“, with the full list in its tooltip and accessible label; desktop List rows keep wrapping.
- **Move help text:** with move and link both on, the move help reads „Rezervované dárky zůstanou a propojí se s kopiemi.“ instead of appending to the existing sentence.
- **Visitors:** the sticker is not rendered; the overlay-row slot falls back to the like control, and a reservation from another copy shows as the ordinary reserved state.
- **Accessibility:** the sticker is a `<button>` named „Propojeno se seznamy: {titles}“; popover content is reachable by Tab and closes on Escape, returning focus to the sticker.
- **Motion:** popover open uses the project's `--ease-out-strong` with a 0.95 enter scale; respects `prefers-reduced-motion`.
