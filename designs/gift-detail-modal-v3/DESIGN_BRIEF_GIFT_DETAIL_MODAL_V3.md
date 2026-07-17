# Design Brief – Gift Detail Modal v3 (Visitor rework: square image, tight layout, inline reserve/like)

> **Status**: Refined (Variant A)
> **Refined mockup**: `designs/gift-detail-modal-v3/refined.html`
> **Summary**: `designs/gift-detail-modal-v3/SUMMARY.md`
> **Refinements**: long-description internal scroll (bar always pinned), two-element single-line action bar (like left, primary right, nothing else – availability text removed as redundant), all reservation status (own + others') as photo overlay with the Koupeno toggle stacked under the own-reservation note, component gap check (priority badge, link rows, like button – restyle specs in SUMMARY.md)
> **Layers on**: v1 brief (modal frame, roles) + v2 brief (multi-link, enrichment – edit mode only).
> This brief covers the **read-only visitor/recipient view** (`GiftDetailView`) only. Edit mode (`GiftDetailForm`) is untouched.

**Component:** `GiftDetailModal` / `GiftDetailView` (`src/lib/components/blocks/gift/`)
**Source:** issue #165 (REQ-1..6). Related: #163 (square-crop + mobile list, in flight), #164 (rotating close button, separate).
**Date:** 2026-07-16

---

## 1. Purpose

The visitor gift detail modal today reuses the edit form's 45/55 grid with a tall 1:2 image column. With typical content (name, price, one link, short description) the right column is mostly empty white space, the „Upraveno po sdílení" badge floats alone under the title, and reserve/like are absent – the visitor must close the modal and act on the card. See board screenshot `.mpx/board-files/Pasted image 20260716082938.png`.

v3 makes the detail modal read as an **enlarged gift card**: same square image crop as the card, same facts, same reserve + like affordances, plus the full description/links/update history the card truncates.

**Key value**: one surface where a gifter can read everything about a gift and act on it, without layout dead zones, on a 390 px phone first.

---

## 2. Surrounding Context

Unchanged mechanics from v1: centered `Dialog` over `/w/<short-id>`, no route change, backdrop dim + blur, body scroll lock, focus trap. Opened by clicking a gift card / list row.

**Mockup rendering instructions**:

- Desktop composition: modal over a dimmed wishlist card grid (backdrop cards are non-interactive context, reduced fidelity).
- Mobile composition: 390 px full-width sheet, sticky bottom action bar, internal scroll.
- State matrix: available / reserved-by-me / fully-reserved / recipient, side by side, labeled.
- Sky design language throughout (sticker panels, 2.5 px ink borders, hard offset shadows, DynaPuff/Geist, playful rotations). Light mode only (source of truth).
- Cross-in-circle rotating close button shown for coherence, but it is **issue #164**, not part of this scope.

---

## 3. Requirements (mapped from issue #165)

### 3.1 REQ-1 – No dead white space

- The media and content areas must be balanced at desktop and mobile widths. The tall 1:2 image column is abandoned; the modal height is driven by content, capped at `90dvh`.
- Content order (visitor): name (+ piece count when qty > 1, + „Obdrženo" badge), price + priority, links, description + post-share appends, action area (like + reserve).
- No fixed min-height that forces empty area (`sm:min-h-[520px]` in `giftDetailModalVariants.body` goes away for the read-only view).
- **Long descriptions (refinement)**: the content region scrolls internally – desktop body scrolls inside the `90dvh` cap with the action bar pinned as a separate grid row; mobile content scrolls behind the sticky bar. No clamp / „Zobrazit více". Scroll shadows hint at overflow.

### 3.2 REQ-2 – „Upraveno po sdílení" integrated with update content

- The badge never floats near the title. It anchors the **description append block** (the accent-tinted immutable note from `GiftDescription`): badge + „doplněno {date}" form the append's header row, the update text sits under it – exactly the `desc-append` pattern from `anime-gift-detail-modal.html`.
- Edge case: gift edited after share **without** a description append (e.g. price change only). Then the badge renders as the header of an otherwise text-free update strip in the description section („Upraveno po sdílení · {date}"), still inside the content flow, never beside the title.
- Components: `GiftEditedBadge` (tag form) composed into / adjacent to `GiftDescription` appends; cards keep their compact info-control treatment from #163.

### 3.3 REQ-3 – Reserve + like inside the modal, role-gated

- Action area shows exactly two controls: `LikeButton` (heart + count) and `ReserveButton` (Rezervovat / Zrušit rezervaci).
- **Composition rule (refinement, all states, all viewports)**: the bar has **at most two elements on a single line** – like always leftmost, primary action always rightmost, nothing else. No availability text („Volné k rezervaci" removed as redundant: the active „Rezervovat" button says it, quantity via `GiftPieceCount` beside the title), no status notes, no toggles in the bar. It never wraps at 390 px.
- **Reservation status lives on the photo** (overlay stack, top-left over the mat), never in the bar. Someone else's reservation: „✓ Rezervováno" + „rezervoval {name}" („🛍 Koupeno" when purchased), content dimmed, bar keeps only the like button – no disabled „Rezervováno" button. Own reservation: „✓ Rezervováno vámi" note with the interactive `PurchasedToggle` („Koupeno") stacked under it, content not dimmed, bar = like + danger „Zrušit rezervaci".
- Reserve tap triggers the existing `ReserveModal` flow (quantity + anonymous identity) – no new reservation form inside the detail.
- Role gating (invariant): **recipient (owner) sees no action area at all** – no availability, no reserve, no like, no reserver names. Visitor and správce see the full action area; both also see reserver names on fully reserved gifts (decision 2026-07-10).
- Archived list: like stays, reserve hidden unless the viewer holds a reservation (cancel allowed) – mirrors `ReserveButton` logic.

### 3.4 REQ-4 – Squarish (1:1) modal image

- The modal displays the **`square` crop target** – the same crop family the card, list thumbnail, and reservation thumb use (#163). WYSIWYG: what the card shows, the modal shows bigger.
- Frame treatment: square photo sticker on the dotted notebook mat; non-filling images letterbox on the mat (`contain` + padding), per round-2 redesign deltas.

### 3.5 REQ-5 – Frames stretch, crop stays square

- The image **element** keeps `aspect-ratio: 1/1`; its container may widen (modal media column, mobile hero). Extra width becomes mat, never a wider crop.
- Height clamp: mobile hero `max-height: min(100vw - padding, ~42vh)` so the square never pushes the action bar off-screen; the square centers on the mat when clamped.

### 3.6 REQ-6 – Mobile-first (390 px)

- ≤ 640 px the modal is a full-width sheet: hero image, content, **sticky bottom action bar** (opaque, top ink border, like left / reserve right).
- Touch targets ≥ 44 px (reserve, like, close, links, append-history toggle).
- Verify composition at 390 px (mockups include a 390 px frame; implementation verified via `scripts/shot.mjs --mobile`).

---

## 4. States

| State                  | Trigger                                   | Visual treatment                                                                                   |
| ---------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Loading                | Modal open before data                    | Skeleton: square image block, title bar, two text bars, action bar placeholders                     |
| Visitor – available    | Free units, no own reservation            | Bar: like + primary „Rezervovat" only; no availability text (quantity via `GiftPieceCount` beside title) |
| Visitor – reserved-by-me | `myReservationId !== null`              | Photo overlay „✓ Rezervováno vámi" + `PurchasedToggle` stacked under it; bar: like + danger „Zrušit rezervaci"; content not dimmed |
| Visitor – fully reserved | `isFullyReserved`, not mine             | Photo overlay „✓ Rezervováno" + „rezervoval {name}" (crisp, not dimmed); photo + content dimmed/desaturated; bar keeps like only – no availability text, no disabled button |
| Recipient (owner)      | `role === 'recipient'` (owner invariant)  | No action area, no availability, no reserver names; content + like count hidden too (no like state) |
| Správce (moderator)    | `role === 'moderator'`                    | Visitor layout + reserver names always visible; može reserve                                        |
| Received               | `gift.received`                           | „Obdrženo" badge beside title; reserve area replaced by muted note                                  |
| Archived list          | wishlist archived                         | Reserve hidden (cancel-only if mine), „Archivováno" context from page; like stays                   |
| Edited after share     | `editedAfterShareAt !== null`             | Integrated update strip per REQ-2 – in every state above                                            |
| Hover/focus            | Buttons, links, close                     | Sticker lift + hard shadow grow; dashed ink focus ring                                              |

---

## 5. Component Reuse Map

### Existing components (MUST use)

| Component | Path | Usage in this design |
| --------- | ---- | -------------------- |
| Dialog | `base/dialog/` | Modal shell, portal, focus trap, scroll lock, Esc |
| Button | `base/button/` | `intent="primary"` reserve, `intent="danger"` cancel, `intent="outline"` disabled reserved |
| Badge | `base/badge/` | Priority (`tone="neutral" badgeStyle="subtle"` + `PRIORITY_DISPLAY.colorClass`), „Obdrženo" |
| LikeButton | `blocks/gift/LikeButton.svelte` | Action area heart + count (`size="md"`; consider a `lg` sticker size per round-2 delta) |
| ReserveButton | `blocks/reservation/ReserveButton.svelte` | Reserve / cancel / fully-reserved logic as-is |
| PurchasedToggle | `blocks/reservation/PurchasedToggle.svelte` | Reserved-by-me state |
| ReservationBadge | `blocks/reservation/ReservationBadge.svelte` | Image-corner overlay in card-like compositions (variant B) |
| GiftImage | `blocks/gift/GiftImage.svelte` | `target="square"` (today `"detail"` – switch) |
| GiftPieceCount | `blocks/gift/GiftPieceCount.svelte` | Qty > 1 beside title, role-conditional, `hideWhenOne` |
| GiftLinkList | `blocks/gift/GiftLinkList.svelte` | Stacked links, primary first, „Bez odkazu" empty state |
| GiftDescription | `blocks/gift/GiftDescription.svelte` | Description + appends; hosts the integrated badge (REQ-2) |
| GiftEditedBadge | `blocks/gift/GiftEditedBadge.svelte` | Tag form inside the append header (new placement prop or composition) |
| `deriveGiftDisplayState` | `modules/gifts/gift_display_state.ts` | Role gating single source |
| `formatPrice`, `getPriorityDisplay`, `formatReserverLine` | `modules/gifts/gift_display.ts` | Facts row |
| `giftDetailModalVariants` | `blocks/gift/gift_detail_modal_variants.ts` | Extend with view-mode slots (actionBar, mediaSquare); do not disturb edit-mode slots |

### Components to adopt

None – all primitives exist.

### Components to design (new)

| Component | Description | Why new |
| --------- | ----------- | ------- |
| `GiftDetailActionBar.svelte` (proposed) | Role-aware action row: like + availability + reserve/cancel/purchased; sticky on mobile | Composition repeats across states; keeps the recipient-invariant in one place for the view mode |

---

## 6. Layout Constraints & Aspect-Ratio Strategy

- **Desktop modal width**: content-driven per variant (A ~860 px 2-col, B ~460 px vertical, C ~800 px asymmetric); `max-h-[90dvh]`, right/content region scrolls, action bar pinned.
- **Image = `square` target everywhere.** The modal joins the card/list/reservation 1:1 family. Consequence for the crop editor (flagged, not designed here): the separate `detail` editor target (1:2, kept by #163) loses its only consumer. Recommended: retire `detail` from `GIFT_EDITOR_CROP_TARGETS` the same way `card` was retired – legacy `targets.detail` metadata stays parseable, surfaces fall back to `square`/auto framing. The gift editor then offers exactly one crop tile (square), and its big preview stage becomes the square target.
- **Square rendering rule**: `img`/frame keeps `aspect-ratio: 1/1`; containers stretch with mat fill; height clamps center the square (REQ-5).
- **Mobile (≤ 640 px)**: full-width sheet, hero clamp ~42vh, sticky action bar with opaque background + top border, content scrolls behind it.
- **Spacing**: 8 px rhythm (`--s1..--s4`); panel radius 16 px; buttons 7 px; borders 2.5 px ink.
- **Typography**: DynaPuff headings (title clamp 22–30 px), Geist body 14–16 px, price 20–24 px bold brand.

---

## 7. Design Tokens

`src/app.css` is canonical; mockups mirror the sky palette primitives from `designs/redesign-2026/sky-final/*` (`--p-brand #1E9BE9`, `--p-ink #16385C`, `--p-accent #FFC93C`, derived via `color-mix(in oklab, …)`).

- Surfaces: `--surface` (brand 11 % on white), `--panel` white, dotted mat `--pattern-dot`.
- Stickers: `--shadow-sticker` 4px 4px 0, lift 7px 7px 0, ink borders.
- Semantic: `--heart` like, `--tag-edited-bg` update tag, accent append tint, `--reserved-veil` for dimmed fully-reserved, `--link` purple links.
- Motion: 200 ms standard, spring `cubic-bezier(.34,1.56,.64,1)` lifts, `prefers-reduced-motion` gated.

---

## 8. Design Constraints (Non-Negotiable)

1. **Recipient never sees reservation or like state** – no action bar, no availability, no reserver names, no like count in the recipient view. API strips; UI must not render.
2. Post-share edits surface uniformly (never reservation-conditional); the badge reads „Upraveno po sdílení" and is driven by `editedAfterShareAt`.
3. Reserve/cancel logic stays in `ReserveButton`; quantity + anonymous identity stay in `ReserveModal`.
4. Square (1:1) displayed crop; frames may stretch, crop may not (REQ-5).
5. Edit mode (`GiftDetailForm`) layout and its `detail` column are out of scope – do not regress #116/#131/#142 behavior.
6. Czech copy: no em-dashes – comma, colon, or spaced en-dash.
7. Close button design (cross-in-circle, rotate on hover) belongs to issue #164 – render it, do not respec it.
8. WCAG AA contrast; touch targets ≥ 44 px; focus visible (dashed ink ring).

---

## 9. Design Freedom

- Composition axis (the 3 variants): 2-col sticker split vs vertical enlarged-card vs asymmetric overlap/timeline.
- Like placement: action bar sticker button vs image-corner overlay (card parity).
- ~~Availability note copy and placement; reserved-by-me banner treatment~~ – settled by refinement: no availability copy anywhere, reservation status (own + others') is a photo overlay, the bar never carries status.
- Fully-reserved dimming strength (veil vs desaturation vs both).
- Whether the price/priority row sits above or below links.
- Update-strip visual (left accent bar vs timeline node vs taped note) – as long as the badge is inside it.

---

## 10. Visual References

- **Target language**: `designs/redesign-2026/sky-final/anime-gift-detail-modal.html` (sticker modal, action bar, desc-append, states) + `anime-sky-final.html`.
- **Visual sibling**: `designs/gift-card-v2/refined.html` + `variants/variant-d.html` (accepted #163 mobile hierarchy: big square image, heart overlay, info control).
- **Prior rounds**: `designs/gift-detail-modal/refined.html` (v1 visitor states), `refined-v2.html` (edit-mode multi-link – unchanged).
- **Current broken state**: `.mpx/board-files/Pasted image 20260716082938.png`.
- Tokens: `designs/tokens.css` (structural), `src/app.css` (canonical).

---

## 11. Not Included (Scope Exclusions)

- Edit mode (`GiftDetailForm`) – v2 brief governs it.
- Close-button interaction spec – issue #164.
- Gift card / list row changes – issue #163 (already accepted as variant-d).
- Crop-editor rework implied by retiring the `detail` target – flag for #163/#165 implementation, not mocked here.
- Reservation quantity/anonymous flow (`ReserveModal`) – unchanged.
- Comments, price tracking, per-field edit diffs – deferred per v1/v2 briefs.

---

## 12. Decisions Taken (revisit if needed)

Defaults picked without reopening settled questions:

1. **Modal image target = `square`, `detail` editor target recommended for retirement.** #163's uncommitted work deliberately keeps the narrow 1:2 `detail` tile; #165 makes the modal squarish, leaving that target consumer-less. Chosen: reuse `square` (true enlarged-card WYSIWYG, one crop to teach users) over retuning `detail` to ~1:1 (two near-identical crops). Tension flagged in §6.
2. **Badge without append**: when `editedAfterShareAt` is set but no description append exists, render a text-free update strip in the description section rather than any title-adjacent placement.
3. **Reserved-by-me includes „Koupeno"** (`PurchasedToggle` exists in production; sky reference shows it) even though an early 2026-05-29 decision said no bought step – the component ships, so the design keeps it.
4. **Recipient view hides the like control entirely** (issue text: recipient „sees no reservation or like state"). If later product direction wants recipients to see like counts, only the action bar gating changes.
5. **Mobile hero clamp ~42vh** – keeps title + first facts + sticky bar visible on a 390×844 viewport without scrolling.
6. **Reserve keeps opening `ReserveModal`** (quantity/anonymous) instead of inlining the form – smaller scope, consistent with cards.
7. **Light mode only in mockups** – dark derives from tokens (settled 2026-05-30 / 2026-07-10).
