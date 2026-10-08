# Gift Viewer — Design Brief

> **Status**: Refined (Variant A) **Refined mockup**: `designs/gift-viewer/refined.html`
> **Summary**: `designs/gift-viewer/SUMMARY.md` **Refinements**: state badges in the dialog's
> bottom-left corner (desktop), state list in the caption (mobile, no photo), actions-only footer,
> photo column sized to the photo width

The gift viewer replaces the read-only gift detail dialog for everyone without edit rights
(visitors, including app admins browsing as visitors). The current dialog mostly repeats the card:
same title, price, priority, links, state badges and actions. The viewer exists for what the card
cannot show: the **large, uncropped photo**, plus a caption carrying the full text the card clamps,
and the viewer's real actions. Recipients and správci keep the unchanged gift editor.

**Source**: issue #440 (blocked-by #442, merged). Grilling decisions in the #440 execution session.

---

## 1. Purpose

A gifter taps a gift card because they want to **see the thing** properly and read everything the
recipient wrote, then act (reserve, like, mark bought). They do not need the card's browse
metadata again. The viewer answers: "What exactly is this, what did they write about it, where can I
buy it, and can I take it?"

**Key value**: a photo-first viewer that shows the gift bigger and in full, with its actions to hand
and nothing the card already says better.

---

## 2. Surrounding Context

The viewer is a centered `Dialog` over the wishlist page `/w/<short-id>` (decision 2026-09-19: gift
viewing stays in dialogs, not routes or inline expansion). Opening a gift never changes the route.
Backdrop dims and blurs the page; body scroll locks; focus is trapped; Escape and the close button
close it.

### Full viewport structure

Behind the dialog (FINAL state, reproduce at reduced fidelity, non-interactive, dimmed):

- App header (logo „přejeme si.cz", nav „Moje seznamy / Spravované / Sledované", Vytvořit button,
  icons, avatar), full width, ~52 px desktop / ~56 px mobile.
- Wishlist hero: notebook panel with polaroid, „Pro: Martin Novák", title „Vánoce 2026", countdown
  sticky note; content container max-width centered, 16 px desktop / 12 px mobile gutters.
- Toolbar row, then a Card grid of gift cards (desktop 3 columns, mobile 2 or 1 column).

**What the parent provides**: `Dialog.Root`, overlay, focus trap, the shared overlay close button
(`overlayCloseButtonClass`, 40 px, rotating icon, non-rotating shadow), 90 dvh cap on desktop.
**What this component fills**: the dialog content box: photo region, caption, footer.
**Excluded — belongs to the parent**: page chrome, the gift editor (`GiftDetailForm`), the
`ReserveModal` flow opened by Rezervovat.

**Mockup rendering instructions**:

- Desktop frame ~1280×900 with the viewer over the dimmed wishlist page; the photo region must read
  as clearly dominant.
- Mobile frame 390×844 (iPhone 13) with the viewer full-screen.
- A state switcher (tabs or a labelled grid of frames) covering every state in §4, desktop and
  mobile for each.
- Anime Sky design language, light mode (source of truth); dark mode derives through tokens.
- Use photo stand-ins with different natural aspects (landscape 4:3, portrait 3:4, tall 9:16,
  wide 21:9) so the uncropped behavior is visible. Seed data has no real photos.

---

## 3. Requirements

### 3.1 Who gets the viewer

- Read-only roles only: `readOnly={!canManageWishlist}` in `WishlistModals.svelte`. Recipients and
  správci keep `GiftDetailForm` unchanged (REQ-4).
- Tapping a gift always opens the viewer, including gifts without a photo.
- Recipient preview (`hideReservationState`): the viewer shows no state and no actions; footer is
  absent.

### 3.2 Photo region

- The uncropped original at its natural aspect, `contain`-fitted inside the region with a height cap
  (decision 2026-07-18). No crop target, no polaroid frame, no tilt, no category, priority or Like
  heart overlays.
- **Desktop state badges** sit side by side in the bottom-left corner of the photo region, which is
  the dialog's bottom-left corner, never centered, so the photo stays clear. They use the footer
  action insets, so badges and actions share one baseline. The list stays bottom-anchored and wraps
  onto further lines when the region is too narrow. Mobile shows no badges on the photo (see §3.3).
- No dimming in any state, including reserved by someone else (the state badge says so; a faded
  photo defeats the viewer).
- Explicit frame fill (`imageMeta.bgColor`) letterboxes the photo; otherwise letterbox on the
  neutral surface.
- Native browser pinch-zoom only; no custom zoom, no swipe between gifts.
- Alt text = gift name.

### 3.3 Caption

Shown top to bottom:

1. **Full title** (no clamp), dialog heading, 22–24 px DynaPuff semibold. It is the dialog's
   accessible name (visible, not `sr-only`).
2. **Price · quantity line**: price in ink (`formatPrice`, range allowed, „Cena neuvedena" muted
   italic when absent) and `GiftPieceCount` when quantity > 1, e.g. „12 490 Kč · 3 kusy ·
   1 rezervováno". Visitors see the reserved count; recipient preview never does.
3. **All links** with label and domain (`GiftLinkList display="row"`, no overflow cap).
4. **State list** (mobile, and any layout without a photo, including the image-error fallback): the
   state badges in a wrapping row. On desktop with a photo the badges sit on the photo instead
   (§3.2).
5. **Full description and every append** (`GiftDescription maxVisibleAppends={null}`), appends with
   their date header.
6. **Edited-after-share line**, muted 12 px: „Upraveno po sdílení · 3. 10. 2026".

State entries are the card's overlay entries (`deriveGiftDisplayState(...).presentation.overlay`)
rendered with the shared `giftStateBadgeVariants` pills: „Přijato", „Rezervováno vámi", „Koupeno",
„Rezervováno někým jiným" / „Rezervoval(a) Petr" / „Rezervováno více lidmi", „Volné 2/3". Absent
when there is no state.

Dropped from the viewer: priority, category, the Like overlay heart.

Long captions scroll: desktop inside the caption column, mobile in the sheet below the photo. The
footer never scrolls away.

### 3.4 Footer: actions only

One footer row, outside the scroll region, using the card's footer geometry: `restingShadowNesting`
insets (`--gift-content-inset`, `-end`, `-bottom`) so the bottom and side insets of the actions are
equal and include depth clearance on shadowed edges (issue REQ-3, decision 2026-10-02). Adjacent
controls use `--nested-control-gap` and share height (desktop `md` 32 px, mobile `lg` 40 px). State
badges never appear in the footer.

- **Actions**, right-aligned lane (decision 2026-09-09), in this order:
  1. `LikeButton` (heart + count), using the card's control size and look rather than the large
     sticker.
  2. `PurchasedToggle` „Koupeno" / „Nekoupeno" when the viewer holds a reservation.
  3. `ReserveButton`: „Rezervovat" (primary) or „Zrušit rezervaci" (red outline with undo icon).
     Hidden when fully reserved by others; in an archived list only Cancel remains possible.
  4. `ReleaseReservationButton` „Uvolnit rezervaci" (danger) for app admins when a reservation
     exists.
- Mobile: the action lane never wraps. Secondary actions (Koupeno, Uvolnit) move into a More
  overflow only if the action row itself cannot fit, with Rezervovat / Zrušit always visible.

### 3.5 Admin release in the card More menu

- Admins also get „Uvolnit rezervaci" in the gift card/list More menu (admins only, gated by the
  same capability as `ReleaseReservationButton`), and it stays in the viewer. Show one small frame of
  a reserved card with its More menu open listing „Uvolnit rezervaci" in danger tone.

---

## 4. States

| State                  | Visual treatment                                                                                   | Trigger                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Available, with photo  | Large photo, caption, footer: Like · Rezervovat                                                     | Visitor, gift unreserved                   |
| Without photo          | Narrower text-only viewer, no photo region and no placeholder image; caption + footer               | `imageUrl`/`imageKey` both empty           |
| Long description       | Caption scrolls (scroll shadow hint); footer pinned                                                 | Long text + several appends + many links   |
| My reservation         | State „Rezervováno vámi"; Like · Koupeno · Zrušit rezervaci                                         | `myReservationId !== null`                 |
| My reservation, bought | States „Rezervováno vámi" + „Koupeno"; Like · Nekoupeno · Zrušit rezervaci                          | Own reservation marked purchased           |
| Reserved by others     | State „Rezervováno někým jiným"; Like only; no dimming                                              | Fully reserved, not mine                   |
| Partial, multi-piece   | State „Volné 2/3"; caption „3 kusy · 1 rezervováno"; Like · Rezervovat                              | quantity 3, reservedCount 1                |
| Admin                  | State „Rezervoval(a) Petr"; Like · Uvolnit rezervaci                                                | App admin viewing a reserved gift          |
| Received               | State „Přijato"; Like only                                                                          | `received`                                 |
| Archived list          | Like only (Zrušit rezervaci if mine)                                                                | Archived wishlist                          |
| Recipient preview      | Photo + caption; no state, no footer                                                                | `hideReservationState`                     |
| Pending action         | Pressed control shows its existing pending/disabled state; others stay usable                       | Reserve/Like/Koupeno request in flight     |
| Focus                  | Shared focus ring on close, links, footer controls; focus starts on close or the dialog             | Keyboard                                   |
| Image loading / error  | Neutral surface with spinner-free placeholder fill; on error fall back to the text-only layout      | Slow or broken image URL                   |

---

## 5. Component Reuse Map

### Existing components (use these)

| Component                  | Variant/Props                                                                | Usage in this design                         |
| -------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| `Dialog` (base)            | `Dialog.Content`, shared overlay close button                                | Viewer shell                                 |
| `ImageFrame`               | `natural`, `fillColor`, `tokenScope={IMAGE_TOKEN_SCOPES.wishlist}`           | Uncropped photo                              |
| `GiftPieceCount`           | `role`, `reservedCount`, `hideWhenOne`                                       | Quantity in price line                       |
| `GiftLinkList`             | `display="row"`, no overflow cap                                             | All links with domain                        |
| `GiftDescription`          | `maxVisibleAppends={null}`                                                   | Full description + appends                   |
| `giftStateBadgeVariants`   | `kind`: received / own-reservation / own-purchased / unavailable / partial   | Photo-corner and caption state list          |
| `LikeButton`               | card appearance and responsive size (not `sticker`)                          | Footer Like                                  |
| `PurchasedToggle`          | `gift`, `size`                                                               | Footer Koupeno                               |
| `ReserveButton`            | `gift`, `isArchived`, `onreserve`, `onunreserve`, `size`                     | Footer Rezervovat / Zrušit                   |
| `ReleaseReservationButton` | `gift`, `size`                                                               | Footer admin release                         |
| `GiftActionRow` overflow   | More trigger / sheet                                                         | Mobile overflow only if the row cannot fit   |
| `restingShadowNesting`     | action from `src/lib/utils/resting_shadow_nesting.ts`                        | Footer inset tokens                          |

### Components to adopt

None.

### Components to design

| Component      | Description                                                       | Why new                                                            |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `GiftViewer`   | Photo region + caption + footer composition replacing `GiftDetailView` | The viewer layout has no existing composition                  |
| State list     | `giftStateBadgeVariants` pills in a wrapping row, anchored to the dialog's bottom-left corner (desktop) or inline in the caption | `GiftStateOverlay` centers its badges over the card image |

---

## 6. Layout Constraints

- **Desktop (≥ 640 px)**: centered dialog sized to its content, `max-w-[1100px]`, `max-h-[90dvh]`.
  Grid: photo column, then caption column (340–420 px). The photo column is the photo's width at
  the height cap `min(90dvh, 720px)`, so tall photos get no side mat; it shrinks with the dialog's
  max width for wide photos. A caption taller than the photo letterboxes the photo vertically,
  which is accepted. The photo region is full-bleed to the dialog's left, top and bottom edges,
  clipped by its radius, with a 400 px minimum height and a 280 px minimum width.
- **Desktop, no photo**: single column, `max-w-[560px]`, caption then footer.
- **Mobile (< 640 px)**: full-screen (`100dvw × 100dvh`, no outer margin, safe-area padding).
  Photo full width, height-capped at ≈55 dvh so the title stays visible on open; caption scrolls
  with the photo in one scroll region; footer fixed at the bottom with a top border, opaque.
  Close button 40 px top-right over the photo region with its own contrast backing.
- **Mobile, no photo**: same full-screen sheet; caption starts below a compact top row holding the
  close button (title and 40 px close share that row, decision 2026-09-19).
- Spacing: caption padding 16 px mobile / 24 px desktop; caption block gap 12 px; footer insets from
  the card's nested-corner tokens.
- Typography: title 22 px mobile / 24 px desktop DynaPuff semibold; price 16–18 px bold ink;
  description 14–15 px Geist; meta 12 px muted.

---

## 7. Design Tokens

From `src/app.css` (canonical; `designs/tokens.css` is legacy reference):

- Fonts: `--font-heading` (DynaPuff), body Geist.
- Surfaces: `--card`, `--surface`, `--ink`, `--ink-faint`, `--muted-foreground`, `--pattern-dot`.
- Radii and elevation: `--radius-panel`, `--radius-btn`, `--elevation-*`, `shadow-sticker`,
  `--depth-clearance`, `--nested-control-gap`.
- State fills: `--gift-overlay-own-reservation`, `--gift-overlay-bought`,
  `--gift-overlay-unavailable`, `primary` for Přijato.
- Actions: `primary` for Rezervovat, full ink for Koupeno, shared red outline for Zrušit/Nekoupeno,
  danger for Uvolnit; Like neutral (decision 2026-09-23).

---

## 8. Design Constraints (non-negotiable)

- Viewer stays a dialog over the list; no route change.
- State badges only in the dialog's bottom-left corner (desktop) or in the caption (mobile, no photo); never in the footer. Photo is uncropped and never dimmed.
- Footer reuses the card's components, sizes and inset tokens; equal bottom and side insets for the
  actions, including depth clearance (Soft depth: no clearance).
- Privacy gating is unchanged and centralized in `deriveGiftDisplayState`: recipient preview shows
  no reservation state or reserver identity; reserver names only where the overlay entries already
  carry them.
- Mobile action lane never wraps; Rezervovat/Zrušit always visible.
- Touch targets ≥ 40 px on mobile; visible focus on every control; dialog labelled by the title.
- Editor (`GiftDetailForm`) for recipients and správci is untouched.

---

## 9. Design Freedom

- Photo region surface: plain neutral `--surface`, the dotted notebook mat, or a darker
  photo-viewing tone (must work in dark mode via tokens).
- Divider between photo and caption (dashed ink-faint seam vs. none).
- Caption hierarchy details: link row styling within `GiftLinkList`, spacing between blocks.
- Open/close motion within the shared dialog transitions and reduced-motion rules.

---

## 10. Visual References

- **Internal**:
  - Current read-only view: `src/lib/components/blocks/gift/GiftDetailView.svelte`,
    `GiftDetailActionBar.svelte`, `gift_detail_modal_variants.ts`.
  - Card footer geometry and actions: `GiftCard.svelte`, `gift_card_variants.ts`,
    `GiftBrowseActions.svelte`, `GiftActionRow.svelte`.
  - State badges: `GiftStateOverlay.svelte`, `gift_state_overlay_variants.ts`.
  - Prior detail studies (superseded for read-only): `designs/gift-detail-modal-v3/refined.html`.
  - Unavailable treatment: `designs/unavailable-gift-comparison/`.
- **External**: photo-first product lightboxes with a caption panel (e.g. a marketplace listing
  viewer): large image left, compact text column right, actions pinned at the column's bottom.

---

## 11. Not Included (scope exclusions)

- Swiping or arrow navigation between gifts.
- Custom zoom/pan controls.
- Edit history beyond the edited-after-share line and appends.
- Any change to the gift editor for recipients and správci.
- New reservation form inside the viewer (Rezervovat opens the existing `ReserveModal`).
