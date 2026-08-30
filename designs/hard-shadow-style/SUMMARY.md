# Hard Shadow Style — Design Summary

**Base**: Variant B | **Refined**: 2026-08-30

## Refinements Applied

Variant B was chosen and refined with three depth choices, a compact self-previewing selector, Balanced ink values, an opaque black option, and quiet dark-mode shadows. See the design brief for full requirements. The oversized option cards and nested preview blocks were replaced by one compact row: each choice button demonstrates its own shadow recipe directly and uses only a name plus selected indicator.

## Component Map

### Codebase — Use As-Is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| SettingsAppearanceSection | `src/lib/components/blocks/settings/SettingsAppearanceSection.svelte` | Host the separate depth setting below palette | Existing autosave card structure |
| ToggleGroup | `src/lib/components/base/toggle-group/` | Three mutually exclusive compact choices | `type="single"`, `intent="outline"` |
| Button | `src/lib/components/base/button/` | Choice-button interaction and production sizing | `intent="outline"`, compact custom layout |
| PaletteSwitcher | `src/lib/components/derived/palette-switcher/PaletteSwitcher.svelte` | Independent ten-palette selector | `variant="inline"` / `"popover"` |
| DarkModeToggle | `src/lib/components/derived/dark-mode-toggle/DarkModeToggle.svelte` | Independent light/dark/system selector | `variant="inline"` |
| AppearanceMenu | `src/lib/components/derived/appearance-menu/AppearanceMenu.svelte` | Compact-menu placement for the same depth control | Existing `w-72` popover |

### Adopt from shadcn-svelte / Bits UI

None. Existing project primitives cover the interaction.

### Build Custom

| Proposed Name | Description | Why existing components don't cover it |
| --- | --- | --- |
| DepthStyleSwitcher | Three compact `Jemné` / `Inkoustové` / `Černé` choices whose own shadows preview their token recipes | ToggleGroup supplies selection behavior but not independent per-item shadow tokens or persistence |
| DepthComparisonSpecimen | Design/Storybook matrix across palettes, modes, and representative surfaces | A global semantic token preference needs focused visual regression coverage |

## Implementation Notes

- Keep `Jemné` as the migration and first-use default.
- Each selector item sets a local choice-shadow variable, so all three recipes remain visible regardless of the active global depth.
- Apply the selected style globally through semantic hard-shadow tokens; do not override individual production components.
- Dark mode keeps shadows dark: near-black 42%/55% for `Jemné`, near-black 48%/62% for `Inkoustové`, and opaque black for `Černé`.
- Preserve explicit selection through `aria-pressed`, border, surface, and radio mark. The shadow is a preview, not the sole state indicator.
- Add the missing viewer preference persistence using the existing palette model: user preference plus cookie mirror for SSR, with anonymous cookie fallback and pre-paint application.
- The three choices stay in one row at 390 px and may stack only below that supported viewport when labels would clip.
