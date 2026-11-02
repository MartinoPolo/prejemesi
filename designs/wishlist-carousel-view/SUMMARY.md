# Wishlist carousel view — Design Summary

**Base**: Variant B | **Refined**: 2026-11-02

Mockup: `designs/wishlist-carousel-view/refined.html` (three 390 × 844 frames, a 320–600 px width strip with measured labels, and a Soft/Ink/Black depth preview). Requirements live in `DESIGN_BRIEF_WISHLIST_CAROUSEL_VIEW.md`.

## Refinements Applied

- **Card frame and shadow.** Every card uses the GiftCard surface: `--border-w` ink border, `--radius-panel` corners and `--elevation-ordinary` resting shadow in the viewer's depth colour. Dimmed cards (reserved by someone else, received) keep that shadow at 50 % with a softened frame (`.gift-frame-softened`) instead of dropping it.
- **Row clearance.** The scroller spans the screen and pads itself with the page gutter inline and 6 px block. No card edge, shadow, badge or focus ring is clipped at the top, bottom, first card or last card.
- **Footer inset.** The footer uses `--gift-content-inset` / `--gift-content-inset-end` / `--gift-content-inset-bottom` from `.resting-shadow-nesting`: 9 / 12 / 12 px in Ink and Black, 9 / 9 / 9 px in Soft, identical on every card.
- **Footer controls.** Dense-view Button `md` faces (32 px), `sm` (26 px) on cards narrower than 170 px, always with 40 px hit areas, `--radius-btn`, `--border-w` and `--elevation-ordinary`, separated by `--nested-control-gap`. Reserve keeps its natural width, right-aligned beside More, as in `GiftActionRow`.
- **Card width.** Fluid: whole cards plus a fixed fraction of the next, so every width shows a peek at the right edge. Below 360 px one card plus half the next, from 360 px two plus a fifth, from 540 px three plus a fifth. The row gap is `--gift-card-grid-gap`, as in the Card grid.
- **Real sections.** Rows follow `computeGiftSections`: „Vaše rezervace“ first, then the groups with fully reserved gifts at their end, then „Obdržené“ while „Zobrazit obdržené“ is on.
- **Source link.** The reduced card keeps one source link, or „Bez odkazu“, because links must be visible in every gift view. It drops only the description.
- **Badges.** Category and Like sit 8 px from the image edges and priority 12 px. State pills carry the ordinary shadow. Like is the 40 px mobile LikeButton.
- **Copy.** Real Czech strings (priorities, state labels, section labels, „Cena neuvedena“, „Bez odkazu“, „+1 další“). The switcher is the icon-only connected `GiftViewSwitcher` with a third „Karusel“ segment. Headers use the `GiftSectionHeader` typography with count and row position.

## Component Map

### Codebase — Use As-Is

| Need | Source |
| --- | --- |
| Native horizontal row, keyboard glide, mouse drag | `src/lib/components/base/carousel/` |
| Card frame, image area, separator, body, footer, dimmed variant | `src/lib/components/blocks/gift/gift_card_variants.ts`, `src/lib/components/blocks/gift/GiftCard.svelte` |
| Footer insets from the measured border | `src/lib/utils/resting_shadow_nesting.ts`, `.resting-shadow-nesting` in `src/app.css` |
| Action placement and overflow | `src/lib/components/blocks/gift/GiftBrowseActions.svelte`, `GiftActionRow.svelte`, `gift_action_placement.ts` |
| Reserve/cancel | `src/lib/components/blocks/reservation/ReserveButton.svelte` |
| Badges, state pills, like, link, image | `GiftCategoryBadges.svelte`, `GiftPriorityBadge.svelte`, `GiftStateOverlay.svelte`, `LikeButton.svelte`, `GiftLinkList.svelte` (`maxVisible={1}`), `GiftImage.svelte` (`target="thumb"`) in `src/lib/components/blocks/gift/` |
| Sections and order | `computeGiftSections` in `src/lib/modules/gifts/gift_ordering.ts`; `src/lib/components/blocks/wishlist/gift_section_label.ts` |
| Header typography | `src/lib/components/blocks/wishlist/GiftSectionHeader.svelte` |
| View switcher | `src/lib/components/blocks/gift/GiftViewSwitcher.svelte`, `src/lib/components/derived/segmented-toggle/` |

### Adopt from shadcn-svelte / Bits UI

| Need | Source |
| --- | --- |
| None | The carousel base and existing blocks cover every part. |

### Build Custom

| Piece | Notes |
| --- | --- |
| `carousel` view mode | `GIFT_VIEW_MODES` in `src/lib/modules/gifts/types.ts`; switcher segment (lucide `gallery-horizontal`), mobile only; `gift_view_carousel: "Karusel"`. |
| Carousel grouping coercion | `effectiveGrouping` in `src/lib/modules/gifts/gifts.context.svelte.ts`: saved priority/category wins, else priority when any gift has one, else category; „Bez seskupení“ disabled while Carousel is active; not persisted. |
| `WishlistGiftCarousel` block | Sections → rows (header with label, count, position; one `Carousel` per row), beside `src/lib/components/blocks/wishlist/WishlistGiftDisplay.svelte`. |
| Carousel card density | GiftCard option: no description track, one-line single link, `thumb` square image, `md` actions (`sm` below 170 px card width) with 40 px hit areas, tighter category badge padding below 170 px. |
| Group chip bar | Sticky `nav` of in-page links with `aria-current="location"`, hidden with fewer than two rows. |
| New copy | `gift_view_carousel`, `reserve_button_cancel_compact` „Zrušit“, `gift_carousel_position` „{first}–{last} z {total}“, `gift_carousel_jump_aria` „Přejít na skupinu“, group counts with the `dárek / dárky / dárků` plurals, localized `aria-roledescription`. |

## Implementation Notes

- **Scrolling.** Native scrollers with no snap, as on Přehled. Touch and trackpad scroll the row, the focused row moves one card per arrow key, and reduced motion makes those moves instant. `overscroll-behavior-x: contain`. Do not copy Přehled's right-edge fade mask: at this card width it fades the second card's More.
- **Shadow clearance.** The scroller bleeds through both gutters (`margin-inline: calc(-1 * var(--page-gutter))`) and pads itself with `--page-gutter` inline and 6 px block (covers 3 px resting / 4 px lifted shadow and a 2 + 2 px focus ring). `HomeShelf` has no trailing padding, so its last card ends at the screen edge; add gutter end padding here. Verify inline-end padding in iOS Safari, with a trailing spacer slide as fallback. Draw the row's own focus ring inset.
- **Card width.** `(row width − page gutter − N × gap) / (N + peek fraction)`, with N and the fraction from container queries on the row: N = 1 / 2 / 3 below 360 / from 360 / from 540 px, fraction 0.5 / 0.2 / 0.2. The card is an inline-size container. Below 170 px, the measured `md` footer minimum for „Rezervovat“ in Ink/Black, it switches actions to `sm` and tightens the category badge so one-word categories stay on one line. The mockup verifies 320, 360, 375, 390, 412, 430 and 600 px in all three depths. Cards of 151–158 px fall under GiftCard's `@container (width <= 10rem)` overlay rules; check them on the real component.
- **Dense action exception.** Mobile `lg` actions need a card of about 190 px (Reserve + More) or about 220 px („Zrušit rezervaci“ + More), which leaves no peek on common phones. The owner accepted smaller faces: `md` or `sm` with 40 px hit areas, and the compact „Zrušit“.
- **Accessibility.** Each row is a labelled, focusable region („Knihy, 10 dárků“), and the position text is `aria-hidden`. Hit areas are separate from the visible faces. Chip links move focus to the section heading (`tabindex="-1"`). Switcher segments keep their aria-label and tooltip.
- **Chip and scroll sync.** Use an `IntersectionObserver` on section headers, with a top root margin equal to the nav plus chip bar height. The current chip is the last header past that line, or the last section at page bottom. Scroll the current chip into view with `inline: 'nearest'` and no smooth behaviour. Set `scroll-margin-top` to the nav plus chip bar height.
- **Edge cases.**
    - Empty groups are hidden while browsing.
    - A list with no priority or category shows one row with a count-only header and no chip bar. Fully reserved gifts go last; own reservations add „Vaše rezervace“ and „Ostatní dárky“ rows.
    - Archived lists hide Reserve as on the Card.
    - Gallery swipe would compete with the row swipe: show the cover with List's `+N` chip (`GiftGalleryCountChip`).
    - Starting reorder or selection mode switches to Card view until Done, then returns to Carousel.
