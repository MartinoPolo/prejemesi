# Design brief – Image editor: true-scale crop in context (#533)

## Problem

Today the gift and wishlist editors show the whole photo contained in an adaptive stage, with the
active target's window drawn over it and the overhang dimmed (`ImageCropStage`). The window's size
depends on the photo, not on the surface: with a large photo and a small target (the 146 px
`thumb`, the 34 px nav thumb) the window is tiny and the user cannot judge the result. Previews are
bare tiles without the surrounding component, so the cutout is never seen as it will be read
(title, price, buttons, polaroid paper, link card).

Goal: the cutout is always shown at the size the surface renders, the photo moves and zooms behind
it, and previews show the real outcome inside the real components, on desktop and mobile.

## Constraints

- Persisted formats do not change (`.mpx/DECISIONS.md` Images & cropping). Focal `{x, y}` + `zoom`
  is canonical for rendering; `cropRect` is stored only to restore editing geometry.
- Gift targets: `square` (4:3 grid card, legacy name) and `thumb` (1:1 List + reservation;
  falls back to `targets.square`). Wishlist slots: `card`, `thumbnail` (polaroid, nav, list rows),
  `social`. Specs live in `src/lib/modules/images/crop_targets.ts`.
- Fill / Fit / Manual map to `cover-crop` centred / `contain-padded` / `cover-crop` with
  per-target crops (`editor_modes.ts`). Legacy `auto` stays untouched until the mode is changed.
- Manual zoom ranges from the target's contain zoom (the whole photo, letterboxed on one axis) to
  300 %; letterbox areas use the image-frame fill (dots / white / black).
- Mobile List and taller desktop List frames show a centred side-window of the saved square
  composition; the editor must disclose this and must not reproject focal/zoom to portrait.
- Zoom uses a native range input; tokens come from `src/app.css`.

## Shared interaction model (all variants)

- **Fixed window.** The window is drawn at the target's rendered CSS size on the current device
  (gift Karta 356 × 267 desktop / ~178 × 134 two-column mobile; `thumb` 146 × 146; wishlist card
  364 × 128; polaroid 146 × 146). It scales down only when it cannot fit, labelled
  “zmenšeno na N %” (always the case for `social` 1200 × 630).
- **Photo behind.** Drag pans, wheel / pinch zooms around the pointer, the slider and − / + zoom
  around the centre, double-click re-centres. Arrow keys pan (Shift = larger step), + / − zoom,
  0 re-centres – this removes the pointer-only gap accepted in #50.
- **Context.** The photo outside the window stays visible but dimmed (A, C) or appears only while
  interacting (B). A rule-of-thirds grid shows while dragging.
- **Mode promotion.** Any pan or zoom from Fill or Fit switches to Manual for the active target
  only (as today); the other target keeps automatic framing or the `thumb` fallback, which the UI
  labels “přebírá ořez Karty” with a “Převzít ořez z Karty” action that drops the own `thumb` crop.
- **Live previews.** Every preview renders through the same focal/zoom geometry as `ImageFrame`.

### Mapping to persisted metadata (no format change)

The renderer shows a cover window of normalized size `1 / zoom` on the bounding axis with origin
`focal% × (1 − size)`. In pixels this is `imageOffset = focal% × (window − imageSize)` per axis,
where `imageSize = sourceSize × coverScale × zoom`. Therefore:

- **Pan** by `d` px: `focal = clamp((imageOffset + d) / (window − imageSize), 0, 1) × 100`.
  Clamping focal to 0–100 is exactly the “photo never leaves the window” rule, including the
  letterboxed axis when zoom is below 1.
- **Zoom** around point `p`: keep the source point under `p`, recompute `focal` with the formula
  above, clamp `zoom` to `[containZoom(target aspect), 3]`.
- **Persist** `targets[target] = { cropRect, focal, zoom }` for gifts and
  `image_slots[slot] = { fitMode: 'cover-crop', cropRect, focal, zoom, bgColor }` for wishlists,
  where `cropRect` is derived from focal/zoom at the spec aspect (identical to
  `focalZoomToWindowRect`). Window pixel size never enters the stored values, so editing at mobile
  size and desktop size yields the same data.
- Variant-specific controls only produce these values: B's contexts select the target
  (Karta → `square`; Seznam, Seznam na mobilu, Rezervace → `thumb`; Přehled → `card`;
  Polaroid → `thumbnail`; Sdílení → `social`); C's navigator sets focal from the clicked source
  point; C's 3 × 3 pad sets focal to 0 / 50 / 100.

Each mockup shows the resulting `image_meta` live in the side panel.

## Variants

| | A – Dílna | B – V kontextu | C – Lupa a mapa |
| --- | --- | --- | --- |
| Stage | Dark stage, window centred, ghosted photo | Real component at true size on the page background; ghost only while interacting | Dark stage + navigator minimap of the whole photo |
| Target switch | Tabs + clickable previews | Context chips (each context = component) | Preview tiles only (as today) with status chips |
| Previews | Gallery: card, desktop List, mobile List (row-height picker), reservation / overview card, polaroid, nav, social | “Další místa” mini previews for the other contexts | Tiles grouped by target |
| Extra | Ghost toggle | Hidden side-overhang of the mobile row shown hatched while dragging | 3 × 3 anchor pad |
| Cost | Inverts today's `ImageCropStage`; previews reuse `ImageFrame` | Needs editable image slots in real components or faithful chrome; most UI per context | A + minimap + anchors |

## Dynamic aspect in mobile cards

- **Mobile Card (grid)** keeps a fixed 4:3 image on top; only the body grows with content. No
  change needed: the `square` crop is exact.
- **Mobile List** rows grow with content (title up to 2 lines, description, links), while the
  image column keeps a fixed width and fills the row height. The square `thumb` composition is
  therefore side-clipped by `1 − width / rowHeight` (≈ 40 % for a full row), centred.
- **Recommendation:** keep the persisted square composition and the centred side-window (no
  reprojection, no new target). In the editor, (1) hatch the square's sides that the tallest
  clamped row hides, so the safe band is always visible while cropping `thumb`, and (2) give the
  mobile List preview a row-height picker (Krátký / 2 řádky / S popisem) so users see the extremes.
  Row height is already bounded by the 2-line clamps, so the safe band has a stable worst case.
- Rejected here (not by the user): a separate portrait target (a format change) and focal-shifted
  side-windows (contradicts the centred-side-window decision).

## Open questions (with recommendations)

1. **Base variant.** Recommend A as the base, adding C's navigator (shown when the window covers
   well under half of the photo) and C's status chips (“automaticky / ručně / přebírá z Karty”).
   B is the most faithful but costs a context-specific chrome per surface.
2. **Target switching: tabs (A) or tiles only (C, current decision 2026-07-18)?** Recommend the
   in-context previews as the switcher (keeping the decision), with the active one ringed and a
   label above the stage naming what is being edited; drop separate tabs.
3. **Ghost outside the window: always (A/C) or only while interacting (B)?** Recommend always,
   dimmed, with a remembered toggle – it gives orientation before the first drag.
4. **Which device's true size?** Recommend the current device's rendered size (desktop editor
   shows the desktop card, mobile editor the mobile card); the previews cover the other device.
5. **Windows larger than the stage** (`social`, mobile overview card on narrow phones). Recommend
   scaling down with the explicit “zmenšeno na N %” badge rather than cropping the window.
6. **Keyboard operation.** The inverted model makes arrow-key pan and +/− zoom trivial. Recommend
   shipping it and replacing the pointer-only #50 decision.
7. **Mobile gesture conflicts.** The stage needs `touch-action: none`, which blocks page scroll on
   it. Recommend capping the mobile stage at ~45 % of the viewport height so the sheet always has
   scrollable area outside it.
8. **Zoom label.** Recommend showing the percentage relative to Fill (100 % = fills the target)
   with explicit “Celý” (contain) and “Vycentrovat” (Fill framing) stops.

## Files

- `index.html` – entry with links into each variant and state.
- `variant-a.html`, `variant-b.html`, `variant-c.html` – self-contained interactive mockups
  (generated; edit `src/` and run `node build.mjs`).
- `src/core.js`, `src/core.css` – shared geometry, stage, previews, persisted-meta panel.
- `src/variant-*.js` – per-variant layout.

Today's editor is described from `ImageCropStage.svelte`, `GiftImagePreviewSlots.svelte`,
`.mpx/CONTEXT.md`, `.mpx/DECISIONS.md`, and desktop screenshots of the gift dialog. The wishlist
image tab was read from source only.
