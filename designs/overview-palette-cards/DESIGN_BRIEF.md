# Přehled: palette-tinted wishlist cards and a more prominent Nedávné row (#532)

## Problem

On `/home` every WishlistCard has a white body and a white title plate. The card does not show the wishlist's palette, so the cards in a row are hard to tell apart. Nedávné uses the same heading size, card size and spacing as Sledované, Spravované and Moje seznamy, so it does not read as the primary row.

## Constraints

- Reuse WishlistCard (DECISIONS 2026-08-07); this changes the card surfaces, not the information inside the card. The blurry wishlist image is out of scope (separate bug).
- Derive palette colours with `color-mix(in oklab, …)` from palette primitives (2026-07-10). `src/app.css` is canonical; `designs/tokens.css` is legacy.
- Text reaches WCAG AA on every palette in light and dark mode (2026-10-17). Brand-coloured text uses `--brand-link`, and filled surfaces pair `--primary` with `--primary-foreground`.
- Keep the carousel peek geometry, the hover-lift clearance and the order of the rows: Nedávné, Sledované, Spravované, Moje seznamy.

## Proposal (shared by all variants)

- Each card subtree carries `data-palette={wishlist.palette}` (the same mechanism the wishlist page uses), so all tokens are re-derived for that palette.
- Two new derived tokens: `--wishlist-card-body = color-mix(in oklab, var(--p-brand) N%, var(--card))` and `--wishlist-card-plate` (a brand mix, or `--primary` at the strong strength, which uses `--wishlist-card-plate-foreground: var(--primary-foreground)`). The formula is the same in both modes; only N differs:

| Strength | Light body / plate | Dark body / plate | Minimum contrast across all palettes (light · dark) |
| -------- | ------------------ | ----------------- | --------------------------------------------------- |
| Subtle   | 5 % / 14 %         | 8 % / 18 %        | 4.98 · 5.47                                         |
| Medium   | 10 % / 24 %        | 14 % / 30 %       | 4.87 · 5.05                                         |
| Strong   | 17 % / `--primary` | 20 % / `--primary`| 4.55 · 4.61                                         |

The contrast figures cover `--foreground`, `--muted-foreground`, `--brand-link` and the plate label. The full per-palette table is in `index.html`. Dark strong was capped at 20 %: at 22 % honey muted text drops to 4.50.

## Variants

- **A** (`variant-a.html`): subtle tint. Nedávné keeps today's size; the category rows get quieter, with 17 px headings and compact 256 px cards that show only the essential line. A dashed divider separates them from Nedávné.
- **B** (`variant-b.html`): medium tint. Nedávné sits on a tinted notebook band (dot grid, punched holes, taped heading) in the viewer's palette. The category rows are unchanged.
- **C** (`variant-c.html`): strong tint with a filled `--primary` plate. Nedávné gets larger 388 px cards and a 28 px heading with an icon sticker; the category rows are compact.

Each page can switch the tint strength (including today's white "Dnes"), light/dark mode and a 390 px mobile frame from the controls in the corner, or through `?tint=`, `?mode=dark` and `?frame=mobile`.

## Recommendation

Use **B's emphasis (the notebook band) with medium tint**. The band marks Nedávné without shrinking the category rows, so their information stays intact (A and C hide the dates and the progress label). Medium tint makes the palette identity clear while keeping the `--card`-white chips and progress tracks distinct. Strong tint puts a second primary fill next to the "Sdíleno" badge and the reservation chips, and the dark reds and browns become heavy.

## Open questions (with recommendation)

1. **Card ink and border: the wishlist palette or the viewer's?** Wrapping the card in `data-palette` also re-derives the border and shadow ink. *Recommendation:* accept it. It uses one mechanism that existing nested-scope AA tests already cover, and the ink differences are subtle.
2. **Plate on photo banners vs. fallback banners.** The fallback banner is already `--tint`, so a tinted plate on it is low-contrast as a shape (it relies on the ink border). *Recommendation:* keep one plate token. The 2 px ink border and sticker shadow separate the plate, as the mockups show.
3. **Band colour: viewer palette or neutral?** *Recommendation:* the viewer palette (`--p-brand` 22 % into white; `--p-deep` 34 % into dark). Nedávné mixes roles, so no single wishlist palette fits it.
4. **Should Nedávné cards also grow (C) when the band is chosen?** *Recommendation:* no. Combining both is redundant, and larger cards cut the mobile peek.
5. **Archived cards.** *Recommendation:* the existing archived desaturation applies on top of the tint; no extra rule is needed.
6. **AA guard.** *Recommendation:* extend `src/lib/theme/palette_contrast.svelte.test.ts` with the card body and plate pairs for the chosen strength.
