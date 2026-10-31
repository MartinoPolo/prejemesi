# Gift gallery

> **Status**: Refined (Variant A), approved by the user on 2026-10-31 for [#591](https://github.com/MartinoPolo/prejemesi/issues/591)
> **Refined mockup**: `designs/gift-gallery/refined.html`
> **Summary**: `designs/gift-gallery/SUMMARY.md`
> **Refinements**: none, approved as-is

## Goal

Show that a gift can have up to 8 ordered images (the first is the cover) on every surface that renders gift images, without changing how single-image gifts look. Motivating case: silicone bands for a water bottle where several colours are fine.

## Settled behaviour

Follow the 2026-10-31 gallery bullets in `.mpx/DECISIONS.md` (Images & cropping):

- **Desktop Card:** dots bottom-center, always visible; above 6 images an `n/8` pill replaces them. Left/right arrows appear on card hover or keyboard focus, vertically centered on the image edges, and cycle with wrap-around without opening the viewer. Category stays top-left, Like top-right, priority bottom-left, state badges centered; the indicator must not collide with any of them.
- **Touch Card:** horizontal swipe plus dots, no arrows. Show the swipe affordance (for example a mid-swipe frame) and that reorder and selection modes disable it.
- **List (desktop and mobile):** a small `+N` corner chip on the image only, no arrows; it must coexist with category/selection badges on the narrow mobile List image.
- **Unavailable gifts:** reserved/received dimming (`designs/unavailable-gift-comparison/`) keeps arrows and indicator crisp while the photo fades.
- **Gift viewer:** uncropped photo at natural aspect inside the height cap, arrows, a thumbnail strip, ←/→ keys; it opens at the image the card showed.
- **Editor:** a thumbnail strip under the crop stage in the gift editor dialog: add (upload or URL), drag reorder, remove, selected-image highlight, first = cover marker, limit 8 (add disabled at the limit). The existing crop stage, mode selector and Karta / Seznam a rezervace preview tiles edit the selected image.
- Single-image and no-image gifts render exactly as today.

## Presentation

One standalone review page with labeled sections per surface, desktop and mobile frames, light and dark. Gifts: the bands (5 colours, then an 8-image case for the pill), a single-image gift and a reserved bands gift side by side for contrast. Use simple SVG stand-ins for product photos (coloured silicone bands on a light backdrop), not third-party photos.

Match current app styling: `src/app.css` tokens, DynaPuff/Geist fonts (font files in `designs/unavailable-gift-comparison/assets/`), sticker borders and hard shadows, shared badge and Button icon geometry, Czech copy with vykání. Interactive where cheap: hover arrows work, clicking cycles, viewer keyboard arrows work.

## Acceptance

Desktop and mobile, light and dark screenshots inspected; arrows and indicator never cover badges or the Like control; no horizontal overflow; the standalone file loads its assets locally.
