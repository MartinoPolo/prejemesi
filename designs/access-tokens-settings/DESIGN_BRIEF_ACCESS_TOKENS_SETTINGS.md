# Access Tokens Settings — Design Brief

> **Status**: Refined (Variant B), approved
> **Refined mockup**: `designs/access-tokens-settings/refined.html`
> **Summary**: `designs/access-tokens-settings/SUMMARY.md`
> **Refinements**: 365-day default expiry with presets up to 10 years, regenerate (roll) action, expired state with regenerate as the main action, AA-safe warning text

A new section on the account Settings page where users create, inspect and revoke personal access tokens that let their own AI agents (Claude, ChatGPT, Codex, scripts) act as them through the JSON API. It makes delegation explicit: what an agent may do, on which wishlists, until when, and when it last did something.

**Source**: [#475](https://github.com/MartinoPolo/prejemesi/issues/475) (epic [#480](https://github.com/MartinoPolo/prejemesi/issues/480); OAuth apps placeholder for [#477](https://github.com/MartinoPolo/prejemesi/issues/477)); `.mpx/DECISIONS.md` § Agent access & AI automation.

---

## 1. Purpose

Users bring their own AI through tokens. The section answers at a glance: which agents can reach my account, what each may do, where, until when, and is any of them still in use? Creating a token must make the scopes understandable to a non-developer and make the irreversible "shown once" moment unmistakable.

**Key value**: hand your AI a narrowly scoped key in under a minute, and take it back in one click.

---

## 2. Surrounding Context

### Full Viewport Structure

1. **App navbar** (final state): 56 px, logo left, Moje seznamy / Spravované / Sledované pills, bell and avatar right; mobile drawer trigger.
2. **Settings page** (final state, `src/routes/(app)/settings/+page.svelte`): left-aligned column, `max-width: 48rem` inside the 1200 px content container. Page title "Nastavení" (26–34 px DynaPuff semibold) with muted subtitle, then sections stacked with 24 px gaps, each a `Card.Root` with an icon + title + description header:
    1. Profil
    2. Zabezpečení (password; hidden for OAuth-only users)
    3. Upozornění
    4. **Přístup pro AI a aplikace** (new, this design)
    5. Vzhled
    6. Nebezpečná zóna
3. Dialogs open centered above a dimmed backdrop.

**What parent provides**: navbar, page title, section stack, toaster.
**What this section fills**: one `Card.Root` in the stack, full column width (48rem desktop, viewport minus 24 px gutters on mobile).
**Must NOT include**: its own page header or navigation.

**Mockup rendering instructions**:

- Desktop ~1440×900 and mobile 390×844, light and dark.
- Show the neighbouring sections (Upozornění above, Vzhled below) collapsed to their real headers at full fidelity so proportions are honest; the new section is the focus.
- In-mockup review controls (visually separate) to switch viewport, theme and scenario: Tokens listed, Empty, Demo session, Create dialog, Token revealed, Regenerate confirm (active and expired), Regenerated token revealed, Revoke confirm, Loading.

---

## 3. Requirements

### 3.1 Section header

- Icon (Lucide `key-round` or `bot`), title "Přístup pro AI a aplikace", description "Tokeny umožní vašemu AI asistentovi pracovat s vašimi seznamy vaším jménem. Agent nikdy nezíská víc práv než vy."
- Primary action "Vytvořit token" (`Button intent="primary"`, `md` desktop, `lg` mobile) in the header row on desktop, full-width below the description on mobile.
- Link "Dokumentace API" (TextLink) to the generated API docs.

### 3.2 Token list

Each token row shows:

- **Name** (user-chosen, e.g. "Claude – vánoční dárky"), semibold.
- **Scopes** as Badges: `Čtení`, `Úpravy dárků`, `Rezervace`, `Pozvánky správců`, `Jména dárců`. Show the Czech label; the technical scope id (`gifts:write`) is available in a tooltip or secondary mono text.
- **Wishlist restriction**: "Všechny seznamy" or "Jen: Vánoce pro babičku, Martinovy narozeniny" (truncate after two names with "+3").
- **Fast-forward** indicator when on: Badge `tone="warning"` "Bez kontroly".
- **Expiry**: "Vyprší 13. 10. 2027"; within 7 days the date gets warning tone "Vyprší za 3 dny"; expired tokens show Badge `tone="danger"` "Vypršel", a muted dashed row and a danger-text note "Token vypršel 1. 9. 2026, agent s ním už nemá přístup. Vygenerujte nový se stejnými oprávněními."
- **Last used**: "Naposledy použit před 2 h" or "Zatím nepoužit".
- **Created**: "Vytvořen 13. 10. 2026" (secondary).
- **Actions**: active rows show "Vygenerovat znovu" (`intent="secondary" size="sm"`) and "Zrušit" (`intent="danger" size="sm"`); expired rows show "Vygenerovat znovu" as the primary action and "Odstranit" (secondary). Mobile actions use `lg`.
- Token prefix for recognition, e.g. `pjs_7Kq2…` (first characters only; the secret is never shown again).
- Sorting: active tokens by last used (most recent first), never-used next, expired last.
- Overflow: long names wrap to two lines then truncate; scope badges wrap.

### 3.3 Create dialog

`Dialog` (standard width ~560 px desktop, mobile full-width with fixed header and footer, body scrolls).

- **Název** (required, max 60 chars, autofocused): placeholder "Např. Claude – vánoční dárky"; help "Podle názvu token poznáte v seznamu a v historii změn."
- **Oprávnění** (scopes) as checkbox rows (ChoiceRow) with a one-line plain-Czech explanation each:
    - `read` — "Čtení: vidí seznamy a dárky, které vidíte vy. Rezervace jen jako stav a počet." Checked and **locked** (every token reads).
    - `gifts:write` — "Úpravy dárků: přidává, upravuje, maže a řadí dárky, spravuje kategorie a priority, zakládá koncepty seznamů."
    - `reservations:write` — "Rezervace: rezervuje dárky vaším jménem."
    - `managers:invite` — "Pozvánky správců: zve další správce."
    - `reservations:identities` — "Jména dárců: vidí, kdo rezervoval. Tyto údaje odejdou k poskytovateli vašeho AI." Shown with a warning HelpText. E-maily anonymních dárců agent neuvidí nikdy.
- **Seznamy** (wishlist restriction): RadioGroup "Všechny seznamy, ke kterým máte přístup" (default) / "Jen vybrané seznamy". The second reveals a checkbox list of the user's wishlists grouped Moje seznamy / Spravované / Sledované with a SearchField when there are more than 8. At least one must be chosen.
- **Platnost** (expiry): Select with presets only: 30 dní, 90 dní, **1 rok (výchozí)**, 5 let, 10 let; no custom date. Shows the resulting date "Vyprší 13. 10. 2027". No "never expires" option; help "Nejdéle 10 let. Token bez data vypršení vytvořit nelze. Před vypršením ho můžete vygenerovat znovu."
- **Bez kontroly (fast-forward)**: Switch, off by default. Help: "Změny se použijí hned, bez stránky s náhledem. Smazání dárků, rezervace a pozvánky správců vždy potvrzujete sami, i když je tato volba zapnutá." The second sentence is always visible, not in a tooltip.
- Footer: "Zrušit" (secondary) and "Vytvořit token" (primary). Validation inline per field (missing name, no wishlist chosen).

### 3.4 Token revealed (once)

- The same dialog switches to a reveal step (no navigation): title "Token je připraven".
- Warning Alert: "Token uvidíte jen teď. Uložte si ho, po zavření ho už nezobrazíme."
- Token in an InputGroup, monospace, read-only, full value selectable, with an attached "Kopírovat" button that flips to "Zkopírováno ✓" for 2 s.
- Quick start: short code block with the API base and header, e.g. `Authorization: Bearer pjs_…`, and a link "Jak token předat AI asistentovi" to docs.
- Summary of what was granted (scopes, wishlists, expiry, fast-forward) so the user can double-check.
- Single footer action "Hotovo". Closing before copying asks "Zavřít bez zkopírování? Token už nezobrazíme." (Continue / Back).

### 3.5 Regenerate (roll)

- Available on active and expired tokens; revoked tokens are gone and cannot be regenerated.
- Confirm Dialog "Vygenerovat token znovu?" (expired: "Vygenerovat vypršelý token znovu?") with the token name, what stays ("Název, oprávnění i seznamy zůstanou stejné: …") and what ends: for an active token the old secret stops working immediately on confirm and the agent loses access until it gets the new one; for an expired token it already does not work.
- "Platnost nového tokenu" Select (30 dní, 90 dní, 1 rok, 5 let, 10 let) preselects the token's original duration, shows the resulting date and says "Předvybraná je původní platnost tokenu: …".
- Buttons "Zpět" (secondary) and "Vygenerovat znovu" (primary, spinner while in flight).
- On success the shown-once reveal step (3.4) opens without the step indicator, titled "Nový token je připraven", with a note "Starý token `pjs_Lw0b…` už nefunguje. Předejte agentovi tento nový." The row keeps its place with the new prefix, expiry and "Zatím nepoužit"; toast "Token vygenerován znovu".

### 3.6 Revoke

- Confirm Dialog: "Zrušit token „Claude – vánoční dárky“? Agent okamžitě ztratí přístup. Zrušený token už nepůjde vygenerovat znovu. Čekající návrhy změn zůstanou dostupné ke kontrole." Buttons: "Zpět" (secondary), "Zrušit token" (`intent="primary-destructive"`).
- Revoked tokens disappear from the list; a toast confirms "Token zrušen".

### 3.7 Propojené aplikace (OAuth placeholder, #477)

- A sub-heading inside the same card, below the token list: "Propojené aplikace".
- Empty placeholder: "Brzy budete moci připojit AI aplikace (například Claude nebo ChatGPT) jedním kliknutím, bez kopírování tokenu." Muted, no action.
- Later it lists granted apps with the same row anatomy (name, scopes, wishlists, last used, revoke), so the token row component must be reusable for apps.

### 3.8 Empty and demo states

- **Empty**: illustration-free message "Zatím nemáte žádný token." + one sentence on what a token enables + the Create action.
- **Demo session**: the demo settings page currently shows only the demo-limits note and Appearance. Show this section in demo too, with the Create button disabled and the explanation "V ukázce nelze vytvářet tokeny ani používat API. Zaregistrujte se a připojte vlastního AI asistenta." plus a "Registrovat" text link, consistent with how demo disables uploads with explanations.

---

## 4. States

| State              | Visual Treatment                                                  | Trigger                            |
| ------------------ | ----------------------------------------------------------------- | ---------------------------------- |
| Loading            | Skeleton rows inside the card                                     | Section data loading               |
| Empty              | Message + Create                                                  | No tokens                          |
| Listed             | Token rows                                                        | ≥ 1 token                          |
| Expiring soon      | Expiry text in warning tone                                       | ≤ 7 days left                      |
| Expired            | Muted dashed row, "Vypršel" badge, note, primary Vygenerovat znovu + Odstranit | Past expiry          |
| Never used         | "Zatím nepoužit" muted                                            | `lastUsedAt` null                  |
| Fast-forward on    | Warning badge "Bez kontroly"                                      | Token setting                      |
| Hover / focus      | Row hover background, focus ring on actions                       | Pointer / keyboard                 |
| Create dialog      | Form                                                              | Vytvořit token                     |
| Validation error   | Inline field error                                                | Missing name / no wishlist chosen  |
| Creating           | Button spinner, form locked                                       | Submit in flight                   |
| Revealed           | Warning alert, token + copy, summary                               | Created                            |
| Copied             | Button "Zkopírováno ✓"                                            | Copy                               |
| Close without copy | Small confirm                                                     | Close before copy                  |
| Regenerate confirm | Kept/ended summary, expiry Select preset to original duration     | Vygenerovat znovu                  |
| Regenerating       | Button spinner, dialog locked                                     | Confirm in flight                  |
| Regenerated        | Reveal step without steps, old-prefix note                        | Regenerated                        |
| Revoke confirm     | Destructive confirm dialog                                        | Zrušit                             |
| Demo disabled      | Disabled Create + explanation + register link                     | Demo session                       |
| Error              | Toast                                                             | Create/revoke failure              |

---

## 5. Component Reuse Map

### Existing Components (MUST use)

| Component               | Variant/Props                                     | Usage                                   |
| ----------------------- | ------------------------------------------------- | --------------------------------------- |
| Card (`Card.Root/Header/Title/Description/Content`) | as other settings sections | Section shell                           |
| Button                  | `intent="primary"` `md`/`lg`                      | Vytvořit token, Hotovo                  |
| Button                  | `intent="danger" size="sm"`                       | Zrušit (row)                            |
| Button                  | `intent="secondary"` / `"primary"` `size="sm"`    | Vygenerovat znovu (active / expired row) |
| Button                  | `intent="primary-destructive"`                    | Confirm revoke                          |
| Button                  | `intent="secondary"`                              | Zrušit / Zpět in dialogs                |
| Badge                   | `tone="neutral"` scopes, `warning` fast-forward, `danger` expired | Row metadata              |
| Dialog                  | standard                                          | Create/reveal, regenerate, revoke       |
| Field + Input           | default                                           | Název                                   |
| ChoiceRow + Checkbox    | default                                           | Scopes, wishlist list                   |
| RadioGroup              | default                                           | Restriction mode                        |
| Select                  | default                                           | Platnost                                |
| Switch                  | default                                           | Bez kontroly                            |
| HelpText                | default / warning                                 | Field help                              |
| Alert                   | `tone="warning"`                                  | Shown-once warning                      |
| InputGroup + InputGroupButton | readonly mono input                         | Token reveal + Kopírovat                |
| SearchField             | default                                           | Wishlist picker > 8 lists               |
| Skeleton                | rows                                              | Loading                                 |
| TextLink                | default                                           | Docs, Registrovat                       |
| Toast                   | success/error                                     | Revoke/create feedback                  |
| Separator               | default                                           | Tokens vs Propojené aplikace            |

### Components to Adopt

None.

### Components to Design (new)

| Component        | Description                                             | Why New                       |
| ---------------- | ------------------------------------------------------- | ----------------------------- |
| AccessGrantRow   | Name, scopes, restriction, expiry, last used, regenerate, revoke | Shared by tokens and OAuth apps |
| ScopePicker      | Scope checkbox rows with explanations and warnings      | Domain-specific composition   |
| TokenRevealPanel | Shown-once token with copy and quick start              | New pattern                   |

---

## 6. Layout Constraints

- Card width = settings column (max 48rem). Rows stack vertically, separated by ink-faint dividers or as nested panels (designer's choice) following the nested-corner rule in `AGENTS.md`.
- Desktop row: name + badges left, meta line below, revoke right-aligned and vertically centered. Mobile: revoke drops to the row's bottom-right; meta wraps.
- Dialog: ~560 px desktop; mobile fixed title row with 40 px close target and fixed footer, body scrolls.
- Rows ending under a dialog close button reserve `--overlay-close-clearance`.
- Typography: section title 22 px; token name 14–15 px semibold; meta 12 px muted; token value 13 px monospace.

---

## 7. Design Tokens

From `src/app.css` (inline a mirrored subset in the standalone mockup; do not link `designs/tokens.css`):

- Fonts: DynaPuff Variable (headings), Geist Variable (body); a system monospace for token values.
- `--ink`, `--card`, `--background`, `--tint`, `--muted-foreground`, `--brand`, `--primary`, `--primary-foreground`, `--status-warning`, `--status-danger`, `--status-danger-text`, `--status-success-text`, `--accent-loud`.
- Radii 16/7/12 px, borders 2–2.5 px ink, hard offset shadows; control sizes 26/32/40 px.

---

## 8. Design Constraints (Non-Negotiable)

- Czech copy in formal address (vykání), no em dashes in visible copy.
- The full token is displayed exactly once, in the reveal step; rows show only a prefix.
- Fast-forward help always states that deletions, reservations and manager invitations still need confirmation.
- `reservations:identities` always carries the third-party AI provider warning.
- Default expiry 365 days, maximum 10 years; no non-expiring option.
- Regenerating keeps name, scopes and wishlist restriction, invalidates the old secret immediately and shows the new one once; revoked tokens cannot be regenerated.
- Demo sessions cannot create tokens.
- Section looks like the other settings Cards (icon header, Card shell); it is not a separate page.
- Light mode source of truth, dark derived from tokens.

---

## 9. Design Freedom

- Row layout (flat list with dividers vs nested sub-panels vs compact table).
- How scopes are presented in the row (badges vs a sentence summary such as "Čte a upravuje dárky").
- Create flow as one dialog vs two steps (details, then permissions) before reveal.
- Wishlist picker presentation.
- Placement of the docs link and the OAuth placeholder.

---

## 10. Visual References

- `src/lib/components/blocks/settings/SettingsSecuritySection.svelte`, `SettingsDangerSection.svelte` — section shell and dialog usage.
- `designs/settings-control-review/refined.html` — settings controls in standalone form.
- `designs/demo-playground/refined.html` — demo disabled-with-explanation tone.
- External: GitHub fine-grained personal access tokens, Vercel and Linear API key pages.

---

## 11. Not Included (Scope Exclusions)

- OAuth consent screen and granted-app management (#477); only the placeholder.
- API docs pages.
- Editing name, scopes or restriction after creation (create a new token instead; regenerating only replaces the secret and expiry).
- Per-token usage charts or request logs.
- Account deletion flow changes (it revokes all tokens server-side; no UI change).

---

## 12. Open Questions for the Owner

Each was resolved by assumption so the mockups could proceed; please confirm or correct.

1. **Placement**: section sits after Upozornění and before Vzhled.
2. **`read` is always on** and cannot be unchecked.
3. **Expiry choices** (confirmed): presets only, 30 / 90 / 365 (default) / 1825 / 3650 days; no custom date and no non-expiring tokens.
4. **Expired tokens** stay listed (muted) until removed; revoked tokens disappear immediately.
5. **No editing** of scopes or restriction after creation.
6. **Demo** shows the section with a disabled Create and explanation rather than hiding it.
7. **Token format** `pjs_` prefix with a visible short prefix in rows for recognition.
8. **Revoking keeps pending proposals** reviewable (they act as the user, not the token).
9. **Section name** "Přístup pro AI a aplikace" (covers tokens now, OAuth apps later).
10. **Removing an expired token** happens immediately with a toast, without a confirm dialog; only revoking an active token confirms.
11. **Warning HelpText** does not exist yet (HelpText has default, error and success states); the `reservations:identities` warning needs a new warning state or an inline Alert.
