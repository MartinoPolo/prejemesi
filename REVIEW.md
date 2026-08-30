# Batch Review — `dev...HEAD` (#287, #285, #284)

## Reviewed scope

Reviewed the `dev...HEAD` batch for issues `#287`, `#285`, and `#284` across four axes:

- **Spec**
- **Code quality / best practices**
- **Test quality**
- **Security**

## Fixes applied

- Added the generated-directory ESLint ignore for `src/paraglide` while preserving the existing stale `src/lib/paraglide` ignore.
- Centralized primary-link URL normalization through `normalizeGiftUrl` before middle-click navigation.
- Corrected wrapper comments to reflect both detail opening and non-interactive-surface middle-click navigation.
- Strengthened unit and integration coverage for middle-click primary-link behavior, including scheme-less URL normalization.

## Dismissed / out of scope

- Card and list presentations intentionally share the same gift-item interaction wrapper so behavior stays consistent across those gift-card surfaces.
- Compact table rows do not use that wrapper and were excluded because issue `#284` explicitly scopes gift cards.
- No compact-view behavior was added.

## Unresolved non-blocking

- No durable automated visual regression was added for `#285` / `#287`.
- Visual browser confirmation remains advisable.

## Verification

- `pnpm run check:all` passed.
- `pnpm run test` passed.
- `pnpm run test:e2e` passed with 133 tests passing and one first-attempt dialog-close timing flake passing on Playwright retry.
- Post-fix code-quality and test-quality re-reviews were clean.
- Security review found no confirmed vulnerability.
- No blocking spec issue remains.
