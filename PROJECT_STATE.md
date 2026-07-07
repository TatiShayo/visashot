# PROJECT_STATE — VisaShot — Passport & Visa Photo Compliance Tool (Web App)

> Single source of truth for build continuity. Update after every milestone.
> A fresh session with zero memory must be able to resume from this file alone.
> Trust the disk over this file if they ever disagree, then correct this file.

## Status: IN PROGRESS — Milestones 2-5 backend+UI built, verification gate re-running 2026-07-07

## Verification gate (last confirmed run 2026-07-07)
- `tsc --noEmit`: PASS (as of last full run before this session's newest edits — re-verify orders.ts change)
- `eslint .`: PASS (0 problems)
- `vitest run`: PASS (62/62)
- `next build`: PASS (confirmed compiling + type-checking clean before this session's newest edits)
- NOTE: a fresh full `npm run verify` should be run at the start of the next session before continuing, since orders.ts (expiry-reminder fields) and several new UI files landed after the last clean build.

## Done
- **Scaffold**: Next.js 15 App Router + TS + Tailwind v4, ESLint flat config, vitest.
- **Design tokens** (`app/globals.css`): "Swiss precision" — ink navy, single blue
  accent, semantic checklist colors, mono for measurements, reduced-motion guard.
- **Spec database** (`data/photo-specs.ts`): 50 specs, each with `sourceUrl`;
  32 flagged `needsVerification: true`; 3 infant specs. Helpers: `getSpec`,
  `getSpecOrThrow`, `listSpecs`, `relatedSpecs`, `upsellSpecs`,
  `formatDimensions`, `formatPixels`.
- **Crop math** (`lib/crop.ts`), **sheet layout** (`lib/sheet-layout.ts`),
  **download signing** (`lib/sign.ts`), **env** (`lib/env.ts`) — all unit tested.
- **Milestone 2 — Pipeline (done)**:
  - `lib/image-ingest.ts`: magic-byte sniff, 15MB cap, sharp re-encode (strips
    EXIF/GPS), decompression-bomb guard.
  - `lib/providers/bg-removal.ts`: Replicate (851-labs/background-remover)
    typed provider + mock (returns original, `mocked: true`); SSRF guard on
    the provider's returned URL.
  - `lib/pipeline.ts`: bg-removal → compose onto spec bgColor → crop (lib/crop.ts)
    → resize to exact spec px/dpi. Unit tested incl. overflow/padding case.
  - `lib/face-detect.ts` (client): MediaPipe FaceLandmarker wrapper — 468-pt
    mesh landmarks + blendshapes (eye-blink, smile) → normalized points +
    tilt + live-feedback hint.
  - `app/create/page.tsx` + `CreateClient.tsx`: consent gate → upload/capture
    (file or camera) → live alignment ring feedback → submit to
    `/api/process` → staged "processing" copy → result.
  - `app/api/process/route.ts`: rate-limited, zod-validated, ingests, runs
    pipeline, computes REAL brightness/contrast stats server-side (sharp,
    eye-line-centered region — fixed from an earlier hardcoded placeholder),
    runs compliance, watermarks, stores clean asset + order, returns ONLY the
    watermarked preview + report (never clean bytes).
- **Milestone 3 — Compliance (done)**:
  - `lib/compliance.ts`: pure checklist engine — single-face, head-height,
    eye-line, tilt, eyes-open, neutral-expression, glasses heuristic,
    brightness, contrast, clothing-vs-background contrast, background-mocked
    flag. Baby-mode downgrades (eyes-open/expression → WARN) per infant
    exemptions. Unit tested (13 tests, tests/compliance.test.ts).
  - `components/ComplianceChecklist.tsx`: the signature "compliance sequence"
    interaction — blueprint guide-lines draw in with mono measurements, ticks
    land sequentially, embossed COMPLIANT seal stamps on all-green;
    `motion-reduce` guarded.
  - `lib/torso-sample.ts` (client): dominant clothing-color sampler feeding
    the clothing-contrast check.
- **Milestone 4 — Payments (done)**:
  - `lib/pricing.ts`: server-side-only price computation (base $4.99, +$2.99
    per add-on spec, +$1.99 Compliance+ bump). Client sends intent, never $.
  - `lib/watermark.ts`: server-side tiled diagonal watermark SVG composite —
    the clean processed bytes are discarded by the caller before responding;
    a security test should assert no pre-payment response contains them
    (see NEEDS HUMAN / next-session TODO: write this explicit test if not
    already covered by tests/pipeline.test.ts).
  - `lib/providers/payments.ts`: Stripe Checkout (one-time, automatic tax) +
    mock provider (`/mock-pay` page mirrors the real redirect contract);
    added `refund()` to both (real: Stripe refund API; mock: instant ok).
  - `app/api/checkout`, `app/api/webhook/stripe` (idempotent, signature
    verified), `app/api/mock-pay` (dev-only, refuses if Stripe configured or
    prod), `app/api/download/[orderId]` (HMAC token + server-side paid-status
    re-check, every hit).
  - `lib/fulfillment.ts` + `lib/deliverables.ts`: on paid, generates hi-res
    PNG + 4x6/A4 print-sheet PDFs (`@react-pdf/renderer`, cut guides via
    `lib/sheet-layout.ts`), emails signed download links (Resend/mock),
    idempotent against webhook retries.
  - `app/checkout/[orderId]`: receipt-styled order summary (mono, ruled
    lines), multi-spec add-on checkboxes, Compliance+ order bump, email +
    optional doc-expiry date, consent checkbox, retention + refund-guarantee
    badges.
  - `app/order/[orderId]`: downloads list, `purchase_completed` /
    `download_completed` analytics, family/companion upsell prompt.
  - Abandoned-order recovery (`app/api/cron/recovery`, env-gated via
    `RECOVERY_EMAILS_ENABLED`, single send at +4h, links to `/checkout/[id]`
    — fixed from an earlier link to the not-yet-paid `/order/[id]`).
  - **NEW this session**: renewal-reminder loop (`app/api/cron/expiry-reminders`,
    6mo + 1mo stages, each fires at most once per order — closes BUILD_PROMPT
    #16 / PLAYBOOK 3.4 "the expiry loop is the long-term goldmine", which was
    previously unimplemented despite the checkout UI already collecting the date).
  - **NEW this session**: `/admin` page + `/api/admin/orders` + `/api/admin/refund`
    — allowlist-gated via `ADMIN_TOKEN` bearer (fails closed if unset), revenue/
    orders/conversion overview, one-click refund with audit log
    (`lib/admin-auth.ts`). This closes a cross-cutting requirement that had no
    UI yet.
- **Milestone 5 — SEO (done)**:
  - `app/photo/[specId]/page.tsx`: programmatic landing page per spec —
    requirements table, FAQ w/ schema.org FAQPage JSON-LD, related-specs
    links, exemption notes, sourceUrl citation. `generateStaticParams` over
    all 50 specs. `opengraph-image.tsx` per spec via `next/og`.
  - `app/photo/page.tsx`: all-formats index grouped by country.
  - `app/vs/pharmacy-passport-photos/page.tsx`: comparison page w/ FAQ schema.
  - `app/sitemap.ts` + `app/robots.ts` (Next file conventions).
  - `app/privacy`, `app/terms`, `app/refunds`: legal pages (subprocessors,
    7-day retention, refund guarantee documented).
- **Analytics**: `lib/analytics.ts` — PostHog client wrapper matching every
  event in `analytics.md` exactly (typed event union); no-op console fallback
  without a key. Wired into create/checkout/order-success flows.
- **Ops scaffolding added this session**: `supabase/schema.sql` (RLS
  default-deny orders + specs_mirror tables, indexes), `vercel.json` (3 cron
  schedules: purge daily 3am, recovery hourly, expiry-reminders daily 8am).

## Next (milestone order from BUILD_PROMPT.md)
- Re-run full `npm run verify` (tsc/lint/vitest/build) after this session's
  orders.ts + admin + expiry-reminder additions — was mid-run when context
  ended; last individually-confirmed states were all green.
- **Milestone 6 — Polish**: the compliance-sequence signature interaction
  exists but hasn't had a dedicated motion/screenshot pass (PLAYBOOK 1.1 "the
  screenshot test") across every screen; before/after bg-removal slider
  (BUILD_PROMPT "presented as a draggable before/after slider") is NOT yet
  built — currently just shows the final watermarked result, no slider.
  Loading states use staged copy already (good); verify 60fps on the seal
  animation on a real device.
- **Milestone 7 — Security tests**: no automated test yet asserting the
  clean asset never appears in a pre-payment response (network-tab-style
  test) — `/api/process` route code looks correct by inspection (only
  watermarked base64 + report returned) but this needs an explicit
  regression test per BUILD_PROMPT. Purge-cron has the route but no test.
  EXIF-strip has a unit test already (`tests/pipeline.test.ts`). Rate-limit
  has the mechanism (`lib/rate-limit.ts`) but no test script hitting it.
- **Milestone 8 — QA**: no Playwright e2e yet. Unit tests cover crop math,
  sheet layout, compliance, sign, specs, pipeline (62/62 passing) but not the
  UI layer (create/checkout/order pages have zero test coverage right now).
- Supabase RLS deny-test (PLAYBOOK 2.2 "write a test that verifies an
  anonymous client cannot read another user's rows") not yet written — no
  live Supabase project to test against in this environment anyway.

## NEEDS HUMAN
- **Provider keys** (build runs on typed mocks until set — see `.env.example`):
  - `REPLICATE_API_TOKEN` — bg removal (mock returns original + `mocked: true`).
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — payments (mock checkout active).
  - `RESEND_API_KEY` — delivery + recovery + expiry emails (mock logs to console).
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY` — storage + orders (in-memory/temp mock until
    set). Run `supabase/schema.sql` once a project exists.
  - `NEXT_PUBLIC_POSTHOG_KEY`, `SENTRY_DSN` — analytics + error monitoring
    (analytics wrapper exists and no-ops cleanly without a key; Sentry not
    yet wired into any route/component at all — NEEDS HUMAN + a follow-up
    session to add `@sentry/nextjs`).
  - `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — bot protection
    (env vars exist; NOT yet wired into `/api/process` or `/api/checkout` —
    those routes currently rely on rate-limiting alone. Follow-up task.).
  - `DOWNLOAD_SIGNING_SECRET`, `CRON_SECRET`, `ADMIN_TOKEN`, `ADMIN_EMAILS`.
- **Admin auth upgrade**: `/admin` currently gates on a single shared
  `ADMIN_TOKEN` bearer typed into the page (PLAYBOOK-acceptable interim per
  "allowlist-gated" but not real per-admin auth). `ADMIN_EMAILS` env exists
  but isn't yet enforced as a real allowlist — needs a proper auth provider
  (e.g. Supabase Auth + email allowlist check) before this is production-grade.
- **Spec verification**: 32 specs flagged `needsVerification: true` — re-check
  dimensions/background/head geometry against each `sourceUrl` before launch.
- **Ops (no deploy performed)**: Vercel prod deploy, Stripe webhook registration
  (`vercel.json` cron schedules are now defined and ready, but crons only run
  once deployed), Supabase project creation + storage bucket + confirm 7-day
  lifecycle rule alongside the purge cron, DNS/email domain verification for
  Resend, Stripe Tax + Radar enabled in dashboard, create the 20%
  `RECOVERY_PROMO_CODE` in Stripe.
- **Sentry**: not yet integrated (see above) — add `@sentry/nextjs`, wrap
  API routes, capture pipeline + payment failures per BUILD_PROMPT.
- **Turnstile**: not yet integrated into the upload/checkout forms — env
  plumbing exists (`lib/env.ts`) but no widget or server verification call
  written yet.
