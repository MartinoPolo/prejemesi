---
name: deploy-to-production
description: Release Přejeme si from dev to production through its gated GitHub workflow.
disable-model-invocation: true
argument-hint: '[optional release description or PR number]'
allowed-tools: Read, Grep, Glob, Bash, AskUserQuestion
metadata:
    author: MartinoPolo
    version: '0.1'
    category: deployment
---

# Deploy to Production

Run a **gated release** from remote `dev` to `production`. Treat `docs/DEPLOYMENT.md` and `.github/workflows/deploy.yml` as the current sources of truth. Use remote refs and an isolated clean checkout so unrelated local changes never enter the release.

## 1. Qualify the Release

1. Read `docs/DEPLOYMENT.md`, `.github/workflows/deploy.yml`, and `scripts/migrate-prod.ts`.
2. Fetch the remote and resolve the repository with `gh repo view --json nameWithOwner`.
3. Compare `origin/production..origin/dev`. If it is empty, stop: there is nothing to release.
4. Record the current production SHA and Worker version as the rollback target.
5. Inspect every changed path and commit. Classify added `drizzle/*.sql` files as a schema-changing release. A modified or deleted existing migration is a release blocker: require a new forward migration or an explicit recovery plan. Identify new or changed runtime variables and secrets without reading or printing secret values.
6. Confirm the latest CI run for the exact `origin/dev` SHA passed.
7. Query the GitHub `production` environment. Confirm it has a required reviewer and a branch policy restricted to `production`. If either control is absent, report the gap and obtain explicit approval before restoring it.
8. For each required Worker setting, confirm the name exists in the correct GitHub or Cloudflare scope. For identity-bearing settings such as `ADMIN_EMAILS`, also confirm the intended production user exists and is eligible. Secret values stay out of output and shell history.

This step is complete only when the report names the exact dev SHA, rollback target, commit and file delta, migration set, migration-history integrity, required configuration changes, green CI run, and verified environment gate. Resolve every unknown before continuing.

## 2. Stabilize the Release PR

1. Reuse the open `dev` to `production` PR or create one.
2. Check whether `production` contains only ancestry commits missing from `dev`; `git diff origin/dev...origin/production` should be empty before syncing.
3. If the PR is behind, update its branch:

```bash
gh api -X PUT repos/{owner}/{repo}/pulls/{pr}/update-branch
```

4. Wait for checks on the final head SHA. Re-run the release classification if syncing changed the tree.
5. Confirm the PR is mergeable and every required check is green.
6. Present the release plan: PR, final SHA, user-visible scope, migrations, configuration changes, rollback target, and expected production hold point. Obtain explicit user confirmation before the first production mutation unless the user already authorized this exact end-to-end release.
7. Provision authorized missing Worker settings in the correct scope, then re-check their names and confirm the live `GIT_COMMIT_SHA` still identifies the current production code.

This step is complete only when the final PR head is stable, mergeable, fully green, the exact release plan is authorized, and every required setting is present.

## 3. Merge and Migrate

1. Merge the release PR with a **merge commit**. Preserve ancestry; this repository's branch model depends on it.
2. Locate the `Deploy (production)` run for the resulting production SHA. Confirm `verify` and `migration-review` finish successfully for that same SHA.
3. Confirm the `deploy` job is waiting for production environment approval. If deployment started without a hold, treat the gate as broken: restore protection and assess whether the new version must be rolled back.
4. For a code-only release, skip database migration.
5. For a schema-changing release:
    - Use a clean checkout at the production SHA.
    - Confirm `.env.production` exists and targets the direct Neon host. Do not expose its URL.
    - Recheck that the migrations are expand-compatible with the currently running app.
    - Run `pnpm db:migrate:prod` before approval. If `pnpm` is unavailable, stop and report the missing project package manager rather than substituting another tool.
    - Verify the expected migrations and schema objects exist in Neon.
6. Approve the pending GitHub production deployment only after configuration and migration checks pass. If the authenticated account cannot approve its own deployment, ask the required reviewer to approve it in GitHub and resume after approval.

This step is complete only when the production merge SHA is fixed, exact-SHA verification passed, every required migration is confirmed in Neon, and the approval gate released the intended deployment.

## 4. Verify the Release

1. Wait for the workflow to finish and inspect the deploy log for the Worker version and `GIT_COMMIT_SHA` assignment.
2. Confirm the GitHub environment deployment, live Worker version, and Worker `GIT_COMMIT_SHA` all identify the production merge SHA. A newly written secret or a successful workflow alone does not prove the intended code is live.
3. Confirm `https://prejemesi.cz` responds successfully and exercise the smallest production smoke path covering the release.
4. Inspect a bounded `wrangler tail` window and relevant Cloudflare metrics for new errors. Keep tokens, query strings, identities, and request data out of retained notes.
5. Report the release PR, production SHA, workflow URL, Worker version, migrations applied or skipped, smoke result, and rollback target.

This step is complete only when every deployed-identity signal matches, the live smoke check passes, and no new production errors are present.

## Rollback Branch

If deployment or smoke verification fails, preserve the failing run URL and UTC window. Select the recorded pre-release Worker version as the exact rollback target and obtain explicit user confirmation unless rollback of this release was pre-authorized. Roll back the app while leaving additive migrations in place, then repeat the deployed-identity, endpoint, smoke, and error checks from verification against the rollback target. Diagnose before attempting another release. Contract migrations are irreversible and must ship only in a later release after the old app no longer uses the contracted objects.
