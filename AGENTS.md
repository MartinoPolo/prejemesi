# Project Instructions

- App is in production (prejemesi.cz) with real user data. Preserve data integrity: avoid destructive schema operations, and migrate existing rows rather than dropping or recreating tables. Code may still be freely refactored, but breaking schema/API changes need a migration plan.
- Before implementation, read `.mpx/CONTEXT.md` (domain language, feature index, constraints) and `.mpx/DECISIONS.md` (settled architectural choices).
- Always fix unrelated errors you encounter (merge artifacts, stale imports, broken references, prior bugs) — they accumulate if ignored. Commit fixes separately from main work. If a fix fails after two attempts, revert and continue with the main task. Always notify user — both for fixes made and problems left unresolved.
- Prefer targeted shell reads: `rg -l`, path-scoped `rg`, `git diff --stat`, and `git diff -- <files>`.
  Inspect a full log only when the tail does not identify the failure.
- Use sub-agents for broad or third-party exploration when explicitly requested or already required by these instructions. Ask them for concise findings and file paths, not full command output.

## Stack

- SvelteKit + Vite
- TypeScript (strict)
- Tailwind CSS
- Drizzle ORM (PostgreSQL, strict mode)
- Vitest + Playwright

## Cloned OSS Repositories

When debugging or analyzing issues related to third-party libraries, delegate exploration to a sub-agent pointing at the cloned source in `C:\_MP_github_cloned\`
**Available**: svelte (+sveltekit), bits-ui, shadcn-svelte, storybook, fallow, lucide, tailwindcss

## Svelte

Before finalizing any .svelte or .svelte.ts file, run svelte-autofixer and iterate until no issues remain.
When editing or creating Svelte code, use Svelte MCP tools (get-documentation, svelte-autofixer) for up-to-date API reference.

## Testing

- When writing tests, always derive expected behavior from requirements (GitHub issue descriptions and comments, `DECISIONS.md`, `CONTEXT.md`, or other docs) — never adapt tests to match the implementation. If a test reveals a bug, report it to the user or fix it immediately.

## Commands

- On Windows, use `pnpm.cmd` for package commands. Corepack's pnpm store lives outside the
  workspace, so package commands may need sandbox escalation.
- `pnpm run dev` -- dev server
- `pnpm run check` -- typecheck
- `pnpm run check:all` -- full check suite (format + lint + typecheck + stylelint + fallow)
- `pnpm run test` -- unit tests
- `pnpm run test:e2e` -- E2E tests
- `pnpm run db:seed` -- populate DB with test data (idempotent, safe to re-run)

## Git Workflow

- For verified branch-delete-only pushes, use `git push --no-verify origin --delete ...` unless the user explicitly wants hooks run.

## Svelte Rules

- Before finalizing any .svelte or .svelte.ts file, run svelte-autofixer and iterate until no issues remain.
- When editing or creating Svelte code, use Svelte MCP tools (get-documentation, svelte-autofixer) for up-to-date API reference.

## Database

- Drizzle with `strict: true` -- always enabled to prevent data loss on renames.
- Schema in `src/lib/server/db/schema.ts`
- Seed script: `src/lib/server/db/seed.ts` — run `pnpm db:seed` to populate test data.

### Test Accounts (password: see `SEED_PASSWORD` in seed.ts — "password" + "123")

| Email          | Name           | Role                                                |
| -------------- | -------------- | --------------------------------------------------- |
| martin@test.cz | Martin Novák   | Primary owner — 4 wishlists (active/draft/archived) |
| jana@test.cz   | Jana Dvořáková | Owner + moderator on Martin's lists                 |
| petr@test.cz   | Petr Svoboda   | Active gifter — many reservations                   |
| eva@test.cz    | Eva Králová    | Casual visitor — mostly likes                       |
| tomas@test.cz  | Tomáš Černý    | Mostly inactive — 1 archived + 1 active list        |

Seed includes 13 wishlists, 47 gifts, 24 reservations (2 marked bought/purchased), 10 likes, moderator assignments, followers (incl. unfollowed), and notifications. Martin follows 6 active lists spanning all gifter states — open (Petr, Eva), reserved (Jana svátek, Tomáš knihy), bought (Jana Vánoce, Tomáš chata) — to exercise the Sledované dropdown sections + truncation. All seed IDs are prefixed `seed-` for easy identification/cleanup.
