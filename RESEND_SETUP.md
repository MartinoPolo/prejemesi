# Resend Email Setup

Status of email sending in Darecky, the free-tier limits, what's already wired, and the
manual steps left to make it work end-to-end.

## Service: Resend (free tier)

| Limit            | Free tier                   |
| ---------------- | --------------------------- |
| Emails / month   | 3,000                       |
| **Emails / day** | **100** ← the binding limit |
| Verified domains | 1                           |
| Log retention    | 30 days                     |
| Webhooks         | Basic                       |

Plenty for dev and early production. Pro ($20/mo) drops the daily cap and raises domains to 10.

**Sandbox vs. verified domain:**

- Until a domain is verified, the sandbox sender `onboarding@resend.dev` only delivers to:
    - the email you signed up to Resend with, and
    - the test addresses `delivered@resend.dev` (always succeeds), `bounced@resend.dev`,
      `complained@resend.dev` (simulate failures).
- Sending to any other real address requires verifying a domain (DNS records) — see Step 4.

## What's already wired (in code)

- `resend@6.x` installed.
- `src/lib/server/email.ts`
    - `sendEmail({ to, subject, html, idempotencyKey? })` — wraps Resend, handles the
      `{ data, error }` response, **throws on failure**, and **logs instead of sending when
      `RESEND_API_KEY` is unset** (same optional-service fallback as R2 storage).
    - `renderActionEmail({ heading, body, buttonLabel, url })` — shared HTML template.
- `src/lib/server/auth.ts` — the three better-auth stubs now send real emails:
    - `sendResetPassword` (password reset)
    - `sendVerificationEmail` (email verification)
    - `sendMagicLink` (magic-link sign-in)
- `.env.example` documents `RESEND_API_KEY` and `EMAIL_FROM`.

## Manual steps (you)

### 1. Create a Resend account + API key

1. Sign up at <https://resend.com> (free, no card). Use the email you'll test with —
   sandbox only delivers there.
2. Dashboard → **API Keys** → **Create API Key** (name `darecky-dev`, **Sending access**, domain **All**).
3. Copy the `re_...` key (shown once).

### 2. Configure `.env`

```
RESEND_API_KEY=re_your_key_here
EMAIL_FROM="Darecky <onboarding@resend.dev>"
```

Restart the dev server after editing `.env` so Vite reloads it.

### 3. Test the slice

1. `pnpm run dev`
2. From the login UI, request a **magic link** or **password reset** using your **Resend
   account email** (the only deliverable sandbox recipient).
3. Server console prints `[Email] Sent "..." (id=...)` on success. Check the inbox.

Troubleshooting:

- `(not sent — RESEND_API_KEY unset)` → key didn't load; check `.env` and restart dev server.
- `[Email] Failed ...` to a non-sandbox address → expected before domain verification.

### 4. (Later) Verify a sending domain — for real recipients

1. Resend → **Domains** → **Add Domain** → enter your domain.
2. Add the shown DNS records (SPF/`MX`, DKIM `TXT`, optional DMARC) at your DNS provider.
3. Once **Verified**, set `EMAIL_FROM="Darecky <noreply@yourdomain.com>"`.

This needs a domain you own and is **not** required to prove emailing works — skip until
you're onboarding real users.

## Remaining work (notification emails — not yet built)

Auth emails are the smallest slice and are done. The notification-email path is still open:

- Infra that already exists: `notifications/types.ts` (`EMAIL_NOTIFICATION_TYPES` lists which
  types must email), the `emailSent` column on the notification schema, and the per-type email
  toggle UI (`NotificationPreferencesForm.svelte`).
- Missing: the notification **dispatcher** — write the notification row, and for
  `EMAIL_NOTIFICATION_TYPES` check the user's preference, call `sendEmail(...)` (pass a stable
  `idempotencyKey` per event to avoid double-sends on retry), then flip `emailSent`. Wire it
  into the event points (gift reservation, moderator invite, wishlist archive, etc.).

## References

- Resend Node.js docs: <https://resend.com/docs/send-with-nodejs>
- Quotas & limits: <https://resend.com/docs/knowledge-base/account-quotas-and-limits>
- Pricing: <https://resend.com/pricing>
