# Gift gallery — Design Summary

**Base**: Variant A | **Refined**: 2026-10-31 | **Issue**: [#591](https://github.com/MartinoPolo/prejemesi/issues/591)

## Refinements Applied

Variant A was approved as-is, including the existing 50 % unavailable treatment in dark mode. See the design brief for requirements. `refined.html` is the variant with local asset paths and the refined label.

## Component Map

### Codebase — Use As-Is

| Component                    | Path                                                        | Usage                                                     | Key Props/Variants                                      |
| ---------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Button                       | `src/lib/components/base/button/`                           | Card and viewer edge arrows, tile remove, „Přidat“ menu   | `intent="secondary" size="md" format="icon"`, as in `carousel-previous.svelte` |
| DropdownMenu                 | `src/lib/components/base/dropdown-menu/`                    | „Přidat“ tile: „Nahrát soubor“ / „Vložit odkaz na obrázek“ | existing menu items                                     |
| ImageFrame / GiftImage       | `src/lib/components/derived/image-frame/`, `blocks/gift/GiftImage.svelte` | Every gallery image with its own `imageMeta`              | `target="square"` card, `thumb` list and strip, `natural` viewer |
| ImageUpload, ImageCropStage  | `src/lib/components/derived/image-upload/`, `derived/image-crop/` | Editor: add by upload; crop the selected image            | unchanged contracts, fed the selected image             |
| GiftImagePreviewSlots        | `src/lib/components/blocks/gift/GiftImagePreviewSlots.svelte` | „Karta“ / „Seznam a rezervace“ tiles for the selected image | unchanged                                               |
| Category, priority, state badges, LikeButton | `src/lib/components/blocks/gift/`              | Unchanged positions; the indicator shares the priority row | unchanged                                               |

### Adopt from shadcn-svelte / Bits UI

None.

### Build Custom

| Proposed Name         | Description                                                                 | Why existing components don't cover it                                                     |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GiftGalleryIndicator` | Dots with an elongated active dot, or an `n/8` pill above 6 images          | No position indicator exists                                                                |
| `GiftCardGallery`     | Card image area cycling images: hover/focus arrows, touch swipe, wrap-around | `base/carousel` is a scrolling row of many items, not a single-frame image cycler with overlays |
| `GiftGalleryCountChip` | List `+N` chip with image icon, top-right of the list image                 | New badge content; reuse badge border/shadow tokens                                         |
| `GiftViewerGallery`   | Viewer photo with counter, arrows, thumbnail strip, ←/→ keys               | GiftViewer shows one natural photo today                                                    |
| `GiftImageStrip`      | Editor strip: select, drag/keyboard reorder, remove, cover pill, add tile, limit message | No sortable thumbnail strip exists                                                          |

## Implementation Notes

- **Card events:** arrows and swipe mark themselves as nested gift-card controls (`GIFT_CARD_CONTROL_SELECTOR`, `data-gift-control-press`) so they neither open the viewer nor trigger the card press state. Swipe uses horizontal-intent detection so vertical page scroll still wins; off in reorder and selection modes, where the card shows the cover.
- **Indicator placement:** centered on the priority row; when it would come within 8 px of the priority badge (narrow two-column mobile cards) it moves bottom-right. Implement with a container query on the image area, not runtime measurement, if a width threshold reproduces the mockup.
- **Current index:** per card, client-only, reset on reload; the viewer opens at the card's current index. Images after the first load lazily; preload the neighbour on hover or first swipe.
- **Viewer:** the photo column width is the widest gallery image at the height cap, so the dialog never resizes; narrower images letterbox with the image-frame fill. ←/→ act only while the viewer is open.
- **Editor:** the crop stage, mode selector and preview tiles bind to the selected image; save validates all images, guards unsaved changes across images, and keeps upload-in-progress blocking per image. Grip arrow keys reorder; announce position changes to screen readers.
- **Accessibility:** arrows labeled „Předchozí obrázek“ / „Další obrázek“; the indicator exposes „Obrázek n z N“; the active dot differs by length, not only colour.
- **Reduced motion:** image changes cross-fade or cut without slide when reduced motion is requested.
