# Gift editor rebuild: refined design

Mockup: [refined.html](refined.html), approved by the owner on 2026-11-16. The three exploration variants (A live-preview workshop, B tabs, C card rail plus framing step) were removed after the choice; "variant A" and "variant C" below name them.

## Chosen

The structure from variant C. On the left is the real gift preview (Karta or Seznam), with the image strip and framing status beneath it. On the right is a compact form. Framing happens in a focused step inside the same dialog. In that step, Karta and Seznam are independent, and the copy buttons copy a framing once without linking the views.

## Changes from variant C

- **Framing entry is the image itself.**
    - The rail's edit button is gone. The wording is "Upravit obrázek" and "výřez"; "záběr" is not used.
    - At rest, a round icon-only pencil button sits in the centre of the image.
    - On hover or focus of the 4:3 card image, a scrim appears and the button widens in place into a pill with "Upravit obrázek". A click anywhere on the image opens the step.
    - Narrow images (list row, phone) keep the icon-only button; the pill never appears there.
    - Clicking a thumbnail only selects which image the preview shows. Thumbnails have no edit icon.
- **Links use variant A's one-line rows**, replacing the chips.
    - The label is highlighted inside the muted URL.
    - A custom label that does not appear in the URL is shown as a chip before it ("Obchod u Nováků").
    - Clicking a row expands it inline. The last row is the paste field.
    - Desktop rows are 34 px. The expanded panel is one row (Adresa | Viditelný popisek | Odebrat) so the dialog still does not scroll.
    - Mobile rows are 40 px, with the expanded panel stacked.
- **Height:** the taller links list and a five-line description fill the space that was empty under Kategorie. At 1440×900 the form ends near the rail, with no scrolling at rest or with a link expanded.
- **Priority** uses the real label "Vysoká" on both the select and the badges.
- **Dialog chrome** now follows the shared Dialog (next section).
- **Phone order:** fields first; the whole image section (preview with the Karta / Seznam toggle, then the image strip) sits at the bottom of the body, after Kategorie and before "Smazat dárek" (frames 5B / 5C). Frame 5A, images at the top, was rejected and stays only for comparison.
- **Background swatches** are 20 px on desktop and 24 px inside 40 px buttons on phones.

## Consistency with shared Dialog

Values taken from `src/lib/components/base/dialog/`:

| Element | Value | Source |
| --- | --- | --- |
| Content | card bg, `rounded-panel`, 2.5px `border-edge`, `shadow-sticker`; `top-[10vh]`, `max-h-[85dvh]`, `p-0`, flex column | `dialog_variants.ts` (`layout: 'scroll'`) |
| Overlay | `bg-scrim` + 2.5px backdrop blur | `dialog-overlay.svelte` |
| Header | `px-6 pt-6 pb-4`, no divider; left-aligned from `sm`, centred on phones | `dialog-header.svelte` |
| Title | `font-heading text-2xl leading-tight font-semibold`; close clearance at the end, and on both sides on phones | `dialog-title.svelte` |
| Close | 40 px circular sticker at `--overlay-close-inset`, card face, 2.5px edge, 16 px icon that rotates on hover | `dialog_close_button.ts` |
| Body | the only scroller; `px-6`, `pt` 4 px (`--dialog-body-padding-top`), `pb-6` | `dialog-body.svelte` |
| Footer | `border-t`, `bg-background`, `px-6 py-4`, `--nested-control-gap`; `justify-end` from `sm` (phones: see deviations) | `dialog-footer.svelte` |
| Buttons | outline "Zrušit" then primary "Uložit" | `GiftCategoryQuickAddDialog.svelte`, `WishlistSettingsModal.svelte` |
| Delete | `intent="danger"` with a trash icon, labelled "Smazat dárek" | current `GiftDetailForm.svelte` |

Deviations:

- **Width 1100 px instead of a `max-w-2xl` size.** The two-column layout needs it. The existing gift modal already uses `sm:max-w-[1100px]` (`gift_detail_modal_variants.ts`).
- **Height pinned to the 85dvh cap instead of fitting the content.** Switching between the main screen and the framing step must not resize the dialog.
- **The desktop footer is not purely `justify-end`.** "Smazat dárek" is pushed to the start so the destructive action sits away from Uložit. In the framing step, the start of the footer holds a draft hint. On phones, delete moves to the end of the body so the footer keeps only Zrušit and Uložit.
- **Compact phone chrome.** The shared Dialog centres the title and stacks the footer on phones. This dialog uses a left-aligned title on the close button's row and a one-row footer (outline Zrušit, then primary Uložit taking the remaining width), because it is the tallest dialog in the app.
- **Back button.** The framing step adds a back arrow at the start inset. It uses the same sticker as close, and the title then reserves the close clearance on both sides.

Changes the shared Dialog would need:

- **A back slot in the header**, for example `Dialog.Back` reusing `overlayCloseButtonClass` with `start` instead of `end`, plus title clearance on both sides. Multi-step dialogs could then share it instead of hand-placing it.
- **Optional `lead` content in the footer**, a start-aligned area for a destructive action or a hint, so dialogs do not each add their own spacer.

## Open points

- On the phone list-row preview, the category badge truncates because of the count chip. This is the real `GiftListItem` behaviour at that width, not something the editor introduces.
- The centred pencil sits over the product. It has its own sticker face, so it stays readable.
- The mockup's `assets/app.css` is an older compiled build; take tokens and control sizes from `src/app.css` and the real components, not from the mockup's pixel values.
