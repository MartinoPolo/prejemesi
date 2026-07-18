# Unified Filters — Design Summary

**Base**: Variant A | **Refined**: 2026-07-18

## Refinements Applied

Variant A was chosen and refined with: dashboard gap-fill pill placement (trigger adjacent),
mobile pill-less mode on both surfaces, clear-all as dropdown item on mobile. See the design
brief for full requirements. Key changes from the base variant: the dashboard toolbar cluster is
reordered to `[Zrušit filtry][pills…][Filtrovat][Řazení][view toggle]` so pills grow leftward
into the empty title↔toolbar gap and sort/view controls never shift; below 640 px (`sm`) pills
are hidden entirely on both surfaces, the trigger count badge carries the active state, and
„Zrušit filtry" renders as the last dropdown item behind a separator.

## Component Map

### Codebase — Use As-Is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| `DropdownMenu` | `src/lib/components/base/dropdown-menu/` | filter dropdown: `Root` + `Trigger` + `Portal` + `Content` + `Group` + `GroupHeading` + `CheckboxItem` + `Separator` + `Item` (mobile clear-all) | `closeOnSelect={false}` for multi-toggle |
| `Button` | `src/lib/components/base/button/` | dropdown trigger | `intent="outline"`, 32 px |
| `Button` | `src/lib/components/base/button/` | desktop clear-all | `intent="ghost" size="sm"` |
| `Badge` (metrics only) | `src/lib/components/base/badge/` | pill sizing reference (26 px, rounded-full) | `size="lg"` metrics, not the component itself |
| `SimpleTooltip` | `src/lib/components/base/tooltip/` | full label of truncated pill | text |
| Lucide icons | — | `list-filter` (trigger), `x` (pill remove + mobile clear-all item), `check` (checkbox) | — |

### Adopt from shadcn-svelte / Bits UI

| Component | Source | Install command | Purpose |
| --- | --- | --- | --- |
| — none — | | | base components cover everything |

### Build Custom

| Proposed Name | Description | Why existing components don't cover it |
| --- | --- | --- |
| `FilterMenu` (derived) | config-driven dropdown: filter definitions (id, label, gate) + change callback; renders trigger with count badge + CheckboxItems + mobile-only clear-all Item | pattern on 2+ surfaces; today bespoke (`GiftFilterOverflowMenu`) |
| `ActiveFilterPills` (derived) | removable pill (label + × button) row incl. desktop clear-all; `direction` prop or slot order controls growth side (wishlist: after trigger, rightward; dashboard: before trigger, leftward); hidden below `sm` | `Badge` non-interactive; `FilterChip` is a toggle, not removable pill |

## Implementation Notes

- **Dashboard toolbar reorder**: `DashboardToolbar` DOM order becomes clear-all → pills →
  FilterMenu trigger → SortDropdown → ViewToggle. The cluster is right-anchored by the
  PageHeader's `justify-between`, so growth is naturally leftward; no extra CSS needed beyond
  `justify-content: flex-end` on the toolbar for clean wrapping. Trigger position moves from
  "after view toggle" to front of the cluster (brief §3.1 amended).
- **Pill insertion order**: on both surfaces the first-activated pill sits closest to the
  trigger and newer pills grow away from it (wishlist: rightward append; dashboard: leftward
  prepend). One rule: "pills grow away from the trigger into empty space".
- **Mobile (`< sm` / 640 px)**: pill row renders nothing (`hidden sm:flex`); FilterMenu appends
  `DropdownMenu.Separator` + `DropdownMenu.Item` „Zrušit filtry" only when `< sm` AND ≥1 filter
  active (CSS-driven visibility preferred over JS matchMedia to avoid SSR flicker). Count badge
  on the trigger is the only persistent indicator.
- **Count badge**: rendered whenever ≥1 filter active at all breakpoints (desktop keeps pills
  AND badge, matching chosen Variant A).
- **Focus management**: removing a pill moves focus to the next pill, else back to the trigger.
  Mobile clear-all item closes the menu and returns focus to the trigger (default DropdownMenu
  behavior).
- **A11y**: trigger `aria-label` includes active count („Filtrovat, 2 aktivní filtry"); pill ×
  is a real button with „Zrušit filtr: <label>"; menu uses Bits UI `menuitemcheckbox` semantics.
- **Motion**: pill enter/exit micro-animation motion-safe only; none on mobile (no pills).
- **Edge cases**: wrapping still works ≥ `sm` when many pills (#104 categories) — dashboard
  PageHeader row wraps as a whole with the title staying left; wishlist panel wraps internally
  keeping the `ml-auto` cluster reachable.
