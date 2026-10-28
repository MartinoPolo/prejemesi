# Production Deployment Runbook

How a commit reaches the production Worker, and how schema changes ship safely (issue #110). Provisioning and service setup live in `CLOUDFLARE_SETUP.md`; rehearse a release on staging first (`STAGING.md`).

## The automatic pipeline

Merging the `dev` → `production` release PR is the approval: there is no manual environment approval. The push to `production` (or a manual **Deploy (production)** dispatch) triggers `.github/workflows/deploy.yml`:

1. **verify** — re-runs the reusable check suite (`.github/workflows/checks.yml`) for the exact commit being deployed: formatting, oxlint, stylelint, fallow, svelte-check, eslint, migration safety, unit + browser-mode vitest, and Playwright against a Postgres service. A commit with any failing check never reaches the deploy job.
2. **migration-review** — validates the complete committed migration journal and SQL files and lists migration files added by the push in the step summary.
3. **deploy** — builds with Sentry source maps, applies pending migrations to the production database, requires **EXACT**, then runs `wrangler deploy`. A missing `PRODUCTION_DATABASE_URL` secret, DRIFT, or any result other than EXACT fails the job before `wrangler deploy`, so the previous Worker version keeps serving.

The deployed commit is recorded three ways: in the environment's deployment history (GitHub → Environments → production), in the workflow step summary (with the migration state), and as a `GIT_COMMIT_SHA` plain-text var on the Worker.

### Merge gates

Pull requests targeting `dev` (and `dev` pushes) run the reusable checks through `ci.yml`. Branch protection on both `dev` and `production` requires the stable `checks / required` aggregator, which fails if any check it covers fails. On release PRs (`dev` → `production`) it also covers the release test tier (`docs/TESTING.md#test-tiers`), so a green release PR has passed every test tier.

If the reusable workflow's caller or aggregator job name changes, update the branch protection status check on both `dev` and `production` at the same time.

Production protection is **strict** (branch must be up to date) and applies to admins, so every release PR opens as `BEHIND`: merging `dev` → `production` leaves the merge commit only on `production`, so `dev` always lacks it by the next release. Sync before merging — GitHub's **Update branch**, or:

```powershell
gh api -X PUT repos/MartinoPolo/prejemesi/pulls/<pr>/update-branch
```

This merges `production` back into `dev` and re-triggers the PR checks; do it **before** waiting on CI so the suite runs once, on the final merged tree. `BEHIND` here carries no unique content — verify with `git diff origin/dev...origin/production` (expected: empty). Merge the release with a **merge commit**, never squash: squashing rewrites the shared commits and breaks the ancestry (see `b31fe5b`).

### The `production` environment

The deploy job runs in the GitHub `production` environment (**Settings → Environments → production**) for its deployment history and the `PRODUCTION_DATABASE_URL` environment secret. It has no required reviewer. Its branch policy must admit only the `production` branch, so no other ref can read the production database secret; a missing branch policy is a release blocker. The settings can be recreated with:

```bash
gh api -X PUT repos/MartinoPolo/prejemesi/environments/production \
  --input .github/production-environment.json
gh api -X POST repos/MartinoPolo/prejemesi/environments/production/deployment-branch-policies \
  -f name=production -f type=branch
gh api repos/MartinoPolo/prejemesi/environments/production \
  --jq '{protection_rules, deployment_branch_policy}'
gh api repos/MartinoPolo/prejemesi/environments/production/deployment-branch-policies \
  --jq '.branch_policies[] | {name, type}'
```

The final command must list only the `production` branch policy. Set the database secret without echoing it: `gh secret set PRODUCTION_DATABASE_URL --env production --repo MartinoPolo/prejemesi` (value from stdin), and check its presence by name with `gh secret list --env production`.

## Database: migrate → verify → deploy

The deploy job migrates through `scripts/migrate-prod.ts` against the **direct Neon URL** (never through Hyperdrive, never `db:push`, never seeding) on every deployment, including code-only hotfixes and manual dispatches. The URL must be PostgreSQL, belong to Neon, use the direct (non-`-pooler`) hostname, and match the production host/database fingerprint pinned in the script; credentials may rotate without changing that target identity. The script reads it from the gitignored `.env.production`, which the job writes from `PRODUCTION_DATABASE_URL` after the build and removes before `wrangler deploy`.

The script validates the complete journal and SQL hashes, then compares them with `drizzle.__drizzle_migrations` under an advisory lock:

- **EXACT** — the database ledger exactly matches the deployed SHA; nothing to apply.
- **PENDING** — the database ledger is an exact prefix; `db:migrate:prod -- --yes` applies the listed migrations and requires an EXACT postcondition.
- **DRIFT** — an applied hash/timestamp differs, history is reordered, or the ledger has unexpected rows. The job fails without migrating or deploying; recover with an explicit forward plan.

`pnpm db:verify:prod` then re-checks for EXACT. The scripts redact database details from errors.

Run `pnpm db:verify:prod` locally as a read-only diagnostic (for example to inspect a failed deploy): it needs a gitignored `.env.production` with the direct Neon URL and never prints it.

Migrations run before `wrangler deploy` while the previous app version serves traffic, so a failed deploy leaves the database ahead of the live Worker; the expand → migrate → deploy → contract sequence keeps that safe:

1. **Expand** — additive migration only (new tables/columns, nullable or with defaults; backfills). Old app code must run unchanged against the new schema.
2. **Migrate and verify** — the deploy job reaches EXACT.
3. **Deploy** — the same job deploys; the new app version starts using the new schema shapes.
4. **Contract** — only in a later release, after the deployed app no longer reads the old objects: drop/rename in a separate migration.

Enforcement: `pnpm check:migrations` (part of `check:all` and CI) fails on destructive statements (`DROP TABLE/COLUMN/TYPE`, `RENAME`, `TRUNCATE`, `DELETE FROM`, `SET DATA TYPE`, `SET NOT NULL`) unless the migration tag has a nonempty rationale in `drizzle/contract-migrations.json`. Staging applies every migration to a production snapshot on each `dev` push first (`STAGING.md`).

The acknowledgment stays outside the SQL because Drizzle records the exact SQL hash in production. Never add a marker comment to an applied migration. The recipient-role expand and contract migrations demonstrate the sequence and sidecar acknowledgment.

## Rollback

- **App only:** `wrangler rollback` (or re-run the deploy workflow from the previous production commit). Safe whenever the contract step has not run — which the sequence above guarantees for the current release.
- **Schema:** contract migrations are the only irreversible step; because they ship one release later, the previous app version always remains deployable.

## Production release checklist

- [ ] Target SHA and rollback Worker version recorded.
- [ ] Complete migration manifest passes `pnpm check:migrations`.
- [ ] Any new migration was generated via `pnpm db:generate`, reviewed, committed, and is expand-compatible (or a later contract is explicitly acknowledged); it applied cleanly on staging.
- [ ] `PRODUCTION_DATABASE_URL` is present in the `production` environment (`gh secret list --env production`).
- [ ] All declared Worker bindings are present in the built/deployed config. In particular, `AGENT_API_RATE_LIMIT` must show the per-token policy from `src/lib/server/agent_access/limits.ts`; the agent API fails closed with HTTP 503 if the binding is absent or errors.
- [ ] Any **new env var/secret** the release reads is set on the Worker (`wrangler secret list` + `wrangler versions view <id>`). A missing one does not fail the deploy — the feature just silently stays off.
- [ ] Sync the release PR (`update-branch`) — it opens `BEHIND` every time.
- [ ] `checks / required` is green for the PR's exact head SHA, including the release tier.
- [ ] Merge to `production` (merge commit, not squash).
- [ ] The deploy run passes verify → migrate → EXACT → deploy; its step summary shows the migration state.
- [ ] Verify: https://prejemesi.cz responds, the live Worker's `GIT_COMMIT_SHA` matches the production SHA, and `wrangler tail` shows no errors.
