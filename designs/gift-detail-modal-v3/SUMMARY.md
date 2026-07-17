# Gift Detail Modal v3 — Design Summary

**Base**: Variant A (Sticker split) | **Refined**: 2026-07-16

## Refinements Applied

Variant A was chosen and refined with: long-description handling via internal scroll, a two-element single-line action bar, all reservation status relocated to photo overlays, reworked state matrix, component style gap check (priority badge, links, like button). See the design brief for full requirements. Key changes from the base variant: the modal body became a bounded scroll region (grid rows `minmax(0,1fr) auto`) with scroll shadows and a permanently pinned action bar; every status text, availability note and toggle left the bar — the bar is exactly like (left) + primary action (right) in all states; reservation status (others' AND own) renders once as a photo overlay, with the „Koupeno" toggle stacked under the own-reservation note.

### Long-description strategy (decision + rationale)

**Chosen: internal scroll region with the action bar always visible** (no clamp, no „Zobrazit více").

- The modal is the app's designated "read everything" surface — cards already truncate; adding a second truncation inside the detail would force one more tap for zero saved space (the modal is `90dvh`-capped either way).
- `GiftDescription` already renders the full text in the modal today; there is no clamp mechanism to reuse, and the append history already has its own expand toggle — nesting two expanders would be confusing.
- The pinned bar makes action usability independent of content length: desktop pins it as the grid's `auto` row outside the scroll region; mobile keeps the sticky opaque bar at the sheet bottom.
- Scroll affordance: fade/scroll shadows at the top/bottom edges of the scroll region (mockup uses the `background-attachment: local` trick; in Svelte this can be a small CSS utility or skipped — the cut-off text line itself signals scrollability).

Verified in `refined.html`: desktop capped modal with a 4-paragraph description scrolls internally (222 px overflow in the demo) with the bar pinned; the 390 px long-description sheet keeps the sticky bar fully visible while content scrolls behind it.

### Action bar / state composition rules (final, post-review iteration)

User review verdict applied: the bar must never be multi-line and must not carry status information. Final rules:

1. **The bar has at most two elements, on a single line, in every state and viewport**: `LikeButton` always leftmost (`margin-right: auto`), primary action (Rezervovat / Zrušit rezervaci) always rightmost. Nothing else ever renders in the bar — no availability text, no status notes, no `PurchasedToggle`.
2. **Removed as redundant**: „Volné k rezervaci" (an active „Rezervovat" button already says it; quantity availability stays visible via `GiftPieceCount` beside the title) and the textual „Rezervováno vámi" bar note (an active „Zrušit rezervaci" button already communicates it).
3. **Relocated to the photo overlay stack** (`.photo-overlays`, top-left over the mat) — ALL reservation status. Reserved-by-others: „✓ Rezervováno" + „rezervoval {name}" (text switches to „🛍 Koupeno" when purchased), content dimmed (not the overlay), bar keeps **only the like button**. Reserved-by-me: „✓ Rezervováno vámi" note + the interactive `PurchasedToggle` („🛍 Koupeno") stacked under it, content **not** dimmed, bar = like + danger „Zrušit rezervaci".
4. **Obdarovaný**: no action bar at all (no like, no availability, no reserver names).
5. **Never wraps at 390 px**: two elements with `flex`, like `margin-right:auto`, `flex:1` primary — verified incl. the longest label „Zrušit rezervaci".

## Component Map

### Codebase — Use As-Is

| Component | Path | Usage | Key Props/Variants |
| --------- | ---- | ----- | ------------------ |
| Dialog | `src/lib/components/base/dialog/` | Modal shell, focus trap, Esc, scroll lock | — |
| Button | `src/lib/components/base/button/` | Reserve / cancel in the bar | `intent="primary"`, `intent="danger"` |
| ReserveButton | `src/lib/components/blocks/reservation/ReserveButton.svelte` | Reserve/cancel logic; **fully-reserved disabled branch is not rendered in the modal bar** (overlay carries the status) | as-is |
| PurchasedToggle | `src/lib/components/blocks/reservation/PurchasedToggle.svelte` | Photo overlay stack (reserved-by-me), stacked under the „Rezervováno vámi" note — never in the action bar | as-is functionally; pill gains sticker shadow (`shadow-sticker-sm`) + `-rotate-3` in the overlay placement |
| GiftImage | `src/lib/components/blocks/gift/GiftImage.svelte` | Photo sticker | `target="square"` (today `"detail"` — switch) |
| GiftPieceCount | `src/lib/components/blocks/gift/GiftPieceCount.svelte` | Qty beside title | `hideWhenOne` |
| GiftDescription | `src/lib/components/blocks/gift/GiftDescription.svelte` | Description + appends, hosts integrated badge | `maxVisibleAppends={null}` |
| GiftEditedBadge | `src/lib/components/blocks/gift/GiftEditedBadge.svelte` | Tag form inside the append header | tag (non-compact) form |
| `deriveGiftDisplayState` / `gift_display.ts` helpers | `src/lib/modules/gifts/` | Role gating, price, priority, reserver line | as-is |

### Restyle Existing (explicit — IN SCOPE for issue #165 implementation)

| Component | Current state | Verdict | Exact change |
| --------- | ------------- | ------- | ------------ |
| Priority badge | `GiftDetailView.svelte` renders `<Badge tone="neutral" badgeStyle="subtle" class={priorityInfo.colorClass}>` — borderless tinted pill | **Restyle** | In the modal view switch to the sticker pill: `badgeStyle="outlined"` (tone `neutral` supplies `border-ink`), add `-rotate-1` to `class` alongside `priorityInfo.colorClass`, render a `StarIcon` via the Badge `icon` snippet, and use the long label „Priorita · {priorityInfo.label()}". Keep the per-priority hue tints in `PRIORITY_DISPLAY` (`src/lib/modules/gifts/gift_display.ts`) unchanged — the mockup's amber comes from the sky reference tag; the mockup is authority for **shape**, the existing tints stay authority for **hue**. Cards/list rows untouched. |
| Gift links | `GiftLinkList.svelte` renders compact ~26 px tag chips (rounded-full, `border-2 border-ink`, `text-[11.5px]`) — below 44 px touch target, card-scaled | **Restyle (extend)** | Add a `display: 'chip' \| 'row'` variant (default `chip` keeps cards/list unchanged; prefer a `gift_link_list_variants.ts` tv() per project convention). `row`: full-width `flex min-h-11 items-center gap-2.5 rounded-[10px] border-2 border-ink bg-card px-3 text-sm transition hover:bg-link-tint hover:shadow-sticker-sm motion-safe:hover:-translate-y-0.5`; leading **domain pill** reusing the current chip styling (`rounded-full border-2 border-ink bg-link-tint px-2.5 text-[12.5px] font-extrabold text-[color:var(--link)]` + `ExternalLinkIcon` + domain); trailing **title** `truncate font-semibold text-ink-soft` showing `link.label ?? link.url`. Modal passes `display="row"` with `maxVisible={10}`. |
| Like button | `like_button_variants.ts` — ghost chip (`border-transparent`, sizes `sm`/`md`), hover tint + scale | **Restyle (extend)** | Add an `appearance: 'ghost' \| 'sticker'` variant (default `ghost` keeps cards unchanged) and a `lg` size. `sticker` root: `border-ink bg-card rounded-[7px] shadow-sticker hover:bg-like-tint motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-100`; `lg`: root `min-h-11 min-w-11 gap-2 px-4 text-base`, icon `size-5`, count `text-sm`. Modal action bar uses `<LikeButton size="lg" appearance="sticker">` (the brief's round-2 delta already anticipated this). |
| Reservation overlay | `ReservationBadge.svelte` is a subtle inline `Badge` (`bg-reserved/15`), not an overlay | **Restyle (extend)** | Add an overlay presentation for the modal photo (either an `overlay` prop on `ReservationBadge` or inside the new media composition): an absolutely positioned top-left **stack** (`.photo-overlays`: grid, gap, `justify-items:start`) over the photo mat. Note styling: `--reserved-note-bg`-style tint, `border-2 border-ink rounded-[10px] shadow-sticker-sm -rotate-3 font-extrabold text-reserved`. Covers BOTH cases: reserved-by-others („✓ Rezervováno" + „rezervoval {name}" via `formatReserverLine`; „🛍 Koupeno" text when purchased) and reserved-by-me („✓ Rezervováno vámi" with the interactive `PurchasedToggle` slotted beneath). Must sit **outside** the dimmed wrapper (dim the photo and body separately) so it stays crisp. |

### Adopt from shadcn-svelte / Bits UI

None — all primitives exist; nothing installed.

### Build Custom

| Proposed Name | Description | Why existing components don't cover it |
| ------------- | ----------- | -------------------------------------- |
| `GiftDetailActionBar.svelte` | Two-element role-aware action bar: like left, primary action right, single line, nothing else; renders nothing for recipient; like-only when someone else holds the reservation; sticky opaque bar with top ink border on mobile. Also owns the photo-overlay status composition (status note + `PurchasedToggle` placement) so all reservation-state presentation lives in one place | The rules repeat across 5 states and the recipient invariant must live in exactly one place for the view mode |

## Implementation Notes

- **Scroll structure** (`giftDetailModalVariants`): add view-mode slots instead of reusing the edit-mode `body` — drop `sm:min-h-[520px]` for the read-only view (REQ-1), desktop grid `340px minmax(0,1fr)` columns + `minmax(0,1fr) auto` rows, content region `overflow-y-auto`, action bar in the `auto` row. Do not disturb edit-mode slots (#116/#131/#142).
- **Mobile hero clamp**: `max-height: min(100vw - padding, ~42vh)`, `min-height` ~240 px; square centers on the dotted mat when clamped (REQ-5).
- **Dimming (fully reserved)**: apply `opacity .55 + grayscale(.45)` to the photo and content nodes separately, never to a shared parent of the overlay — a child cannot exceed parent opacity.
- **No disabled reserve button, no bar status copy**: in the fully-reserved modal bar the `ReserveButton` disabled branch is suppressed and no availability/status text renders anywhere in the bar; status lives on the photo overlay only. Bar layout: `flex` + `justify-content:flex-end`, like `margin-right:auto`, mobile primary `flex:1` — two elements cannot wrap at 390 px (verified incl. „Zrušit rezervaci").
- **Close button**: cross-in-circle with hover rotation rendered for coherence — spec belongs to issue #164.
- **Deviation from skill template**: `refined.html` inlines the sky tokens instead of linking `../tokens.css`, matching prior rounds (gift-card-v2, gift-detail-modal v1/v2) so the file stays portable/self-contained.
- **Out of scope flag (unchanged from brief §6)**: switching the modal to the `square` target leaves the `detail` editor crop target consumer-less — retirement recommended, coordinate with #163.
