# Shared control sizing

The contract is defined by [issue #376](https://github.com/MartinoPolo/prejemesi/issues/376) and the
[design decisions](../.mpx/DECISIONS.md). Pixel values belong in [`src/app.css`](../src/app.css),
not duplicated component scales.

## Contract

- Explicit `sm`, `md`, `lg`, and `xl` heights are 26, 32, 40, and 48 px on every device.
- Omitted size uses `lg` below the `sm` breakpoint and `md` from that breakpoint.
- Text and icon-only formats share size-driven icon geometry. Consumers choose variants instead of
  overriding icon dimensions or control height.
- Equivalent adjacent actions use an 8 px gap on desktop and mobile. Section spacing and shadow
  clearance are separate concerns.
- Toolbar, category-group, and gift-card selection surfaces normally follow the responsive default.
  Visible checkbox geometry is separate from the semantic owner and accessible hit target.
- Shared shell surfaces use the centered wishlist maximum width and 12 px mobile / 16 px desktop
  gutters. Measure the brand and account-circle edges, not notebook padding or shadow extents.
- Nested corners follow `max(0, outer radius - border thickness - padding)`. Calculate unequal
  horizontal/vertical insets separately. Shadows do not change the geometric inset.
- Preserve stationary elevation owners, moving visual surfaces, and viewer-selected depth tokens.

The existing [`/playground`](../src/routes/playground/+page.svelte) is the shared comparison
surface; component stories document their public variants and interaction states.

## Audit ledger

Dedicated icon-sizing and component-reuse agents reviewed shared components and application
consumers, including navigation, dashboard, wishlist browsing, gift actions, authentication,
settings, dialogs, reservations, sharing, import, and draft entry. Findings below are the
implementation record. Focused regression tests exercise these corrections; full verification and
review results belong to the issue's PR rather than a frozen pass count here.

| Finding                                     | Resolution                                                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incomplete size families and outdated `lg`  | Canonical tokens and typed `control_sizing.ts`; Button, Input, Select, InputGroup, SearchField share the scale.                                                |
| Icon aliases and local dimensions           | Orthogonal size/format; password reveal, toast dismissal, reorder arrows, crop actions, and LikeButton use shared geometry.                                    |
| Hard-coded switcher geometry                | ToggleGroup/SegmentedToggle inherit size and format; the tray inset determines the inner radius.                                                               |
| Divergent selection surfaces                | Checkbox and nonsemantic CheckboxSurface share variants; card roots remain sole semantic selection owners. Marker inset derives from parent and control radii. |
| Action gaps and detail-bar mismatches       | Gift, hero, detail, and toolbar actions use compatible responsive sizes and the shared gap.                                                                    |
| Header/content gutters                      | Navbar, app layout, and wishlist surfaces share maximum width and `--page-gutter`; account triggers preserve decorative avatar content.                        |
| Raw paste textarea and navbar footer action | Reused Textarea and Button, preserving paste handling and action behavior.                                                                                     |
| Raw image-source tabs                       | Reused SegmentedToggle with keyboard selection and retained URL drafts.                                                                                        |
| Raw draft priority/link actions             | Reused Toggle/Button with explicit dense `sm` sizing and preserved callbacks.                                                                                  |
| Crop action and uploader mismatch           | Compact upload and remove actions follow the responsive default.                                                                                               |
| Local control/row shadows                   | Removed duplicate overlay shadows and used semantic compact row elevation.                                                                                     |
| Remaining pinned mobile defaults            | Dashboard filters/sort, DatePicker, reservation quantity controls, and import selects inherit responsive sizing.                                               |
| Incomplete comparison                       | Playground shows real controls, including LikeButton and shell triggers; component stories cover public size/format variants.                                  |

## Regression coverage

- [Rendered primitive matrix](../src/lib/components/base/control_sizing.svelte.test.ts): fixed and
  responsive geometry, icons, InputGroup inheritance, checkbox states, and focus.
- [Showcase browser tests](../tests/e2e/control-sizing-showcase.spec.ts): all button treatments,
  compatible peers, interactive Select, real depth preferences, and keyboard focus.
- [Shell alignment](../tests/e2e/header-control-spacing.spec.ts) and
  [form heights](../tests/e2e/control-heights.spec.ts): narrow and centered desktop layouts.
- Gift/wishlist component tests cover action geometry, role-dependent states, selection, wrapping,
  and real card/list overlay clearance. The synthetic wrapper fixture does not offset status badges
  to manufacture clearance; collision assertions use the production display components.

## Deliberate exceptions

These are distinct interaction or decorative surfaces, not another ordinary control-size scale:

- Native crop zoom ranges and hidden file/color inputs.
- Managed calendar cell controls and hidden calendar selects.
- Full-surface upload dropzones, choice cards, and navigable cards.
- Rows-driven textareas, including import paste content.
- Reorder grips with a small visible affordance and a larger hit target; mobile grips retain their
  established 60 px target.
- Mobile sheet action/choice rows retain their 48 px minimum touch target and wrapping content.
- Decorative avatars, status/badge icons, illustrations, image crops, and category swatches. Account
  triggers still follow shared control geometry.
- Dense or ghost sub-actions may use an explicit compact size while preserving an adequate hit
  target and shadow clearance. An exception must not silently override a named ordinary size.

Keep role-dependent actions, accessible names, keyboard operation, selection/pending states,
responsive wrapping, and focus clearance unchanged during geometry migration.
