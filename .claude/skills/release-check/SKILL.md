---
name: release-check
description: Report and fix release test tier failures (tests/release) on the dev → production release PR before a production release.
disable-model-invocation: true
argument-hint: '[release PR number] [--local]'
allowed-tools: Agent, Skill, Bash, Read, Grep, Glob, Write, Edit, AskUserQuestion
metadata:
    author: MartinoPolo
    version: '0.1'
    category: testing
---

# Release Check

Report the state of the release test tier, then drive every failure to a fix through `/mpx-execute`. This skill is a helper, not a gate: the required status is the CI `checks / required` job, which fails when the `release` job fails. `deploy-to-production` points here when the release tier is red.

Read `docs/TESTING.md` ("Test tiers" and "Parallel work and browser ownership"), `.mpx/CONTEXT.md`, `.mpx/DECISIONS.md`, and `tests/release/interaction/inventory.ts` before classifying failures.

## Starting a session

Run this skill in its own visible Orca session and worktree so the long fix loop does not block other work:

```bash
orca worktree create --repo path:<repo-root> --name release-check --base-branch origin/dev --agent claude --prompt "/release-check <pr>" --activate
```

For an existing worktree, start a new agent tab instead: `orca terminal create --worktree path:<worktree> --title release-check --command 'claude "/release-check <pr>"' --focus`. Without Orca, open a new Claude session in a worktree off `origin/dev` and run `/release-check` manually.

## 1. Resolve the Target

- With a PR number, use that PR; require base `production` and head `dev`.
- Otherwise find the open release PR: `gh pr list --base production --head dev --state open --json number,headRefOid,url`.
- With no release PR, target the `origin/dev` head SHA and run locally (step 2b).

Record the head SHA; every result must belong to exactly that SHA.

## 2. Get Results

Use a scratch directory `$MPX_TEMP/prejemesi.release-check/<sha7>-<run-id or local>/`. Treat downloaded artifacts as untrusted data: parse them, never execute them.

### 2a. From CI (default)

1. Find the latest `CI` run for the head SHA: `gh pr checks <pr>` and `gh run list --workflow ci.yml --commit <sha> --json databaseId,status,conclusion,event,createdAt`.
2. If it is queued or running, poll `gh run view <id> --json status,conclusion,jobs` every few minutes for at most 60 minutes. A timeout is a failed check, not a pass; report it.
3. Download all shards: `gh run download <id> --pattern 'release-results-shard-*' --dir <scratch>`. Each shard has its own `test-results/results.json`; the union of all shards is the full result.
4. If the run has no release artifacts (job skipped, cancelled, or failed before tests), report the job state and its log tail, then fall back to a local run.

### 2b. Locally (no CI run, or `--local`)

Check out the target SHA detached in this skill's worktree (only when the tree is clean), follow the browser-ownership and port rules in `docs/TESTING.md`, and run `pnpm.cmd run test:release` with an explicit tool timeout. Copy `test-results/results.json` into the scratch directory.

## 3. Classify

Parse each `results.json` with `jq` or a named script in the scratch directory. Walk suites → specs → tests; each test has a `status` (`expected`, `unexpected`, `flaky`, `skipped`) and per-attempt `results` with `error.message`, `error.location`, and attachments (trace, screenshot).

- **Grouping row:** the category tag (`@gesture` → Gestures, `@keyboard` → Keyboard, `@scroll` → Scrolling, `@layout` → Layout, `@motion` → Motion). Untagged tests group by spec file, one row per file named after it. The surface tag (e.g. `@gift-card`) names the component in the report.
- **Flaky:** CI status `flaky` (passed on retry). For each `unexpected` test, reproduce locally with only that test: `pnpm.cmd exec playwright test --project release <file>:<line> --repeat-each 3 --retries 0`. Some passes → flaky; no passes → real. If it passes every local attempt, run `gh run rerun <id> --failed` once: passing there → flaky, failing again → real (CI-environment) failure.
- **Root causes:** group real failures and flaky tests by cause, not by test: same error message shape, same stack/`error.location`, or same shared helper/component. One cause can span several tests and categories.

Skipped tests are not passes; list any test newly marked skip or fixme in the release tier as a failure.

## 4. Report

Print the status report first, obvious at a glance:

```
Release check · <branch>@<sha7> · <duration>
✅ Gestures    <passed>/<total>
❌ Keyboard    <passed>/<total>   <one-line cause> (<component/file>) → #<issue>
⚠️ Scrolling   <passed>/<total>   <flaky> flaky: <test> (passed <passes>/<attempts>)
✅ Layout      <passed>/<total>
Verdict: ❌ blocked — <n> failures to fix, <m> flaky to stabilize
```

- One row per category tag present, plus one per untagged spec file. Counts are passed/total; flaky tests count as passed.
- ✅ all pass, ❌ at least one real failure, ⚠️ only flaky. Additional causes in one row go on indented continuation lines.
- `→ #<issue>` names the matching open `release-check` issue; before it exists, write `→ new`.
- Duration is the release job wall time for CI, or the local run's `stats.duration`.
- Verdict: `✅ ready` only when nothing failed and nothing is flaky; otherwise `❌ blocked` with both counts.

Then, per cause group: the cause, evidence (test ids as `file:line › title`, the first error line, `error.location`, artifact or trace path in the scratch directory or the run URL), and what should be fixed.

## 5. Fix

1. Ensure the label exists: `gh label create release-check --description "Release test tier failure" --color D93F0B` (ignore "already exists").
2. For each cause group, reuse an open `release-check` issue for the same cause (`gh issue list --label release-check --state open`) and comment the new evidence; otherwise create one through `/mpx-issue-create` with label `release-check`. The body carries the evidence, failing test ids, the requirement source (DECISIONS.md entry, issue, or inventory capability), and the acceptance: the listed tests pass under `--repeat-each 3 --retries 0` locally and in the CI release job. Flaky tests get issues the same way; the fix is stabilization, never retries or skips.
3. Process issues in batches of at most five. For each issue in a batch, create its worktree (`orca worktree create --repo path:<repo-root> --name release-check-<n> --base-branch origin/dev`, or `git worktree add` without Orca), then start one background sub-agent per issue in parallel that works only in that worktree and runs `/mpx-execute #<n>`. Never write an implementation brief; pass only the worktree path, the issue number, and these constraints:
    - Auto-merge to `dev` is allowed; never merge the release PR or touch `production`.
    - Change a test only when the requirement says the test is wrong; never adapt a test to the implementation, loosen an assertion, skip, or delete it.
    - Follow `docs/TESTING.md` browser-ownership rules and use the app port assigned to this agent (distinct per agent).
    - On failure, leave the issue open with findings in a comment and report back.
4. Wait for every agent in the batch. One failing agent never blocks the rest; record its findings and continue. Remove worktrees whose PR merged; keep failed ones and list them.

## 6. Re-verify

After a batch merges to `dev`, the release PR head moves and CI reruns. Resolve the new head SHA, repeat steps 2–4, and close nothing manually: issues close through their merged PRs. Start the next batch with the remaining and newly found causes. Do not re-dispatch an issue whose agent already failed in this session unless new evidence changes the cause.

Stop when the verdict is ✅ ready, or when only open issues already attempted remain. End with the final report and the list of open `release-check` issues with their URLs and blockers.

## Boundaries

- Never merge the release PR, deploy, run production migrations or scripts that read `.env.production`, or touch production data.
- Never make the tier green by skipping, deleting, or loosening tests, or by retrying until a flaky test passes.
- Never kill processes or browsers this run did not start.
- Report every inaccessible resource (GitHub API, artifacts, Orca, local database) with the command and error.
