# Responsive comparison summary

## Included

- **Desktop List:** a square image fills each minimal, collection-aligned row. Title and description
  remain one line. Price shares the action row only when the measured width permits; otherwise the
  row stacks.
- **Mobile Grid:** one column keeps compact natural card heights. Two columns align title,
  description, link, price, and action tracks across the collection. Title and description previews
  are explicitly capped at two visible lines; track measurement uses those painted caps rather than
  their unclamped `scrollHeight`.
- **Mobile List:** title and description previews are capped at two visible lines. The full-height
  portrait frame now uses `min(35%, 152px)`, leaving at least 170 px of text width in the tested 320
  px viewport. Priority stays bottom-left while top overlays occupy separately measured zones.
- **Mobile actions:** every card has one non-wrapping action lane. Intrinsic button widths and the
  actual flex gap decide when secondary actions move to **More**. Reserve remains visible before
  Received where both cannot fit; if Reserve plus More cannot fit at enlarged text, Reserve also
  moves into More. Hidden commands return when room becomes available and retain menu role,
  enabled/disabled state, pointer access, and keyboard focusability without duplicate commands.
- Every source link remains visible inline, in **More**, or in the full detail. The approved desktop
  Grid remains separately linked from the comparison header.

## Crop comparison

Canonical production targets remain unchanged: `thumb` is **1:1** and `square` is **4:3** in
`src/lib/modules/images/crop_targets.ts`. “Ořez stran” clips the same square composition through the
portrait window; it visibly loses side content. “Celý obrázek” uses contain and may show empty
space. Neither proposal is an exact portrait WYSIWYG promise. A separately editable portrait target
would require a future crop-contract/editor decision and is not implemented here.

## Narrow-overlay review

Mobile List keeps category, state, identity, and Like information in measured top zones and anchors
priority at the image bottom. The minimum row height reserves clearance between both areas without
hiding labels or identities. A long category can therefore make the row taller at 200% text.

Mobile Grid preserves the centered state placement while overlays fit. If valid category/state/
identity combinations collide, it switches that card to a measured vertical fallback and gives the
whole collection a shared image height so content tracks remain aligned. This is deliberately a
crowding fallback rather than a new overlay composition.

## Remaining tradeoffs

- The wider Mobile List proposal provides more image presence than the former 30% / 128 px frame,
  but reduces the content column by up to five percentage points. The narrowest tested viewport
  still retains the explicit text-width floor above.
- Crowded two-column Grid overlays can make every image in the displayed collection taller because
  shared content alignment and full label disclosure take precedence over a strict 4:3 frame in that
  fallback.
- Preview clamps do not remove content: the full title remains in the card’s accessible name, and
  the detail dialog exposes the full title and description.

## Prototype boundaries

All controls and actions are demo-only. Detail and More are keyboard accessible. Draft gating,
archive read-only behavior, ordinary/promoted recipient restrictions, manager identity, and
visitor/anonymous ownership examples are represented for review, not as a production authorization
boundary.

## Verification

Run:

```bash
node designs/gift-desktop-alignment/verify-responsive.mjs
```

The raw Playwright check uses shared Chrome launch options and no screenshots. It covers actual
320/360/390/430 mobile viewports, explicit two-line painted bounds, single-row action geometry,
action overflow/restore and narrow 200% fallback, dynamic Mobile List image width and bottom
priority placement, desktop and mobile shrink round trips, one- and two-column tracks, Grid/List
overlay separation, source-link reachability, crop modes, role/lifecycle behavior, and keyboard
access.
