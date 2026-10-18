# Agent Change Review — Design Brief

> **Status**: Refined (Variant D)
> **Refined mockup**: `designs/agent-change-review/refined.html`
> **Summary**: `designs/agent-change-review/SUMMARY.md`
> **Refinements**: tinted row header with the change type as coloured title text instead of a kind badge, title and status centred on the checkbox, `--status-success-text` for green text, AA-safe warning tone, mixed and nothing-selected review states, per-field accept, reject and edit shared with the AI chatbot (`designs/ai-chatbot/`)

The review page where a user inspects a batch of changes that their own agent (Claude, Codex, a script) proposed for one wishlist, deselects what they do not want, applies the rest in one transaction, and can undo the whole batch afterwards. It turns an opaque API call into a visible, reversible diff the user trusts.

**Source**: [#475](https://github.com/MartinoPolo/prejemesi/issues/475) (epic [#480](https://github.com/MartinoPolo/prejemesi/issues/480), undo from [#474](https://github.com/MartinoPolo/prejemesi/issues/474)); `.mpx/DECISIONS.md` § Agent access & AI automation.

---

## 1. Purpose

An agent acting as the user submits a batch of operations. The server dry-runs it and stores it for 7 days as a **proposal**, returning a review link `/w/<id>/changes/<proposalId>`. The user opens the link (from the agent's reply), and must answer at a glance:

- What will change, on which gifts, and how each card will look afterwards?
- Which rows are risky (deleting, reserving, inviting a person) and need my explicit confirmation?
- Which rows cannot apply because the gift changed after the agent looked at it?
- After applying: can I take it all back?

**Key value**: the user sees exactly what their agent wants to do and keeps the final word, field by field.

---

## 2. Surrounding Context

The page is a normal authenticated route inside the `(app)` layout.

### Full Viewport Structure

1. **App navbar** (final state, reproduce faithfully): 56 px tall, brand logo left (tilted, DynaPuff wordmark "Přejeme si"), section links Moje seznamy / Spravované / Sledované as background pills, notifications bell and avatar right. Mobile: logo, bell, avatar, drawer trigger.
2. **Content container**: centered, `--content-default-max-width` 1200 px, gutters 12 px mobile / 16 px desktop. The wishlist's **scoped palette** applies to the page body (sample: `sky`).
3. **Compact page header** (new, this design): a back link "← Zpět na seznam" to `/w/<id>`, the eyebrow "Návrh změn", title "Vánoce pro babičku" (wishlist title), meta line "Pro: Babička Věra". It is **not** the spiral-notebook wishlist hero; a compact header keeps the table above the fold.
4. **Proposal summary strip**: submitter and channel ("Navrhl: Petr Svoboda přes token „Claude – vánoční dárky“"), submitted time ("13. 10. 2026 v 21:47"), expiry ("Platnost ještě 6 dní 23 h"), counts by kind ("14 změn: 3 nové dárky, 8 úprav, 1 smazání, 1 rezervace, 1 pozvánka").
5. **Change table** (focus of the design), scrolling with the page.
6. **Sticky apply bar** at the viewport bottom (desktop and mobile), holding the selection count and the single Apply action.

**What parent provides**: navbar, page background, palette scope, toaster.
**What this page fills**: the content container below the navbar, full width up to 1200 px.
**Must NOT include**: the wishlist notebook hero, the gift toolbar (View/Display/Add gift), or wishlist settings tabs.

**Mockup rendering instructions**:

- Desktop frame ~1440×900 and mobile frame 390×844, light and dark (dark derived from tokens, light is the source of truth).
- The change table and apply bar are the focus; the navbar is shown at full fidelity but not redesigned.
- Provide in-mockup controls (a small review toolbar, visually separate from the design) to switch: viewport, theme, and page state (Pending, Field decisions, Editing a value, Conflict on apply, Applied with undo, Undo conflict, Undone, Expired, Loading).

---

## 3. Requirements

### 3.1 Who sees the page

- Only the user who owns the token that submitted the proposal (the token always acts as that user). Other users, including other správci of the wishlist, get the ordinary not-found page.
- Old/new gift cards render in the **viewer's role shape**: a linked recipient sees no reservation state, counts, likes or names; a správce sees reservation state. Proposals never bypass surprise protection.
- Sample persona for the mockup: **Petr Svoboda, správce** of "Vánoce pro babičku" (free-text recipient "Babička Věra"), so reservation and manager-invitation rows are legitimate.

### 3.2 Change table

- One row per operation, in the agent's submitted order, grouped visually by gift where several operations touch the same gift (e.g. price + image on one gift form one row with two field diffs).
- Row anatomy (desktop):
    - **Selection checkbox** (button-sized visible surface, `md` 32 px desktop / `lg` 40 px mobile per control sizing).
    - **Row header** (replaces a kind badge): a full-width band tinted with the type colour (12% in oklab over the row surface, 7% for ink-coloured types) holding the checkbox, the type as a DynaPuff semibold 16 px title with an 18 px icon (Nový dárek, Úprava · 2 pole, Doplnění popisu, Smazání dárku, Rezervace, Pozvánka správce, Přesun pořadí, Přijato, Kategorie, Úroveň priority) and the status Badge on the right, all centred on the checkbox. Deletion uses `--status-danger-text`, new gifts `--status-success-text`, reservations and invitations `--brand-link`, other types ink with a muted icon. Blocked rows keep the coloured title on a grey band.
    - **Gift identity**: 1:1 thumb (ImageFrame, `thumb` target) and gift name; for wishlist-level rows (category or priority-level management, invitation) an icon instead of a thumb.
    - **Field rows** (new gifts, edits, description appends): one read-only row per field with the label, `previous → next` and three 32 px icon buttons ✓ Přijmout, ✕ Zamítnout, ✎ Upravit (same contract as the chatbot). The previous value is `--status-danger-text` with strikethrough, the arrow muted, the next value `--status-success-text` at weight 600 without decoration; an empty previous value shows a muted placeholder (new gifts show `+ next`). Image changes show the old thumb dimmed with a red outline and the new thumb with a green outline. Long text wraps; links show domain + label.
    - **Field decision**: ✓ and ✕ are pressed toggles (`aria-pressed`); clicking the active one clears the decision, there is no other undo control. ✎ swaps the value for its control (input, textarea, select, image picker) with Uložit and Zrušit; Enter saves (Ctrl/Cmd+Enter in a textarea), Escape cancels. Saving marks the field accepted with the text pill "Upraveno"; saving a value equal to the proposal stores no edit. Other pills: "Přijato", "Zamítnuto". Accepted and edited fields get a 12% success tint, rejected fields a muted dashed surface with the next value dimmed. A new gift's name cannot be rejected alone (✕ disabled with a tooltip); the row checkbox drops the whole gift.
    - **Field summary** under the fields: "Použije se 1 ze 2 polí".
    - **Row status**: Připraveno / Částečně / Nevybráno / Konflikt / Nelze použít / Vyžaduje potvrzení / Použito / Vráceno.
- **Card-affecting rows** (category, priority, image, price, also name and quantity for new gifts) additionally show **old and new gift cards side by side** (desktop Card geometry: 4:3 image, category top-left, priority bottom-left, title, links, price, action footer omitted or non-interactive). New-gift rows show only the new card; delete rows show only the old card with a "bude smazán" treatment. The Po card reflects the field decisions: rejected fields keep the previous value, edited fields show the user's value, and a new gift with every field rejected shows "Dárek se nepřidá".
- Description appends (post-share) show only the appended text in green, rendered with the accent append style, labeled "Doplnění popisu", because the original is immutable.
- Reorder rows show "pozice 7 → 2" and the neighbouring gift names, not a card pair.
- Table header: "Vybrat vše" master checkbox (mixed state), a count, and quick filters as a segmented control: Vše · Vyžaduje potvrzení · Konflikty. A filter never changes the selection.
- Overflow: very long names truncate with full text available (tooltip/title); field lists wrap; row height is content-driven.
- 200 rows max (batch cap); the page must stay usable at 200 rows (no virtualisation needed for the mockup, but avoid per-row heavy chrome; card pairs may be collapsed behind a per-row "Zobrazit karty" disclosure when the list is long; designer decides the default).

### 3.3 Selection rules

- Ordinary rows start **selected**: every field is undecided and an undecided field applies. A row applies when at least one of its fields does.
- The row checkbox is a whole-gift shortcut: unticking rejects every field (and drops saved edits), ticking clears those rejections. It shows the mixed state when only some fields apply. "Vybrat vše" works the same way across ordinary rows.
- Changes are counted per gift: one row is one change however many fields it touches. The apply bar adds "U 2 dárků jen vybraná pole." when rows apply partially.
- Deletions, reservations, invitations and reorders have no fields; they stay whole-row decisions with the checkbox.
- **Separately confirmed rows** (gift deletion, reservations, manager invitations) start **unselected** and live in a highlighted "Vyžaduje potvrzení" treatment. Selecting one is the confirmation of that row; the row states the consequence in plain words:
    - Smazání: "Dárek „Bezdrátová sluchátka“ bude trvale odstraněn." A gift with active reservations can never be deleted, so such a row is "Nelze použít".
    - Rezervace: "Zarezervujete 1 ks pod svým jménem Petr Svoboda." (the reserving actor is the user)
    - Pozvánka správce: shows the **exact email** in monospace, e.g. `eva.kralova@email.cz`, "dostane e-mail s pozvánkou a uvidí rezervace". Email is never truncated; it wraps.
- **Conflict rows**: the gift changed after submission. Checkbox disabled and unchecked, warning treatment, reason "Dárek se po odeslání návrhu změnil (upravila Jana Dvořáková, 13. 10. v 21:50)." plus a "Zobrazit aktuální stav" disclosure showing current vs proposed. Cannot apply.
- **Nelze použít rows**: the dry-run rejected the operation under ordinary rules (e.g. renaming a gift after share grace, lowering quantity, deleting a reserved gift). Same disabled treatment as conflicts, with the rule as the reason.
- Rows that depend on a deselected row (e.g. editing a gift the same batch creates) are deselected together and explain why.

### 3.4 Apply

- One primary button in the sticky bar: "Použít 11 vybraných změn". Disabled at zero selected ("Nic není vybráno").
- When any separately confirmed row is selected, Apply opens a confirmation Dialog listing exactly those rows (deletions by gift name, reservation with quantity, invitation with exact email) with "Potvrdit a použít" (primary) and "Zpět ke kontrole". Without such rows, Apply runs directly.
- Apply is one transaction for all selected conflict-free rows, applying only their included fields (edited fields with the user's value). Loading: button shows spinner + "Používám…", table locked.
- If a gift changes between page load and Apply, nothing applies; the page reloads the dry-run, marks the new conflicts, keeps the user's other selections, and shows an inline alert "2 změny mezitím přestaly platit. Zkontrolujte je a použijte znovu." (no partial apply).
- Secondary action: "Zahodit návrh" (ghost/danger outline) with a confirm dialog; the link then shows the Discarded state.

### 3.5 After apply and undo

- Success: a non-dismissable success panel at the top "Použito 11 změn · 13. 10. 2026 v 21:52" with "Vrátit celou dávku" (red-outline reversal button with undo icon, per gift action conventions) and "Otevřít seznam". Rows show "Použito"; unselected rows show "Nepoužito" muted. The sticky apply bar disappears.
- Undo confirm Dialog: "Vrátit všech 11 změn? Pozvánky a rezervace se zruší, smazané dárky se obnoví." Undo is one core operation (#474).
- Undo conflict: if any gift changed after apply, undo refuses as a whole: alert listing the changed gifts "Tyto dárky se od použití změnily, dávku nelze vrátit celou: …".
- Undone state: panel "Dávka vrácena · 13. 10. v 21:58"; rows "Vráceno".
- Undo remains available while revisions exist (90-day retention) and nothing changed since; the panel states nothing about timing unless unavailable.

### 3.6 Expired and other terminal states

- **Expired** (7 days after submission, not applied): warning panel "Platnost návrhu vypršela 20. 10. 2026. Požádejte svého agenta o nový návrh." Table remains readable but dimmed, checkboxes and Apply removed.
- **Discarded**: same read-only treatment, "Návrh jste zahodili."
- **Revoked token**: the proposal still applies (the user is the actor), but the summary strip notes "Token byl zrušen".
- **Loading**: skeleton rows (Skeleton component), not a spinner page.
- **Not found / no access**: ordinary app 404.

### 3.7 Mobile

- Rows become stacked row cards: the header band holds checkbox + type title; the status moves to the first line of the row body (title and status do not fit 390 px together), then gift identity and field rows: label and the three buttons on the first line, `previous → next` below; in edit mode Uložit and Zrušit fill the width at `lg` 40 px.
- Old/new cards side by side are kept as two narrow cards (compact mobile Card geometry, ~170 px each) or swapped through a "Před / Po" segmented control; designer decides, both must keep the cards legible.
- Sticky apply bar with count and full-width primary Apply (`lg` 40 px), safe-area clearance.
- The filter segmented control scrolls horizontally if needed; no wrapping toolbars.

---

## 4. States

| State                   | Visual Treatment                                                         | Trigger                                    |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| Pending (default)       | Selectable table, sticky Apply bar                                       | Proposal open and not expired              |
| Loading                 | Skeleton summary + skeleton rows                                         | Initial load                               |
| Row selected            | Checked box, full-contrast row                                           | Default for ordinary rows                  |
| Row deselected          | Unchecked, row content at reduced emphasis (diffs stay readable)          | User unticks                               |
| Row partial             | Mixed checkbox, "Částečně" status, field summary                         | Some fields rejected                       |
| Field accepted          | Pressed ✓, "Přijato" pill, success tint                                  | User clicks ✓                              |
| Field rejected          | Pressed ✕, "Zamítnuto" pill, muted dashed surface, next value dimmed     | User clicks ✕                              |
| Field editing           | Pressed ✎, control with Uložit / Zrušit below the value                  | User clicks ✎                              |
| Field edited            | Pressed ✓, "Upraveno" pill, user's value as next, agent's value noted    | User saves an edit                         |
| Needs confirmation      | Highlighted row frame, consequence sentence, starts unselected           | Deletion, reservation, invitation          |
| Conflict                | Warning badge + reason, disabled checkbox, current-state disclosure      | Gift changed after submission              |
| Nelze použít            | Danger-tone badge + rule reason, disabled checkbox                        | Dry-run rejected the operation             |
| Hover / focus           | Row hover background, visible focus ring on checkbox and disclosures     | Pointer / keyboard                         |
| Apply disabled          | Disabled primary, helper text                                            | Zero rows selected                         |
| Confirm dialog          | Dialog listing confirmation rows, exact email                            | Apply with confirmation rows selected      |
| Applying                | Spinner in button, table locked                                          | Apply in flight                            |
| Apply conflict          | Inline alert, newly conflicting rows marked, nothing applied             | Gift changed between load and apply        |
| Applied                 | Success panel with Undo, rows "Použito"/"Nepoužito", no Apply bar          | Apply succeeded                            |
| Undo conflict           | Alert listing changed gifts, Undo disabled                               | A gift changed after apply                 |
| Undone                  | Info panel, rows "Vráceno"                                               | Undo succeeded                             |
| Expired                 | Warning panel, read-only dimmed table                                    | 7 days passed                              |
| Discarded               | Info panel, read-only table                                              | User discarded                             |
| Error                   | Toast for action failures                                                | Network/server failure                     |

---

## 5. Component Reuse Map

### Existing Components (MUST use)

| Component                         | Variant/Props                                         | Usage in This Design                                  |
| --------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Button                            | `intent="primary" size="md"` (`lg` mobile)            | Apply, Potvrdit a použít                              |
| Button                            | `intent="secondary"` / `intent="ghost" size="sm"`     | Zpět ke kontrole, Zobrazit karty, filters' overflow   |
| Button                            | `intent="danger"` with undo icon                      | Vrátit celou dávku (reversal convention)              |
| Checkbox                          | contextual size (`md`/`lg`), mixed state for master   | Row selection, Vybrat vše                             |
| Badge                             | `tone="neutral"/"primary"/"warning"/"danger"/"success"/"info"` | Kind and status badges                     |
| SegmentedToggle                   | default                                               | Vše · Vyžaduje potvrzení · Konflikty; mobile Před/Po  |
| Alert                             | `tone="default"/"warning"/"destructive"`              | Applied/expired/conflict panels                       |
| Dialog                            | standard                                              | Apply confirmation, Undo confirmation, Discard        |
| GiftCard (blocks/gift)            | Card view, non-interactive actions                    | Old/new card pair                                     |
| ImageFrame / GiftListImage        | `thumb` target                                        | Row thumbnail                                         |
| GiftCategoryBadge, GiftPriorityBadge | as on cards                                        | Inside card pair and category/priority diffs          |
| GiftDescription append style      | accent append                                         | Description append diff                               |
| Skeleton                          | rows                                                  | Loading                                               |
| Toast                             | error                                                 | Action failures                                       |
| Navbar block                      | unchanged                                             | App chrome                                            |

### Components to Adopt

None. Table semantics use a native `<table>` on desktop (screen-reader row/column navigation) styled with tokens; no new shadcn primitive is needed.

### Components to Design (new)

| Component            | Description                                                      | Why New                                    |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| ChangeReviewTable    | Responsive table / stacked rows with selection and status        | No existing diff/review surface            |
| FieldDecisionRow     | Label, `previous → next`, ✓ ✕ ✎ toggles, inline editor, pill     | Shared with the chatbot's field review     |
| GiftCardComparison   | Old and new GiftCard side by side with "Před"/"Po" captions       | Composition of GiftCard                    |
| ProposalSummaryStrip | Submitter, channel, time, expiry, kind counts                    | New metadata                               |
| ApplyBar             | Sticky bottom bar with count and Apply                           | Mirrors mobile selection toolbar semantics |

---

## 6. Layout Constraints

- Desktop table columns: checkbox 48 px · kind 140 px · gift identity 220–280 px · diffs flexible · status 140 px. Card pair spans the diff+status columns beneath the row's diffs, each card ~240 px wide (default Card track).
- Mobile: single column of row cards, 12 px gutters, card pair two columns at ≥ 360 px viewport.
- Sticky apply bar: full content width, 64 px desktop / 72 px mobile + safe area; page content reserves its height at the end.
- Spacing beside elevated elements adds `--depth-clearance`; adjacent buttons use `--nested-control-gap`.
- Typography: page title 26–34 px DynaPuff semibold; section headings 22 px; row gift names 14 px semibold Geist; diff labels 12 px muted; values 13–14 px.

---

## 7. Design Tokens

From `src/app.css` (inline a mirrored subset in the standalone mockup; do not link `designs/tokens.css`):

- Fonts: `--font-head` DynaPuff Variable, `--font-body` Geist Variable (woff2 files in `designs/unavailable-gift-comparison/assets/`).
- Ink and surfaces: `--ink`, `--card`, `--background`, `--tint`, `--panel-hover`, `--muted-foreground`, `--brand`, `--primary`, `--primary-foreground`.
- Diff colors: field values carry no background; previous = `--status-danger-text` struck through, next = `--status-success-text`. The field row carries the decision: accepted = `color-mix(in oklab, var(--status-success) 12%, var(--card))`, rejected = muted surface with a dashed border. Card-pair highlights keep red/green dashed outlines. Mix in **oklab**, never oklch.
- Coloured text uses only `--status-success-text`, `--status-danger-text` or `--brand-link` (`src/app.css`), never raw `--status-success`.
- Warning (conflict, needs confirmation): `--status-warning`, `--accent-loud`; warning badges use a 22% warning tint with `--foreground` text because the warning text mix fails AA.
- Radii: `--radius-panel` 16 px, `--radius-btn` 7 px, `--radius-badge` 12 px; borders 2–2.5 px ink; hard offset shadows via elevation tokens.
- Control sizes: `--size-control-sm/md/lg` 26/32/40 px.

---

## 8. Design Constraints (Non-Negotiable)

- Czech copy in formal address (vykání), no em dashes in visible copy.
- Red/green never the only signal: strikethrough, arrow, and text labels carry meaning.
- Exact invitation email always fully visible before confirmation.
- Deletion, reservation and invitation rows never start selected and never apply without explicit confirmation.
- Conflict and rejected rows can never be selected.
- One Apply action; no per-row apply buttons.
- Gift cards reuse the real GiftCard geometry and badge placement (category top-left, priority bottom-left, state badges centred); do not invent a card.
- Role-filtered card rendering; no reservation data for recipients.
- Light mode is the source of truth; dark is token-derived.
- Keyboard: every checkbox, disclosure and button reachable in reading order; the sticky bar never hides the focused row.

---

## 9. Design Freedom

- Whether card pairs are always visible or behind a per-row disclosure, and their placement within the row.
- Grouping of confirmation rows (inline with a highlight vs a separate section at the top).
- Mobile card-pair strategy (two narrow cards vs Před/Po toggle).
- Summary strip layout and kind counts visualisation.
- Applied/Undo panel placement (top panel vs replacing the sticky bar).

---

## 10. Visual References

- `src/lib/components/blocks/gift/GiftCard.svelte`, `GiftListItem.svelte` — card geometry and badges.
- `designs/unavailable-gift-comparison/refined.html` — standalone token mirror and card markup to reuse.
- `designs/gift-viewer/refined.html` — dialog styling in standalone form.
- Mobile selection toolbar (DECISIONS 2026-09-04) — count + right-grouped actions semantics.
- External: GitHub pull-request "Files changed" (per-file checkboxes, red/green), Stripe dashboard review-before-commit tables.

---

## 11. Not Included (Scope Exclusions)

- Token creation and management (`designs/access-tokens-settings/`).
- Revision history browser and single-gift undo UI.
- Wishlist-level operations that are human-only (share, archive, revert, delete).
- Draft-wishlist creation proposals (they are not scoped to an existing `/w/<id>`; see open questions).
- Notifications/emails about proposals.
- MCP/CLI/OAuth/chatbot surfaces.

---

## 12. Open Questions for the Owner

Each was resolved by assumption so the mockups could proceed; please confirm or correct.

1. **Viewer**: only the submitting user can open the review page; other správci get 404. Alternative: any správce of the wishlist may review.
2. **Confirmation model**: deletions, reservations and invitations start unselected, ticking them is the per-row confirmation, and Apply then shows one dialog listing them. Alternative: per-row "Potvrdit" buttons without a dialog.
3. **Unselected rows after apply** are discarded with the proposal ("Nepoužito"); the proposal cannot be applied a second time. Alternative: keep leftovers pending until expiry.
4. **Discard action** ("Zahodit návrh") exists. The issue does not mention it.
5. **Rejected rows** ("Nelze použít", dry-run rule violations) are shown alongside conflicts rather than rejected at submission time.
6. **Undo scope**: one button undoes the whole applied batch only; single-gift undo stays out of this page.
7. **Draft wishlist creation** by an agent has no `/w/<id>` yet; assumed to need its own review route or fast-forward only.
8. **Compact header** instead of the notebook wishlist hero.
9. **Gift card pair for new-gift rows** shows only the new card, delete rows only the old card.
10. **"Vybrat vše"** toggles only ordinary rows; deletion, reservation and invitation rows are always ticked one by one.
11. **Diff and badge text contrast** (resolved): `--status-success-text` (see §7).
12. **Kind presentation** (resolved): variant D, a tinted row header with a coloured type title; uniform badges (B) and grouping by type (E) were not chosen.
13. **Counting and edits** (resolved): changes count per gift; saving an edit accepts the field as "Upraveno".
14. **Undecided fields apply**, so an untouched proposal applies in full, as before. Alternative: require a decision on every field.
15. **New gift name** cannot be rejected alone; dropping the gift goes through the row checkbox.
16. **Rejecting an edited field** discards the saved edit instead of keeping it for a later re-accept.
