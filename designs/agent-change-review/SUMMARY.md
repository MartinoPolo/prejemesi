# Agent Change Review: Design Summary

**Base**: Variant D | **Refined**: 2026-10-17

## Refinements Applied

Variant D was chosen and refined with: AA-passing coloured text, per-field accept, reject and edit matching the AI chatbot, preselected field changes with unresolved decisions blocking apply, and a floating apply bar. See the design brief for full requirements. Key changes from variant B, which D grew out of: rows carry no kind badge; each row opens with a tinted header band holding the change type as coloured title text, the status and the row's decision controls, and the summary strip shows kind counts as the same coloured icon and text.

## Component Map

### Codebase: Use As-Is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| Badge | `src/lib/components/base/badge/` | Row status | `size="lg"`, `tone` per state |
| Button | `src/lib/components/base/button/` | Apply, Zamítnout vše, Přijmout vše, Zahodit návrh, Vrátit celou dávku | `intent="primary"` / `"secondary"`, red-outline reversal |
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
| ChangeRow | Header band (type title, status, decision controls) over a large gift identity, field rows and card pair | Domain-specific composition |
| ChangeKindTitle | Icon + DynaPuff title coloured per change type; also used for summary counts | One mapping of type to colour and icon |
| FieldDecisionRow | Label, `previous → next`, ✓ ✕ ✎ toggles, inline editor (Zrušit, Uložit) and decision pill; share it with the chatbot's field review | No diff or per-field decision primitive exists |
| GiftDecisionToggle | Přijmout vše / Zamítnout vše per gift with `aria-pressed` true, mixed or false; whole-row items use their own two choices (Smazat / Ponechat) | Tri-state over many fields; no toggle-group primitive covers it |
| ProposalApplyBar | Floating sticky card: count, Zamítnout vše, Přijmout vše, single Apply with `aria-disabled` while anything is unresolved | Specific to the proposal flow |

## Implementation Notes

- Keep the type-to-colour-and-icon mapping in one table shared by row titles and summary counts; colours come only from `--status-danger-text`, `--status-success-text`, `--brand-link` and ink.
- The band's top corners use the row's outer radius minus its border (nested-corner rule in `AGENTS.md`); it touches the border, so there is no padding term.
- Head cells must be their own flex cells with a `min-height` equal to the band control size; a generic `td { display: block }` rule outranked them in the base variant and broke the centring.
- Badge `tone="warning"` text in `src/app.css` measures about 3.15:1; the mockup uses a 22% warning tint with `--foreground` text. Fix the shared tone, not call sites.
- The review states are presets of one model: per-field decisions (unresolved, accepted, rejected, plus an optional edit) and whole-row decisions (unresolved, true, false). Field changes start accepted and always-confirmed rows unresolved. The per-gift toggles derive from it (true, mixed, false) and write through it.
- Use `aria-disabled` on the blocked Apply, never `disabled`: the click is what outlines the unresolved controls and names the count.
- The Po card is computed from the field decisions, so it always previews exactly what Apply writes.
