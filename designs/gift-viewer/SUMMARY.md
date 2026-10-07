# Gift Viewer — Design Summary

**Base**: Variant A | **Refined**: 2026-10-07

## Refinements Applied

Variant A refined with: state badges in the dialog's bottom-left corner on desktop, state list in the
caption on mobile and without a photo, actions-only footer, photo column sized to the photo's width.
See the design brief for full requirements. Key structural changes from the base variant: the footer
state group is gone; one state list renders in two placements, switched at the 640 px breakpoint;
the fixed 3fr/2fr grid became a content-sized dialog whose photo column follows the photo's aspect.

## Component Map

### Codebase — use as-is

| Component                  | Path                                                                         | Usage                                           | Key Props/Variants                        |
| -------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `Dialog` + overlay close   | shared dialog primitives used by `WishlistModals.svelte`                     | Viewer shell                                    | 40 px rotating close button               |
| `ImageFrame`               | `src/lib/components/derived/image-frame/ImageFrame.svelte`                   | Uncropped photo                                 | `natural`, `fillColor`, wishlist scope    |
| `GiftPieceCount`           | `src/lib/components/blocks/gift/GiftPieceCount.svelte`                       | Quantity in the price line                      | `reservedCount`, `hideWhenOne`            |
| `GiftLinkList`             | `src/lib/components/blocks/gift/GiftLinkList.svelte`                         | All links                                       | `display="row"`, no overflow cap          |
| `GiftDescription`          | `src/lib/components/blocks/gift/GiftDescription.svelte`                      | Description and appends                         | `maxVisibleAppends={null}`                |
| `giftStateBadgeVariants`   | `src/lib/components/blocks/gift/gift_state_overlay_variants.ts`              | State badges, both placements                   | `kind` per overlay entry                  |
| `LikeButton`               | `src/lib/components/blocks/gift/LikeButton.svelte`                           | Footer, first action                            | card appearance, responsive size          |
| `PurchasedToggle`          | `src/lib/components/blocks/reservation/PurchasedToggle.svelte`               | Footer Koupeno / Nekoupeno                      | `gift`, `size`                            |
| `ReserveButton`            | `src/lib/components/blocks/reservation/ReserveButton.svelte`                 | Footer Rezervovat / Zrušit rezervaci            | `gift`, `isArchived`, `size`              |
| `ReleaseReservationButton` | `src/lib/components/blocks/reservation/ReleaseReservationButton.svelte`      | Footer admin release                            | `gift`, `size`                            |
| `restingShadowNesting`     | `src/lib/utils/resting_shadow_nesting.ts`                                    | Footer and photo-badge insets                   | `--gift-content-inset`, `-end`, `-bottom` |
| `giftContextActions`       | `src/lib/modules/gifts/gift_context_actions.ts`, `GiftContextActions.svelte` | Admin „Uvolnit rezervaci" in the card More menu | danger tone, admin capability gate        |

### Adopt

None.

### Build custom

| Proposed Name   | Description                                                                       | Why existing components don't cover it                                                 |
| --------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `GiftViewer`    | Photo region, caption column and footer replacing `GiftDetailView`                | No existing photo-first read-only composition                                           |
| `GiftStateList` | Wrapping `<ul>` of `giftStateBadgeVariants` pills; placement `photo` or `caption` | `GiftStateOverlay` centers badges over the card image and does not wrap as a flow list |

## Implementation Notes

- **Content-sized dialog**: `width: fit-content` with the 1100 px / viewport max width; grid columns
  `minmax(0, auto) minmax(340px, 420px)`. The photo sizer's width is
  `min(720px, 90dvh) × aspect ratio` (min 280 px, max 100 % of its track) with `aspect-ratio` and a
  400 px min height, so tall photos fill their column edge to edge and wide photos shrink with the
  dialog. Stored image metadata has no dimensions, so the ratio is measured when the photo loads
  (`ImageFrame` `onmeasured`), with 4:3 until then.
- **Centering**: a fit-content dialog must not center with `left: 50%` plus translate, because
  shrink-to-fit then only sees half the viewport. Use `inset-inline: 0; margin-inline: auto`.
- **Photo-badge placement**: absolute in the photo region at
  `left/right: --gift-content-inset`, `bottom: --gift-content-inset-bottom` from
  `restingShadowNesting`, so the badges and the footer actions share one baseline.
- **Placement switch**: render the list once per placement and hide the inactive one with
  `display: none` at the `sm` breakpoint (photo placement `sm:flex`, caption placement `sm:hidden`
  when a photo exists), which also keeps assistive tech from reading the state twice. Caption
  placement sits between `GiftLinkList` and `GiftDescription`; image error drops the photo region,
  so the caption placement applies automatically.
- Footer is the action lane only, right-aligned; it is omitted in recipient preview.
- Label the list `aria-label="Stav dárku"`; it is not a live region.
