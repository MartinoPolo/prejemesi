# Design brief: mobile wishlist carousel view

> **Status**: Refined (Variant B)
> **Refined mockup**: `designs/wishlist-carousel-view/refined.html`
> **Summary**: `designs/wishlist-carousel-view/SUMMARY.md`
> **Refinements**: GiftCard frame, shadow and dimmed shadow in every state; row shadow and focus clearance on all edges; footer on the shared content insets; dense 32/26 px actions with 40 px hit areas; fluid card width with a peek at every screen width; rows follow the existing sections; source link restored; real Czech copy and „Karusel“.

The owner chose Variant B. `variants/variant-a.html` is kept as a backup; the owner rejected Variant C.

Issue: https://github.com/MartinoPolo/prejemesi/issues/580 (blocked by #632, which removes the Compact view).

## Goal

On mobile, a wishlist can be browsed as one horizontal carousel row per priority or category group, so a long list becomes a stack of swipeable shelves instead of one long vertical scroll.

## Settled requirements

- Mobile only. The gift view switcher offers Card, List, Carousel; Carousel is the third segment.
- The carousel view always groups; "no grouping" is unavailable while it is active. Saved priority or category grouping wins; otherwise priority when any gift has one, otherwise category. A list with neither shows a single row.
- One horizontal, next-card-peeking row per section of the grouped view (`computeGiftSections`): „Vaše rezervace“ first, then the groups, then „Obdržené“ while received gifts are shown. Each header shows the section's gift count.
- Rows are uncapped: every gift of the group is in its row. Native horizontal scrolling like the Přehled rows (`src/lib/components/base/carousel/`), with page-gutter padding at both ends and enough block padding that no card shadow, border, badge or focus ring is clipped.
- Cards keep the mobile Card frame, resting shadow (softened, not removed, when dimmed), badges, state overlays, source link and footer lane on the shared content insets (DECISIONS: badges in every grouping; the primary/Received/More actions share the right-aligned footer lane). The reduced carousel card drops only the description and uses the square `thumb` image.
- Every screen width shows the next card peeking at the right edge: one card plus a peek on narrow screens, two or three on wider ones. Card width follows the screen.
- Footer actions use the dense-view `md` face (32 px), or `sm` (26 px) on narrow cards, with 40 px hit areas: mobile `lg` actions would need a card of about 190 px or more, which leaves no peek.
- Starting reorder or selection mode switches to Card view until Done.

## Resolved design questions

Answered by the refined mockup: the card width rule and breakpoints (see SUMMARY.md); a one-line header with count and row position; a sticky group chip bar for jumping; empty groups hidden while browsing.

## Container context

Show the mobile wishlist page around the rows at reduced emphasis: navbar, wishlist hero/header and the toolbar with the three-segment view switcher (Carousel selected) and the grouping control. The designed part is the grouped rows.

## Reference

- Tokens: `src/app.css` (DynaPuff headings, Geist body). `designs/tokens.css` is legacy; do not link it.
- Current gift card markup to mirror: `designs/multi-category-badges/variant-a.html` (mobile Card), `src/lib/components/blocks/gift/GiftCard.svelte`.
- Overview carousel rows: `src/lib/components/blocks/dashboard/HomeShelf.svelte`, `designs/home-overview/refined.html`.
- Current grouped rendering: `src/lib/components/blocks/wishlist/WishlistGiftDisplay.svelte`.
