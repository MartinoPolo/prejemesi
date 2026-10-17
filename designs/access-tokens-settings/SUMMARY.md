# Access Tokens Settings — Design Summary

**Base**: Variant B | **Refined**: 2026-10-17

## Refinements Applied

Variant B was chosen and refined with: 365-day default expiry and presets up to 10 years, a regenerate (roll) action, an expired state led by regenerate, AA-safe warning and success text. See the design brief for full requirements. Key changes from the base variant: every row carries "Vygenerovat znovu" beside its revoke/remove action, a regenerate confirm dialog with its own expiry select, and the reveal step reused for the regenerated secret without the step indicator.

## Component Map

### Codebase — Use As-Is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| Card | `src/lib/components/base/card/` | Section shell | as other settings sections |
| Button | `src/lib/components/base/button/` | Create, regenerate, revoke, dialog footers | `intent="primary"/"secondary"/"danger"/"primary-destructive"`, `size="sm"` rows |
| Badge | `src/lib/components/base/badge/` | Bez kontroly, Vypršel, scope chips | `tone="warning"/"danger"/"neutral"` |
| Dialog | `src/lib/components/base/dialog/` | Create/reveal, regenerate, revoke, close-without-copy | standard and small |
| Select | `src/lib/components/base/select/` | Platnost, Platnost nového tokenu | default |
| Field, Input, ChoiceRow, Checkbox, RadioGroup, Switch, HelpText | base / derived | Create form | default |
| Alert | `src/lib/components/base/alert/` | Shown-once warning | `tone="warning"` |
| InputGroup | `src/lib/components/base/input-group/` | Token value + Kopírovat | readonly mono |
| Toast, Skeleton, TextLink, Separator | base | Feedback, loading, links | default |

### Adopt from shadcn-svelte / Bits UI

None.

### Build Custom

| Proposed Name | Description | Why existing components don't cover it |
| --- | --- | --- |
| AccessGrantRow | Name, scope sentence, lists, meta, expired note, regenerate + revoke actions, details | Shared by tokens and future OAuth apps |
| ScopePicker | Scope rows with explanations and warnings | Domain-specific |
| TokenRevealPanel | Shown-once secret, copy, quick start, summary, optional replaced-prefix note | Reused by create and regenerate |
| TokenRegenerateDialog | Kept/ended summary and expiry select preset to the original duration | New flow |

## Implementation Notes

- Persist each token's preset duration so regenerate can preselect it. Expiry is presets only; the custom-date expiry kind on `dev` (`src/lib/modules/access_tokens/types.ts`) is no longer offered.
- Regenerate is one server operation that swaps the hash, prefix, expiry and created time and clears last used, keeping the token id so revisions and proposals stay attributed to the same named token.
- Revoke deletes the token; nothing remains to regenerate.
- The light `--warning-text` mix in the mockup is 50% warning into foreground; 55% measured 4.49:1 on the card.
- The copied state of the Kopírovat button uses a success tint with `--status-success-text`, not white on raw success.
- Focus returns to the row's action after the reveal closes; the toast reads "Token vygenerován znovu" after regenerating.
