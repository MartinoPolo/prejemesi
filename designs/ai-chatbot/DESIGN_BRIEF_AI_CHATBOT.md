# AI Chatbot: Design Brief

> **Status**: Variant A chosen and refined (2026-10-19): two-line panel header, decision bar at the bottom, floating icon entry, unresolved decisions block apply
> **Refined mockup**: `designs/ai-chatbot/refined.html`
> **Comparison page**: `designs/ai-chatbot/index.html`
> **Original variants**: `designs/ai-chatbot/variants/variant-{a,b,c}.html` (reference only)

An in-app AI assistant that creates gifts, enriches them (product data, price references, images, review scores) and edits them in bulk from plain Czech. It is an ordinary API client acting as the signed-in user. Every change it wants to make is a stored proposal; the user applies or declines it in the chat next to a live preview, or lets the agent apply changes directly at their own risk. The review page is optional, for checking.

**Source**: [#478](https://github.com/MartinoPolo/prejemesi/issues/478) G12–G21 (epic [#480](https://github.com/MartinoPolo/prejemesi/issues/480)); `.mpx/DECISIONS.md` § Agent access & AI automation.

---

## 1. Purpose

Turn "I have a few links and a vague idea" into a tidy, priced, illustrated wishlist without filling forms, while keeping the user in control of every change. The panel must make three things obvious: what the assistant is about to change, how to accept it, and why it cannot help right now when it cannot. It should be read at a glance: short copy, dense cards, decisions at the bottom.

**Key value**: describe the gift, see the finished card, apply it in one click.

---

## 2. Surrounding Context

### Full Viewport Structure

1. **App navbar** (final state): 56 px, logo, Moje seznamy / Spravované / Sledované pills, bell and avatar right; mobile drawer trigger.
2. **Wishlist page** `/w/<id>` (final state) for a manager: notebook hero ("Pro: Babička", title "Vánoce pro babičku", Settings gear, More), then the toolbar (View, Display, Add gift rightmost), then gift cards (Card view, 3–4 columns desktop, 2 or 1 mobile).
3. **Pending banner** (exists, `PendingChangesBanner.svelte`): an `Alert` above the toolbar, title "Čekající změny (n)", one row per proposal with its source ("Změny u 3 dárků přes token „Claude“" or "Změny u 2 dárků z AI asistenta") and validity, each with a secondary sm "Zkontrolovat" linking to `/w/<id>/changes/<proposalId>`.
4. **Review page** `/w/<id>/changes/<proposalId>` (exists, `designs/agent-change-review/refined.html`): compact header, summary strip, change rows with a tinted header band and the same per-field rows as the chat (§3.6), sticky apply bar.

**What parent provides**: navbar, wishlist page, review page, toasts.
**What this design fills**: the AI side panel, its global entry point, "Vylepšit pomocí AI" in the gift menu, in-chat decisions with a live preview on the wishlist, the handoff to the review page, and the chat source in the pending banner.

**Mockup rendering instructions**:

- Desktop ~1440×900 and mobile 390×844, light and dark, palette `sky`.
- Render the wishlist page beside the panel at real fidelity (navbar, hero, toolbar, 6–8 gift cards with real product photos from `static/demo/`).
- A visually separate review toolbar switches every option below. The same state is reachable by URL query: `?viewport=desktop|mobile&theme=light|dark&scenario=<id>&role=manager|recipient`, plus `&panel=closed` to start with the panel closed (scenario ids in §4).

---

## 3. Requirements

### 3.1 Placement and entry points (G12)

- **Global entry**: a floating icon button in the bottom-right corner with the accessible name "AI asistent". Opening it from a wishlist scopes the panel to that wishlist ("Vánoce pro babičku").
  - Desktop: icon only at rest; the label "AI asistent" slides out on hover and on keyboard focus, never on scroll. Hover expansion is gated on `(hover: hover)`, not on viewport width; `prefers-reduced-motion` drops the animation.
  - Desktop with the panel open: the same button stays docked at the panel's edge and closes it ("Zavřít AI asistenta", `aria-expanded`); the panel header keeps its own ✕.
  - Mobile: always icon only, no reaction to scrolling; hidden while the sheet is open.
  - The list reserves bottom space for it, so the last cards' prices and buttons can always scroll clear. It is hidden on pages with their own bottom action bar (the review page) and toasts sit above it.
- **"Vylepšit pomocí AI"** stays in the gift More menu ("Další akce") and opens the panel focused on that gift with the enrich flow started.
- **Never an AI button in the wishlist hero.**
- Entry points are hidden for users outside the allowlist and for visitors.
- Desktop: a right-docked, non-modal panel that pushes the wishlist narrower. Its width is draggable from the left edge between 360 px and 640 px (never more than 50 % of the viewport), remembered per device; double-click on the handle resets to 420 px.
- Mobile: no resizing. The panel is a sheet with two heights: **half** (wishlist preview visible above, used while deciding) and **full** (reading the chat). A drag handle and the "Náhled" toggle in the header switch between them.
- **Panel header, two lines** (desktop and mobile alike, so the switch has one home and nothing sits below the send button):
  - Line 1: icon, title "AI asistent" with the wishlist as subtitle (both wrap, never truncate), close ✕.
  - Line 2: Náhled (mobile, with its text label), history and new chat, then the Bez kontroly switch or the "Vypnuto" / "Ukázka" state, all ghost.
  - The dismissible hint explaining the switch sits right below line 2.

### 3.2 Conversation basics

- Composer: multi-line input and send; placeholder "Napište, co mám udělat…".
- Assistant messages: short text, compact tool lines ("Hledám na Heurece a Alze…"), result cards, proposal cards.
- Streaming with "Zastavit".
- Empty-chat starters: "Vylepšit dárek bez obrázku", "Přidat dárky z odkazů", "Upravit více dárků najednou".
- **Copy diet**: one sentence where one is enough; no repeated explanations in headers, footers and cards. Explanations appear once (first use or a dismissible hint), then the UI stays compact.
- The assistant never claims a change happened before it is applied.

### 3.3 Flow: enrich one gift (G13)

From "Vylepšit pomocí AI" on "Sluchátka Sony WH-1000XM5" (name + link, no image, no price):

- Product data, **price references** (Heureka, Alza, a foreign reference) with a proposed price range, **image candidates** and **review score**, as in §3.6 per-field rows.
- Image candidates are small (about 64 px) real photos; tap or click opens an enlarged view (about 320 px) to judge detail. The chosen image is fetched server-side.
- Review score goes into the description.
- On a shared list the name is frozen, so brand and model go into the description only.

### 3.4 Flow: create gifts from links or text (G13)

- The user pastes 3 links and one line of free text. Each resolves into a compact gift draft row (thumb, name, price, link); the vague one offers 2–3 candidates; a failed link shows "Odkaz se nepodařilo načíst" without blocking the rest.
- New gifts appear as ghost cards at the end of the wishlist grid (live preview).

### 3.5 Flow: bulk edit from plain language (G13)

- "Všechno nad 3 000 Kč dejte do nízké priority a smažte ty dva duplicitní Lego sety."
- The assistant restates the scope in one line ("Změním 4 dárky, smažu 2"), then proposes.
- Deletions need explicit confirmation: clicking "Smazat 1 dárek" in the chat is that confirmation, with no second dialog, and Vrátit stays available.
- The assistant has exactly the user's rights. When a recipient asks for something they cannot do, it refuses or warns with the same message the UI gives for that action (e.g. "Stávající dárky nelze po sdílení seznamu odebrat."), including the first-change warning on a shared permanent list, and never says or hints anything about reservations the recipient could not learn from the UI. A správce may read that a gift is reserved.
- Reorders are low risk: the assistant applies them without confirmation, even with the trust switch off, and reports them as an applied card with Vrátit. The batch stores the previous order; undo restores it and refuses only when the order changed since.

### 3.6 Decisions, live preview and fast-forward

Counts are per gift: "Návrh · 1 dárek", "Použít (7)", "Použito · 2 dárky".

**Decision bar** for the open proposal, sticky above the composer:

- Line 1: the count ("Návrh · 3 dárky · 5 přijato") and **Zkontrolovat**, which expands the inline check (per-field rows, below); proposals over 5 gifts open the review page instead.
- Line 2: **Zamítnout vše**, **Přijmout vše** and **Použít (N)**. N counts gifts with at least one accepted change. Přijmout vše never resolves deletions, reservations or invitations; Zamítnout vše rejects everything and keeps gifts held for deletion. With nothing accepted and nothing open, the primary reads "Zamítnout návrh" and declines the proposal.
- Použít applies the accepted changes from the chat, with the same server dry-run, conflict check, revision record and batch undo as the review page.

**Preselection and unresolved decisions**:

- Additions and field edits start accepted, shown as accepted (pressed ✓, "Přijato", tint). Deletions, reservations and manager invitations start unresolved.
- While any decision is unresolved, Použít looks disabled but stays focusable and clickable (`aria-disabled`, never `disabled`). Clicking it outlines every unresolved decision control in red (2 px `--status-danger-text`), scrolls to the first one, focuses it and replaces the count with "Rozhodněte 2 změny" (announced).

**Per-field decisions** (inline check and review page alike):

- Each changed field of a gift is its own read-only row: label, then previous → next, the previous value struck through in red (`--status-danger-text`) and the next in green (`--status-success-text`). An empty previous value is muted, not struck; an append keeps the previous part neutral and greens only the addition; images show the new thumb with tap-to-enlarge.
- Three icon buttons per row: accept ✓, reject ✕ and edit ✎. Clicking the active ✓ or ✕ again clears the decision to unresolved; there is no other undo control. A status pill ("Přijato", "Zamítnuto", "Upraveno") carries text only; an unresolved row has none.
- Edit turns that one value into the right control (input, textarea, select, image picker) with Zrušit / Uložit; Enter saves inputs, Escape cancels. Saving accepts the field; a changed value shows as "Upraveno". Rejecting an edited field discards the edit.
- Accepted rows take a success tint; rejected rows a muted tint with the next value struck and the previous value back in plain text.
- **Per gift**: each gift's header has "✓ Vše" and "✕ Vše" for its fields, `aria-pressed` true, false or mixed (dashed border with a soft tint) when the field decisions differ. In the chat a new gift is one row whose ✕ drops it; on the review page its name ✕ stays disabled and rejecting all its fields drops it.

**Live preview**: while deciding, the affected gift cards on the wishlist show the result as a ghost state (dashed brand outline, "Návrh" chip visible only to the user), new gifts as ghost cards and deletions struck through. It updates as the user accepts, rejects or edits.

**Never asked**: reorders apply directly (§3.5).

**Always confirmed**: deletions, reservations and manager invitations are separate rows with their own explicit action ("Smazat 1 dárek" / "Ponechat"); neither Použít nor the trust switch covers them. The click is the confirmation. Smazáno or Ponecháno then offers Vrátit, which returns the row to the Smazat / Ponechat choice and restores a deleted gift.

**Trust switch (fast-forward per chat)**: "Bez kontroly" on header line 2, compact, off for each new chat. Explained once in a dismissible hint. When on, ordinary edits and creations apply as they arrive with an applied card ("Použito · Vrátit"); always-confirmed rows still wait.

### 3.7 Access and limit states (G14, G18, G20, G21)

- **Allowlisted family member**: full panel.
- **Not allowlisted**: no entry point at all (floating button and gift-menu item hidden). The mockup shows the page without them.
- **Per-user daily cap reached**: history readable, composer disabled, one line "Dnešní limit je vyčerpaný, obnoví se zítra v 0:00." Pending proposals stay actionable.
- **Global kill switch on**: a "Vypnuto" state on header line 2 and "AI asistent je dočasně vypnutý." above the disabled composer; history readable; pending proposals can still be applied.
- **Provider error**: inline error on the failed turn with "Zkusit znovu"; the user's message stays; nothing changed.
- **Demo playground**: predefined action chips only, one-line note "Ukázka: odpovědi jsou předpřipravené." Its proposals apply to demo data like real ones.

### 3.8 History (G19)

- Per wishlist, last 30 days, title, date and outcome; one line "Konverzace se mažou po 30 dnech." New chat is one action.

---

## 4. States (scenario ids)

| Scenario id       | What it shows                                                                    |
| ----------------- | -------------------------------------------------------------------------------- |
| `chat`            | Fresh chat with starters and the switch hint; with `panel=closed`, the floating button |
| `enrich`          | Headphones: preselected per-field rows with ✓ ✕ ✎, per-gift ✓ Vše / ✕ Vše, live preview |
| `create`          | Gifts from links + text, one ambiguous, one failed, ghost cards                  |
| `bulk`            | Bulk edit; unresolved deletions block Použít until decided                       |
| `big-batch`       | Proposal over 5 gifts: Zkontrolovat opens the review page with per-field rows    |
| `streaming`       | Tool lines, streaming text, Zastavit                                             |
| `handoff`         | Review page reached from the chat, pending banner row "z AI asistenta"           |
| `fast-forward`    | Trust switch on: applied card with Vrátit, a held deletion with Smazat / Ponechat |
| `history`         | 30-day history                                                                   |
| `not-allowlisted` | Page with no entry points                                                        |
| `daily-cap`       | Cap reached                                                                      |
| `kill-switch`     | Globally disabled, "Vypnuto" on header line 2                                   |
| `provider-error`  | Failed turn with Zkusit znovu                                                    |
| `demo`            | Predefined action chips                                                          |

---

## 5. Component Reuse Map

### Existing Components (MUST use)

| Component            | Path                                             | Usage                                       |
| -------------------- | ------------------------------------------------ | ------------------------------------------- |
| Button               | `src/lib/components/base/button/`                | Send, Zkontrolovat, Použít, Zamítnout       |
| Badge                | `src/lib/components/base/badge/`                 | Kind counts, "Vyžaduje potvrzení", "Návrh"  |
| Alert                | `src/lib/components/base/alert/`                 | Cap, kill switch, provider error            |
| Switch               | `src/lib/components/base/switch/`                | Trust switch                                |
| Input / Textarea     | `src/lib/components/base/input/`, `textarea/`    | Field edit mode, composer                   |
| Sheet / Dialog       | `src/lib/components/base/sheet/`, `dialog/`      | Mobile panel, image zoom                    |
| DropdownMenu         | `src/lib/components/base/dropdown-menu/`         | Gift More menu entry                        |
| ImageFrame           | `src/lib/components/derived/image-frame/`        | Thumbs and candidates                       |
| GiftCard             | `src/lib/components/blocks/gift/GiftCard.svelte` | Ghost preview (real geometry)               |
| FieldDiffList        | `src/lib/components/blocks/change-proposals/`    | Previous → next display in field rows       |
| ChangeKindTitle      | `src/lib/components/blocks/change-proposals/`    | Kind counts                                 |
| PendingChangesBanner | `src/lib/components/blocks/change-proposals/`    | Source per row                              |

### Components to Design (new)

| Proposed Name     | Description                                                          |
| ----------------- | -------------------------------------------------------------------- |
| AssistantPanel    | Resizable docked panel / two-height mobile sheet, thread, composer    |
| ChatMessage       | Turns, tool lines, error turn                                        |
| FieldDecisionRow  | Label, previous → next, accept/reject/edit, edit mode, tint; shared with the review page |
| ProposalCard      | Counts, Zkontrolovat, bulk actions and Použít, applied/undo state    |
| ProposalActionArea| Bottom decision bar with the blocked-apply state                     |
| AssistantHeader   | Two-line header: identity and close, then ghost tools, trust switch and hint |
| BulkDecision      | ✓ Vše / ✕ Vše per gift and for the whole proposal, with the mixed state |
| AssistantFab      | Floating icon entry: label on desktop hover/focus, docked toggle while open, reserved list space |
| GhostGiftState    | Card preview state for proposed edit, creation, deletion             |

---

## 6. Layout Constraints

- Panel width 360–640 px (≤ 50 % viewport), default 420 px; content container keeps 16 px gutters. Mobile panel full width, 12 px gutters.
- Chat cards use tight insets (8–12 px), nested corners per `AGENTS.md`.
- Typography from `src/app.css`: panel title 17 px DynaPuff semibold; message text 14 px; field rows 13 px; meta 12 px muted.
- Controls `md` 32 px desktop, `lg` 40 px mobile; field-row accept/reject/edit may be `sm` 26 px on desktop with 32 px hit targets.

---

## 7. Design Tokens

From `src/app.css` (inline a mirrored subset; do not link `designs/tokens.css`):

- Fonts: `--font-head` DynaPuff Variable, `--font-body` Geist Variable (woff2 in `designs/unavailable-gift-comparison/assets/`).
- Type scale `--text-xs` 11 … `--text-3xl` 28; control heights 26/32/40/48.
- Surfaces and ink: `--ink`, `--card`, `--background`, `--tint`, `--panel-hover`, `--muted-foreground`, `--brand`, `--brand-link`, `--primary`, `--primary-foreground`, `--accent-loud`.
- Status text (AA): `--status-success-text`, `--status-warning-text`, `--status-danger-text`; solid danger fills `--status-danger-fill`; raw `--status-*` only for borders, icons and tints. Mix in **oklab**.
- Radii `--radius-panel` 16, `--radius-btn` 7, `--radius-badge` 12; 2–2.5 px ink borders; hard offset shadows via elevation tokens.

---

## 8. Design Constraints (Non-Negotiable)

- Czech copy with vykání, no em dashes in visible copy.
- Every mutation is a stored proposal. Použít in the chat is a full apply through the same path as the review page, and with the trust switch on the agent applies changes without any review step; the review page is optional. Deletions, reservations and manager invitations always need their own explicit confirmation.
- No bring-your-own-key input, no credits or pricing UI.
- Role-filtered content: a recipient's chat never reveals reservations or reserver names.
- The ghost preview and "Návrh" chip are visible only to the acting user; AI-made gifts carry no visitor-facing marker.
- Post-share rules hold: no name change on frozen gifts, description changes are appends on shared occasion lists.
- Light mode is the source of truth; dark is token-derived.
- Keyboard: the docked panel is non-modal, Escape closes it and returns focus to the trigger; the resize handle is keyboard-operable (arrow keys); a blocked Použít stays focusable.

---

## 9. Owner Answers and Assumptions

Confirmed by the owner (2026-10-18 and 2026-10-19):

- Review score goes into the description.
- Entry points are hidden outside the allowlist.
- Fast-forward is per chat.
- The pending banner shows one row per proposal, each with its source.
- On shared lists, enrichment adds to the description only.
- Reorders apply without confirmation, even with the trust switch off, and are undoable from the stored previous order.
- Changes are counted per gift.
- Editing a suggested value accepts it ("Upraveno").
- Pending proposals can still be applied while the global kill switch is on.
- The bottom action area is the decision bar; the global entry is the floating icon button, labelled on desktop hover and focus and docked at the open panel's edge as its toggle.
- The panel header has two lines; on mobile the trust switch lives there, not below the composer.
- Undecided fields are not applied: field changes start accepted, deletions start unresolved, and unresolved decisions block Použít.
- Clicking "Smazat 1 dárek" in the chat is the explicit confirmation; reverting a decision returns to the choice.
- The review page uses the same per-field accept, reject and edit as the chat.
- The assistant has exactly the recipient's rights and answers with the UI's own refusal or warning, never hinting at reservations.
- Users may let the agent apply changes immediately at their own risk: Použít from the chat and the trust switch need no review step; the review page is optional. Deletions, reservations and manager invitations always need explicit confirmation, even with the trust switch on.

Still an assumption:

- Proposals over 5 gifts check on the review page rather than inline.
- Deletions, reservations and manager invitations are the kinds that start unresolved (coordinator default).
- Přijmout vše never resolves deletions, reservations or invitations.

---

## 10. Visual References

- `designs/ai-chatbot/variants/variant-a.html`: chosen base.
- `designs/ai-chatbot/variants/variant-c.html`: per-field decisions, row tints, ghost cards, dense cards.
- `designs/agent-change-review/refined.html`: review page, kind colours, field diffs.
- `designs/unavailable-gift-comparison/refined.html`: gift card markup.

---

## 11. Not Included (Scope Exclusions)

- Provider, model and billing configuration (G14, G16, G17).
- Admin UI for the allowlist, global cap and kill switch.
- Linkless name search beyond what the create flow shows.
- Implementation of the review page; its per-field design is in `designs/agent-change-review/refined.html`.
