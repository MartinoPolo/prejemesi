# Wishlist Motion Strategy — Design Brief

> **Status**: Refined (Variant A + selected behavior from Variant B)
> **Refined mockup**: `designs/motion-strategy/refined.html`
> **Summary**: `designs/motion-strategy/SUMMARY.md`
> **Refinements**: slower received/hidden sequences, Variant B hidden exit and card/list transition, identity-gated cross-section gift flight, in-place filter entry/exit, slow sibling FLIP, no hidden-result banner, Variant A secondary motions, three approved list-motion studies, and a realistic reorder-toolbar proposal pending approval

Create an interactive approval-stage motion study for Přejeme si. The primary problem is spatial disorientation: activating a filter inserts an active-filter pill and changes toolbar height immediately; marking a gift received refreshes data and moves that gift into the final „Obdržené“ section, causing every sibling to jump. The mockups must let the reviewer replay and compare real transitions before production code changes.

**Source**: user motion-review request; issues #161, #239, #240, #246, #255; standalone implementation tracker #268 (`Keep wishlist toolbar stable during gift reorder mode`); `.mpx/DECISIONS.md` motion and wishlist-display decisions. Issue #268's `design needed` label remains pending user approval.

---

## 1. Purpose

This study defines purposeful motion for state changes that alter layout or item position. Motion must explain cause and destination, not decorate routine actions.

The primary workflow answers three questions:

1. Did the filter activate?
2. Why did the toolbar and gift grid move?
3. Where did the gift go after it was marked received?

**Key value**: preserve spatial continuity so users understand changed state without having to rescan the whole wishlist.

---

## 2. Surrounding Context

The mockup **MUST** reproduce a realistic wishlist manager view at desktop proportions and provide a 390 px mobile preview mode.

### Full Viewport Structure

1. **Motion-study utility header**: variant name, concise motion principle, replay/reset controls, speed (`1×` and `0.25×`), viewport (`Desktop` and `Mobile`), and reduced-motion toggle. This is mockup-only chrome and must be visually subordinate.
2. **App header** (~56 px, FINAL): compact Přejeme si logo/navigation/action context. At mobile width, simplify it in the same way as the production header.
3. **Wishlist notebook header** (FINAL, reduced height is acceptable): „Pro: Martin Novák“, „Vánoce 2026“, status/event metadata.
4. **Wishlist toolbar** (primary design area): current 32 px labeled control families in order: view → sort → grouping → filter → reset → separated reorder; atomic management actions aligned right. Active filter pills are visible at desktop and mobile per the latest toolbar decision.
5. **Gift display** (primary design area): six realistic gift cards, with one card suitable for marking received. A final „Obdržené“ section appears when received gifts are shown.
6. **Other valuable motion opportunities**: a compact gallery below the core wishlist demo, showing four small interactive examples: reservation confirmation, card/list view change, wizard step change, and like acknowledgement. These are recommendations, not full surface redesigns.
7. **Motion specification strip**: currently playing phase, duration, easing, and a short explanation of what the motion communicates.

**What parent provides**: existing app shell, notebook visual language, toolbar controls, cards, semantic tokens, and state behavior.

**What this design fills**: transition choreography between existing states.

**Must NOT include**: new business actions, new data semantics, a separate “bought” state, confetti, looping decorative movement, page-route transitions, or redesign of toolbar/card information architecture.

**Mockup rendering instructions**:

- Default canvas should fit approximately 1440×900 without requiring horizontal scroll.
- The interactive wishlist stage should be centered and responsive.
- Provide a mockup-only viewport toggle that constrains the live stage to ~390 px.
- Every scenario must be replayable without reloading the HTML file.
- Use real DOM state changes and Web Animations API/CSS transitions, not GIF/video simulation.

---

## 3. Requirements

### 3.1 Interactive scenario controls

- `Přehrát filtr`: activates „Zobrazit obdržené“, inserts a count on the filter trigger and an active pill, expands/reflows the toolbar, and reveals the final received section.
- `Přijatý → dolů`: starts from a state where received gifts are shown, marks „Stolní lampa“ received, changes its action/badge, and moves it from its current slot to the final „Obdržené“ section.
- `Přijatý → skrýt`: starts from the default hidden-received state, marks the same gift received, removes it from active browsing, closes the sibling gap, and clearly communicates that it moved to hidden received gifts.
- `Vrátit zpět`: restores the moved/hidden gift to active content with reverse spatial continuity.
- `Reset`: restores initial data, filters, toolbar layout, scroll position, and phase label.
- Disable conflicting scenario controls while a sequence is running.
- Repeated rapid activation must cancel/finish prior animations cleanly; no duplicate cards, stale placeholders, or stuck inline transforms.

### 3.2 Filter activation choreography

The animation must make the causal chain readable:

1. Filter trigger acknowledges activation.
2. Count badge and active pill enter.
3. Toolbar grows or wraps with an eased height/layout transition.
4. Gift content shifts coherently; relevant received content enters.

Constraints:

- Control feedback starts immediately.
- Toolbar movement uses standard easing, never spring/bounce.
- New pill may use scale only if the variant’s direction calls for it.
- The filter and result update feel like one coordinated event, not sequential loading.
- A gift newly revealed or hidden by filtering enters or exits at its final location, using at most an in-place opacity reveal. It must not receive translate/FLIP movement merely because it was inserted or revealed.
- FLIP capture includes only rendered, non-zero-size cards present on both sides of the update. Existing visible cards whose measured coordinates genuinely change may use bounded FLIP to avoid jumping.
- The production latest decision keeps active pills visible on mobile; mobile mockup must show realistic wrapping and an intact atomic actions row.

### 3.3 Mark received with visible destination

- The clicked gift first shows a local pending/acknowledgement state; layout must not move before the action is visually acknowledged.
- On success, show the received state (`Přijato` badge/sticker and „Označit jako nepřijatý“ action).
- Move the gift to a final section labeled `Obdržené`, after every active gift.
- Animate surviving siblings into their new positions using stable gift IDs and FLIP-style transforms.
- The moved gift must remain recognizable throughout. A shared-element clone, crossfade, or retained moving card is allowed depending on variant.
- Preserve focus conceptually on the moved gift’s reverse action; the mockup may visualize focus but must not unexpectedly scroll.
- The motion must work when movement crosses the section boundary.

### 3.4 Mark received with hidden destination

- When `Zobrazit obdržené` is off, marking received removes the gift from active browsing.
- Do not visually fly it to an off-screen destination.
- Use Variant B’s intentional local fade/scale exit. Do not fly the gift toward an invisible destination.
- Do not insert an inline banner, placeholder, or status row: these create a second layout shift. Announce completion through the existing polite live region.
- After the exit completes, every surviving sibling closes the gap with an individually measured FLIP transform; no sibling may jump directly to its final position.
- Keep `Vrátit zpět` in the stable study controls so reversal does not add content inside the wishlist layout.

### 3.5 Mobile behavior

- Constrain the stage to ~390 px and use one gift column.
- Toolbar controls and active pills wrap without overflow; management actions remain atomic on a final row.
- Do not animate long-distance movement to an off-screen received section. Use a local fade/state cue and let visible siblings settle.
- Keep touch targets realistic.
- Avoid automatic scrolling during motion.

### 3.6 Reduced motion

- Mockup toggle must emulate `prefers-reduced-motion: reduce` without requiring OS changes.
- Reduced mode removes travel, scale, spring, and interpolated layout transforms.
- State, copy, badge, focus, and polite announcement still update immediately.
- Very short opacity changes are acceptable only if they do not obscure state; zero-duration is preferred for layout.
- All decorative examples stop moving in reduced mode.

### 3.7 Inspection speed and instrumentation

- `0.25×` is a review aid only; it multiplies durations but is labeled as non-production.
- Display current phase, production duration, easing token, and behavior summary.
- Show production timing, not slowed timing, in the spec strip.
- Approved baseline timing envelope:
  - control acknowledgement: 180 ms;
  - pill and compact state entry: 220 ms;
  - filter-toolbar layout change: 320 ms;
  - hidden gift exit: 340 ms;
  - sibling grid reflow: 520 ms;
  - cross-section gift flight: 650 ms.
- These timings intentionally run at about half the original baseline speed. Large transitions use standard easing and may not be shortened to micro-animation timing.

### 3.8 Secondary motion gallery

Provide four compact, independently replayable examples:

1. **Reservation success**: button label/icon/color morph plus count update; no celebration.
2. **Card ↔ list view**: use Variant B’s two-stage crossfade: fade the retained collection out, change geometry, then fade/settle it in; no staggered page reveal.
3. **Wizard step**: Source → Review directional horizontal transition with step connector progress.
4. **Like**: brief heart fill/scale pop and count crossfade.

Also provide four compact, independently replayable demos. The first three are approved together as one coherent list/list-order motion family:

1. **Notification loading**: transition from skeletons to the loaded notification list.
2. **Import draft rows**: insert and remove draft rows in place.
3. **Categories**: reorder and delete category rows with stable identity and measured sibling movement.
4. **Reorder-mode toolbar** (proposal pending approval): preserve the real toolbar and its responsive slots. Morph only `Změnit pořadí` in place to `Hotovo`. Keep view/preview/sort/group/filter/reset/active-filter/settings/batch-add/add-gift controls visible in their existing slots but programmatically disabled while incompatible. Do not add a Save/Cancel session, translate or reflow the toolbar, or move focus. Reveal grips in place. Reduced motion changes state immediately.

All four share the speed and reduced-motion controls and must not insert layout-shifting banners. The earlier image-editor border/frame-mode candidate is rejected because it does not correspond to the real editor. Track implementation of the reorder proposal in standalone issue #268; its `design needed` label remains pending user approval.

---

## 4. Variant Directions

### Refined direction — Variant A with selected Variant B behavior

- Variant A remains the visual and structural base.
- Use Variant B’s local fade/scale for hiding and its two-stage card/list crossfade.
- Filter pill/count enter over 220 ms; toolbar and results settle over 320 ms.
- The received badge changes first, then the real gift card flies above the grid to the visible final `Obdržené` section over 650 ms, but only when that same gift identity moves between two visible sections.
- Newly revealed or removed filter results enter or exit in place and never inherit a translate from missing or zero-size coordinates.
- Every previously and subsequently visible affected sibling whose coordinates genuinely change uses an independently measured 520 ms FLIP transform during visible relocation, hidden removal, filter reflow, and undo.
- Hidden gifts exit locally over 340 ms, followed by the 520 ms sibling reflow. No banner or inserted status row follows.
- Use `--ease-standard` for all large movement; no large spring motion.

### Variant B — Sticker Confirmation

- Adds controlled anime-sky character without making layout playful.
- Small pill and received sticker use `--ease-spring` over ~160–180 ms.
- Large toolbar/grid movement remains standard ~220–240 ms.
- Received sticker pops before the card moves, making completion unmistakable.
- Never bounce the full card/grid.

### Variant C — Not selected

Variant C remains a reference artifact only and receives no further refinement. Its destination highlight and path annotation are not part of the approved direction.

---

## 5. States

| State | Visual Treatment | Trigger |
| --- | --- | --- |
| Initial | One-row desktop toolbar, no active pills, six active gifts | Reset/load |
| Scenario pending | Clicked control/button shows immediate local pending state; conflicting controls disabled | scenario starts |
| Filter entering | Trigger count and pill appear; toolbar begins eased reflow; newly revealed cards appear at final coordinates with at most opacity | filter activation |
| Filter active | Pill removable, reset enabled, received section visible; only continuously visible displaced cards may have used FLIP | filter animation settles |
| Received acknowledged | Gift badge/action changes before relocation | mark success |
| Gift relocating | Actual changed card flies above the grid; all affected siblings FLIP slowly to targets | visible destination |
| Received arrived | Card rests under `Obdržené`; reverse action receives focus without scrolling | relocation complete |
| Gift exiting | Card fades/scales locally without collapsing its grid slot mid-exit | hidden destination |
| Hidden completion | Every sibling finishes a slow FLIP reflow; live region announces completion; no banner is inserted | exit complete |
| Undo | Reverse state and layout movement | user invokes undo |
| Mobile | Single column, wrapped toolbar, local movement only | viewport toggle |
| Reduced motion | Immediate state replacement, no travel/scale/layout interpolation | reduced toggle |
| Slow inspection | Same choreography at 0.25× while spec shows production timings | speed toggle |
| Error concept | Gift remains stationary; error cue only (may be documented, not simulated) | failed mutation |

---

## 6. Component Reuse Map

### Existing Components (MUST mirror)

| Component | Usage in this study |
| --- | --- |
| `WishlistDetailToolbar.svelte` | Current toolbar shell, labeled control order, responsive row behavior |
| `FilterMenu` + `ActiveFilterPills.svelte` | Filter trigger/count and removable active pill |
| `GiftViewSwitcher.svelte` | Card/list/compact controls |
| `GiftCard.svelte` | Main gift surface, received sticker/action |
| `GiftListItem.svelte` | Secondary view-change example |
| `GiftReceivedToggle.svelte` | Mark received/unreceived labels and local pending state |
| `GiftSectionHeader.svelte` | Final `Obdržené` section header |
| Button/Badge base variants | Sticker buttons, focus, status indicators |
| `gift_pointer_reorder.svelte.ts` | Behavioral reference for cancel-safe WAAPI FLIP and reduced-motion guard |

### Components to Adopt

None. Svelte transitions and Web Animations API cover the behavior.

### Components to Design for production (after approval)

| Component/helper | Description | Why new |
| --- | --- | --- |
| Layout motion coordinator | Captures visible `data-gift-id` positions before refresh and FLIP-animates attached elements after refresh | Current nested section rendering prevents a simple `animate:flip` addition |
| Mutation motion state | Tracks pending/completed gift IDs and focus/live-announcement handoff | Prevents motion from confirming failed remote mutations |
| Small transition wrappers | Standard active-pill and conditional-row enter/exit choreography | No Svelte transition directives currently exist in app surfaces |

---

## 7. Layout Constraints

- Main app content max width: 1200 px.
- App nav height: 56 px.
- Toolbar controls: 32 px `md`; active pills use current production metrics.
- Desktop gift stage: three columns with stable card dimensions and 20–24 px gaps.
- Mobile gift stage: one column; no horizontal overflow.
- Toolbar height is content-driven; mockup must measure before/after height rather than hardcode a fake endpoint.
- Animate transforms/opacity wherever possible. Height interpolation is allowed only for the small toolbar/placeholder region.
- Do not animate the page header or app chrome when filters change.

---

## 8. Design Tokens

Mockups must link `../../tokens.css`, then map the current canonical `src/app.css` visual identity:

- Headings: DynaPuff Variable.
- Body: Geist Variable.
- `--duration-fast`: 100 ms.
- `--duration-normal`: 200 ms in production app.
- `--duration-slow`: 300 ms.
- `--ease-standard`: `cubic-bezier(0.2, 0.7, 0.3, 1)`.
- `--ease-spring`: `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- Semantic colors only: `--background`, `--card`, `--foreground`, `--muted-foreground`, `--primary`, `--status-success`, `--border`, `--ink`.
- Sticker geometry and hard shadows should match the Anime Sky design language.

---

## 9. Design Constraints (Non-Negotiable)

- Motion communicates state/layout change; no confetti, ambient loops, or decorative travel.
- Received gifts remain hidden by default and, when shown, always form a final section.
- Marking received remains the primary manager action and auto-enables the received filter in current production behavior; the study also demonstrates the hidden-destination design as an alternative/other filter outcome for approval.
- Use stable gift IDs and cancel-safe animation. Never duplicate or lose a gift in final DOM state.
- Coordinate capture must ignore detached, non-rendered, and zero-size elements. FLIP requires the same identity to have valid visible rectangles before and after the update.
- Cross-section flight is reserved for the same gift identity truly moving between two visible sections; filter-only insertion/removal always enters/exits in place.
- A mutation is not visually confirmed until success; failures do not move the gift.
- Large layout movement uses standard easing, not spring.
- Reduced-motion mode preserves all information and operability.
- Focus/announcement strategy must be represented in labels or notes.
- Czech text uses formal address and no em dash.
- Existing owner/recipient reservation privacy invariants remain untouched.
- The study is mockup-only; do not alter Svelte application files.

---

## 10. Design Freedom

- Exact shadow/elevation treatment while the real gift card flies above the grid.
- Whether production coordinates the cross-section movement with the retained DOM node or an inert visual clone, provided identity and focus handoff remain stable.
- Small badge/sticker timing within the allowed envelope.
- Stage annotation placement and visualization of motion paths.
- Secondary gallery composition, provided it remains compact and interactive.

---

## 11. Visual References

- `designs/unified-filters/refined.html` — current toolbar/filter visual language.
- `designs/redesign-2026/sky-final/anime-sky-final.html` — current Anime Sky wishlist page.
- `src/app.css` — canonical tokens and motion keyframes.
- `src/lib/components/blocks/wishlist/WishlistDetailToolbar.svelte` — actual responsive toolbar.
- `src/lib/components/blocks/gift/GiftCard.svelte` and `gift_card_variants.ts` — current card/received styling.
- `src/lib/components/blocks/wishlist/gift_pointer_reorder.svelte.ts` — established WAAPI FLIP precedent.

---

## 12. Not Included

- Production implementation or Svelte refactor.
- Backend/API/database changes.
- Changing received/filter semantics.
- New undo persistence behavior.
- Full route transitions.
- Continuous animation of long lists.
- Compact-view motion or redesign; the refined core stage demonstrates only card/list switching.
- Production implementation of the three approved list-motion studies or the reorder-toolbar proposal; the refined study contains four demos, and the reorder proposal still requires user approval.
- Image-editor border/frame-mode motion; the candidate was rejected because it does not correspond to the real editor.
