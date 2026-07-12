# Security & Reliability Review — 2026-07-12

Scope: PLAYBOOK Part 2 audit of all API routes, providers, signing, storage,
payments, admin, and cron surfaces. Status column updated as fixes land.

## HIGH

### H1 — Mock webhook lets anyone mark any order paid on a real deployment
`app/api/webhook/stripe/route.ts` delegates to `getPaymentProvider().parseWebhook`.
The **mock** provider (active whenever `STRIPE_SECRET_KEY` is unset) performs no
signature check — it parses `{"orderId": ...}` straight from the body. `/api/mock-pay`
has a real-prod kill guard (`env.stripeSecretKey || env.isRealProdDeployment`), but
the webhook route has none, so a production deploy without Stripe configured would
let any unauthenticated caller flip any order to `paid` and trigger fulfillment
(free clean assets — defeats the watermark invariant).
**FIXED**: webhook route now returns 403 when the provider is mocked on a real
prod deployment (same guard as mock-pay).

### H2 — Paid add-on specs are charged but never fulfilled
`/api/checkout` accepts `addonSpecIds`, validates them, and charges +$2.99 each
(`lib/pricing.ts`), but `lib/fulfillment.ts` only generates deliverables for
`order.specId`; the download route (`KEY_FOR`) and order page only expose primary-spec
files, and the delivery email only links them. A customer buying 3 formats pays for 3
and receives 1. Business-integrity bug (refund magnet), found while auditing the
watermark invariant across the add-on path.
**FIXED**: face landmarks are now persisted on the order at process time
(`orders.landmarks`, jsonb; `supabase/schema.sql` updated); `fulfillOrder` re-runs the
pipeline from the stored original for each add-on spec and generates
processed/hires/print-sheet deliverables per spec; `/api/download` accepts a `spec`
query param validated server-side against the order's own spec set (primary +
add-ons — no signature change needed since the token already binds order+kind+expiry
and all specs on an order share one payment); order page and delivery email list
per-spec download links. Covered by `tests/fulfillment.test.ts`.

## MEDIUM

### M1 — Admin token compared with `===` (not timing-safe)
`lib/admin-auth.ts` compared the bearer against `ADMIN_TOKEN` with string equality.
**FIXED**: `timingSafeEqual` over SHA-256 digests (length-independent, constant-time).

### M2 — `sharp` decompression limit relied on library default
`lib/image-ingest.ts` has its own 60MP metadata guard, but the initial `sharp(input)`
decode ran with the default `limitInputPixels` (~268MP) — the metadata guard runs
before full decode, but defense-in-depth says the decoder itself should be capped.
**FIXED**: `limitInputPixels: 60_000_000` set on every ingest decode.

### M3 — Stripe webhook idempotency is status-based, not event-id-based
PLAYBOOK 2.5 says "persist event ids". The route is idempotent via the
`pending → paid` transition guard plus `fulfillOrder`'s own delivered-check, which
covers Stripe's retry semantics, but a concurrent double-delivery race could
double-send the delivery email (never double-charge, never leak). ACCEPTED for now
(single-instance memory store; Supabase path should add an `events` table before
launch — noted in PROJECT_STATE NEEDS HUMAN).

### M4 — Order rows (email PII) have no retention purge
The purge cron deletes storage objects after 7 days but order rows keep `email` and
`doc_expiry` indefinitely (needed for the expiry-reminder loop, which is the point of
the feature). ACCEPTED / documented: retention for order metadata is "until reminder
loop completes"; privacy policy already discloses. Revisit before GDPR-serious launch.

### M5 — `docExpiryIso` accepted as any string
`/api/checkout` stored an arbitrary ≤∞-length string; `Date.parse` guarded consumers
but garbage persisted to the DB.
**FIXED**: zod-validated as `YYYY-MM-DD` + parseable date.

## LOW / ACCEPTED

- **L1** Order page mints fresh signed links from the orderId alone and shows the
  buyer's email — a capability-URL design. Acceptable: ids are `nanoid(16)`
  (~95 bits, non-enumerable), links still re-check paid status server-side.
- **L2** In-memory rate limiter is per-instance (best-effort on serverless).
  Documented in `lib/rate-limit.ts`; swap to Upstash before scale.
- **L3** Turnstile is skipped entirely when `TURNSTILE_SECRET_KEY` is unset
  ("never stall on missing keys" doctrine). Rate limiting still applies. Set the
  key in prod (NEEDS HUMAN).
- **L4** SSRF guard on Replicate result URLs checks hostname patterns without DNS
  resolution — acceptable because the URL comes from Replicate's authenticated API,
  the guard is defense-in-depth only.
- **L5** Admin audit log is in-memory (documented in `lib/admin-auth.ts`); persist
  to Postgres when Supabase is live.

## Verified-good (no action)

- Watermark invariant: `/api/process` response contains only watermarked base64 +
  report (regression-tested in `tests/security.test.ts` and `e2e/no-clean-asset-leak.spec.ts`);
  clean bytes only reachable via `/api/download` behind HMAC token **and** a
  server-side paid-status re-check on every hit; there is no re-process route and
  the print-sheet/email paths only run post-payment.
- Download tokens: HMAC-SHA256, bound to orderId+kind+expiry, timing-safe compare,
  fail-closed on signing-secret misconfiguration (403, not 500).
- `/api/process` ordering: rate limit → Turnstile → zod → 15MB cap (client size
  checked before buffering) → magic-byte sniff → sharp re-encode (EXIF/GPS strip,
  covered by `tests/pipeline.test.ts`) → decompression-bomb guard.
- Stripe path: signature verified via `constructEvent`; amounts computed server-side
  only (`lib/pricing.ts`); client sends intent, never totals; add-on ids validated
  against the spec DB.
- Cron routes gated by `CRON_SECRET` bearer, fail closed in prod when unset; purge
  deletes actual storage objects (both providers) and is regression-tested.
- Order ids: `nanoid(16)`, non-sequential; unknown ids 404 with no existence oracle
  beyond the 404 itself.
