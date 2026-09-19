# Desktop gift-card alignment

> **Status:** Refined Variant A, price row and minimal shared height. **Mockup:** [refined.html](refined.html).

Desktop layout direction accepted with these refinements; production implementation remains separate. Source: user review of the actual application and follow-up choices on 2026-09-16. Related: issue #377 and the earlier gift-hierarchy design.

## Confirmed requirements

- Preserve the actual application's DynaPuff/Geist typography, palettes, ink borders, image ratios, category/priority/state badges and ghost Like. This is a layout change, not a visual redesign.
- The approved desktop Card mockup remains unchanged. Extend the design with desktop List, mobile Card and mobile List in a separate responsive comparison. No application implementation, new screenshots, commits or publication.
- Match content positions and total card heights across the displayed collection, including different grid rows and grouped sections. Per-row equal height alone is insufficient.
- Titles are top-aligned, capped at two lines. Use one shared title height derived from the displayed collection at its current width: one line when all titles fit, otherwise two. Do not always reserve a second line. Complete titles remain available through keyboard-accessible detail.
- Descriptions have a shared one-line preview row. Missing descriptions leave that space empty. Remove the row when the entire displayed collection has no descriptions. Full text remains available in detail.
- Source links remain visible with current badge styling. Missing links retain the existing muted “Bez odkazu”. Model long labels and many links without letting their local wrapping shift other card content.
- Keep primary actions and relevant Received/Bought controls visible. Secondary actions may move into More; show the proposed mapping explicitly for each role. Never introduce powers unavailable to that role.
- Preserve ordinary recipient surprise protection, promoted-recipient identity restrictions, anonymous visitor state, manager identity visibility, draft gating and archive read-only state.
- Include real-looking short/long Czech titles, absent/long descriptions, no/multiple/long links, absent/single/range prices, quantity, image/placeholder, single/multiple reservations and received state.

## Price and minimal height refinement

Price belongs to the content directly below the link badges, on its own left-aligned line. Title, description, links, price and actions share one horizontal card inset; badge-internal padding is independent. Image-corner overlays retain their geometry-specific positioning. Omit the action separator. Price length must not consume horizontal button space or cause action wrapping. Keep long amounts readable, wrapping only when their own full-width line requires it.

Always use the smallest collection-wide height justified by current content and shared alignment tracks. Recalculate from intrinsic content after width, typography, role and content changes; previous equalized heights must not feed subsequent measurements. Returning to a previous option combination must restore its previous compact geometry, without accumulated space beneath the links.

Link overflow and action overflow mappings shown by the mockup are also proposals. All links must remain reachable.

## Deliverable and review controls

One HTML mockup at `variants/variant-a.html`, with linked local styles/scripts if needed and no server/database prerequisite. Use local production fonts and image assets wherever available; reference `../../tokens.css` relative to the HTML, then canonical production token sources rather than restyling from stale reference tokens.

Provide desktop width controls including the narrowest supported three-column grid, palette/theme toggles, role/lifecycle controls, realistic mixed content, all-short/no-description content and an adversarial content preset. Show at least two rows so collection-wide alignment can be judged. Optional guide lines should explain the shared rows without becoming part of the proposed UI.

Detail and More should work by pointer and keyboard. Controls and actions must be clearly prototype-only, never mutate real data or imply reservation success. Include a visible note distinguishing approved text rules from proposed price/overflow treatment.

## Responsive comparison extension

- Desktop List: square image filling the entire row height, one-line title and one-line description. Use consistent, minimal content-driven row heights. Price below links may share a bottom row with actions when the measured available width comfortably permits; otherwise separate them. This sharing is not a change to the approved desktop Card price placement.
- Mobile Card: natural compact flow for a single column, without reserving blank title/description space to match remote cards. Where cards are side by side, retain shared alignment. Keep the existing visual language and role constraints.
- Mobile Card and List titles and descriptions are capped at two visible lines each, with full text accessible in detail. Shared track measurement must respect the visible clamp instead of expanding to the hidden text's scroll height.
- Mobile actions stay on one row. Move secondary actions into More when the actual available width cannot fit the buttons; restore them when space returns. For example, keep Reserve visible and move Received into More when both cannot fit. Preserve every eligible action and its permissions. Measure shared action height after overflow placement so another card cannot reserve a redundant second button row. At extreme text enlargement, remaining commands must stay accessible in More rather than clip or force wrapping.
- Mobile List: preserve horizontal composition and a full-height portrait image, with a width responsive to the available row width and an upper cap. Refine the initially narrow image strip to be modestly wider while keeping the text column usable. Allow taller cards only where current readable content requires them; do not create an oversized square image just to satisfy full height. Priority badges stay at the bottom-left of the image, clear of the other overlays.
- Compare side-cropping the existing square framing with fitting the complete image into the portrait frame. These are visual proposals, not an approved crop contract. An independently editable portrait crop remains a possible alternative, not an authorized editor/schema change. Existing `thumb` is a square, exact editor-preview consumer; changing the rendered aspect breaks that promise unless the editor preview or the documented crop contract also changes. Preserve stored metadata and do not silently call the new portrait frame exact WYSIWYG.
- Exercise narrow and wide desktop List, actual mobile widths, all existing roles/states, long content, absent metadata, and repeated view/width switches. Keep the desktop Card baseline separately accessible.
- Mobile narrow images leave less badge space: investigate category/state/identity/priority collisions explicitly. Any proposed overlay repositioning or disclosure trade-off must be labeled for review, not silently treated as approved.

## Verification

Use raw Playwright against the HTML, without screenshots. Verify matching card heights and matching relative title/description/link/footer positions across rows, title track shrinking on the all-short preset, description-row removal when empty, text/action containment at narrow three-column and wide desktop widths, light/dark, role privacy, read-only draft/archive cases, detail access and reachable overflow links. Check enlarged text for containment and report any adaptive fallback honestly. Do not treat prototype measurements or copied permission examples as a production implementation strategy or security boundary.
