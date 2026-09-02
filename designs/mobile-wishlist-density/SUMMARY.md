# Mobile Wishlist Density — Design Summary

**Base**: Variant B with Variant C list cards and narrow single-column card mode | **Refined**: 2026-09-02

## Refinements Applied

Variant B was chosen and refined with a fixed 12px page gutter, edge-to-edge product imagery, equal-height cards, a vertical single-column card mode at 320px, two-column cards above 320px, equal-height horizontal list cards, and a compact hero with an equally inset photo. Final refinement preserved drag reorder through an image-only handle, aligned toolbar icons with the application, and changed reservation presentation from quantity-based “full” semantics to ownership and remaining-capacity semantics. The result is one responsive system rather than separate role-specific card designs.

## Component Map

### Codebase — Use As-Is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| `Button` | `src/lib/components/base/button/` | Toolbar, card, hero, and sheet actions | `size="md"`, icon, primary, danger, outline |
| `Badge` | `src/lib/components/base/badge/` | Consolidated gift state | Semantic tone, subtle style |
| `Sheet` | `src/lib/components/base/sheet/` | Card More actions and hero management actions | `side="bottom"` |
| `WishlistDetailToolbar` | `src/lib/components/blocks/wishlist/WishlistDetailToolbar.svelte` | Compact sticky mobile command bar | Role and state gates remain authoritative |
| `WishlistGiftCardGrid` | `src/lib/components/blocks/wishlist/WishlistGiftCardGrid.svelte` | Grid, grouping, selection, and reorder wrapper | Existing callbacks and item identity |
| `WishlistGiftListView` | `src/lib/components/blocks/wishlist/WishlistGiftListView.svelte` | List, grouping, selection, and reorder wrapper | Existing callbacks and item identity |
| `WishlistGiftDraggableWrapper` | `src/lib/components/blocks/wishlist/WishlistGiftDraggableWrapper.svelte` | Image-overlay `GripVertical` drag handle and keyboard reorder | Existing pointer controller and arrow-key behavior |
| `GiftImage` | `src/lib/components/blocks/gift/GiftImage.svelte` | Edge-to-edge responsive image and fallback | `target="square"` / `target="thumb"` |
| `LikeButton` | `src/lib/components/blocks/gift/LikeButton.svelte` | Image-overlay Like action | `size="md"`, `aria-pressed` |
| `ReserveButton` | `src/lib/components/blocks/reservation/ReserveButton.svelte` | Reserve or cancel own reservation | `size="md"` |
| `PurchasedToggle` | `src/lib/components/blocks/reservation/PurchasedToggle.svelte` | Private current-reserver action in More actions | `size="md"` |
| `GiftReceivedToggle` | `src/lib/components/blocks/gift/GiftReceivedToggle.svelte` | Direct manager browse action | `size="md"` |
| `GiftContextActions` | `src/lib/components/blocks/wishlist/GiftContextActions.svelte` | Existing role-aware mobile action-sheet composition | Reuse action derivation and sheet behavior |

### Adopt from shadcn-svelte / Bits UI

None. The existing button, badge, and bottom-sheet primitives cover the refined design.

### Build Custom

| Proposed Name | Description | Why existing components don't cover it |
| --- | --- | --- |
| `CompactGiftCard` presentation | Equal-height vertical card in one column at 320px and two columns above it, consuming existing gift actions | Current `GiftCard` anatomy reserves desktop-scale rows and padding |
| `CompactGiftState` resolver/presentation | Selects one role-safe image badge plus optional body detail by explicit precedence | Current independent category, reservation, received, quantity, and selection overlays can collide |
| `CompactWishlistHero` presentation | Mobile photo, identity, lifecycle metadata, and one role-aware overflow action | Current ruled notebook and labeled action row consume excessive mobile height |

## Implementation Notes

- Keep role/capability derivation in existing wishlist and gift modules. Presentation must not independently infer permissions.
- Derive a single compact-card view model from gift state, role, lifecycle, and interaction mode. This should determine the primary action, More actions, consolidated badge, and allowed supporting text in one place.
- Keep one semantic DOM order for one- and two-column vertical Card anatomy and the horizontal List anatomy; switch layout with a component/container query rather than duplicate role logic.
- Treat 320px and below as a one-column vertical Card view with image above content. Widths above 320px through `sm` use a two-column vertical grid. List stays horizontal at every mobile width so the view switch never becomes a no-op.
- Give every item an explicit equal height within its responsive view. Clamp titles/supporting text and let the information region absorb free space; never vary height from reservation state, missing metadata, or optional actions.
- Apply the 12px page gutter at the route layout once. Remove mobile-only nested collection padding before changing card dimensions.
- Reuse `Sheet.Content side="bottom"` for card and hero overflow. Preserve inner scroll position and phone geometry while open; use non-scrolling focus placement/restoration in addition to focus containment, Escape/backdrop dismissal, and safe-area padding.
- In selection mode, replace the normal toolbar with selection count, Select all, `Akce`, and Cancel. Cards show only the image checkbox and no footer control. In reorder mode, replace incompatible toolbar controls with `Hotovo`, expose existing up/down affordances plus the existing `GripVertical` image-overlay handle, and keep normal card actions inert.
- Restrict `touch-action: none` to the drag handle. The rest of each card must continue vertical page scrolling; pointer drag and keyboard arrows preserve focus and scroll position.
- Match existing toolbar icon semantics: `ListChecks` enters selection, `Hand` enters reorder, `Check` completes reorder, and `GripVertical` identifies the draggable region.
- Render actual product imagery full-bleed in the image region. Do not nest product images in a colored mat or decorative paper frame.
- Show one centered state overlay. Received dominates reservation; a received-and-reserved gift uses one combined overlay with ownership or remaining capacity as supporting text.
- Present `Rezervováno vámi` as white on a lighter saturated green with accessible contrast. Present unavailable capacity owned by another person as distinctly darker navy `Rezervováno někým jiným`, regardless of total quantity. Show counts only while capacity remains, using `Volné 2/3`-style wording.
- Run Like feedback only from direct Like activation. Any card rerender caused by reserve, role, mode, or view changes must remain visually inert.
- Test recipient privacy structurally: no reserved text, badges, counts, names, controls, or state-dependent blank space may remain.
- Test combinations that previously collide: received plus reserved, quantity plus reservation, Like plus state badge, selection plus state badge, and moderator identity. Reversing Received must reveal the preserved underlying reservation state.
- Archived presentation removes all mutations except cancellation of the current visitor’s own reservation; management mode controls must become unavailable without leaving stale selection state.
- Keep unrelated desktop density unchanged. The cross-viewport contained view switcher is tracked in #327; centered received/reserved overlay precedence, including desktop, is tracked in #328.
