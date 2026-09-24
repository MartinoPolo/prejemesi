# Variant A — shared tracks

[Open the refined mockup](refined.html). Variant A places price in the content directly below link badges, using the same horizontal inset as text and actions. The action separator is removed. Collection-wide measurements reset previous imposed sizes before reading intrinsic content, preventing accumulated blank space after control changes. See the design brief for the accepted layout rules.

The refined entry embeds the same interactive variant so existing review links stay current without duplicating prototype logic. Production reuse remains GiftCard, WishlistGiftCardGrid, shared gift badges, buttons and existing detail/More controls; no new dependency or production component was introduced.

## Prototype boundaries

- All actions are local demonstrations and never persist data.
- Role and lifecycle examples communicate presentation rules only; they are not an authorization boundary.
- External destinations are representative links. Local demo seed images and production font files are referenced in place, not copied.
- The mockup links `designs/tokens.css` as required, then `src/app.css` as the canonical palette/token source. Component-specific layout is in `variants/variant-a.css`.
- Card-height and shared-track measurement are prototype JavaScript. They demonstrate the visual contract, not a production implementation strategy.
- The exact narrow preset is an `880px` collection: three production-minimum `280px` columns plus two `20px` gaps, following `WishlistGiftCardGrid.svelte`.
- Role/state examples are bounded to `gift_display_state.ts`, `GiftStateOverlay.svelte`, `gift_context_actions.ts`, and `wishlist_capabilities.ts`. Archive content edits are disabled; the source-permitted cancellation of one's own reservation remains available.
- The 200% text control doubles card typography and uses a taller shared image track plus shared price and action rows. Card copy remains preview-clamped with full text in the keyboard-accessible detail.

## Verify

```bash
node designs/gift-desktop-alignment/verify.mjs
```
