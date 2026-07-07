# PROJECT_STATE — VisaShot — Passport & Visa Photo Compliance Tool (Web App)

> Single source of truth for build continuity. Update after every milestone.
> A fresh session with zero memory must be able to resume from this file alone.
> Trust the disk over this file if they ever disagree, then correct this file.

## Status: IN PROGRESS — Milestones 2-5 done, Milestone 6 (polish) partial, 7 (security tests) mostly done, 8 (QA/e2e) not started

## Verification gate (last full run 2026-07-07, this session)
- `tsc --noEmit`: PASS (0 errors)
- `eslint .`: PASS (0 problems)
- `vitest run`: PASS (70/70 across 9 test files)
- `next build`: PASS — compiles clean, 0 type errors, all 72 static pages
  generate successfully (50 spec pages + 50 OG images + static routes;
  confirmed via `.next/BUILD_ID` written + exit code 0 on four consecutive
  full clean builds this session)

## Done

### Foundation (prior session)
- Next.js 15 App Router + TS + Tailwind v4, ESLint flat config, vitest.
- Design tokens (`app/globals.css`): "Swiss precision" — ink navy, single
  blue accent, semantic checklist colors, mono for measurements,
  reduced-motion guard.
- Spec database (`data/photo-specs.ts`): 50 specs, each with `sourceUrl`; 32
  flagged `needsVerification: true`; 3 infant specs. Helpers: `getSpec`,
  `getSpecOrThrow`, `listSpecs`, `relatedSpecs`, `upsellSpecs`,
  `formatDimensions`, `formatPixels`.
- Crop math (`lib/crop.ts`), sheet layout (`lib/sheet-layout.ts`), download
  signing (`lib/sign.ts`), env (`lib/env.ts`) — all unit tested.
- Security headers already in `next.config.ts` (CSP, HSTS, X-Frame-Options,
  Permissions-Policy) with correct allowances pre-anticipating MediaPipe/
  PostHog/Stripe/Turnstile origins.

### Milestone 2 — Pipeline (done)
- `lib/image-ingest.ts`: magic-byte sniff, 15MB cap, sharp re-encode (strips
  EXIF/GPS), decompression-bomb guard.
- `lib/providers/bg-removal.ts`: Replicate (851-labs/background-remover)
  typed provider + mock (returns original, `mocked: true`); SSRF guard on
  the provider's returned URL.
- `lib/pipeline.ts`: bg-removal → compose onto spec bgColor → crop
  (`lib/crop.ts`) → resize to exact spec px/dpi. Unit tested incl. overflow/
  padding case.
- `lib/face-detect.ts` (client): MediaPipe FaceLandmarker wrapper — 468-pt
  mesh landmarks + blendshapes (eye-blink, smile) → normalized points + tilt
  + live-feedback hint.
- `app/create/page.tsx` + `CreateClient.tsx`: consent gate → upload/capture
  (file or camera) → live alignment ring feedback → submit to
  `/api/process` → staged "processing" copy → result with draggable
  before/after slider (`components/BeforeAfterSlider.tsx`).
- `app/api/process/route.ts`: rate-limited, Turnstile-verified (mocked
  without a key), zod-validated, ingests, runs pipeline, computes REAL
  brightness/contrast stats server-side (sharp, eye-line-centered region),
  runs compliance, watermarks, stores clean asset + order, returns ONLY the
  watermarked preview + report (never clean bytes — regression-tested).

### Milestone 3 — Compliance (done)
- `lib/compliance.ts`: pure checklist engine — single-face, head-height,
  eye-line, tilt, eyes-open, neutral-expression, glasses heuristic,
  brightness, contrast, clothing-vs-background contrast, background-mocked
  flag. Baby-mode downgrades (eyes-open/expression → WARN) per infant
  exemptions. Unit tested (13 tests).
- `components/ComplianceChecklist.tsx`: the signature "compliance sequence"
  interaction — blueprint guide-lines draw in with mono measurements, ticks
  land sequentially, embossed COMPLIANT seal stamps on all-green;
  `motion-reduce` guarded.
- `lib/torso-sample.ts` (client): dominant clothing-color sampler feeding
  the clothing-contrast check.

### Milestone 4 — Payments (done)
- `lib/pricing.ts`: server-side-only price computation (base $4.99, +$2.99
  per add-on spec, +$1.99 Compliance+ bump). Client sends intent, never $.
- `lib/watermark.ts`: server-side tiled diagonal watermark SVG composite.
- `lib/providers/payments.ts`: Stripe Checkout (one-time, automatic tax) +
  mock provider (`/mock-pay` page mirrors the real redirect contract);
  `refund()` on both (real: Stripe refund API; mock: instant ok).
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
  `RECOVERY_EMAILS_ENABLED`, single send at +4h, links to `/checkout/[id]`).
- Renewal-reminder loop (`app/api/cron/expiry-reminders`, 6mo + 1mo stages,
  each fires at most once per order — BUILD_PROMPT #16 / PLAYBOOK 3.4).
- `/admin` page + `/api/admin/orders` + `/api/admin/refund` — allowlist-
  gated via `ADMIN_TOKEN` bearer (fails closed if unset), revenue/orders/
  conversion overview, one-click refund with audit log (`lib/admin-auth.ts`).

### Milestone 5 — SEO (done)
- `app/photo/[specId]/page.tsx`: programmatic landing page per spec —
  requirements table, FAQ w/ schema.org FAQPage JSON-LD, related-specs
  links, exemption notes, sourceUrl citation. `generateStaticParams` over
  all 50 specs. `opengraph-image.tsx` per spec via `next/og`.
- `app/photo/page.tsx`: all-formats index grouped by country.
- `app/vs/pharmacy-passport-photos/page.tsx`: comparison page w/ FAQ schema.
- `app/sitemap.ts` + `app/robots.ts` (Next file conventions).
- `app/privacy`, `app/terms`, `app/refunds`: legal pages (subprocessors,
  7-day retention, refund guarantee documented).

### Analytics
- `lib/analytics.ts`: PostHog client wrapper matching every event in
  `analytics.md` exactly (typed event union); no-op console fallback
  without a key. Wired into create/checkout/order-success flows.

### Security (Milestone 7, mostly done)
- `tests/security.test.ts`: regression test calling the REAL `/api/process`
  route handler and asserting the JSON response never contains the clean
  asset — only the watermarked base64 preview + report. Also confirms the
  clean asset exists server-side (so the test isn't vacuous) and that the
  order remains `pending` (unpaid) after processing.
- `tests/storage-purge.test.ts`: regression test for the 7-day retention
  purge — backdates a file's mtime past `RETENTION_MS` and confirms
  `listExpired`/`remove` work, without a real 7-day wait.
- `tests/rate-limit.test.ts`: unit tests (bucket isolation, window reset,
  `clientIp` header parsing) + an integration test against the real
  `/api/process` route confirming the 11th request in a window gets 429.
- `lib/providers/turnstile.ts` + `components/TurnstileWidget.tsx`: invisible
  Turnstile wired into `/api/process`, mocked (always passes) without
  `TURNSTILE_SECRET_KEY`.
- EXIF-strip already covered by `tests/pipeline.test.ts` (prior session).
- **Still open**: no automated Supabase RLS deny-test (no live Supabase
  project to test against in this environment); Sentry not yet integrated
  (see NEEDS HUMAN).

### Ops scaffolding (new this session)
- `supabase/schema.sql`: RLS default-deny `orders` + `specs_mirror` tables,
  indexes, storage bucket note.
- `vercel.json`: 3 cron schedules — purge (daily 3am), recovery (hourly),
  expiry-reminders (daily 8am).

## Next (in priority order)

1. **Milestone 6 — Polish, finish the pass**: the compliance-sequence
   signature interaction and before/after slider both exist and are wired,
   but there hasn't been a dedicated screenshot-test pass (PLAYBOOK 1.1)
   across every screen on a real viewport, nor a confirmed 60fps check on
   the seal-stamp animation on a real device. Empty/error states are
   present but not exhaustively reviewed screen-by-screen.
2. **Milestone 8 — QA**: no Playwright e2e yet. Unit/integration tests cover
   crop math, sheet layout, compliance, sign, specs, pipeline, security,
   storage purge, and rate-limit (70/70 passing) but there is zero
   browser-level coverage of the create → checklist → checkout → download
   UI flow. This is the single biggest remaining gap before a real launch
   dry-run.
3. **Sentry**: genuinely not integrated — `@sentry/nextjs` isn't even
   installed. Needs a human decision to add the dependency + DSN; wiring
   itself (wrap API routes, capture pipeline/payment failures) is
   straightforward once that's approved.
4. Re-verify the 32 `needsVerification: true` specs against their
   `sourceUrl`s before any real launch.

## NEEDS HUMAN
- **Provider keys** (build runs on typed mocks until set — see `.env.example`):
  - `REPLICATE_API_TOKEN` — bg removal (mock returns original + `mocked: true`).
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — payments (mock checkout active).
  - `RESEND_API_KEY` — delivery + recovery + expiry emails (mock logs to console).
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY` — storage + orders (in-memory/local-fs mock
    until set). Run `supabase/schema.sql` once a project exists.
  - `NEXT_PUBLIC_POSTHOG_KEY` — analytics (wrapper no-ops cleanly without it).
  - `SENTRY_DSN` — error monitoring. NOT YET INTEGRATED AT ALL (see above);
    needs `npm install @sentry/nextjs` (a new dependency — flagging for
    approval per the "justify any new dependency" discipline) plus
    instrumentation in API routes and a top-level error boundary.
  - `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — now wired
    into `/api/process` + the create-page widget; mocked (always passes)
    until keys are set.
  - `DOWNLOAD_SIGNING_SECRET`, `CRON_SECRET`, `ADMIN_TOKEN`, `ADMIN_EMAILS`.
- **Admin auth upgrade**: `/admin` currently gates on a single shared
  `ADMIN_TOKEN` bearer typed into the page (PLAYBOOK-acceptable interim per
  "allowlist-gated" but not real per-admin auth). `ADMIN_EMAILS` env exists
  but isn't yet enforced as a real allowlist — needs a proper auth provider
  (e.g. Supabase Auth + email allowlist check) before this is production-grade.
- **Spec verification**: 32 specs flagged `needsVerification: true` — re-check
  dimensions/background/head geometry against each `sourceUrl` before launch.
- **Ops (no deploy performed)**: Vercel prod deploy, Stripe webhook
  registration (`vercel.json` cron schedules are defined and ready but only
  run once deployed), Supabase project creation + storage bucket + confirm
  7-day lifecycle rule alongside the purge cron, DNS/email domain
  verification for Resend, Stripe Tax + Radar enabled in dashboard, create
  the 20% `RECOVERY_PROMO_CODE` in Stripe.
- **Playwright e2e**: not installed/written — the single biggest remaining
  gap. Needs a human decision on installing `@playwright/test` (new
  dependency) before that work starts.
