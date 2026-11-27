# Shared gifts — Design Brief

> **Status**: Refined (Variant B) **Refined mockup**: `designs/shared-gifts/refined.html`
> **Summary**: `designs/shared-gifts/SUMMARY.md` **Refinements**: recipient avatars, explaining popover on the shared badge, explicit shared quantity, „Jak to funguje?“ section help

A shared gift is one gift that sits on the wishlists of two or more different recipients, such as one LEGO set two siblings will build together. Gifters reserve it once from any of those lists, and every list shows it as shared and with whom. The design must make "this one is shared, with Anička" obvious at a glance without crowding the gift card, and give managers a calm way to share a gift from the editor or in bulk.

**Source**: [#737](https://github.com/MartinoPolo/prejemesi/issues/737) (Decisions section is authoritative). Related: [#742](https://github.com/MartinoPolo/prejemesi/issues/742) reuses the same placement model for one recipient's lists; keep the visual language reusable for it.

---

## 1. Purpose

Today a wish shared by siblings is duplicated on both lists and can be bought twice. With shared gifts a visitor on Tomáš's list sees the LEGO set once, in a „Společná přání“ section, labelled „Společně s Aničkou“-style with the other recipient's name, and reserving it closes it on Anička's list too. A parent who manages both children's lists turns a gift into a shared one from the gift editor or from selection mode.

Questions the UI answers at a glance:

- Visitor: "Is this gift just for this child, or for them together with someone else?"
- Manager: "Which of my gifts are shared, with which lists, and can I still change that?"

**Key value**: one physical gift, one reservation, visible on every child's list without confusion.

---

## 2. Surrounding Context

The mockup **must** show the full wishlist page with all chrome at correct proportions.

### Full viewport structure (desktop ~1440×900)

Top to bottom, all FINAL (reproduce faithfully, reduced emphasis):

1. **Navbar** (`src/lib/components/blocks/navbar/Navbar.svelte`): logo, Moje seznamy / Spravované / Sledované pills, palette control, notifications, avatar. Full width, content aligned to the 1200 px content column.
2. **Wishlist hero**: Blok frame (spiral notebook, taped polaroid), „Pro: Tomáš“ above the title „Tomášovy Vánoce“, postage stamp „Vánoce · za 29 dní“. Settings gear + More in the hero.
3. **Sticky toolbar card**: View switcher (Karta / Seznam), Display control, More, primary „Přidat dárek“ rightmost.
4. **Gift collection** (the focus): sections in this order, each with `GiftSectionHeader` (uppercase DynaPuff label, count, hairline rule):
   1. „Vaše rezervace“ (only for a visitor/správce with own reservations)
   2. The recipient's own gifts, ungrouped or in priority/category groups as today
   3. **„Společná přání“** — NEW, designed here
   4. „Obdržené“ (when the received filter shows received gifts)

**What the parent provides**: navbar, hero, toolbar, section headers, card grid tracks (`repeat(auto-fill, minmax(min(100%, 280px), 1fr))`, gap 20 px from 640 px). **What this design fills**: the „Společná přání“ section and the shared badge on cards/rows; the gift editor field; the bulk share dialog; the Gift viewer line. **Excluded — belongs to the parent**: navbar, hero, toolbar, Display sheet, other sections' content.

### Other surfaces

- **Gift editor** (`GiftDetailModal` + `GiftDetailForm`, ~1100 px wide, 85dvh, `designs/gift-editor-rebuild/refined.html`): left rail preview, right column fields Název → Popis → Odkazy → Cena | Měna | Počet kusů | Priorita → Kategorie. The new „Společně s“ field is added at the end of the right column.
- **Selection mode** (`WishlistSelectionToolbar`): „Vybráno N“ + Actions dropdown (desktop, cascading submenus) or „Akce“ bottom sheet (mobile). The new bulk action opens a dialog modelled on `GiftBulkCopyDialog` (Dialog on desktop, Sheet below 640 px).
- **Gift viewer** (`GiftViewer`): caption shows title, price/quantity, categories row, links, description.

**Mockup rendering instructions**:

- Desktop frame ~1440×900 and phone frame ~390×844 side by side or stacked; light mode, default palette.
- The „Společná přání“ section must be visible above the fold on desktop: show 3–4 own gifts, then the section with 2 shared gifts.
- Show the gift editor and bulk share dialog as separate frames over a dimmed page.
- Use real Czech copy (vykání, no em dashes).

---

## 3. Requirements

### 3.1 „Společná přání“ section

- Holds every shared gift of this wishlist that is not pinned in „Vaše rezervace“ and not received (received shared gifts go to „Obdržené“, keeping the badge).
- Appears after all of the recipient's own gifts and groups in every grouping (none / priority / category) and in Card, List and Carousel (its own row and jump chip in Carousel).
- Inside it, the active sort and the reservation bands (available before fully reserved for visitors) apply; no priority/category sub-grouping.
- Header: `GiftSectionHeader` with label „Společná přání“, gift count and a „Jak to funguje?“ text button that opens the same explanation as the badge popover (one gift, one reservation for everyone, quantity is a shared total). The section sits in a subtle tinted band with the line „Tyto dárky si přeje Tomáš společně s dalšími.“ Hidden when the section is empty.
- Category and priority badges still show on shared cards at their usual positions (priority is this list's own placement value; categories are shared).

### 3.2 „Společně s“ badge

- Every shared gift card, list row, carousel card, and its Gift viewer caption names the other participating recipients: „Společně s Aničkou“ is NOT allowed (names are never declined, decision 2026-11-16); use „Společně s: Anička“, „Společně s: Anička a Petr“, „Společně s: Anička, Petr a 1 další“.
- Every badge shows the participating recipients' avatars (photo, else initials).
- The card badge is a small button that opens an explanation Popover (hover on desktop, tap on touch, focus + Enter/Space; below 640 px a bottom sheet) without opening the gift, like the category „+X“ popover (`data-prevent-gift-card-open`). Contents:
  - Title „Společné přání“ and an avatar row of all participating recipients, this list's recipient first.
  - Visitor and správce: „Tento dárek si přejí Tomáš a Anička společně. Když ho zarezervujete, darujete ho oběma najednou, ne každému zvlášť.“ (3+ recipients: „… darujete ho všem najednou …“).
  - Quantity, always explicit: „Počet: 1 ks pro oba dohromady“; above 1 „Počet: 3 ks celkem pro oba dohromady, ne 3 ks pro každého“; visitors also see progress „Zarezervováno 1 z 3 ks“.
  - Linked recipient of any participating list: „Tento dárek si přejete společně s: Anička. Dárci ho rezervují jednou pro vás oba.“ plus the quantity line, never reservation state.
- Visitors see names only. A manager who can open the other list also gets a link with that list's title, in the popover, viewer and editor.
- Must fit next to existing badges: category top-left, Like top-right, priority bottom-left, gallery count bottom-right, state badges centered. It must never overlap the centered state badges.
- Shown also in „Vaše rezervace“ and „Obdržené“, since the gift there is outside its section.
- Narrow cards (carousel ~150 px, mobile two-column Card): the badge truncates to „Společně s: Anička +1“ or an icon + first name; full names remain in the accessible name and the Gift viewer.
- Quantity above 1 is shown on the shared card itself as „3 ks dohromady“, because the quantity is one shared total, not per recipient.

### 3.3 Gift editor: „Společně s“ field

- Last field of the right column, after Kategorie. Label „Společně s“, help text: „Dárek se objeví i na vybraných seznamech. Rezervovat ho půjde jen jednou.“
- Second help line: „Počet kusů je společný: 3 ks znamená 3 ks pro všechny dohromady.“
- Checkbox rows, one per wishlist the actor manages whose recipient differs from this one, each with the recipient's avatar, list title and recipient name, ordered by title. The current list is shown checked and locked. Lists with the same linked recipient never appear (that is #742).
- Unchecking a row follows that list's ordinary delete rules: a reserved gift's rows are locked (lock icon instead of the checkbox) with help „Rezervovaný dárek nelze ze seznamu odebrat.“ Never reveal reservation state to a linked recipient: for them the lock reads as a generic post-share rule, matching the existing delete-block wording.
- A row for a list the actor no longer manages is shown read-only with its title only.
- Field is hidden when the actor has no eligible list; in create mode it works the same before the first save.
- On phones it follows Kategorie in the fields-first column.

### 3.4 Bulk share action

- New Actions item „Sdílet s dalším seznamem“ after „Kopírovat do seznamu“, desktop dropdown and mobile sheet.
- Opens a dialog: title „Sdílet N dárků“, the same avatar checkbox rows of eligible lists („Cílové seznamy“), a summary naming the categories that will be added and stating that quantities stay shared totals, outline „Zrušit“ + solid primary „Sdílet“ (one solid button, rightmost). Spinner while running; failure as Alert `danger` with Retry; success toast with „Vrátit“.
- Already-shared gifts in the selection keep their existing lists; the dialog adds lists only.

### 3.5 Gift viewer

- Caption line after the categories row: avatars + „Společně s: Anička (Vánoce 2026)“; for managers with access the list title is a link. Below it the popover's explanation sentence and quantity line for the viewer's role.
- Reserve dialog stepper help for shared gifts: „z {count} dostupných · společně pro oba“ ({count} is the units still free, e.g. „z 2 dostupných“ when 1 of 3 is reserved).

### 3.6 Agent surfaces

- Change review (`/w/<id>/changes/<proposalId>`) shows a sharing change as a field row „Společně s“ previous → next list names. No new layout; reuse the existing row.

---

## 4. States

| State                         | Visual Treatment                                                                  | Trigger                                           |
| ----------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| Default                       | Section with header + count; cards carry the shared badge                         | Wishlist has ≥1 active shared gift                |
| Empty                         | No section, no header                                                             | No shared gifts                                   |
| Reserved (visitor/správce)    | Usual state badge centered + shared badge; card in the reserved band of section   | Reserved from any participating list              |
| Own reservation               | Gift moves to „Vaše rezervace“, keeps shared badge                                | Viewer reserved it from any list                  |
| Recipient view                | No reservation state anywhere, shared badge still shown                           | Viewer is linked recipient of any participating list |
| Received                      | Moves to „Obdržené“, keeps badge                                                  | Marked received on any list                       |
| Archived other list           | Badge unchanged; gift still reservable here                                       | Another participating list archived               |
| Many recipients               | Badge truncates with „+N“                                                         | 3+ participating lists                            |
| Narrow card                   | Compact badge (icon + first name / +N)                                            | Carousel, mobile Card                             |
| Selection / reorder mode      | Badge stays at the same position; section is a drop zone only for its own gifts  | Selection or reorder active                       |
| Editor: none eligible         | Field hidden                                                                      | Actor manages no other-recipient list             |
| Editor: locked row            | Lock icon instead of checkbox, help line                                          | Gift reserved, or list not managed by actor       |
| Bulk dialog: loading/error    | Spinner in confirm; Alert `danger` with Retry                                     | Request running / failed                          |
| Hover/Focus/Tap on badge      | Explanation popover (bottom sheet below 640 px); card does not open               | Pointer, keyboard or touch on the shared badge    |
| Quantity above 1              | „3 ks dohromady“ on the card; popover states total, not per recipient             | Gift quantity > 1                                 |
| Dark mode                     | Tokens only; no separate design                                                   | Viewer in dark mode                               |

---

## 5. Component Reuse Map

### Existing components (use these)

| Component                                                 | Variant/Props                                          | Usage in this design                         |
| --------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| `GiftCard` (`blocks/gift/GiftCard.svelte`)                | `density="grid"` / `"carousel"`                        | Shared gifts in Card and Carousel            |
| `GiftListItem` (`blocks/gift/GiftListItem.svelte`)        | —                                                      | Shared gifts in List                         |
| `GiftSectionHeader` (`blocks/wishlist/`)                  | `section`, `count`                                     | „Společná přání“ header                      |
| `Badge` (`base/badge`)                                    | `tone` neutral/info/primary/accent, `badgeStyle` outlined/subtle/overlay, `size="default"` | Base for the shared badge |
| `GiftCategoryBadges`, `GiftPriorityBadge`, `GiftStateOverlay` | unchanged                                          | Existing badges on shared cards              |
| `Select` (`base/select`)                                  | `type="multiple"`, `Select.Item indicator="checkbox"`  | Editor field and bulk dialog picker          |
| `HelpText`                                                | —                                                      | Field help and lock reason                   |
| `Avatar` (`derived/avatar`)                               | photo or initials                                      | Recipients in badge, popover, rows, viewer   |
| `Popover` (`base/popover`) / `Sheet` below 640 px         | —                                                      | Shared badge explanation                     |
| `Checkbox` (`base/checkbox`)                              | —                                                      | Editor and bulk dialog list rows             |
| `Dialog` / `Sheet`, `ConfirmDialog` footer rules          | `layout="scroll"` when needed                          | Bulk share dialog                            |
| `DropdownMenu` / `WishlistSheetAction`                    | —                                                      | New bulk action entry                        |
| `Alert`                                                   | `tone="danger"`                                        | Bulk share failure                           |
| `GiftViewer` caption                                      | `categories` slot neighbourhood                        | „Společně s“ line                            |

### Components to adopt

None.

### Components to design

| Component                         | Description                                                    | Why new                                                  |
| --------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| `GiftSharedBadge` (`blocks/gift`) | Avatars + „Společně s: {names}“ button opening the explanation popover, compact form for narrow cards | No badge names other recipients; must reuse `Badge` |
| `GiftSharedField` (`blocks/gift`) | Editor checkbox rows with avatars and lock states              | Category field is category-specific                      |
| `GiftBulkShareDialog` (`blocks/wishlist`) | Multi-destination dialog                               | Copy dialog is single-select with move option            |

---

## 6. Layout Constraints

- Content column max 1200 px, page gutter 12 px (<640) / 16 px (≥640).
- Card grid: auto-fill min 280 px; chosen columns floor 13.5 rem; single column ≤320 px. Carousel card `(100cqi − gutter − gaps) / (N + peek)`, can be ~150 px wide.
- The badge must fit within a 13.5 rem card next to Like and category lane, or sit in the body; desktop Card body alignment rules (shared title height, one-line description row, price below links) must not break.
- Text badges are 22 px tall with 8 px padding (Badge default).
- Editor field uses the editor's form row spacing; phone editor stays fields-first.

---

## 7. Design Tokens

From `src/app.css` (never `designs/tokens.css`; style mockups with compiled app CSS, e.g. `designs/mobile-filter-reset/assets/app.css`):

- Fonts: DynaPuff headings, Geist body.
- Edges `--edge`, sticker shadows, `--rounded-badge`, `--page-gutter`, `--gift-card-grid-gap`, `--nested-control-gap`, `--minimum-nested-inset`.
- Status text tokens only for status (`--status-*-text`); the shared badge is informational, not a status: `info` or `accent`/`primary` tone, must reach AA on every palette.
- Wishlist palette scope applies on the page (scoped tokens), dialogs follow the layer-palette rule.

---

## 8. Design Constraints (non-negotiable)

- Never reveal reservation state to a linked recipient of any participating list; the badge and section must look identical whatever the reservation state for them.
- Names are never declined (no „Aničkou“); use „Společně s: …“.
- Visitors get names, not links to other lists.
- Category stays top-left, priority bottom-left, state badges centered, Like top-right, gallery count bottom-right; the shared badge must not move them or overlap state badges.
- Badges look the same in every grouping, reorder and selection mode.
- Reuse shared components and Badge variants; no one-off raw controls. Dialog: one solid rightmost button.
- Czech vykání, no em dashes. AA contrast in light and dark.

---

## 9. Design Freedom

- Badge placement: image overlay (e.g. below the category lane or above the priority), body line under the title, or footer-adjacent; and its tone/icon.
- Section emphasis: plain header like other groups vs. a header with a short explanation line („Tyto dárky si přeje Tomáš společně s dalšími.“) or a subtle tinted band.
- Bulk dialog layout within the Dialog rules.
- Motion: popover fade/scale from the trigger, none under reduced motion; otherwise no motion beyond existing gift movement; follow `mpx-ui-motion`.

---

## 10. Visual References

- `designs/multi-category-badges/variant-a.html` — current card markup and badge lanes.
- `designs/gift-editor-rebuild/refined.html` — editor layout.
- `designs/wishlist-carousel-view/refined.html` — carousel rows and jump chips.
- `designs/unavailable-gift-comparison/` — reserved/unavailable card treatment.
- `src/lib/components/blocks/wishlist/GiftBulkCopyDialog.svelte` — bulk dialog pattern.

---

## 11. Not Included (scope exclusions)

- Linked copies of one recipient's gifts (#742) — same model, separate design.
- Cross-manager share requests and acceptance.
- Per-list overrides of shared fields other than priority and order.
