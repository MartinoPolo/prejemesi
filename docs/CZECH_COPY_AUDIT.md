# Czech copy audit — issue #351

## Checked sources and surfaces

- Priority defaults and seed data: `DEFAULT_PRIORITY_LEVELS` and the seed rows intentionally store
  the stable ASCII i18n keys `Vysoka`, `Stredni`, and `Nizka`.
- Translations: Czech priority messages are `Vysoká`, `Střední`, and `Nízká`; English messages
  provide the corresponding localized labels.
- Gift cards, list rows, detail/edit form, and grouped section headings already resolve recognized
  default keys through the priority display translations and remain unchanged.
- Bulk-selection menus and summaries plus mobile/desktop gift context actions received raw labels
  from the wishlist page action-option mapping. That mapping now localizes recognized default keys.
- Priority filter options received raw gift priority labels from the gifts context. They now use the
  same display-label rule while retaining option IDs and ordering.
- Other Czech runtime copy and `messages/cs.json` were swept for malformed encoding and confirmed
  non-priority diacritic mistakes; none were found. Formal address and established domain
  terminology are unchanged.

## Data policy

No schema, database rows, defaults, seed values, or user-authored labels are rewritten. Only the
three recognized default keys are translated for display. Every custom label—including whitespace
and prototype-like names—is preserved exactly. Mutation behavior belongs to the separate bulk-action
regression scope and was not changed.
