---
name: deploy-to-production
description: Release Přejeme si from dev to production through its automatic GitHub workflow.
disable-model-invocation: true
argument-hint: '[optional release description or PR number]'
allowed-tools: Read, Grep, Glob, Bash, AskUserQuestion
metadata:
    author: MartinoPolo
    version: '0.3'
    category: deployment
---

# Deploy to Production

Run a release from remote `dev` to `production`. Treat `docs/DEPLOYMENT.md`, `.github/workflows/deploy.yml`, and `scripts/migrate-prod.ts` as the sources of truth. Merging the release PR is the approval: once merged, the deploy workflow applies pending migrations, requires EXACT, and deploys without a manual hold. Use remote refs so unrelated local changes never enter the release. Resolve the production SHA yourself from `origin/production`; never ask the user to supply it. Never print credentials, connection URLs, tokens, or production data.

## 1. Qualify the Release

1. Read the three sources of truth above.
2. Fetch the remote and resolve the repository with `gh repo view --json nameWithOwner`.
3. Compare `origin/production..origin/dev` and inspect every changed path and commit.
    - If changes exist, continue with a `dev` → `production` release PR.
    - If no changes exist and the user explicitly requested a redeploy, use the manual-dispatch path in step 3.
    - Otherwise stop: there is nothing to release.
4. Record the current production SHA and Worker version as the rollback target.
5. Run `pnpm check:migrations` at the candidate tree. Classify every added `drizzle/*.sql` file for the report (expand, backfill, or acknowledged contract) and confirm it applied on staging. A modified or deleted existing migration is a blocker requiring a forward migration or explicit recovery plan.
6. Identify runtime variable and secret changes without reading or printing secret values. Verify every required name in the correct GitHub or Cloudflare scope, including `PRODUCTION_DATABASE_URL` in the production environment (`gh secret list --env production`, names only). For identity-bearing settings such as `ADMIN_EMAILS`, confirm the intended production user exists and is eligible.

Qualification is complete when the report names the candidate SHA, rollback target, commit/file delta, migration-file delta with classification, manifest integrity result, and required configuration changes.

## 2. Pass the Release PR

1. Reuse the open `dev` → `production` PR or create one.
2. Confirm production contains no unique content; `git diff origin/dev...origin/production` must be empty before syncing.
3. If the PR is behind, update it:

```bash
gh api -X PUT repos/{owner}/{repo}/pulls/{pr}/update-branch
```

4. Wait for checks on the final head SHA, then repeat qualification if syncing changed the tree.
5. Require the PR to be mergeable and `checks / required` green for that exact head SHA. On production PRs it includes the release test tier.
6. If the release tier fails, run the `/release-check` project skill, optionally in a separate Orca session for visibility. It reports the failures and fixes them in batches; continue once the release PR is green again.
7. Present the PR, final head SHA, user-visible scope, migration-file delta, configuration changes, and rollback target. Obtain explicit confirmation before merging unless the user already authorized this exact release scope. Provision authorized missing settings first and recheck their names.

## 3. Merge and Watch the Deployment

For a normal release, merge the release PR with a merge commit; never squash. Fetch `origin/production`, verify it matches the PR's merge commit, and record that SHA.

For an explicitly requested redeploy with no source delta:

```bash
gh workflow run deploy.yml --ref production
```

Then watch the `Deploy (production)` run for the exact production SHA:

1. `verify` and `migration-review` must succeed.
2. In `deploy`, the migration step reports the ledger state in the step summary: EXACT (nothing to apply) or the applied PENDING tags followed by EXACT. `Require EXACT production migration history` must pass before `wrangler deploy` runs.
3. A missing secret, DRIFT, or a non-EXACT result fails the job before `wrangler deploy`, so the previous Worker keeps serving. Stop and report; DRIFT needs an explicit forward recovery plan. `pnpm db:verify:prod` with a local `.env.production` is the read-only diagnostic.

## 4. Verify the Release

1. Inspect the deploy log for the Worker version and `GIT_COMMIT_SHA` assignment.
2. Require the GitHub environment deployment, live Worker version, Worker `GIT_COMMIT_SHA`, and workflow head to identify the same production SHA.
3. Confirm `https://prejemesi.cz` responds and exercise the smallest production smoke path covering the release. Do not create production users or mutate user data unless explicitly authorized.
4. Inspect a bounded `wrangler tail` window, Sentry, and relevant Cloudflare metrics for new errors without retaining tokens, query strings, identities, or request data.
5. Report the release PR or manual dispatch, production SHA, workflow URL, Worker version, migration result, smoke result, and rollback target.

## Rollback

If deployment or smoke verification fails, preserve the failing run URL and UTC window. Select the recorded pre-release Worker version and obtain explicit rollback approval unless rollback was already authorized. Roll back the app while leaving additive migrations in place, then repeat identity, endpoint, smoke, and error checks. Contract migrations are irreversible and belong only in a later release after the old app no longer uses the contracted objects.
