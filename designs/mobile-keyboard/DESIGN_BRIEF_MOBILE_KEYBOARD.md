# Mobile Keyboard Layouts: Design Brief

> **Status**: Refined (Variant B)
> **Refined mockup**: `designs/mobile-keyboard/refined.html`
> **Summary**: `designs/mobile-keyboard/SUMMARY.md`
> **Refinements**: none, Variant B accepted as is

How every mobile surface with a text input behaves while the on-screen keyboard is open. Today the app ignores the keyboard: the AI chat composer floats mid-screen with dead space below it and the chat loses its controls and starters. The design defines one keyboard-aware layout system that adapts to the real keyboard height, then applies it to each affected surface, starting with the AI chat.

**Source**: [#623](https://github.com/MartinoPolo/prejemesi/issues/623); `.mpx/DECISIONS.md` (mobile sheets, chatbot panel, gift editor dialogs, control sizing).

---

## 1. Purpose

On a phone the keyboard takes 35–50 % of the screen. While typing, the user must still see what they type, the primary action for it, and enough context to know where they are. The question each layout answers at a glance: "what am I typing into, and how do I send or save it?"

**Key value**: the focused input and its action always sit directly above the keyboard, whatever its height.

---

## 2. Surrounding Context

The mockup **MUST** show a full 390×844 phone frame (status bar, browser URL bar, page, keyboard, Android nav bar) at real proportions, using `designs/ai-chatbot/refined.html` as the fidelity reference for the app shell, wishlist page and assistant sheet.

### Full Viewport Structure

1. Browser chrome: status bar and URL bar (≈ 110 px at 390 wide), fixed, not part of the page.
2. App navbar (final state): 56 px, tilted logo, create, bell, avatar; mobile drawer trigger left.
3. Wishlist page `/w/<id>` (final state): notebook hero, one-row toolbar, gift cards (2 columns or 1).
4. Surface under design, one per scenario (§3.2–3.5).
5. Simulated keyboard: dark Gboard-style keyboard with suggestion strip, number row optional; height switchable.
6. Android gesture/nav bar (≈ 48 px) below the keyboard.

**What parent provides**: browser chrome, keyboard, navbar, wishlist page.
**What this design fills**: the layout of each input surface while the keyboard is open and while it opens or closes.
**Must NOT include**: desktop layouts, changes to closed-keyboard layouts beyond what keyboard support requires.

**Mockup rendering instructions**:

- One review toolbar outside the phone switches: scenario (§4), keyboard `closed | compact 260 | typical 336 | tall 420` px, and theme `light | dark`, palette `sky`. Mirror them in the URL: `?scenario=<id>&kb=closed|260|336|420&theme=light|dark`.
- Animate keyboard open/close (≈ 250 ms, eased) so the reflow is visible; `prefers-reduced-motion` snaps.
- Real Czech copy and real product photos from `static/demo/`.

---

## 3. Requirements

### 3.1 Layout system (all surfaces)

- Layouts size against the **visible viewport above the keyboard**, not the full screen: the keyboard pushes content up, never covers the focused input or its primary action.
- Works with any keyboard height and with changes while open (suggestion strip appearing, emoji panel, switching keyboards, rotating).
- Bottom-anchored surfaces (sheets, composers, fixed footers) sit flush on the keyboard top with no gap and no overlap; safe-area padding applies only when the keyboard is closed.
- When space runs short, collapse in this order: decorative spacing → secondary header lines → non-essential context (preview area, long helper text) → never the input, its action, or the close control.
- Closing the keyboard restores the exact previous layout and scroll position.

### 3.2 AI chat sheet (priority)

The mobile assistant is a bottom sheet (half ≈ 50 %, full ≈ screen − 48 px) with a two-line header (line 1: icon, "AI asistent", wishlist subtitle, ✕; line 2: Náhled, history, new chat, Bez kontroly switch), the thread, the decision bar for an open proposal (count, Zamítnout vše, Přijmout vše, Použít), starters on an empty chat ("Vylepšit dárek bez obrázku", "Přidat dárky z odkazů", "Upravit více dárků najednou") and the composer ("Napište, co mám udělat…", send).

With the keyboard open:

- The composer sits directly on the keyboard.
- Controls stay reachable: close, Bez kontroly state, and the decision bar when a proposal is open.
- Suggestions stay visible above the composer (starters on an empty chat, follow-up chips after a reply).
- The thread fills the remaining space and keeps the latest message visible; it scrolls independently.
- A half-height sheet expands to use the space above the keyboard rather than being pushed off screen.
- Multi-line input grows up to a cap that scales with the usable height (more lines with a compact keyboard, fewer with a tall one), then scrolls internally.

### 3.3 Gift editor dialog (mobile)

Near-full-screen dialog: fixed compact title row with 40 px close, scrolling fields (Název, Odkaz, Cena, Popis, …, image workshop), fixed footer Uložit / Zrušit.

- The focused field scrolls into view above whatever bottom chrome remains.
- Decide whether the footer rides on the keyboard or hides while typing (design freedom §9); Save must stay reachable within one action.

### 3.4 Small dialogs and sheets with one or two inputs

Representative: Reserve modal (name, optional e-mail), category quick-add, create wishlist, share message.

- Centered dialogs move up so the input and primary button sit above the keyboard; if the dialog is taller than the space, its body scrolls and the actions stay pinned.
- Bottom sheets with inputs behave like the chat sheet: flush on the keyboard.

### 3.5 Full-page forms

Representative: sign-in page (e-mail, heslo, Přihlásit).

- The page scrolls so the focused field and the submit button are visible; brand panel compresses first.

---

## 4. States

| Scenario id     | Surface                    | Content                                                          |
| --------------- | -------------------------- | ---------------------------------------------------------------- |
| `chat-empty`    | AI chat, half sheet        | Empty chat with three starters, composer focused                 |
| `chat-reply`    | AI chat, full sheet        | Thread with a reply and follow-up chips, composer focused        |
| `chat-proposal` | AI chat, full sheet        | Open proposal (3 gifts) with decision bar, composer focused      |
| `chat-long`     | AI chat                    | Composer holding 6 lines of text (growth cap and internal scroll) |
| `editor`        | Gift editor dialog         | Popis textarea focused, mid-form                                 |
| `reserve`       | Reserve modal              | E-mail field focused                                             |
| `signin`        | Sign-in page               | Heslo focused                                                    |

Each scenario renders at every keyboard height, including `closed` for comparison. Also show: focus ring on the active input, disabled composer (daily cap reached) and streaming ("Zastavit") in the chat.

---

## 5. Component Reuse Map

### Existing Components (MUST use)

| Component     | Path                                         | Usage                                   |
| ------------- | -------------------------------------------- | --------------------------------------- |
| Button        | `src/lib/components/base/button/`            | Send, Použít, Uložit, Zrušit (`lg` on mobile) |
| Textarea      | `src/lib/components/base/textarea/`          | Composer, Popis, note                   |
| Input         | `src/lib/components/base/input/`             | Single-line fields                      |
| Sheet         | `src/lib/components/base/sheet/`             | Mobile sheets                           |
| Dialog        | `src/lib/components/base/dialog/`            | Editor, reserve, quick-add              |
| Switch        | `src/lib/components/base/switch/`            | Bez kontroly                            |
| Assistant UI  | `src/lib/components/blocks/chat/`            | Header, composer, decision bar, starters |

### Components to Design (new)

| Component              | Description                                                        | Why New                                   |
| ---------------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Keyboard-aware surface | Shared behavior that keeps bottom-anchored chrome on the keyboard  | No surface handles the keyboard today     |
| Compact chat header    | Keyboard-open form of the two-line assistant header (if a variant needs it) | The two-line header costs ≈ 100 px |

---

## 6. Layout Constraints

- Phone 390×844 frame; content gutters 12 px; controls `lg` 40 px, touch targets ≥ 40 px.
- Keyboard heights 260 / 336 / 420 px; usable height between URL bar and keyboard ≈ 420 / 344 / 260 px at those heights. Every scenario must work at 260 px usable height.
- Composer minimum one line (≈ 52 px including padding), cap per §3.2.

---

## 7. Design Tokens

From `src/app.css`: fonts (display for titles, sans for body), `--ink`, `--brand`, `--radius-panel`, `--elevation-*`, `--size-control-lg`, `--space-*`. Palette `sky`, light and dark. Decision bar and proposal colors as in `designs/ai-chatbot/refined.html`.

---

## 8. Design Constraints (Non-Negotiable)

- Input and its primary action are never covered by the keyboard or pushed off screen.
- No fixed pixel offsets for the keyboard; layouts follow its measured height.
- Keep the assistant's header contents, decision bar actions and copy from the chatbot decisions; only their arrangement may change while the keyboard is open.
- Ink borders, hard shadows and nested-corner geometry per the project rules.
- Respect `prefers-reduced-motion`.

---

## 9. Design Freedom

- How the chat header compacts (single line, icons only, hide line 2 behind a control).
- Where suggestions live (chip row above the composer, inside the composer top, horizontal scroll vs. wrap).
- Whether the decision bar collapses to a one-line summary while typing.
- Gift editor footer: ride on the keyboard vs. hide while typing with Save in the title row.
- Transition style between keyboard closed and open.

---

## 10. Visual References

- `designs/ai-chatbot/refined.html`: assistant sheet, header, decision bar, composer (mobile viewport).
- `designs/gift-mobile-fields-first/`: mobile gift editor composition.
- Screenshot of the current defect in #623.

---

## 11. Not Included

- Desktop and tablet layouts.
- Chat features, copy or decision logic beyond layout.
- Hardware keyboards.
