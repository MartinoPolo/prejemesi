# Linked Gift Copies — Design Brief

> **Status**: Refined (Variant A) **Refined mockup**: `designs/linked-gift-copies/refined.html`
> **Summary**: `designs/linked-gift-copies/SUMMARY.md` **Refinements**: none, Variant A adopted as is

Copies of one recipient's gift on several wishlists (typically a permanent list and its Vánoce or birthday list) stay linked: reservations, received state and shared fields sync, so nobody buys the same wish twice. This brief covers every surface that creates, shows or breaks that link.

**Source**: [#742](https://github.com/MartinoPolo/prejemesi/issues/742) (decisions in the Issue body and `.mpx/DECISIONS.md`, entries dated 2026-11-25). Related: #737 (shared gifts across recipients, out of scope).

---

## 1. Purpose

A manager copies gifts from „Stálý seznam“ into „Vánoce 2026“. Today the copies drift apart: a Vánoce gifter reserves the LEGO set, but the permanent list still offers it. With linking, the manager answers three questions at a glance: _Is this gift linked? Where else does it live? Why is it reserved when nobody reserved it here?_ Visitors only notice that the reserved state is correct.

**Key value**: one wish, one reservation, wherever the recipient listed it.

---

## 2. Surrounding Context

The mockup shows four scenes, each at full viewport (~1440×900 desktop, plus 390×844 mobile for scenes A and B).

### Scene A — wishlist page with linked gifts (Card view, manager)

- App shell top bar and wishlist hero (FINAL, reproduce from `designs/gift-hierarchy` / live app): hero frame, title „Vánoce 2026“, occasion chip, toolbar (view switcher Card/List, filters, sort, More).
- Content column `max-width: 1200px`, `--page-gutter` 16px; Card grid `repeat(auto-fill, minmax(280px,1fr))`, gap 20px → 3 columns at 1440.
- Show 6 cards: 2 linked unreserved, 1 linked reserved on another list („Rezervováno na jiném seznamu“), 1 linked with own reservation („Rezervováno vámi“), 1 unlinked reserved by a named gifter („Rezervoval(a) Petr“), 1 unlinked with categories + priority to prove the chip coexists with crowded overlays.
- Repeat Scene A in **List view** (desktop) and **mobile Card + List** (390 px, single column).

### Scene B — bulk copy dialog

- Parent: wishlist page with selection mode active (selection toolbar visible, 3 gifts checked) dimmed behind the dialog (FINAL).
- `Dialog.Content size="sm"` (`max-w-sm`, 384 px) on desktop; `WishlistBottomSheet` (`max-h-[80dvh]`) on mobile.
- The new „Propojit kopie“ control is the only design work; everything else is FINAL.

### Scene C — gift editor with linked copies

- `GiftDetailModal` (`sm:max-w-[1100px]`, `sm:h-[85dvh]`), two columns: rail left (`minmax(15rem,18.75rem)`: preview, image URL, image strip), fields right (FINAL).
- New: a linked-copies section in the fields column after `GiftCategoryField`, and „Odpojit“ handling. Mobile: near-full-screen modal, single column.

### Scene D — unlink confirmation

- `ConfirmDialog size="md"` over the editor or the wishlist page.

**What the parent provides**: app shell, hero, toolbar, grid/list layout, dialog chrome, footer actions. **What this design fills**: the link chip and its popover, the reserved-elsewhere state, the dialog checkbox, the editor section, the unlink confirm. **Excluded**: hero, toolbar, filters, selection toolbar.

**Mockup rendering instructions**:

- Style with compiled app CSS or custom properties copied from `src/app.css`; never link `designs/tokens.css`.
- Real Czech copy; vykání; no em dashes in visible text.
- Light mode primary; include one dark-mode frame of Scene A.

---

## 3. Requirements

### 3.1 Who sees what

| Viewer                                    | Link chip + linked list names | Reserved count across copies                         | Gifter names                                                                 |
| ----------------------------------------- | ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Správce                                   | Yes                           | Yes                                                  | Only for reservations made on this list; otherwise „Rezervováno na jiném seznamu“ |
| Linked recipient (not self-promoted)      | Yes                           | No (no reservation state at all, as today)           | No                                                                           |
| Self-promoted recipient                   | Yes                           | Only reservations made on lists where they self-promoted | No                                                                       |
| Visitor / gifter                          | **No** (no chip, no names)    | Yes, as an ordinary reserved/partial state           | No                                                                           |

### 3.2 Link chip on Card and List

- Shown on every linked gift for managers and the recipient. Label „Propojeno“ with a link icon (lucide `Link2`); compact form may be icon + count of other lists (e.g. „2“) when space is tight.
- Activating it (click/tap/Enter) opens a popover „Také na seznamech“ listing each other list: title, occasion badge, status (Koncept / Sdíleno / Archivováno), each a link to `/w/<id>`. Footer of the popover: „Upravit propojení“ opens the editor section (Scene C).
- Must coexist with category badges, Like, live-preview badge, priority badge and the centered state overlay without overlap at 280 px card width and on the mobile List row.
- Archived or deleted linked lists: archived ones are listed with „Archivováno“; deleted ones are not listed.

### 3.3 Reserved-elsewhere state

- New label for the existing `unavailable` state badge when the reservation was made on another linked list and the viewer is a správce: „Rezervováno na jiném seznamu“. Partial reuses „Volné {remaining}/{total}“.
- A gifter whose own reservation lives on another copy sees the normal „Rezervováno vámi“ and can cancel / mark bought here.

### 3.4 Bulk copy dialog

- New `Checkbox` „Propojit kopie“ with `HelpText` „Rezervace, přijetí a úpravy dárku se budou sdílet mezi seznamy.“ below the destination select, above the existing move checkbox.
- Default on when the destination has the same linked recipient or an identical free-text recipient name; off and disabled for other recipients, with help text „Propojit lze jen seznamy stejného obdarovaného.“ Hidden until a destination is chosen; „Nový seznam…“ (created for the same recipient) defaults on.
- With move and linking both on, the move checkbox help reads „Rezervované dárky zůstanou a propojí se s kopiemi.“ in place of „Rezervované dárky zůstanou.“
- Success toast appends „Propojeno: {count}“.

### 3.5 Editor section „Propojené kopie“

- Lists every other copy: list title (link), occasion, status, and per row an „Odpojit“ action for that copy. Note: „Název, popis, odkazy, cena, počet, obrázky, kategorie a přijetí se sdílí. Priorita a pořadí jsou pro každý seznam vlastní.“
- When any copy is frozen (shared occasion list or reserved), show why the name is locked: „Název je uzamčen, protože kopie na seznamu {title} je sdílená.“ (reuse the existing post-share lock styling of `GiftNameField`).
- Hidden when the gift is not linked.

### 3.6 Unlink confirm

- `ConfirmDialog`, title „Odpojit kopii?“, description „Dárek na seznamu {title} se přestane synchronizovat. Rezervace a stav přijetí zůstanou, jak jsou.“, confirm „Odpojit“, `confirmIntent="primary-destructive"`, pending „Odpojuji…“. Also reachable from the gift More menu as „Odpojit kopie“ (unlinks this copy from its group).

### 3.7 Edge cases

- Group of 3+ copies: chip count and popover list scale; popover scrolls past 5 rows.
- Long list titles: truncate with ellipsis, full title in `title` attribute.
- Received linked gift: received band/overlay as today; chip still visible to managers.
- Mobile: chip must not push the two-line title clamp; popover becomes a `WishlistBottomSheet`.

---

## 4. States

| State                      | Visual Treatment                                             | Trigger                                   |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------------- |
| Unlinked                   | No chip                                                      | Gift has no group                         |
| Linked, default            | „Propojeno“ chip                                             | Manager/recipient views linked gift       |
| Linked, hover/focus        | Chip hover per Badge/Button hover; focus ring                | Pointer / keyboard                        |
| Popover open               | „Také na seznamech“ list                                     | Chip activated                            |
| Reserved elsewhere         | `unavailable` badge „Rezervováno na jiném seznamu“           | Správce; reservation on other copy        |
| Own reservation elsewhere  | `own-reservation` badge „Rezervováno vámi“                   | Gifter reserved another copy              |
| Partial across copies      | `partial` badge „Volné 1/2“                                  | Group reservations < quantity             |
| Dialog: link on            | Checked checkbox + help                                      | Same-recipient destination                |
| Dialog: link unavailable   | Disabled unchecked checkbox + reason                         | Different recipient                       |
| Dialog: submitting         | Existing „Upravuji {count} dárků…“                           | Confirm clicked                           |
| Editor section             | Rows with Odpojit                                            | Linked gift in edit mode                  |
| Unlink pending / error     | Confirm spinner; error toast keeps dialog open               | Unlink request                            |
| Dark mode                  | Same, palette tokens                                         | Dark theme                                |

---

## 5. Component Reuse Map

### Existing components (use these)

| Component                                      | Variant/Props                                                        | Usage in this design                   |
| ---------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| `Badge` (`base/badge`)                         | `tone="neutral"\|"info"`, `badgeStyle="overlay"\|"subtle"`           | Link chip candidate                    |
| `Popover` (`base/popover`)                     | `Root/Trigger/Content`                                               | „Také na seznamech“ on desktop         |
| `OverflowChips` (`derived/overflow-chips`)     | popover pattern                                                      | Reference for chip → popover behaviour |
| `GiftStateOverlay` + `giftStateBadgeVariants`  | `kind="unavailable"\|"own-reservation"\|"partial"`                   | Reserved-elsewhere state               |
| `GiftCategoryBadges`, `GiftPriorityBadge`, `LikeButton` | as today                                                    | Crowded-overlay context                |
| `Checkbox`, `Label`, `HelpText`                | as in `GiftBulkCopyDialog` move control                              | „Propojit kopie“                       |
| `Dialog.Content size="sm"` / `WishlistBottomSheet` | as today                                                         | Copy dialog                            |
| `GiftDetailModal` / `GiftDetailForm`           | edit mode                                                            | Editor section host                    |
| `ConfirmDialog` (`derived/confirm-dialog`)     | `confirmIntent="primary-destructive"`                                | Unlink confirm                         |
| `Button`                                       | `intent="outline"` / `"danger"`                                      | Odpojit row action                     |
| `GiftContextActions`                           | new item in `gift` group                                             | „Odpojit kopie“                        |
| `SimpleTooltip` (`base/tooltip`)               | `text`                                                               | Icon-only chip label                   |

### Components to adopt

None.

### Components to design

| Component              | Description                                    | Why new                                         |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------- |
| `GiftLinkChip`         | Chip + popover/sheet listing linked lists      | No existing chip conveys a cross-list relation  |
| `GiftLinkedCopiesSection` | Editor section with per-copy unlink         | Editor has no relation section                  |

---

## 6. Layout Constraints

- Card min width 280 px (13.5 rem when 4/5 columns chosen); chip fits in the top overlay row or content column without wrapping category badges.
- Mobile List row: chip may not add a row above the title; title and description stay clamped to two lines.
- Copy dialog stays `max-w-sm`; the new control matches the move control's checkbox + label + help geometry.
- Editor section uses the fields column width; spacing matches sibling fields.
- Control heights 26/32/38 px; touch targets ≥ 44 px on mobile via hit-area padding, not visual size.

---

## 7. Design Tokens

From `src/app.css`:

- Fonts: `--font-head` (DynaPuff) for dialog titles, `--font-body` (Geist) everywhere else.
- Type: `--text-xs` 11 / `--text-sm` 12 for chips, `--text-base` 14 for body, `--text-xl` 17 for dialog titles.
- Shape: `--radius-badge` 12 px, `--radius-btn` 7 px, `--radius-panel` 16 px, `--border-w` 2.5 px, `shadow-sticker` for overlay badges.
- Color: `--primary`, `--primary-soft`, `--accent`, `--muted`, `--muted-foreground`, `--border`, `--ink`; destructive via `primary-destructive`. The link chip must not reuse category colours or the received/reserved state colours, so it never reads as a category or a reservation.

---

## 8. Design Constraints (non-negotiable)

- Visitors never see the chip, the popover, or any other list's name.
- Gifter names follow 3.1; never show a gifter name from another list.
- Dialogs: exactly one solid button, rightmost; unlink confirm is `primary-destructive`.
- Gift action footer lane and image-corner overlay positions stay as decided (DECISIONS „Wishlist browsing & actions“); the chip must not displace Reserve/Received/More.
- Reuse primitives under `src/lib/components/base/`; vykání; no em dashes.
- Keyboard: chip is a focusable button with an accessible name „Propojeno se seznamy: {titles}“.

---

## 9. Design Freedom

- Chip placement: top overlay row with categories, beside the title, near the price line, or in the footer lane's leading edge.
- Chip form: text badge, icon-only sticker with tooltip, or icon + count.
- Popover content density and whether it shows reservation summary per list for správci.
- Editor section placement within the fields column (after categories vs. above the name as a banner).
- Motion within `mpx-ui-motion` values for popover open and chip appearance.

---

## 10. Visual References

- **Internal**: `src/lib/components/blocks/gift/GiftCard.svelte`, `GiftListItem.svelte`, `GiftStateOverlay.svelte`, `GiftCategoryBadges.svelte`, `src/lib/components/blocks/wishlist/GiftBulkCopyDialog.svelte`, `GiftDetailForm.svelte`; briefs `designs/multi-category-badges/`, `designs/wishlist-gift-actions/`, `designs/gift-editor-rebuild/`.

---

## 11. Not Included (scope exclusions)

- Gifts shared between different recipients (#737).
- In-app linking of existing copies; the owner's family lists use a one-off backfill.
- Per-gift „copy to list“ action (copy stays in the selection toolbar).
- Agent API surfaces (no UI).
