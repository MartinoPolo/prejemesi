# Gift mobile fields first

GitHub: MartinoPolo/prejemesi#393

## Goal

On mobile, make gift details immediately editable and keep the existing image workshop in the same dialog after the ordinary fields. Desktop retains the current image-left / fields-right workshop geometry. Dirty-exit protection and Cancel are approved safety improvements on all sizes.

## Mobile composition

1. A compact, shrink-proof top header outside scrolling content: the 19 px short title „Upravit dárek“ is vertically centered with the 40 px close target in one row. Keep 20 px left alignment for the title, with compact 8 px vertical and 10 px right insets around the close control. The close column never shrinks; the title wraps within the remaining width at enlarged text.
2. One body scroll: Název, Popis, Odkazy, Cena + Měna, Počet + Kategorie + Priorita, then image source.
3. Directly after the source, retain the existing inline image workshop: Vyplnit / Přizpůsobit / Ručně, white / black / transparent background options, adaptive stage, and the two previews Karta and Seznam a rezervace.
4. Uložit and Zrušit are sibling footer actions outside the body scroll and stay reachable.

## Constraints

- No separate image dialog, duplicate editor, or new visual language.
- Preserve current image behavior, labels, and desktop image/form placement; do not extract or relocate the desktop workshop.
- Footer safety controls are the approved cross-size exception: show Uložit and Zrušit on mobile and desktop.
- Closing or cancelling an unchanged draft exits directly. With changes, use the shared confirmation pattern with Zahodit změny and Pokračovat v úpravách; do not promise Save-and-continue.
- Use production semantic tokens, DynaPuff headings, Geist body copy, ink borders, sticker depth, and visible focus.
- Default mobile controls are generous touch targets. Layout must survive narrow width and enlarged text without overlapping, clipping, or moving Save into the scroll.
- Czech copy uses formal address where instructional text appears.

## Acceptance cues

- The shared compact header contains the only dialog title; title and close stay vertically centered, and the scrolling body does not repeat it.
- At dialog open, Název is the first ordinary field and the image workshop does not block access to details.
- The title/close header plus the Save/Cancel footer remain visible while the body scrolls.
- Image source and workshop read as one continuous image section.
- Enlarged text reflows field pairs and editor controls rather than shrinking text.
- At `sm` and above, retain the established image-left / fields-right geometry while adding the approved Cancel and dirty-exit safety controls.
