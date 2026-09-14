# Gift hierarchy · issue #377

> **Status**: Approved and finalized (Variant A, 2026-09-14), excluding the broken mobile List composition.
> **Refined mockup**: `designs/gift-hierarchy/refined.html`
> **Summary**: `designs/gift-hierarchy/SUMMARY.md`
> **Refinements**: Grid corner Like, List title-aligned Like, centered title metadata, two-line titles, full ink secondary, top-aligned content, equal-height grid cards, centered state groups.

Source: https://github.com/MartinoPolo/prejemesi/issues/377, `.mpx/DECISIONS.md`, and user feedback on Variant A (2026-09-14). These artifacts refine the design only; application implementation remains outstanding.

## Scope and context

Standalone component review stage, not a redesigned wishlist shell. One comparison document covers desktop/mobile Grid and List. Review controls are prototype tooling, not app UI. Existing Anime Sky design, DynaPuff/Geist, canonical semantic tokens, ink borders and sticker shadows remain fixed.

## Requirements

- Assigned category top-left over every image or placeholder; no badge when unassigned. Eligible priority and reservation/received state remain over the image at every viewport. Center authorized identity with reservation state, never repeat it in content.
- Ordinary recipients receive no reservation/Like information. Self-promoted recipients see state/counts, not identities and cannot reserve/like. Visitors see anonymous state and own controls only. Authorized single-reserver shows one name; multiple reservers use “Rezervováno více lidmi”, without a name list or additional exact reserver count.
- Titles use 18 px mobile / 24 px desktop, at most two lines then ellipsis. Preserve the full accessible name and access to the complete title through the existing gift-detail entry point. Keep quantity outside the clamped text so it cannot disappear, adjacent to the title, with reserved portions capability-gated. Retain consistent generous title-to-price spacing; top-align content at its ordinary inset instead of vertically centering it in List.
- Grid places ghost Like with adjacent count at the image/card top-right; List places it beside the title, including when the narrow List image stacks above content. Preserve an accessible target independently of icon size. In Grid, category wraps in its own top-left lane beside the reserved Like target; never let category text enter its hit area or shift the state group off-center.
- In List, center the heart/count and quantity against the **first title line**, not the entire multiline title. Use first-line-height alignment slots with centered contents; the Like hit target may extend above/below its slot without moving the visual alignment or shrinking its accessible size. Derive slot height from title typography (`1lh`), without title-length checks or arbitrary offsets. In Grid, quantity remains centered against the visible title block.
- Use the selected full ink secondary Received, distinct from primary Reserve and stronger than More. Preserve role gates, Reserve/Cancel and received/unreceived semantics. Implement emphasis through shared semantic intents, not a production card-local override.
- Exercise long category/title, quantity, priority, received plus reservation, single/multiple authorized reservers, unassigned category, no image, role-dependent actions, pending/error/disabled and empty/loading states.
- Grid cards sharing a row have equal outer height and bottom-aligned actions; this is surrounding-layout fidelity, not an app-wide geometry redesign. Grid images normally use 4:3. List images are square and full-height beside content. **The mockup's blanket mobile List stacking is broken and explicitly not approved.** Preserve the app's real side-by-side mobile List layout; allow only the existing constrained-content/enlarged-text accessibility fallback where necessary, not a blanket viewport rule that converts List into Grid. Implement and browser-test genuine mobile rows using the shared image/crop contract; do not treat this prototype as their visual specification. Keep all eligible overlays visible. The prototype expands the image mat if enlarged badges cannot fit; production must reconcile that fallback with the shared crop contract rather than copy its sizing script. Compact remains image-free.
- State badges and authorized identity form one group centered on the image itself. A lone state is centered; multiple states shift around their combined center, not around remaining space between edge badges. Category stays top-left. Priority is approved at bottom-left; the corner comparison is complete.
- **Do not copy the mockup's badge styling.** Badge outlines, colors, shapes, icons, rotations and shadows are schematic. Reuse the actual shared category, priority and state components; review only their positioning here.
- Shared target control sizes 32 px desktop / 40 px mobile, action gap 8 px, panel radius 16 px and border 2.5 px; separate shadow clearance from insets. No competing geometry system.
- Validate light/dark, narrow widths, enlarged text and focus without clipping. Production fixtures/tests, seed enrichment and application implementation are subsequent issue work, not mockup claims.

## Reuse

`GiftCard`, `GiftListItem`, `GiftStateOverlay`, `GiftCategoryBadge`, `GiftPriorityBadge`, `GiftPieceCount`, `LikeButton` (ghost, adjacent count), `GiftActionRow`, `GiftReceivedToggle`, `ReserveButton`, and shared Button intents. No missing library primitive or installation needed.

## Approval boundary

The user approved the mockups as-is with priority bottom-left. No design questions remain. The mobile List composition, schematic badge appearance and prototype dimension script are explicitly non-authoritative. Correct mobile List behavior is implementation work within #377, not a remaining design gate. Preserve server capabilities, shared geometry and actual component styling. Approval is not a claim that production code, seeds or regression tests have been implemented.
