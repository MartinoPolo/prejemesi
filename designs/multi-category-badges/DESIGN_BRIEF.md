# Design brief — multiple categories per gift (#529)

A gift may carry zero to several categories ("labels"). Card and List badges stay tidy: show what
fits, collapse the rest into a "+X" chip. Full set lives in the Gift viewer, editor and a "+X"
popover. Mockups: `index.html` → `variant-a.html`, `variant-b.html`, `variant-c.html`.

## Fixed constraints (from `.mpx/DECISIONS.md` and the real components)

- Badge placement stays (2026-09-14): categories top-left on the image, priority bottom-left,
  state badges centered as one group; Compact stays image-free and badge-free.
- Grid Like sits top-right on the image with a separate category lane (2026-10-02); List Like
  stays beside the title, so the List category lane gets the full image width.
- Real `GiftCategoryBadge`: category color fill, 2 px ink border, `rounded-badge` (12 px),
  11 px extrabold, two-line clamp with `title` tooltip. Priority is the outlined `Badge`; state
  badges are solid `shadow-sticker` pills (`GiftStateOverlay`). Tokens come from `src/app.css`
  (DynaPuff / Geist); `designs/tokens.css` is legacy and not used.
- The precedent "+X" is `GiftLinkList`: count-based (`maxVisible={3}`), muted semibold text
  "+{count} další". Badges need a *fit*-based rule instead, because category labels vary widely
  in width and the lane width varies by view, column count and viewport.
- Desktop Card columns: Automatic / 4 / 5 with a 13.5 rem minimum card width (2026-10-06);
  mobile Card falls back to one column when two cannot fit actions (2026-09-19). The narrowest
  real lane is therefore a 5-column desktop card or a 2-column mobile card minus Like, and the
  mobile List portrait image (~6 rem wide).
- Preserve privacy capabilities: categories are visible to every role that sees them today.

## Overflow rule (shared by all variants)

1. Order = the gift's category order (first = primary, editable in the editor).
2. Multi-category badges render on **one line** each (ellipsis instead of the single badge's
   two-line clamp), so the lane height stays predictable for the state-badge centering math.
3. Lay badges out in order; stop at the first badge that does not fit together with a "+X" chip
   for the remainder (no skipping ahead to smaller later badges — order must stay stable).
4. The primary badge is always shown; if even it plus "+X" does not fit, it shrinks with an
   ellipsis. If it would drop below a readable width (~5 rem), "+X" moves to a second line and
   the primary takes the full lane (mobile List, 2-column mobile Card).
5. When the lane wraps, the centered state group is centered between the lane and the priority
   badge (as List already does via `--gift-list-overlay-start-clearance`), so they never overlap.
   On 2-column mobile cards a wrapped lane + state + priority is tight; verify in implementation.
6. "+X" is a neutral outlined badge (same height and radius as categories, ink border, card
   fill), a real button: press/hover opens a popover listing all categories in order; touch opens
   the same popover (not a tooltip). Its accessible name reads "Další kategorie: 4"; the badge
   group exposes all names to assistive tech. Pressing it never presses the card (2026-10-06).
7. Recompute on resize, column change and font load (ResizeObserver), like the existing
   List overlay clearance measurement in `GiftListItem.svelte`.

## Behaviour beyond badges

- **Grouping by category:** a gift appears once, under its primary category (recommended in
  the issue). Badges stay identical to the ungrouped view (today grouping does not hide the
  category badge either), so a secondary category is still visible inside the primary's group.
- **Facets:** category facet matches any of the gift's categories (OR within facet, AND across
  facets — unchanged 2026-08-13 rule). Counts per facet option count gifts, so the sum may exceed
  the gift count.
- **Reorder:** cross-group drag replaces only the primary category (old primary → new group's
  category, secondaries unchanged; if the target category was a secondary it becomes primary and
  the duplicate is removed). Drop into "Bez kategorie" clears the primary and promotes the next
  one; if none remain the gift is uncategorized. The Vrátit toast restores the full set.
- **Editor:** a multi-select combobox field "Kategorie" showing selected categories as
  removable chips in order (first labelled "Hlavní" visually via position, not a badge — the
  link editor dropped a "Hlavní" badge, 2026-07-18); options list with checkboxes and color
  swatches; drag/arrow reorder of chips sets the primary. Cap reached → remaining options disabled
  with a help line.
- **Bulk actions / context menu:** the Category submenu becomes a checkbox list with tri-state
  (checked = all selected gifts have it, indeterminate = some, empty = none). Toggling adds or
  removes that one category across the selection; "Bez kategorie" clears all. Desktop cascade /
  mobile bottom sheet rules (2026-09-10) unchanged.
- **Gift viewer / detail:** shows all categories wrapped (no "+X"); 2026-10-07 currently says
  "priority and category stay on the card", so this needs an owner decision (see Q3).
- **Migration:** additive — new `gift_category_assignment(giftId, categoryId, position)` table,
  backfill from `gift.categoryId` at position 0, keep `categoryId` as a mirror of the primary
  until the contract step (expand → migrate → deploy → contract).

## Open questions (with recommendations)

1. **Grouping placement (from the issue):** every group or only the primary? — *Recommend only
   the primary*, so reorder, counts and the single global `sortOrder` stay unambiguous; facets
   still match any category.
2. **Cap per gift (from the issue):** — *Recommend 5.* Six-plus labels on one gift are rare and
   unreadable; the mockups still render 6 to prove overflow holds if the cap is raised or data
   arrives via import/agents (server clamps).
3. **Viewer shows categories?** The 2026-10-07 viewer decision keeps category on the card only.
   With "+X" hiding some, the full set must be reachable without edit rights. — *Recommend the
   "+X" popover as the full-set surface on cards, and add a wrapped category row to the viewer
   caption* (small change, keeps parity with editor).
4. **Single-category badge clamp:** keep the two-line clamp for exactly one category? —
   *Recommend yes*: one-category cards look exactly as today; only multi-category lanes switch
   to one-line badges.
5. **Primary concept visible to users?** — *Recommend yes, implicitly*: first chip in the editor
   is the primary, with help text "První kategorie určuje skupinu při seskupení". No separate
   star/badge.

## Variants and recommendation

- **A — Fit-to-lane, one line + "+X" (recommended):** shows what fits in order with a stable
  one-line height; matches the owner's "as many as fit, then +X" wording.
- **B — Primary + colored "+X":** always the primary only plus a dot-swatch "+X"; calmest and
  measurement-free, but hides categories even when space exists.
- **C — Wrap to 2 rows (desktop List 3) + "+X":** most labels visible, but covers more photo
  and always pushes the state group off center.

Mockup styling is schematic: badge geometry mirrors `GiftCategoryBadge`, `GiftPriorityBadge`,
`GiftStateOverlay` and `LikeButton`; implementation must reuse those components.
