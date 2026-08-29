# Wishlist Motion Strategy — Design Summary

**Base**: Variant A with selected Variant B behavior | **Refined**: 2026-08-28

## Refinements Applied

Variant A was chosen as the structural base and refined with Variant B’s hidden-gift exit and
card/list transition, slower received and hidden sequences, a visible identity-gated cross-section
gift flight, slow FLIP movement for continuously visible displaced siblings, in-place filter result
entry/exit, and no inserted completion banner. Variant A’s reservation, wizard, and like
micro-animations remain. The current follow-up composition has four demos: notification
skeleton-to-list loading, import draft-row insertion/removal, and category reorder/deletion are
approved together as one coherent list/list-order motion family; the realistic reorder-toolbar
proposal remains pending approval. The former image-editor candidate is rejected because it does
not correspond to the real editor. See the design brief for full requirements.

## Component Map

### Codebase — Use As-Is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| `WishlistDetailToolbar` | `src/lib/components/blocks/wishlist/WishlistDetailToolbar.svelte` | Toolbar shell and display state | `filters`, `viewMode`, `reorderMode`, change callbacks |
| `ActiveFilterPills` | `src/lib/components/derived/filter-menu/ActiveFilterPills.svelte` | Keyed pills and focus restoration | `items`, `triggerElement`, `onclearall` |
| `GiftViewSwitcher` | `src/lib/components/blocks/gift/GiftViewSwitcher.svelte` | Card/list/compact trigger | `value`, `onchange` |
| `GiftCard` | `src/lib/components/blocks/gift/GiftCard.svelte` | Card surface keyed by gift ID | existing gift and role props |
| `GiftListItem` | `src/lib/components/blocks/gift/GiftListItem.svelte` | List destination for view crossfade | existing gift and role props |
| `GiftReceivedToggle` | `src/lib/components/blocks/gift/GiftReceivedToggle.svelte` | Received/unreceived action | `giftId`, `received`, `onreceived` |
| `GiftSectionHeader` | `src/lib/components/blocks/wishlist/GiftSectionHeader.svelte` | Final `Obdržené` heading | `section` |
| `gift_pointer_reorder` | `src/lib/components/blocks/wishlist/gift_pointer_reorder.svelte.ts` | Cancel-safe WAAPI and FLIP precedent | stable `data-gift-id` elements |

### Adopt from shadcn-svelte / Bits UI

None.

### Build Custom

| Proposed Name | Description | Why existing components don't cover it |
| --- | --- | --- |
| `gift_layout_motion` coordinator | Captures attached gift positions before a successful state update, animates the moved gift and every surviving sibling, and cancels stale runs | Gifts cross keyed sections and the existing reorder controller is coupled to pointer reordering |
| `layout_transition` action | Measures small conditional containers such as filter rows and reorder toolbar states | Svelte’s built-in transitions do not coordinate container height with distant FLIP targets |

## Implementation Notes

- Start received motion only after the mutation succeeds. Failed mutations leave card position and
  received styling unchanged.
- Use stable gift IDs. Capture only attached, rendered elements with non-zero rectangles, update the
  Svelte state after `tick()`, then FLIP only identities with valid visible rectangles in both states.
- Filter-only insertions and removals enter or exit at their final coordinates, with at most opacity;
  they never receive translate/FLIP movement from a missing or zero-size rectangle.
- The visible desktop path uses the retained gift element or an inert visual clone above the grid
  for at least 650 ms only when the same identity moves between two visible sections. Longer routes
  extend to keep average translation velocity at or below 750 CSS px/s, with no duration cap. Other
  continuously visible, genuinely displaced gifts use 520 ms FLIP transforms concurrently.
- The hidden path fades/scales the gift for 340 ms while its grid slot remains reserved, removes it,
  then runs the 520 ms sibling FLIP. Do not insert a banner or status row.
- Announce completion through the existing polite live region. Keep undo in a stable control area.
- Focus the moved gift’s reverse action with `preventScroll`. If the gift is hidden, restore focus to
  the stable scenario/action trigger.
- Card/list switching uses Variant B’s fade-out, geometry replacement after `tick()`, and fade-in
  sequence. Reservation, wizard, and like feedback use the Variant A treatment.
- Apply the same cancel-safe and reduced-motion rules to the three approved list-motion demos:
  notification loading, import draft-row insertion/removal, and category reorder/deletion.
- For the pending reorder proposal, preserve the real toolbar and responsive slots. Morph only
  `Změnit pořadí` in place to `Hotovo`; keep incompatible view/preview/sort/group/filter/reset,
  active-filter, settings, batch-add, and add-gift controls visible but programmatically disabled.
  Do not introduce Save/Cancel, toolbar translation/reflow, or focus movement. Reveal grips in
  place; reduced motion updates immediately.
- Standalone issue #268 (`Keep wishlist toolbar stable during gift reorder mode`) tracks the
  reorder implementation. Its `design needed` label remains pending user approval.
