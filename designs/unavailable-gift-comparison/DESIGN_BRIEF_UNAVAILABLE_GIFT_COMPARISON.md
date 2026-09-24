# Unavailable gift comparison

> **Status:** Design approved by the user on 2026-09-24 and implemented in `GiftCard`/`GiftListItem`. **Mockup:** [refined.html](refined.html). **Implementation map:** [SUMMARY.md](SUMMARY.md). **Execution handoff:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Goal

Make unavailable gifts unmistakably quieter while retaining readable content and usable controls. The previous evidence compared different gifts and cannot establish the visual effect.

## Controlled comparison

Show identical copies of one gift, with the same image, title, description, price, source link, category and priority. Label the left available and the right reserved. Change only reservation state and the selected treatment. Include category and priority simultaneously; keep the reservation status readable as a separate layer. A local prototype reservation toggle must let the viewer compare the same card before and after without touching real data.

## Selected treatment and comparison options

The default selected treatment retains **50% visibility** of the image, title, description, source links, price, category and priority badges. Soften the card border and shadow to match. **Reservation status and action buttons stay crisp at full visibility and operable**; the supplied screenshot shows the reservation state crisp, and the explicit action exception overrides the screenshot's action checkbox. Use the existing `presentation.isDimmed` eligibility for both reserved and received gifts; preserve recipient privacy, partial-reservation behavior, and image-free Compact. Keep eligible identity with the crisp state overlay. All action controls, including Like and overflow outside the footer, retain full visibility. Do not add the old image veil or extra desaturation to this selected treatment. Maintain a visible image/body separator on both available and reserved gifts, following the softened frame treatment on reserved gifts: horizontal in Grid, vertical in List. Clip art to the image box rather than masking the separator with an extra overlay.

Retain interactive comparison presets and independent controls for evaluating alternatives; these do not change the selected default:

- Current baseline: image veil, secondary badges at 90% opacity and 50% saturation; body and actions unchanged.
- Content-only gentle: image, title, description, links, price and both secondary badges at 75%; actions, card border and shadow unchanged.
- Content-only stronger: same at 60%.
- Content and frame: 60% content with softened border and shadow; actions unchanged.
- Whole presentation: 60% content, secondary badges, actions, border and shadow, but a crisp reservation state.

Expose opacity, secondary badge participation, action participation, and border/shadow participation independently so viewers can explore alternatives; the selected default excludes actions. Explain that opacity values mean retained visibility, not percent removed. Preserve available reference styling for every option. Avoid compounding image veil and opacity in experimental presets.

## Presentation

Use current gift Card and genuine horizontal List geometry, with Grid/List, light/dark and photo/placeholder controls. Desktop shows the pair side by side; mobile stacks labeled cards at readable size rather than shrinking typography. Include a compact preset gallery for simultaneous comparison. Match the current app's DynaPuff/Geist fonts, sticker borders/shadows, category placement top-left, priority bottom-left, and centered reservation status. Use current source styling, not stale design-token typography. Controls and prices remain semantic: fading does not imply disabled actions.

## Acceptance

Capture and inspect desktop and mobile, light and dark Grid/List screenshots with both secondary badges present. Verify the selected default computes to 50% for image/text/badges, leaves status and actions at 100%, softens border/shadow and visibly retains the separator on both cards. Verify controls can still change the intended layers, the available reference remains unchanged, assets load from a standalone file, and there is no horizontal overflow. Document contrast limitations for stronger fades; do not claim accessibility from opacity alone. No production reservations or data changes are needed.
