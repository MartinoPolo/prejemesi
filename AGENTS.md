# Project Instructions

## Stack

- SvelteKit + Vite
- TypeScript (strict)
- Tailwind CSS
- Drizzle ORM (PostgreSQL, strict mode)
- Vitest + Playwright

## Commands

- `pnpm run dev` -- dev server
- `pnpm run check` -- typecheck
- `pnpm run check:all` -- full check suite (format + lint + typecheck + stylelint + fallow)
- `pnpm run test` -- unit tests
- `pnpm run test:e2e` -- E2E tests

## Svelte Rules

- Before finalizing any .svelte or .svelte.ts file, run svelte-autofixer and iterate until no issues remain.
- When editing or creating Svelte code, use Svelte MCP tools (get-documentation, svelte-autofixer) for up-to-date API reference.

## Database

- Drizzle with `strict: true` -- always enabled to prevent data loss on renames.
- Schema in `src/lib/server/db/schema.ts`
