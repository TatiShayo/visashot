# VisaShot

Turn a phone selfie into a government-compliant passport/visa/ID photo in 60
seconds. One-time payment of $4.99 per photo set. Next.js 15 App Router +
TypeScript + Tailwind + Supabase + MediaPipe (client-side face landmarks) +
Replicate (background removal) + sharp + Stripe + Resend.

Binding documents: `BUILD_PROMPT.md` (product spec) and `PLAYBOOK.md`
(standards). Build continuity: `PROJECT_STATE.md`. Analytics events:
`analytics.md`.

## Development

```bash
npm install
cp .env.example .env   # fill in what you have; everything mocks gracefully
npm run dev
```

No keys? The app still runs end-to-end in dev:

| Missing key | Fallback |
|---|---|
| Supabase | Local filesystem store (`.data/` orders, `.storage/` files) |
| `REPLICATE_API_TOKEN` | Mock bg-removal returns the original image with `mockBackground: true` |
| Stripe | Dev-only mock checkout at `/api/dev/mock-pay` (never active in prod) |
| `RESEND_API_KEY` | Emails written to `.mock-emails/*.html` |
| Turnstile | Verification passes (dev only) |
| PostHog / Sentry | Events/errors logged to console only |

## Commands

```bash
npm run dev         # dev server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest unit tests (crop math, specs, tokens, pdf layout…)
npm run build       # production build
npm run verify      # all four gates, in order
```

## Adding a photo spec (the moat)

1. Open `data/photo-specs.ts` and add ONE object to `PHOTO_SPECS`.
2. Record the official government page in `sourceUrl`. If you could not verify
   head-height / eye-line numbers against that page, set
   `needsVerification: true` and keep ICAO-derived defaults.
3. `npm run test` — the spec database test suite validates ranges, aspect
   ratio, dpi consistency, and related-spec links.
4. Done. The spec automatically gets a landing page at `/photo/<id>`, a
   sitemap entry, processing targets, and checkout support.

## Security invariants (do not break)

- The un-watermarked processed photo NEVER appears in any pre-payment
  response. Watermarking happens server-side inside the pipeline; the clean
  master is stored privately and only served by `/api/download/*` after a
  server-side paid-status check plus a signed, expiring token
  (`lib/sign.ts`). There is a regression test for this.
- All uploads: 15 MB cap, magic-byte sniffing, re-encoded through sharp
  (strips EXIF/GPS), rate-limited, consent checkbox required before
  processing.
- Order ids are nanoids — never sequential.
- Face photos auto-purge after 7 days (cron) — this is a privacy commitment,
  not just cost control.

## NEEDS HUMAN — external setup (not automatable from this machine)

1. **Supabase project**: create; set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Run the SQL in
   `supabase/schema.sql`. Create a **private** storage bucket `photos`.
2. **Replicate**: create API token → `REPLICATE_API_TOKEN`.
3. **Stripe**: keys → `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`;
   register webhook `https://<domain>/api/stripe/webhook` (events:
   `checkout.session.completed`) → `STRIPE_WEBHOOK_SECRET`. Enable Stripe Tax
   and Radar in the dashboard. Create the 20% recovery promotion code →
   `RECOVERY_PROMO_CODE`.
4. **Resend**: verify sending domain; `RESEND_API_KEY`, `EMAIL_FROM`.
5. **PostHog**: project key → `NEXT_PUBLIC_POSTHOG_KEY`.
6. **Sentry**: DSN → `SENTRY_DSN`.
7. **Turnstile**: site + secret keys (invisible widget mode).
8. **Secrets**: generate long random `DOWNLOAD_SIGNING_SECRET`, `CRON_SECRET`,
   `ADMIN_TOKEN`; set `ADMIN_EMAILS`.
9. **Vercel deploy**: import repo, set all env vars, deploy. Configure crons
   (see `vercel.json`): storage purge (daily), expiry reminders (daily),
   abandoned-order recovery (hourly) — all call `/api/cron/*` with
   `Authorization: Bearer $CRON_SECRET`.
10. **Verify spec data**: every spec in `data/photo-specs.ts` flagged
    `needsVerification: true` must be re-checked against its `sourceUrl`
    before launch.

## Refund workflow (the guarantee)

Customer claims a government rejection → open `/admin` (token-gated) → find
the order → one-click refund (calls Stripe refund + marks the order refunded +
audit-logs the action). Reply with the day-3 email template. Refunds are
expected and priced in — keep the guarantee loud.

## Weekly operating ritual (PLAYBOOK 4.5)

30 minutes: review funnel (visits → upload → checklist pass → checkout →
paid) in PostHog/admin, pick ONE experiment, ONE retention fix, ONE
distribution push. Kill/scale rule: <$500 revenue after 30 days of real
distribution → pivot; ≥$500 → double down.
