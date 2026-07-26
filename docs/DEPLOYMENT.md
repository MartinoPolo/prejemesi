# Production Deployment Runbook

How a commit reaches the production Worker, and how schema changes ship safely
(issue #110). Provisioning and service setup live in `CLOUDFLARE_SETUP.md`.

## The gated pipeline

Merging `dev` → `production` (or a manual **Deploy (production)** dispatch)
triggers `.github/workflows/deploy.yml`:

1. **verify** — runs the full reusable check suite
   (`.github/workflows/checks.yml`, called with `run_e2e: true`) for the exact
   commit being deployed: formatting, oxlint, stylelint, fallow, svelte-check,
   eslint, migration safety, unit + browser-mode vitest, and the Playwright
   e2e suite against a Postgres service. A commit with any failing check never
   reaches the deploy job. (PRs and `dev` pushes run the same suite via
   `ci.yml`, also called with `run_e2e: true`, so e2e runs there too; this
   `verify` step re-runs it to pin the exact deployed commit.)
2. **migration-review** — writes a step summary listing any new `drizzle/*.sql`
   migrations in the push, with the reminder to apply them before approving.
3. **deploy** — waits for the GitHub **`production` environment approval**
   (required reviewer: repo owner; restricted to the `production` branch).
   After approval it builds and runs `wrangler deploy`.

The deployed commit is recorded three ways: in the environment's deployment
history (GitHub → Environments → production), in the workflow step summary,
and as a `GIT_COMMIT_SHA` plain-text var on the Worker.

### PR and `dev` merge gate

Pull requests targeting `dev` (and `dev` pushes) run the reusable checks through
`ci.yml`, now called with `run_e2e: true` — so the full suite **including the
Playwright e2e job** runs on every PR and `dev` push. Branch protection requires
the stable `checks / required` aggregator, which fails if the static/unit checks
fail or (when `run_e2e: true`) if e2e fails. Feedback is slower than the old
e2e-skipped setup, but regressions are caught before the merge rather than only
at the production deploy gate.

If the reusable workflow's caller or aggregator job name changes, update the
branch protection status check on both `dev` and `production` at the same time.

Production protection also requires `checks / required`: release PRs
(`dev` → `production`) run `ci.yml` the same way, so the same aggregator gates
the merge. The production **push** then re-runs the suite through `deploy.yml`'s
`verify` job before the environment-approval deploy step. (Historically this
required `verify / required`, a status that only appears on the production push,
never on the release PR — so it could never be satisfied pre-merge; it was
repointed to `checks / required`.)

Production protection is **strict** (branch must be up to date) and applies to
admins, so every release PR opens as `BEHIND`: merging `dev` → `production`
leaves the merge commit only on `production`, so `dev` always lacks it by the
next release. Sync before merging — GitHub's **Update branch**, or:

```powershell
gh api -X PUT repos/MartinoPolo/prejemesi/pulls/<pr>/update-branch
```

This merges `production` back into `dev` and re-triggers the PR checks; do it
**before** waiting on CI so the suite runs once, on the final merged tree.
`BEHIND` here carries no unique content — verify with
`git diff origin/dev...origin/production` (expected: empty). Merge the release
with a **merge commit**, never squash: squashing rewrites the shared commits and
breaks the ancestry (see `b31fe5b`).

Environment approval is configured under
**Settings → Environments → production** (required reviewer + branch policy).
It was created via `gh api` and can be recreated with:

```powershell
gh api -X PUT repos/MartinoPolo/prejemesi/environments/production --input reviewers.json
gh api -X POST repos/MartinoPolo/prejemesi/environments/production/deployment-branch-policies -f name=production -f type=branch
```

## Schema changes: expand → migrate → deploy → contract

Migrations are intentionally **manual** and run against the **direct Neon URL**
(never through Hyperdrive, never `db:push`, never seeding) using committed
migration files:

```powershell
pnpm db:migrate:prod   # reads .env.production (gitignored, Neon direct URL)
```

Because the migration runs while the **previous** app version is still serving
traffic, every release must keep that window compatible:

1. **Expand** — additive migration only (new tables/columns, nullable or with
   defaults; backfills). Old app code must run unchanged against the new
   schema.
2. **Migrate** — apply the expand migration to Neon (`pnpm db:migrate:prod`)
   **before approving the deployment** in GitHub.
3. **Deploy** — approve the environment gate; the new app version starts using
   the new schema shapes.
4. **Contract** — only in a **later release**, after the deployed app no longer
   reads the old objects: drop/rename in a separate migration.

Enforcement: `pnpm check:migrations` (part of `check:all` and CI) fails on
destructive statements (`DROP TABLE/COLUMN/TYPE`, `RENAME`, `TRUNCATE`,
`DELETE FROM`, `SET DATA TYPE`, `SET NOT NULL`) unless the migration file
explicitly acknowledges the contract step:

```sql
-- expand-contract: <why the deployed app no longer uses the dropped/renamed objects>
```

Example: `drizzle/0003_recipient_role_model_expand.sql` (expand) +
`drizzle/0004_recipient_role_model_contract.sql` (acknowledged contract).

## Rollback

- **App only:** `wrangler rollback` (or re-run the deploy workflow from the
  previous production commit). Safe whenever the contract step has not run —
  which the sequence above guarantees for the current release.
- **Schema:** contract migrations are the only irreversible step; because they
  ship one release later, the previous app version always remains deployable.

## Checklist for a schema-changing release

- [ ] Migration generated via `pnpm db:generate`, reviewed, committed.
- [ ] `pnpm check:migrations` passes (or the contract is acknowledged).
- [ ] Any **new env var/secret** the release reads is set on the Worker
      (`wrangler secret list` + `wrangler versions view <id>`). A missing one
      does not fail the deploy — the feature just silently stays off, which is
      how `ADMIN_EMAILS` sat unset from #150 until the #213 release.
- [ ] Sync the release PR (`update-branch`) — it opens `BEHIND` every time.
- [ ] Merge to `production` (merge commit, not squash); wait for **verify**.
- [ ] Apply migrations: `pnpm db:migrate:prod`.
- [ ] Approve the `production` environment deployment.
- [ ] Verify: https://prejemesi.cz responds; `wrangler tail` shows no errors.
