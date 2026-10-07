# Segmented selection slide

> **Status**: Refined (Variant 1 · Slide) **Refined mockup**:
> `designs/segmented-selection-slide/refined.html` **Summary**:
> `designs/segmented-selection-slide/SUMMARY.md` **Refinements**: slide only (no hover lift), default
> tray hugs its options

Design reference for [#455](https://github.com/MartinoPolo/prejemesi/issues/455). Requirements live
in the issue; this folder shows them in the real app surroundings.

## Goal

Keep the shipped look of every segmented control and tab strip, and animate the selection: the
selected face slides from the previous option to the new one. Hover and press stay static. The
default segmented tray hugs its options instead of stretching across a flex-column parent.

## Contexts

Each frame is captured from the running app at 1:1 inside its real container:

| Context                  | Control                                       |
| ------------------------ | --------------------------------------------- |
| Wishlist toolbar         | Gift view switcher (connected presentation)   |
| Dashboard (Moje seznamy) | View toggle (default presentation)            |
| Add-gift dialog          | Image source (default presentation, tray fix) |
| Wishlist settings dialog | Tabs                                          |
| Login card               | Auth tabs (links)                             |

## Review controls

Device (desktop 1280 px, mobile 390 px), depth, light or dark mode and palette (as captured, or
forced).

## Rejected

- Tinted track with a raised selected segment: today's looks stay.
- Hover lift and press on the controls: unclear value, and the settings tab track's
  `overflow-y: hidden` clips the lifted shadow.

## Files

- `refined.html`, `review.css`, `review.js`: review page.
- `scene.html`, `scene.css`, `scene.js`, `motion.css`: one captured context per frame; `motion.css`
  holds the slide and the tray fix.
- `app-reference.css`, `reference-data.js`, `assets/`: captured app CSS, markup, images and fonts.
- `capture-reference.mjs`: refreshes the captures from a local seeded dev server:
  `PLAYWRIGHT_BASE_URL=http://localhost:<port> node designs/segmented-selection-slide/capture-reference.mjs`.
