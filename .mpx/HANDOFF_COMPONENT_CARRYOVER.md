# Component Carry-Over: Grovekeeper → Darecky + template-sveltekit

Comprehensive spec for upgrading the base component library in both Darecky and template-sveltekit using Grovekeeper's mature implementations. Produced from a detailed grilling session comparing every component file-by-file.

## Source Repositories

| Repo                            | Path                                 | Role                                                 |
| ------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| **Grovekeeper** (source)        | `C:\_MP_projects\Grovekeeper`        | Component library source — mature, production-tested |
| **Darecky** (target)            | `C:\_MP_projects\Darecky`            | App project — receives upgraded components           |
| **template-sveltekit** (target) | `C:\_MP_projects\template-sveltekit` | Template repo — receives same component upgrades     |

## Branch Strategy

1. **Work on `dev` branch** in Darecky (currently at `48c7d07`). This branch matches template-sveltekit's current state.
2. Set `dev` as the **default branch** for the Darecky repository (`gh repo edit --default-branch dev`).
3. After all component changes land on `dev`, **rebase `one-shot`** (19 commits ahead of dev) onto the updated `dev`.
4. Fix any import/prop renames caused by the rebase (mechanical grep-and-replace: `variant=` → `intent=`/`tone=` etc.).
5. Apply the **same component changes** to `template-sveltekit` (identical base component library).

## Execution Order

### Phase 1: Design Tokens (`app.css`)

Darecky already has most tokens. Add only what's missing and needed by carried-over components.

**Tokens to ADD to `:root` and `.dark`:**

```css
/* Surface hierarchy (GK components reference these) */
--surface: var(--background); /* alias — maps to existing --background */
--surface-2: var(--secondary); /* alias — maps to existing --secondary */
--surface-3: var(--muted); /* alias — maps to existing --muted */
--surface-hover: color-mix(in oklch, var(--foreground) 6%, transparent);

/* Text hierarchy */
--foreground-muted: var(--muted-foreground); /* alias — GK name for existing token */
--foreground-subtle: oklch(0.5 0.012 107); /* new — between muted and invisible */

/* Border */
--border-strong: oklch(0.815 0.018 107); /* new — emphasis borders */

/* Primary */
--primary-soft: oklch(0.92 0.03 150); /* new — soft primary overlays */
```

Dark mode values:

```css
.dark {
	--surface-hover: color-mix(in oklch, var(--foreground) 8%, transparent);
	--foreground-subtle: oklch(0.55 0.012 107);
	--border-strong: oklch(0.35 0.015 107);
	--primary-soft: oklch(0.25 0.04 150);
}
```

**Register in `@theme inline` block:**

```css
--color-surface: var(--surface);
--color-surface-2: var(--surface-2);
--color-surface-3: var(--surface-3);
--color-surface-hover: var(--surface-hover);
--color-foreground-muted: var(--foreground-muted);
--color-foreground-subtle: var(--foreground-subtle);
--color-border-strong: var(--border-strong);
--color-primary-soft: var(--primary-soft);
```

**Animations to add** (needed by Input loading state, Accordion, Badge):

```css
@keyframes shimmer {
	0% {
		background-position: 200% 0;
	}
	100% {
		background-position: -200% 0;
	}
}

@keyframes accordion-down {
	from {
		height: 0;
	}
	to {
		height: var(--bits-collapsible-content-height);
	}
}

@keyframes accordion-up {
	from {
		height: var(--bits-collapsible-content-height);
	}
	to {
		height: 0;
	}
}

@keyframes badge-pulse {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.4;
	}
}
```

Register in `@theme inline`:

```css
--animate-shimmer: shimmer 2s ease-in-out infinite;
--animate-accordion-down: accordion-down 0.2s ease-out;
--animate-accordion-up: accordion-up 0.2s ease-out;
--animate-badge-pulse: badge-pulse 1.5s ease-in-out infinite;
```

**DO NOT change:**

- Font stacks (Figtree + Noto Sans — intentionally different from GK's Geist)
- Spacing base (4px — intentionally different from GK's 2px)
- Theme selector (`.light`/`.dark` — keep, do not adopt GK's `[data-theme]`)
- Existing shadcn token names (`--primary`, `--secondary`, `--destructive`, etc.)

### Phase 2: Utility Updates

Verify `src/lib/utils/variants.ts` has `asExhaustiveArray` (it does — already present).

Verify `src/lib/utils.ts` exports: `cn`, `WithElementRef`, `WithoutChildren`, `WithoutChild`, `WithoutChildrenOrChild`. Add any missing type helpers from GK.

### Phase 3: GK-Winner Components (carry over from Grovekeeper)

For each: copy GK files, translate token references to Darecky equivalents, create stories.

**Token translation rules** (apply when carrying over GK component classes):
| GK class | Darecky equivalent |
|---|---|
| `bg-surface` | `bg-background` |
| `bg-surface-2` | `bg-secondary` |
| `bg-surface-3` | `bg-muted` |
| `bg-surface-hover` | `bg-surface-hover` (new token) |
| `text-foreground-muted` | `text-muted-foreground` |
| `text-foreground-subtle` | `text-foreground-subtle` (new token) |
| `border-border-strong` | `border-border-strong` (new token) |
| `bg-primary-soft` | `bg-primary-soft` (new token) |
| `text-status-danger` | `text-status-danger` (already exists) |
| `h-(--size-control-md)` | `h-(--size-control-md)` (already exists) |
| `text-(length:--text-sm)` | `text-(length:--text-sm)` (already exists) |
| `z-(--z-dropdown)` | `z-(--z-dropdown)` (already exists) |

#### 3.1 Button

**Source:** `C:\_MP_projects\Grovekeeper\src\lib\components\shadcn\button\`
**Target:** `src/lib/components/base/button/`

**Files to create:**

- `button-variants.ts` — from GK, with modifications below
- `Button.svelte` — from GK (note: PascalCase filename)
- `index.ts` — from GK
- `Button.stories.svelte` — from GK, expanded

**Modifications to GK Button:**

Intents — final set (8):
| Intent | Source | Notes |
|---|---|---|
| `primary` | GK | Keep as-is, translate `bg-surface` tokens |
| `secondary` | GK | Keep |
| `ghost` | GK | Keep, translate `bg-surface-hover` → use new token |
| `ghost-overlay` | GK | Keep |
| `danger` | GK | Keep, uses `--status-danger` (exists in Darecky) |
| `primary-destructive` | GK | Keep, uses `--status-danger` (exists) |
| `outline` | Darecky | Add from current Darecky `variant='outline'` classes |
| `link` | Darecky | Add from current Darecky `variant='link'` classes |

**Strip:** `contextual-primary` (GK moss-specific), `issue-color` (GitHub-specific)

Sizes — final set (7):
| Size | Source |
|---|---|
| `xs` | Darecky |
| `sm` | GK |
| `md` | GK (default) |
| `lg` | GK |
| `icon` | GK |
| `icon-xs` | Darecky |
| `icon-sm` | GK |

Remove `FILLED_BUTTON_KBD_CLASSES` constant (references `[data-slot=kbd]` which will come from Kbd component — can be added back after Kbd is carried over if needed).

Prop name: `intent` (not `variant`).
Default intent: `primary`.
Default size: `md`.

Export: `buttonVariants`, `ButtonIntent`, `ButtonSize`, `BUTTON_INTENTS`, `BUTTON_SIZES`, `BUTTON_TEXT_SIZES`, `BUTTON_ICON_SIZES`, `ButtonProps`.

#### 3.2 Badge

**Source:** `C:\_MP_projects\Grovekeeper\src\lib\components\shadcn\badge\`
**Target:** `src/lib/components/base/badge/`

**Files to create:**

- `badge-variants.ts` — from GK
- `Badge.svelte` — from GK
- `index.ts` — from GK
- `Badge.stories.svelte` — from GK

**Modifications:**

Tones — final set (7): `neutral`, `success`, `warning`, `danger`, `info`, `primary`, `accent`.
**Strip:** `merged` (GitHub-specific).

Styles: `outlined`, `subtle`, `solid` — keep all 3.
Formats: `default`, `mono` — keep both.
Sizes: `default`, `compact` — keep both.
Features: `collapsed`, `dot` (static/pulsing), `icon` snippet — keep all.

Prop name: `tone` (not `variant`).
Remove compound variant for `merged` tone.

#### 3.3 Card

**Source:** `C:\_MP_projects\Grovekeeper\src\lib\components\shadcn\card\`
**Target:** `src/lib/components/base/card/`

**Files to create:**

- `card-variants.ts` — from GK
- Keep existing `Card.svelte` and sub-components but add the GK variants integration

**Modifications:**

States — final set (10): `default`, `hover`, `selected`, `focus`, `dragging`, `loading`, `error`, `success`, `archived`, `disabled` — keep all.

Padding: `none`, `padded` — keep both.

Add `accentBarColor` prop (useful for wishlist theme color on cards).
**Skip** `gradientTint` prop.

Note: Darecky's card already has sub-components (Header, Title, Description, Content, Footer, Action). Keep Darecky's sub-component structure. Only add the `card-variants.ts` with states/padding and integrate it into the root Card component.

Prop name: `state` (semantic — describes card state). `padding` stays as-is.

#### 3.4 Input

**Source:** `C:\_MP_projects\Grovekeeper\src\lib\components\shadcn\input\`
**Target:** `src/lib/components/base/input/`

**Files to create:**

- `input-variants.ts` — from GK
- Update `Input.svelte` to use variants (keep Darecky's file input handling)
- `index.ts` — update exports
- `Input.stories.svelte` — expand with state examples

States: `default`, `success`, `error`, `loading` (with shimmer animation).

Prop name: `state`.

Keep Darecky's special `type="file"` branch and its styling.

#### 3.5 Textarea

**Source:** `C:\_MP_projects\Grovekeeper\src\lib\components\shadcn\textarea\`
**Target:** `src/lib/components/base/textarea/`

**Files to create:**

- `textarea-variants.ts` — from GK
- Update `Textarea.svelte` to use variants
- `index.ts` — update exports
- `Textarea.stories.svelte` — expand

States: `default`, `error`.
Prop name: `state`.

Keep Darecky's `field-sizing-content` and `min-h-16` (GK doesn't have these — they're good additions).

#### 3.6 Alert

**Source:** `C:\_MP_projects\Grovekeeper\src\lib\components\shadcn\alert\`
**Target:** `src/lib/components/base/alert/`

**Files to create:**

- `alert-variants.ts` — from GK
- Update `Alert.svelte` to import from variants file (remove inline `<script module>`)
- `index.ts` — update exports
- `Alert.stories.svelte` — expand

Tones: `default`, `destructive`, `warning` — keep all 3.

Prop name: `tone` (not `variant`).

Keep Darecky's sub-component structure (AlertTitle uses `font-heading`).

#### 3.7 Tooltip

**Source:** `C:\_MP_projects\Grovekeeper\src\lib\components\shadcn\tooltip\`
**Target:** `src/lib/components/base/tooltip/`

**Files to create:**

- `tooltip-variants.ts` — from GK
- `SimpleTooltip.svelte` — from GK (convenience wrapper)
- Update existing sub-components with GK styling improvements
- `index.ts` — add SimpleTooltip export
- `Tooltip.stories.svelte` — from GK (extensive delay/content examples)

Keep Darecky's `delayDuration=0` default on Provider.
Add SimpleTooltip for the common case (icon button + text tooltip).

### Phase 4: Darecky-Winner Upgrades

These stay as Darecky's implementation but get structural improvements.

#### 4.1 Dialog — Add Body sub-component

Keep all Darecky dialog files. Add:

- `dialog-body.svelte` — from GK (`overflow-y-auto px-5 py-4` scrollable content area)
- Update `index.ts` to export Body
- Rename all files to follow convention (lowercase folder, any new components PascalCase)
- Create `Dialog.stories.svelte` with play tests if not present

#### 4.2 Label — Merge typography

Keep Darecky's flex layout (`flex items-center gap-2`). Add GK's typography refinements:

- `tracking-[0.01em]`
- `text-(length:--text-sm)` (use design token instead of raw `text-sm`)
- `text-muted-foreground` (explicit text color)

Create `label-variants.ts` only if introducing `tv()`. Otherwise just update the inline classes.

#### 4.3 Switch — PascalCase rename

Keep Darecky's implementation (size prop, RTL support). Rename to PascalCase convention.

#### 4.4 Checkbox — PascalCase rename + stories

Keep Darecky's implementation (larger click target). Carry over GK's richer stories with play tests.

#### 4.5 Sheet — PascalCase rename

Keep Darecky's implementation (backdrop blur). Rename to PascalCase.

#### 4.6 Separator — PascalCase rename

Keep as-is. Rename to PascalCase. Add more stories from GK (With Surrounding Content, In a Form).

#### 4.7 Skeleton — PascalCase rename

Keep Darecky's implementation (GK doesn't have this). Rename to PascalCase.

### Phase 5: Merged Components

#### 5.1 Select — Merge best of both

Keep Darecky's implementation as the base. Add from GK:

- `state` prop on trigger (default/error) with error border + ring styling
- GroupHeading uppercase styling
- Full stories with play tests (16 stories from GK, adapted)

Do NOT carry over GK's native `<select>`. Custom-only.

Keep from Darecky:

- Scroll buttons (up/down)
- `size` prop on trigger
- `highlighted` state in item children
- `SelectLabel` component
- `preventScroll` on content
- Reuse of base Separator
- All current styling (dark mode, focus states)

#### 5.2 DropdownMenu — Merge best of both

Keep Darecky's implementation as the base. Add from GK:

- SubContent defaults: `align='start'`, `alignOffset=-4`, `sideOffset=2`, `z-50`, `overflow-x-hidden overflow-y-auto outline-none`
- Shortcut: add `group-data-[variant=destructive]/dropdown-menu-item:text-destructive` alongside existing focus color
- Full stories with play tests (8 stories from GK, adapted)
- Remove duplicate `data-inset:pl-8 data-[inset]:pl-8` on Label (keep just `data-[inset]:pl-8`)

Keep from Darecky:

- Bold focus style (`bg-accent` + `text-accent-foreground`)
- `cursor-default` on items
- Subtle destructive focus (`bg-destructive/10` + dark variant)
- Child text propagation on focus

### Phase 6: New Components (from Grovekeeper)

Carry over these 14 components. Each needs token translation (see table above) and PascalCase file naming.

For each component, copy from GK, translate tokens, create/adapt stories.

| #   | Component                    | GK Source Path                                            | Notes                                                                                                                                      |
| --- | ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **HelpText**                 | `src/lib/components/base/help-text/`                      | 3 states: default/error/success. Uses `--foreground-subtle`, `--status-danger`, `--status-success`                                         |
| 2   | **SearchField**              | `src/lib/components/base/search-field/`                   | Wraps Input + search icon. Depends on Input being carried over first                                                                       |
| 3   | **Toggle**                   | `src/lib/components/shadcn/toggle/`                       | Wraps bits-ui Toggle + Button styling. Depends on Button                                                                                   |
| 4   | **ToggleGroup**              | `src/lib/components/shadcn/toggle-group/`                 | Uses Svelte context to pass intent/size to items. Depends on Toggle                                                                        |
| 5   | **Tabs**                     | `src/lib/components/shadcn/tabs/`                         | Custom implementation (not bits-ui). `active` prop on Tab                                                                                  |
| 6   | **Accordion**                | `src/lib/components/shadcn/accordion/`                    | bits-ui based. Needs `animate-accordion-down/up` keyframes                                                                                 |
| 7   | **Collapsible**              | `src/lib/components/shadcn/collapsible/`                  | bits-ui based. Simple wrapper                                                                                                              |
| 8   | **Popover**                  | `src/lib/components/shadcn/popover/`                      | bits-ui based. Has Item/Label/Divider sub-components. Note: Darecky's one-shot branch already has a simpler Popover — this will REPLACE it |
| 9   | **Kbd**                      | `src/lib/components/shadcn/kbd/`                          | Pure CSS. 3 formats (default/lucide/mono), 3 tones (neutral/accent/inverted)                                                               |
| 10  | **InputGroup**               | `src/lib/components/shadcn/input-group/`                  | Complex `:has()` selectors. Depends on Input, Textarea, Button                                                                             |
| 11  | **Progress**                 | `src/lib/components/shadcn/progress/`                     | bits-ui based. Simple value/max wrapper                                                                                                    |
| 12  | **RadioGroup**               | `src/lib/components/shadcn/radio-group/`                  | bits-ui based. Custom radio styling                                                                                                        |
| 13  | **Toast**                    | `src/lib/components/shadcn/toast/`                        | 5 tones: info/success/warning/danger/loading. Has dismiss button                                                                           |
| 14  | **Calendar + RangeCalendar** | `src/lib/components/shadcn/calendar/` + `range-calendar/` | Complex compositions (18-21 sub-components each). Depends on bits-ui + `@internationalized/date`. Carry over as-is with token translation  |

**Dependency order for new components:**

1. HelpText (no deps)
2. Kbd (no deps)
3. SearchField (depends on Input)
4. Toggle (depends on Button)
5. ToggleGroup (depends on Toggle)
6. Tabs, Accordion, Collapsible, Popover, Progress, RadioGroup (independent)
7. InputGroup (depends on Input, Textarea, Button)
8. Toast (depends on Button)
9. Calendar, RangeCalendar (depends on Button, bits-ui calendar primitives)

### Phase 7: Stories

Every component must have a `.stories.svelte` file. For GK-carried-over components, adapt GK's stories. For Darecky-winner components, create new stories or expand existing ones.

Stories should include:

- "All Variants" grid showing every combination
- Individual variant stories
- Play tests for interactive components (click, keyboard, disabled state)
- Integration examples (e.g., Input + HelpText + Label)

### Phase 8: PascalCase Rename

After all components are in place, rename files:

- Component folders: **lowercase** (e.g., `button/`, `dropdown-menu/`)
- Main component file: **PascalCase** (e.g., `Button.svelte`, not `button.svelte`)
- Sub-component files: **lowercase with prefix** (e.g., `dialog-content.svelte`) — these stay lowercase
- Variants files: **lowercase** (e.g., `button-variants.ts`)
- Stories files: **PascalCase** (e.g., `Button.stories.svelte`)
- Index files: **lowercase** (e.g., `index.ts`)

Files that need renaming (currently lowercase main component):

- `button.svelte` → `Button.svelte`
- `badge.svelte` → `Badge.svelte`
- `input.svelte` → `Input.svelte`
- `textarea.svelte` → `Textarea.svelte`
- `checkbox.svelte` → `Checkbox.svelte`
- `switch.svelte` → `Switch.svelte`
- `label.svelte` → `Label.svelte`
- `separator.svelte` → `Separator.svelte`
- `skeleton.svelte` → `Skeleton.svelte`
- `alert.svelte` → `Alert.svelte`
- All multi-part root components: `dialog.svelte` → `Dialog.svelte`, `sheet.svelte` → `Sheet.svelte`, etc.

Update all `index.ts` imports to match new filenames.

### Phase 9: Rebase one-shot

After dev is stable with all component changes:

```bash
git checkout one-shot
git rebase dev
```

Expected conflicts: files under `src/lib/components/base/` where one-shot uses old prop names.

**Mechanical renames needed after rebase:**

| Old (one-shot uses)               | New (dev has)                                       | Files affected                |
| --------------------------------- | --------------------------------------------------- | ----------------------------- |
| `variant="default"` on Button     | `intent="primary"`                                  | All files importing Button    |
| `variant="secondary"` on Button   | `intent="secondary"`                                |                               |
| `variant="outline"` on Button     | `intent="outline"`                                  |                               |
| `variant="ghost"` on Button       | `intent="ghost"`                                    |                               |
| `variant="destructive"` on Button | `intent="danger"` or `intent="primary-destructive"` | Case-by-case                  |
| `variant="link"` on Button        | `intent="link"`                                     |                               |
| `variant="default"` on Badge      | `tone="neutral"`                                    | All files importing Badge     |
| `variant="secondary"` on Badge    | `tone="neutral" badgeStyle="subtle"`                |                               |
| `variant="destructive"` on Badge  | `tone="danger"`                                     |                               |
| `variant="outline"` on Badge      | `tone="neutral" badgeStyle="outlined"`              |                               |
| `variant="default"` on Alert      | `tone="default"`                                    | All files importing Alert     |
| `variant="destructive"` on Alert  | `tone="destructive"`                                |                               |
| Import paths                      | May change if file renamed                          | Update `.svelte` → PascalCase |

The one-shot branch also added components not on dev (Dialog, Sheet, DropdownMenu, Tooltip, Popover). These will conflict with the dev versions. Resolution: **take dev's version** for the component files, then verify one-shot's usage still works with the updated APIs.

### Phase 10: Apply to template-sveltekit

Apply the same changes to `C:\_MP_projects\template-sveltekit`:

1. Same `app.css` token additions
2. Same base component upgrades
3. Same new components
4. Same PascalCase renames

The template should NOT include:

- Darecky-specific tokens (`--wishlist-*`, `--color-reserved/liked/archived`)
- Any derived or block components
- Storybook stories (template-sveltekit may or may not have Storybook — check first)

## Package Dependencies

Check that both target repos have these dependencies (GK components need them):

| Package                   | Purpose                              | Check in                      |
| ------------------------- | ------------------------------------ | ----------------------------- |
| `bits-ui`                 | Headless primitives                  | Both repos                    |
| `tailwind-variants`       | `tv()` variant system                | Both repos                    |
| `@lucide/svelte`          | Icons                                | Both repos                    |
| `@internationalized/date` | Calendar/RangeCalendar date handling | Add if carrying over Calendar |
| `tw-animate-css`          | Animation utilities                  | Both repos                    |

## Naming Conventions Summary

| Concept              | Convention         | Example                 |
| -------------------- | ------------------ | ----------------------- |
| Button variant prop  | `intent`           | `intent="primary"`      |
| Badge variant prop   | `tone`             | `tone="success"`        |
| Alert variant prop   | `tone`             | `tone="warning"`        |
| Input/Textarea state | `state`            | `state="error"`         |
| Card state           | `state`            | `state="loading"`       |
| Badge style          | `badgeStyle`       | `badgeStyle="solid"`    |
| Folder names         | lowercase          | `button/`, `help-text/` |
| Main component       | PascalCase         | `Button.svelte`         |
| Sub-components       | lowercase-prefixed | `dialog-content.svelte` |
| Variants file        | lowercase          | `button-variants.ts`    |
| Stories file         | PascalCase         | `Button.stories.svelte` |

## Verification Checklist

After each phase:

- [ ] `pnpm run check` passes (typecheck)
- [ ] `pnpm run check:all` passes (format + lint + typecheck + stylelint + fallow)
- [ ] Storybook renders all new/changed components
- [ ] No unused exports flagged by fallow (suppress if intentional re-exports)

After rebase:

- [ ] `pnpm run check` passes on one-shot
- [ ] `pnpm run dev` runs without errors
- [ ] All existing pages render correctly
- [ ] Button/Badge/Alert prop renames are complete (no `variant=` on these components)

## Open Items

- **Calendar/RangeCalendar npm dependency**: Verify `@internationalized/date` is compatible with the project's other deps. May need to install it.
- **Toast integration**: GK's Toast is a standalone component. Darecky may prefer `svelte-sonner` for toast management. Decide during implementation whether to use GK's Toast component inside sonner's toast system or replace entirely.
- **Popover conflict**: one-shot branch already has a simpler Popover. The GK version (with Item/Label/Divider) is more complete. Take GK's version and update one-shot's usage.
- **Select and DropdownMenu visual comparison**: User wants to visually compare in Storybook before finalizing. The merge spec above is the agreed plan, but final styling tweaks may happen after visual review.
