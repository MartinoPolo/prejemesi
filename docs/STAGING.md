# Staging

https://staging.prejemesi.cz runs the current `dev` branch so a release can be exercised before it reaches production. `.github/workflows/deploy-staging.yml` deploys every `dev` push: it applies pending migrations to the staging database, builds, and runs `wrangler deploy --env staging`.

## What differs from production

| Concern | Staging |
| --- | --- |
| Worker | `prejemesi-staging`, `env.staging` in `wrangler.jsonc` |
| Database | Neon branch `staging` (snapshot of production) behind its own Hyperdrive config; migrations run automatically on deploy |
| Images | R2 bucket `prejemesi-images-staging`, public at `staging-images.prejemesi.cz`; production objects are copied in, so staging deletes never reach production |
| Email | Off: no `RESEND_API_KEY`, so sends are skipped and logged. Existing accounts sign in with their production password; sign-up verification and password reset cannot complete |
| Optional | No Google sign-in, Turnstile, presigned uploads (same-origin upload proxy instead), or AI assistant unless their secrets are added to the staging Worker |
| Indexing | Every response carries `X-Robots-Tag: noindex`; Sentry reports under environment `staging` |

Links the app builds (share, invite, claim, reset) stay on the staging host; see `src/lib/config/site.ts`.

## Refresh the snapshot

Reset the Neon `staging` branch from its parent in the Neon console (Branches → `staging` → Reset from parent), then re-copy images and redeploy so the newest `dev` migrations apply again:

```bash
node scripts/copy-staging-images.mjs
gh workflow run deploy-staging.yml --ref dev
```

Resetting keeps the branch's connection string, so `STAGING_DATABASE_URL` and the Hyperdrive config stay valid.

## Release rehearsal

1. Push to `dev`; wait for **Deploy (staging)**.
2. Test on staging. A failed migration there is the same failure production would hit.
3. Release through `docs/DEPLOYMENT.md` as usual; staging does not replace the production database gate.
