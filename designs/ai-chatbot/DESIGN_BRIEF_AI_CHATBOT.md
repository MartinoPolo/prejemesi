# AI Chatbot: Design Brief

> **Status**: Variant A chosen (2026-10-18), refined with owner feedback; bottom action area and entry point still open between sub-variants
> **Refined mockup**: `designs/ai-chatbot/refined.html` (`?actions=` and `?entry=` switch the open options)
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
3. **Pending banner** (exists, `PendingChangesBanner.svelte`): an `Alert` above the toolbar, title "Čekající změny (n)", one row per proposal with its source ("3 změny přes token „Claude“" or "2 změny z AI asistenta") and validity, each with a secondary sm "Zkontrolovat" linking to `/w/<id>/changes/<proposalId>`.
4. **Review page** `/w/<id>/changes/<proposalId>` (exists, `designs/agent-change-review/refined.html`): compact header, summary strip, change rows with a tinted header band, sticky "Použít vybrané (n)" bar.

**What parent provides**: navbar, wishlist page, review page, toasts.
**What this design fills**: the AI side panel, its global entry point, "Vylepšit pomocí AI" in the gift menu, in-chat decisions with a live preview on the wishlist, the handoff to the review page, and the chat source in the pending banner.

**Mockup rendering instructions**:

- Desktop ~1440×900 and mobile 390×844, light and dark, palette `sky`.
- Render the wishlist page beside the panel at real fidelity (navbar, hero, toolbar, 6–8 gift cards with real product photos from `static/demo/`).
- A visually separate review toolbar switches every option below. The same state is reachable by URL query: `?viewport=desktop|mobile&theme=light|dark&scenario=<id>&actions=<id>&entry=header|fab&role=manager|recipient` (scenario ids in §4, action-area ids in §3.6).

---

## 3. Requirements

### 3.1 Placement and entry points (G12)

- **Global entry**, two options to compare: an "AI asistent" button in the app header, or a floating button near the bottom-right corner. Opening it from a wishlist scopes the panel to that wishlist ("Vánoce pro babičku").
- **"Vylepšit pomocí AI"** stays in the gift More menu ("Další akce") and opens the panel focused on that gift with the enrich flow started.
- **Never an AI button in the wishlist hero.**
- Entry points are hidden for users outside the allowlist and for visitors.
- Desktop: a right-docked, non-modal panel that pushes the wishlist narrower. Its width is draggable from the left edge between 360 px and 640 px (never more than 50 % of the viewport), remembered per device; double-click on the handle resets to 420 px.
- Mobile: no resizing. The panel is a sheet with two heights: **half** (wishlist preview visible above, used while deciding) and **full** (reading the chat). A drag handle and a "Náhled" toggle switch between them.

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
- Deletions need explicit confirmation.
- The assistant has exactly the user's rights. When a recipient asks for something they cannot do, it refuses or warns with the same message the UI gives for that action (e.g. "Stávající dárky nelze po sdílení seznamu odebrat."), including the first-change warning on a shared permanent list, and never says or hints anything about reservations the recipient could not learn from the UI. A správce may read that a gift is reserved.
- Reorders are low risk: the assistant applies them without confirmation, even with the trust switch off, and reports them as an applied card with Vrátit. The batch stores the previous order; undo restores it and refuses only when the order changed since.

### 3.6 Decisions, live preview and fast-forward

**Three actions on every proposal that needs the user:**

- **Zkontrolovat**: expands the inline check (per-field rows, below). Batches over 5 change rows open the review page instead.
- **Použít**: applies the proposal from the chat, with the same server dry-run, conflict check, revision record and batch undo as the review page.
- **Zamítnout**: declines the proposal; nothing changes.

**Per-field decisions** (inline check):

- Each changed field of a gift is its own row: label, old value, suggested value as an **editable input**, accept ✓ and reject ✗, and a small cross that reverts only that field to undecided.
- Accepted rows take a success tint, rejected rows a muted tint (from variant C).
- Použít applies accepted and undecided rows with their (possibly edited) values; rejected rows are skipped.

**Live preview**: while deciding, the affected gift cards on the wishlist show the result as a ghost state (dashed brand outline, "Návrh" chip visible only to the user), new gifts as ghost cards and deletions struck through. It updates as the user accepts, rejects or edits.

**Never asked**: reorders apply directly (§3.5).

**Always confirmed**: deletions, reservations and manager invitations are separate rows with their own explicit confirm ("Smazat 1 dárek"); neither Použít nor the trust switch covers them.

**Trust switch (fast-forward per chat)**: at the bottom near the composer, compact, off for each new chat. Explained once in a dismissible hint. When on, ordinary edits and creations apply as they arrive with an applied card ("Použito · Vrátit"); always-confirmed rows still wait.

**Bottom action area sub-variants** (`?actions=`), all keep Zkontrolovat, Použít and Zamítnout and the trust switch at the bottom:

| id       | Layout                                                                                                     | Switch wording                         |
| -------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `bar`    | Sticky decision bar above the composer for the open proposal: count line + Zamítnout · Zkontrolovat · Použít | Switch row under the composer: "Bez kontroly" |
| `inline` | Actions stay on each proposal card in the thread; the composer footer holds a compact toggle chip           | Chip: "Důvěřovat agentovi"             |
| `tray`   | Collapsible tray above the composer: collapsed shows count + Použít; expanded shows per-field rows and all three actions | Segmented "Kontrolovat · Důvěřovat" in the tray |

### 3.7 Access and limit states (G14, G18, G20, G21)

- **Allowlisted family member**: full panel.
- **Not allowlisted**: no entry point at all (header/floating button and gift-menu item hidden). The mockup shows the page without them.
- **Per-user daily cap reached**: history readable, composer disabled, one line "Dnešní limit je vyčerpaný, obnoví se zítra v 0:00." Pending proposals stay actionable.
- **Global kill switch on**: "AI asistent je dočasně vypnutý." Composer disabled, history readable.
- **Provider error**: inline error on the failed turn with "Zkusit znovu"; the user's message stays; nothing changed.
- **Demo playground**: predefined action chips only, one-line note "Ukázka: odpovědi jsou předpřipravené." Its proposals apply to demo data like real ones.

### 3.8 History (G19)

- Per wishlist, last 30 days, title, date and outcome; one line "Konverzace se mažou po 30 dnech." New chat is one action.

---

## 4. States (scenario ids)

| Scenario id       | What it shows                                                                    |
| ----------------- | -------------------------------------------------------------------------------- |
| `chat`            | Fresh chat with starters                                                         |
| `enrich`          | Headphones: per-field rows, image picker with enlarge, live preview, 3 actions   |
| `create`          | Gifts from links + text, one ambiguous, one failed, ghost cards                  |
| `bulk`            | Bulk edit with restated scope, an always-confirmed deletion                      |
| `big-batch`       | Proposal over 5 rows: Zkontrolovat opens the review page                          |
| `streaming`       | Tool lines, streaming text, Zastavit                                             |
| `handoff`         | Review page reached from the chat, pending banner row "z AI asistenta"           |
| `fast-forward`    | Trust switch on: applied card with Vrátit, a held deletion awaiting confirmation |
| `history`         | 30-day history                                                                   |
| `not-allowlisted` | Page with no entry points                                                        |
| `daily-cap`       | Cap reached                                                                      |
| `kill-switch`     | Globally disabled                                                                |
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
| Switch / ToggleGroup | `src/lib/components/base/switch/`, `toggle-group/` | Trust switch sub-variants                 |
| Input / Textarea     | `src/lib/components/base/input/`, `textarea/`    | Editable suggested values, composer         |
| Sheet / Dialog       | `src/lib/components/base/sheet/`, `dialog/`      | Mobile panel, deletion confirm, image zoom  |
| DropdownMenu         | `src/lib/components/base/dropdown-menu/`         | Gift More menu entry                        |
| ImageFrame           | `src/lib/components/derived/image-frame/`        | Thumbs and candidates                       |
| GiftCard             | `src/lib/components/blocks/gift/GiftCard.svelte` | Ghost preview (real geometry)               |
| FieldDiffList        | `src/lib/components/blocks/change-proposals/`    | Old value display in field rows             |
| ChangeKindTitle      | `src/lib/components/blocks/change-proposals/`    | Kind counts                                 |
| PendingChangesBanner | `src/lib/components/blocks/change-proposals/`    | Source per row                              |

### Components to Design (new)

| Proposed Name     | Description                                                          |
| ----------------- | -------------------------------------------------------------------- |
| AssistantPanel    | Resizable docked panel / two-height mobile sheet, thread, composer    |
| ChatMessage       | Turns, tool lines, error turn                                        |
| FieldDecisionRow  | Label, old value, editable suggestion, accept/reject/revert, tint    |
| ProposalCard      | Counts, Zkontrolovat · Použít · Zamítnout, applied/undo state        |
| ProposalActionArea| Bottom decision area and trust switch (sub-variant)                  |
| GhostGiftState    | Card preview state for proposed edit, creation, deletion             |

---

## 6. Layout Constraints

- Panel width 360–640 px (≤ 50 % viewport), default 420 px; content container keeps 16 px gutters. Mobile panel full width, 12 px gutters.
- Chat cards use tight insets (8–12 px), nested corners per `AGENTS.md`.
- Typography from `src/app.css`: panel title 17 px DynaPuff semibold; message text 14 px; field rows 13 px; meta 12 px muted.
- Controls `md` 32 px desktop, `lg` 40 px mobile; field-row accept/reject may be `sm` 26 px on desktop with 32 px hit targets.

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
- Keyboard: the docked panel is non-modal, Escape closes it and returns focus to the trigger; the resize handle is keyboard-operable (arrow keys).

---

## 9. Owner Answers and Assumptions

Confirmed by the owner (2026-10-18):

- Review score goes into the description.
- Entry points are hidden outside the allowlist.
- Fast-forward is per chat.
- The pending banner shows one row per proposal, each with its source.
- On shared lists, enrichment adds to the description only.
- Reorders apply without confirmation, even with the trust switch off, and are undoable from the stored previous order.
- The assistant has exactly the recipient's rights and answers with the UI's own refusal or warning, never hinting at reservations.
- Users may let the agent apply changes immediately at their own risk: Použít from the chat and the trust switch need no review step; the review page is optional. Deletions, reservations and manager invitations always need explicit confirmation, even with the trust switch on.

Still an assumption:

- Batches over 5 change rows check on the review page rather than inline.

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
- Implementation of the review page itself (exists).
