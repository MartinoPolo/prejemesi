# Connected view switcher — final design

**Base:** B · **Approved:** 2026-09-21 · **Issue:**
[#395](https://github.com/MartinoPolo/prejemesi/issues/395)

[Final mockup](refined.html) · [Approved requirements](DESIGN_BRIEF_CONNECTED_VIEW_SWITCHER.md)

The user approved the non-animated design with selected-only square-button emphasis and flush
selected-side backing. Production uses the scoped `connected` segmented-toggle presentation.

## Component map

| Existing component                                                | Implementation role                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/lib/components/blocks/gift/GiftViewSwitcher.svelte`          | Preserve view values, Compact fallback and accessible selection behavior.                              |
| `src/lib/components/derived/segmented-toggle/`                    | Add a scoped presentation option for the approved switcher; preserve other consumers.                  |
| `src/lib/components/base/button/`                                 | Reuse authoritative face sizing, border, radius and icon treatment; do not change neighboring buttons. |
| `src/lib/components/blocks/wishlist/WishlistDetailToolbar.svelte` | Preserve existing mobile/desktop composition and spacing.                                              |

No additional library components are needed. Reuse `src/app.css` elevation and palette tokens, but
do not apply raised-owner interaction classes to this switcher. Implement semantic controls through
the existing Svelte components, not the mockup's cloned decorative HTML. Update shadowless-switcher
regression expectations only to the approved requirements and verify other segmented-control
consumers.

## Verification and maintenance

```bash
node designs/connected-view-switcher/verify.mjs
```

Raw Playwright verifies the requirements in the brief and writes
`.local/connected-view-switcher/final-{mobile,desktop}[-dark].png`. Production component and
application regressions cover the scoped presentation and preserve default segmented controls.

Keep `preview.html`, `preview.css`, `preview.js`, `review.css` and `review.js` as the final
artifact's shared runtime. `reference-data.js`, `app-reference.css` and `assets/` preserve the
actual toolbar and licensed fonts for offline viewing. Exploratory variants, comparison navigation
and animation branches were removed.

For an intentional reference refresh, with a local dev server and seeded DB:

```bash
node designs/connected-view-switcher/refresh-reference.mjs
```

Optionally set `PLAYWRIGHT_BASE_URL` to another loopback dev origin. This captures local toolbar
markup/styles/fonts without changing application source or wishlist data. Re-review any visual
differences before replacing the approved reference.
