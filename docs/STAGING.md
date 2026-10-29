# Staging

https://staging.prejemesi.cz runs the current `dev` branch so a release can be exercised before it reaches production. `.github/workflows/deploy-staging.yml` deploys every `dev` push: it applies pending migrations to the staging database, builds, and runs `wrangler deploy --env staging`.

## What differs from production

| Concern | Staging |
| --- | --- |
| Worker | `prejemesi-staging`, `env.staging` in `wrangler.jsonc` |
| Database | Neon branch `staging` (snapshot of production) behind its own Hyperdrive config; migrations run automatically on deploy |
| Images | R2 bucket `prejemesi-images-staging`, public at `staging-images.prejemesi.cz`; production objects are copied in, so staging deletes never reach production |
| Email | Off: no `RESEND_API_KEY`, so sends are skipped and logged. Sign-up verification and password reset cannot complete; see [Sign in](#sign-in) |
| AI assistant | Scripted fake provider (`CHAT_PROVIDER=fake`, no API cost), shown only to the emails in the `CHAT_ALLOWED_EMAILS` Worker secret; switch to `anthropic` and add an `ANTHROPIC_API_KEY` secret to test the real model |
| Optional | No Turnstile or presigned uploads (same-origin upload proxy instead) unless their secrets are added to the staging Worker |
| Indexing | Every response carries `X-Robots-Tag: noindex`; Sentry reports under environment `staging` |

Links the app builds (share, invite, claim, reset) stay on the staging host; see `src/lib/config/site.ts`.

## Sign in

Google sign-in uses the production OAuth client, whose authorized redirect URIs include `https://staging.prejemesi.cz/api/auth/callback/google`. For a password sign-in, give an existing account a staging-only password (generated and printed unless one is passed):

```bash
pnpm exec tsx scripts/set-staging-password.ts <email> [password]
```

## Refresh the snapshot

Reset the Neon `staging` branch from its parent in the Neon console (Branches → `staging` → Reset from parent), then re-copy images, re-set staging passwords, and redeploy so the newest `dev` migrations apply again:

```bash
node scripts/copy-staging-images.mjs
pnpm exec tsx scripts/set-staging-password.ts <email>
gh workflow run deploy-staging.yml --ref dev
```

Resetting keeps the branch's connection string, so `STAGING_DATABASE_URL` and the Hyperdrive config stay valid.

## Release rehearsal

1. Push to `dev`; wait for **Deploy (staging)**.
2. Test on staging. A failed migration there is the same failure production would hit.
3. Release through `docs/DEPLOYMENT.md`; the production deploy job still applies and verifies migrations against the production database itself.
