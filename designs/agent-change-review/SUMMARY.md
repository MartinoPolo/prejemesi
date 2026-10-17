# Agent Change Review — Design Summary

**Base**: Variant D | **Refined**: 2026-10-17

## Refinements Applied

Variant D was chosen and refined with: exact checkbox alignment, AA-passing coloured text, mixed and nothing-selected review states. See the design brief for full requirements. Key changes from variant B, which D grew out of: rows carry no kind badge; each row opens with a tinted header band holding the checkbox, the change type as coloured title text and the status, and the summary strip shows kind counts as the same coloured icon and text.

## Component Map

### Codebase — Use As-Is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| Badge | `src/lib/components/base/badge/` | Row status | `size="lg"`, `tone` per state |
| Checkbox | `src/lib/components/base/checkbox/` | Row selection, Vybrat vše (mixed) | contextual `md` desktop / `lg` mobile |
| Button | `src/lib/components/base/button/` | Apply, Zahodit návrh, Vrátit celou dávku | `intent="primary"`, red-outline reversal |
| Dialog | `src/lib/components/base/dialog/` | Apply confirmation, discard, undo | standard |
| Alert | `src/lib/components/base/alert/` | Conflict, expired, undo-conflict panels | `tone="warning"` / `"danger"` |
| SegmentedToggle | `src/lib/components/derived/segmented-toggle/` | Vše · Vyžaduje potvrzení · Konflikty | default |
| ImageFrame | `src/lib/components/derived/image-frame/` | Gift thumbs | `thumb` target |
| Skeleton | `src/lib/components/base/skeleton/` | Loading rows, including the header band | rows |
| GiftCard | `src/lib/components/blocks/gift/GiftCard.svelte` | Old/new card pair | non-interactive, footer omitted |

### Adopt from shadcn-svelte / Bits UI

None.

### Build Custom

| Proposed Name | Description | Why existing components don't cover it |
| --- | --- | --- |
| ChangeRow | Header band (checkbox, type title, status) over gift identity, diffs and card pair | Domain-specific composition |
| ChangeKindTitle | Icon + DynaPuff title coloured per change type; also used for summary counts | One mapping of type to colour and icon |
| FieldDiff | `label: old → new` with struck red and green tints | No diff primitive exists |
| ProposalApplyBar | Sticky count + single Apply | Specific to the proposal flow |

## Implementation Notes

- Keep the type-to-colour-and-icon mapping in one table shared by row titles and summary counts; colours come only from `--status-danger-text`, `--status-success-text`, `--brand-link` and ink.
- The band's top corners use the row's outer radius minus its border (nested-corner rule in `AGENTS.md`); it touches the border, so there is no padding term.
- Head cells must be their own flex cells with `min-height` equal to the checkbox size; a generic `td { display: block }` rule outranked them in the base variant and broke the centring.
- Badge `tone="warning"` text in `src/app.css` measures about 3.15:1; the mockup uses a 22% warning tint with `--foreground` text. Fix the shared tone, not call sites.
- The "Smíšený výběr" and "Nic nevybráno" review states are presets of the same selection model; the apply bar disables at zero.
