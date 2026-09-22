# Connected view switcher

> **Status: Implemented — static variant B (2026-09-21).** [Final mockup](refined.html) ·
> [Implementation summary](SUMMARY.md) The scoped production presentation is tracked by
> [#395](https://github.com/MartinoPolo/prejemesi/issues/395).

## Desired state

A connected Grid/List selector beside the actual wishlist toolbar controls. Only the selected option
looks like a standard icon-only square button. The unselected option remains quiet and borderless on
the shared accent backing.

### Appearance and geometry

- Selected face: the neighboring Button's ink border, card fill, corner radius and icon size.
  Current CSS border is 2.5 px; preserve its actual browser rendering rather than substituting an
  outline of another weight.
- Visible selected square: 40 × 40 px on mobile, 32 × 32 px on desktop. Preserve icon positions and
  existing stationary semantic hit targets; mobile decoration extends around the existing segment.
- No enclosing ink frame, central divider or separate segment shadows. The shared backing uses the
  wishlist's accent palette and one ordinary resting shadow, matching adjacent controls' contextual
  depth tokens.
- The backing and its shadow end flush with the selected face's outer horizontal edge, on either
  selection. Remove the desktop backing's selected-side padding without moving the controls. Mobile
  edges are already flush. Preserve the backing around the unselected option.
- Preserve toolbar placement, spacing, labels and neighboring controls. Mobile uses icon-only
  Display, flexible space, More and Add. Desktop uses labeled Display and a separate right-aligned
  More/Add group.

### Interaction

- **No switcher hover lift, press shrink, translation or interaction-driven shadow-depth change.**
  Both the visible surface and semantic owners remain stationary. Selection and focus provide
  feedback.
- Exactly one option stays selected, including when clicking it again. Preserve view values and
  existing Compact fallback behavior in production.
- Preserve accessible names, selected-state semantics, visible keyboard focus, arrow-key navigation
  and normal activation. The mockup also supports Home/End.
- Respect depth preferences and light/dark appearances. Do not change shared animation policy or
  unrelated segmented controls to implement this scoped exception.

## Source fidelity

The approved mockup uses captured local seeded `/w/xmas2026` toolbar markup, compiled application
CSS, wishlist palette, fonts and icons. The following are reference dimensions, not a proposal to
resize semantic owners:

| Element                        | Mobile     | Desktop    |
| ------------------------------ | ---------- | ---------- |
| Semantic switcher owner        | 79 × 40 px | 67 × 32 px |
| Existing segment               | 38 × 38 px | 32 × 32 px |
| Approved painted backing       | 79 × 40 px | 66 × 32 px |
| Neighboring button face height | 40 px      | 32 px      |
| Shadow-inclusive toolbar gap   | 11 px      | 12 px      |

Preserve the captured desktop vertical segment overflow rather than silently changing the
established sizing contract during this work. Treat backing paint, selected face and semantic hit
region as separate geometry.

## Deliverables and acceptance

`refined.html` is the sole approved interactive mockup, with mobile and desktop device links,
unscaled viewport-width controls, light/dark mode and depth choices. Earlier alternatives and motion
comparisons are intentionally removed. Neighboring actions provide visual context only.

Verification must cover:

- Source-relative semantic geometry, typography and icon positions across narrow mobile and desktop
  widths.
- Both selections: selected square matches a neighboring icon-only button; inactive segment has no
  competing frame; backing ends flush on the selected side.
- Stable geometry and resting shadow during hover/press with normal and reduced motion.
- Exclusive selection, keyboard focus/navigation, palettes/depths, no clipping or overflow, and no
  missing assets or runtime errors.

The reference capture is frozen evidence of the approved design. Refreshing it against changed app
styles requires reviewing any visual differences, not silently changing the desired state.
