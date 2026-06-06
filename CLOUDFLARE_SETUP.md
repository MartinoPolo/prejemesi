# Cloudflare Setup & Maintenance Guide

How to deploy Darecky to Cloudflare, develop against it, and maintain it. The
project is **already architected for Cloudflare** — the decision is settled in
`.mpx/DECISIONS.md` (2026-05-30) and most wiring exists in code. This guide
covers provisioning the external services and filling in deploy-time config.

---

## 1. Where everything runs

| Concern      | Service                                 | Status in code                                                                                                  |
| ------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **The app**  | **Cloudflare Workers** (not Pages)      | ✅ `adapter-cloudflare`, `wrangler.jsonc`, `_worker.js` output                                                  |
| **Database** | **Neon Postgres** via **Hyperdrive**    | ✅ `getDb()` reads `platform.env.HYPERDRIVE` → falls back to `DATABASE_URL`; `postgres({ prepare: false })` set |
| **Images**   | **R2** (`darecky-images`)               | ✅ binding + upload proxy + public-URL logic                                                                    |
| **Email**    | **Resend**                              | ✅ wrapper with console fallback                                                                                |
| **Auth**     | better-auth (edge-compatible `minimal`) | ✅ magic-link + email/password + optional Google                                                                |

> The SvelteKit Cloudflare adapter outputs a **Worker with Static Assets**
> (`.svelte-kit/cloudflare/_worker.js` + `ASSETS` binding), **not** a Pages
> project. Deploy to **Workers**; in the dashboard the project appears under
> **Workers & Pages → your worker**. Do not create a Pages project.

**Cost:** $0/month on free tiers — Workers (100k req/day), Hyperdrive (free on
all plans), R2 (10 GB), Neon (free, ~300–800ms cold start after idle), Resend
(3k emails/mo, 100/day).

---

## 2. What's done vs. what you must do

**Already wired (no action):** adapter, wrangler config, Hyperdrive/R2 code
paths, `app.d.ts` platform types, `cf:types` + `preview` scripts, `.env`
gitignored (only `.env.example` tracked), `prepare:false` for the pooler.

**Gaps to close before going public:**

1. Provision Neon DB + create Hyperdrive + uncomment the binding in `wrangler.jsonc`
2. Create the R2 bucket + enable a public URL
3. Set production secrets/vars in Cloudflare
4. Add a `deploy` script (none exists today — only `preview`)
5. Decide a **production migration strategy** (`drizzle/` is empty — push-based, interactive-only)
6. Custom domain + set `ORIGIN`
7. Resend domain verification + `RESEND_API_KEY`
8. Production auth hardening (two flags in `auth.ts`)
9. Google OAuth redirect URIs (if used)

---

## 3. One-time setup (in order)

### A. Account + CLI

```powershell
pnpm add -g wrangler   # or use pnpm dlx wrangler
wrangler login
```

### B. Neon Postgres

Create a project at neon.tech → copy the **direct (non-pooled)** connection
string (Hyperdrive does its own pooling, so point it at the unpooled endpoint).

### C. Hyperdrive

```powershell
wrangler hyperdrive create darecky-db --connection-string="postgresql://USER:PASS@HOST/dbname?sslmode=require"
```

Copy the returned **id**, then uncomment + fill the binding in `wrangler.jsonc`
(already stubbed at line 14):

```jsonc
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<your-hyperdrive-id>" }],
```

### D. R2 bucket + public URL

```powershell
wrangler r2 bucket create darecky-images
```

Then in the dashboard → R2 → `darecky-images` → **Settings → Public access**:
enable the **r2.dev** dev URL or (better) attach a custom subdomain like
`images.darecky.com`. Set that value as `R2_PUBLIC_URL` (below). Without it,
images still work but get proxied through the Worker (burns Worker CPU).

### E. Secrets & vars

**Secrets** (sensitive — `wrangler secret put NAME`, prompts for value):

```powershell
wrangler secret put AUTH_SECRET          # openssl rand -base64 32
wrangler secret put RESEND_API_KEY
wrangler secret put GOOGLE_CLIENT_SECRET  # only if using Google
```

**Plain vars** (non-sensitive — add a `"vars"` block to `wrangler.jsonc`):

```jsonc
"vars": {
  "ORIGIN": "https://darecky.com",
  "R2_PUBLIC_URL": "https://images.darecky.com",
  "EMAIL_FROM": "Darecky <noreply@darecky.com>",
  "GOOGLE_CLIENT_ID": "..."   // optional; not secret
}
```

`ORIGIN` **must** be your production URL — auth redirects and email links derive
from it (else links point to localhost).

### F. Add a deploy script

`package.json` has no `deploy` (only `preview`). Add:

```json
"deploy": "vite build && wrangler deploy"
```

### G. Production migration strategy ⚠️

Currently **push-based** (`drizzle/` is empty, `db:push` is interactive and
fails non-interactively on renames). Fine for local dev, risky for prod. Pick:

- **Simplest now:** run `drizzle-kit push` from your machine against the Neon
  connection string (set `DATABASE_URL` to Neon temporarily). Works, but
  interactive and manual.
- **Recommended long-term:** switch to generated migrations — `pnpm db:generate`
  (commits SQL into `drizzle/`), then `pnpm db:migrate` against Neon in a deploy
  step. Non-interactive, reviewable, safe.

Either way, **migrations run against Neon directly, never through Hyperdrive**
(Hyperdrive is read-optimized/cached for the runtime).

### H. First deploy

```powershell
pnpm run deploy
```

Gives `https://darecky.<your-subdomain>.workers.dev`. Test before attaching a
domain.

### I. Custom domain

Dashboard → your Worker → **Settings → Domains & Routes → Add custom domain** →
`darecky.com`. If the domain's DNS is on Cloudflare, certs + routing are
automatic. Then update `ORIGIN` to match and redeploy.

### J. Resend

Add + verify your sending domain in Resend (DNS records), create an API key →
that's `RESEND_API_KEY`. Until verified you can use the sandbox
`onboarding@resend.dev` (the default fallback), but it only sends to your own
address.

### K. Google OAuth (if used)

In Google Cloud console add the authorized redirect URI:
`https://darecky.com/api/auth/callback/google`.

### L. Production auth hardening

In `src/lib/server/auth.ts` two flags are marked for production:

- `requireEmailVerification: true` (line 21)
- `sendOnSignUp: true` (line 38)

Both depend on Resend working (step J), or users can't verify.

---

## 4. Development workflow (day-to-day)

| Command          | Runtime                             | DB                    | R2                    | Use for                       |
| ---------------- | ----------------------------------- | --------------------- | --------------------- | ----------------------------- |
| `pnpm dev`       | Vite (Node)                         | local Docker Postgres | in-memory fallback    | **Default** — fast HMR        |
| `pnpm preview`   | **real Workers runtime** (wrangler) | local or `--remote`   | real R2 if `--remote` | Verify prod-matching behavior |
| `pnpm db:studio` | —                                   | Drizzle Studio GUI    | —                     | Inspect/edit data             |

**Local DB loop:**

```powershell
pnpm db:start   # docker compose: postgres:17 on :5432
pnpm db:push    # create schema
pnpm db:seed    # test accounts (martin@test.cz etc., pwd: password123)
pnpm dev
```

Keep `.env`'s `DATABASE_URL` pointed at the local Docker DB
(`postgres://root:mysecretpassword@localhost:5432/local`). The app auto-detects:
no Hyperdrive/R2 bindings locally → falls back to `DATABASE_URL` + in-memory
image store. So **local dev needs zero Cloudflare access**.

To test against **real Cloudflare bindings** locally: `wrangler dev --remote`
(after `vite build`) — uses the actual Hyperdrive + R2. Run `pnpm cf:types`
after changing bindings to regenerate types.

---

## 5. Deploy / CI-CD (pick one)

**Recommended — Workers Builds (git-push deploys):** Dashboard → your Worker →
**Settings → Builds → Connect repo**. Build command `pnpm run build`, deploy
command `npx wrangler deploy`, production branch `dev` (your main branch). Every
push auto-deploys; PRs get preview URLs. Secrets live in Cloudflare, not in CI.
Lowest-maintenance, fits the existing `dev`-as-main convention.

**Alternative — manual:** run `pnpm run deploy` when you want to ship.

**Alternative — GitHub Actions:** `ci.yml` currently only checks/tests (no
deploy). Add a deploy job using `cloudflare/wrangler-action` with a
`CLOUDFLARE_API_TOKEN` secret. More moving parts than Workers Builds; only worth
it to gate deploys behind existing CI.

---

## 6. Maintaining it going forward

- **Schema changes:** edit `schema.ts` → `db:generate` → review SQL →
  `db:migrate` against Neon → deploy. (Or local `db:push` for dev iteration.)
- **Secrets rotation:** `wrangler secret put NAME` creates a new version +
  deploys immediately. List with `wrangler secret list`.
- **Logs / debugging prod:** `wrangler tail` for live logs; enable
  **Observability** on the Worker in the dashboard for retained logs + metrics.
- **Hyperdrive caching gotcha:** Hyperdrive caches `SELECT`s (~60s default).
  With auth/session data this can serve briefly stale reads. better-auth already
  has a 5-min session cookie cache, so usually fine — but if you see stale data,
  disable Hyperdrive query caching (`wrangler hyperdrive update <id>
--caching-disabled` or `caching: { disabled: true }`). Writes are never cached.
- **Free-tier ceilings:** Workers 100k req/day, Resend 100 emails/day, Neon
  compute hours, R2 10 GB. All have dashboards.
- **Neon cold starts:** after ~5 min idle the first request pays 300–800ms.
  Acceptable for a family app; Neon has a paid always-on option if needed.

---

## 7. Before flipping the GitHub repo to public 🔒

- ✅ `.env` is gitignored; only `.env.example` is tracked (no real secrets).
- ⚠️ **Scan git history** for any secret ever committed:
  `pnpm dlx @secretlint/secretlint "**/*"` or run `gitleaks detect`. If anything
  turns up, rotate it (it's permanently in history).
- Dev secrets in `compose.yaml`/`.env.example` (`mysecretpassword`, local-only)
  are harmless to expose.
- After making public, confirm no Cloudflare/Neon/Resend/Google keys appear in
  any committed file.

---

## Quick reference — code-side changes (no account access needed)

These can be applied in a commit without any Cloudflare login:

1. Add the `deploy` script to `package.json`
2. Uncomment/template the `hyperdrive` + `vars` blocks in `wrangler.jsonc`
3. Flip the two production auth flags in `src/lib/server/auth.ts`
4. Optionally switch Drizzle to generated migrations (`db:generate` + `drizzle/` baseline)

Account-side steps (Neon, Hyperdrive create, secrets, domains) require your login.
