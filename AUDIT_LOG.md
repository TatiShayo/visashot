# AUDIT_LOG — VisaShot

Audit + hardening sweep per `.agents/upgrade.txt` (Phases 2–3, 7) and
PLAYBOOK.md Part 2. Sections appended per phase, never overwritten.
Companion docs: `ARCHITECTURE.md` (system map), `REVIEW_FINDINGS.md`
(per-finding severity detail — H1/H2/M1–M5/L1–L5 with status).

## Phase 2 — Deep audit: architecture, security, performance, reliability

### Found → Fixed

- **H2 (business-integrity, the critical verify): paid add-on specs were
  charged but never fulfilled.** `/api/checkout` validated + billed
  `addonSpecIds` (+$2.99 each) but `lib/fulfillment.ts` generated
  deliverables only for `order.specId`; the download route and delivery
  email exposed only primary-spec files. Fixed end-to-end:
  - Face landmarks persisted on the order at `/api/process` time
    (`orders.landmarks` jsonb, `supabase/schema.sql` updated) so
    fulfillment can re-crop the stored ORIGINAL for any geometry.
  - `fulfillOrder` iterates `orderSpecIds()` (primary + de-duped add-ons)
    and produces processed/hi-res/4x6/A4 deliverables per spec.
  - `/api/download` takes a `spec` query param validated server-side
    against the order's own entitlement set (unpurchased spec → 404); no
    token-format change needed — token already binds order+kind+expiry and
    all specs on one order share one payment.
  - Order page + delivery email list per-spec link groups.
  - Regression-tested in `tests/fulfillment.test.ts` (7 tests: both specs'
    artifacts exist, per-spec email links, idempotency, add-on download
    200, unpurchased-spec 404, pre-payment 402).
- **H1: mock Stripe webhook could mark any order paid on a real deploy**
  without `STRIPE_SECRET_KEY`. Fixed: webhook 403s when the payment
  provider is mocked on a real prod deployment (`env.isRealProdDeployment`
  guard, same as `/api/mock-pay`).
- **M1: admin/cron bearer compare wasn't timing-safe.** Fixed:
  `timingSafeEqual` over SHA-256 digests in `lib/admin-auth.ts` (and cron
  auth), length-independent.
- **M2: sharp decode ran at default ~268MP `limitInputPixels`.** Fixed:
  `MAX_INPUT_PIXELS = 60_000_000` enforced on every ingest decode
  (`lib/image-ingest.ts`), with the friendly metadata guard kept in front
  and a caught decoder-cap error for bombs that lie in metadata.
- **M5: `docExpiryIso` persisted arbitrary strings.** Fixed: zod
  `YYYY-MM-DD` regex + real-date refine in `/api/checkout`.

### Verified-good (attack chains attempted, no fix needed)

- **"Clean photo without paying" chain — proven closed on every path.**
  `/api/process` response = watermarked base64 + report only
  (`tests/security.test.ts` asserts against the real route handler and
  confirms the clean asset does exist server-side, so the test isn't
  vacuous; `e2e/no-clean-asset-leak.spec.ts` asserts the network log).
  There is no re-process route; add-on assets are generated only inside
  post-payment fulfillment; print-sheet PDFs and the delivery email exist
  only post-payment; admin routes never return asset bytes. The one chain
  that DID yield a free clean asset — mock webhook on a keyless prod
  deploy (H1) — is fixed above.
- **Download tokens**: HMAC-SHA256 bound to orderId+kind+expiry,
  timing-safe verify, 7-day TTL, and the route re-checks order existence +
  paid/delivered status server-side on EVERY hit; signing-secret
  misconfiguration fails closed (403, not 500).
- **/api/process ordering**: rate limit (10/5min/IP) → Turnstile
  server-verify (before any Replicate spend; mocked only when no key) →
  zod → 15MB cap → magic-byte sniff → sharp re-encode (EXIF/GPS strip,
  regression-tested) → 60MP bomb guard.
- **Stripe path**: signature via `constructEvent`; amounts computed
  server-side only (`lib/pricing.ts`); webhook idempotent via
  pending→paid transition + fulfillment delivered-check (M3: event-id
  table deferred, see below).
- **Purge cron**: `CRON_SECRET` bearer, fails closed in prod when unset,
  deletes actual storage objects on both providers
  (`tests/storage-purge.test.ts` backdates mtimes to prove it).
- **Admin**: every `/api/admin/*` route behind the timing-safe bearer;
  refunds audit-logged.

### Performance / reliability added

- `lib/semaphore.ts` + wiring in `/api/process`: bounded concurrency for
  the pipeline (paid Replicate call + several full-image sharp passes);
  over-capacity requests shed with 503 + `Retry-After` instead of OOMing
  (`tests/semaphore.test.ts`, 84 lines).
- Replicate provider: 60s call / 30s fetch `AbortSignal.timeout`s,
  single retry on transient-only failures (429/5xx/timeout/network),
  25MB result cap, SSRF guard on the result URL; pipeline failures return
  a generic 4xx/5xx to the client and full detail to monitoring.
- OG images: `Cache-Control: public, max-age=3600, s-maxage=86400,
  stale-while-revalidate=604800` — CDN-cached instead of re-rendered per
  crawler hit. Spec pages themselves static (`generateStaticParams` over
  all 49 specs; 72 static pages in the build).
- Error boundaries: `app/error.tsx` + `app/global-error.tsx` +
  `app/not-found.tsx`; monitoring wrappers (`lib/monitoring.ts`) wired
  into pipeline, fulfillment, webhook, and download failure paths.
- Brightness/contrast stats failure never blocks purchase (caught with
  neutral fallback).

### Deliberately deferred (with reasoning)

- **M3** Stripe event-id idempotency table: current transition-guard
  idempotency covers Stripe retry semantics on a single instance; add an
  `events` table when Supabase is live. Worst case is a duplicated
  delivery email, never a double charge or leak.
- **M4** Order-row (email) retention: needed by the expiry-reminder loop,
  disclosed in the privacy policy; revisit before a GDPR-serious launch.
- **L2** In-memory rate limiter is per-instance; swap to Upstash at scale.
- **L5** Admin audit log in-memory; persist to Postgres with Supabase.
- **Add-on cutout reuse**: fulfillment re-runs bg-removal per add-on spec
  (a paid Replicate call each). Correctness-first; caching the alpha
  cutout at process time is a future optimization bounded by the add-on
  count the customer actually paid for.
- **Turnstile/L3**: verification is skipped without `TURNSTILE_SECRET_KEY`
  per "never stall on missing keys"; rate limiting still applies. Set the
  key in prod (NEEDS HUMAN).

## Phase 3 — Adversarial review & reduction

- Re-walked every money/asset path as an attacker: forged download tokens
  (403), expired tokens (403), valid-signature-but-unpaid (402), unknown
  order (404, no oracle), unpurchased spec on a paid order (404), mock
  webhook on prod (403), admin without bearer (401, timing-safe when
  present), cron without `CRON_SECRET` (401/fails closed). All covered by
  unit or e2e tests.
- Reduction: no dead abstractions found worth removing this pass; the
  provider-interface + mock pattern is load-bearing (it is what makes the
  no-keys e2e gate possible). `env.isProd` vs `env.isRealProdDeployment`
  split retained deliberately — collapsing them re-opens the e2e/prod-build
  conflation bug fixed in Milestone 8.

## Phase 7 — Remediation & root-cause closure

- All HIGHs and actionable MEDIUMs fixed and regression-tested (H1, H2,
  M1, M2, M5). Accepted items (M3, M4, L1–L5) documented with reasoning in
  `REVIEW_FINDINGS.md` and NEEDS HUMAN.
- **Root cause of H2** (the one real business-integrity bug): fulfillment
  was written against the single-spec MVP and never revisited when add-ons
  were bolted onto checkout/pricing — a cross-module invariant ("every
  billed line item produces deliverables") that no single file owned.
  Closure: the invariant now has a named owner (`orderSpecIds()` in
  `lib/fulfillment.ts`) and a dedicated regression suite
  (`tests/fulfillment.test.ts`) that exercises checkout-shaped orders
  end-to-end through the real process + download routes.
- Remaining recommendations (all NEEDS HUMAN, none code-blocked): deploy +
  register Stripe webhook, live Supabase (then RLS deny-test + events
  table + persisted audit log), Sentry dependency + DSN, Turnstile keys,
  re-verify the 31 `needsVerification` specs, real-device camera/MediaPipe
  pass, Lighthouse ≥85 once deployed.

## Gate (this session's full run — see PROJECT_STATE.md for detail)

`tsc --noEmit` · `eslint .` · `next build` (4GB heap) · `vitest run` ·
`playwright test` — results recorded in PROJECT_STATE.md after each full
run; the gate is never left broken between commits.
