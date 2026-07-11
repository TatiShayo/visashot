# PROJECT_STATE — VisaShot — Passport & Visa Photo Compliance Tool (Web App)

> Single source of truth for build continuity. Update after every milestone.
> A fresh session with zero memory must be able to resume from this file alone.
> Trust the disk over this file if they ever disagree, then correct this file.

## Status: IN PROGRESS — Milestones 2-5 done, Milestone 6 (polish) partial, 7 (security) done, 8 (QA/e2e) DONE — first full green gate this session

## Verification gate (last full run 2026-07-11, this session)
- `tsc --noEmit`: PASS (0 errors)
- `eslint .`: PASS (0 problems)
- `next build` (NODE_OPTIONS=--max-old-space-size=4096): PASS — 72 static
  pages, 0 type errors
- `vitest run`: PASS (74/74 across 10 test files)
- `npx playwright test`: PASS (4/4 — first-ever green e2e run this session;
  see "Milestone 8" below for the two real bugs this run found and fixed)

## Milestone 8 — QA/e2e: DONE this session

`e2e/full-flow.spec.ts` (Schengen visa: upload fixture -> mock bg-removal ->
compliance checklist -> mock-pay -> order page shows all 4 downloads, plus
an empty-state and a 404 check) and `e2e/no-clean-asset-leak.spec.ts` (the
BUILD_PROMPT "verify in network tab as a test" requirement) existed but had
never had a completed green run. Getting there surfaced two real bugs, both
fixed and committed (`622cd28`):

1. **`e2e/helpers.ts` waited on the wrong signal.** It waited for the
   embossed "Compliant" seal text, but `components/ComplianceChecklist.tsx`
   only stamps that seal when `overall === "pass"`. The e2e webServer
   intentionally runs bg-removal mocked (no `REPLICATE_API_TOKEN`), so
   `lib/compliance.ts` always flags `backgroundMocked` as a WARN ("preview
   mode") check, making `overall` always `"warn"` in this environment — the
   seal could never appear by construction, independent of whether
   processing actually succeeded. Fixed to wait on the "Continue — $" CTA
   instead (the real `purchasable` signal, and what the flow clicks next).
2. **Real bug: `env.isProd` conflated "NODE_ENV=production" with "real
   deployment."** The e2e webServer deliberately runs a *production build*
   (`next build && next start`) rather than `next dev`, because
   `next.config.ts`'s CSP omits `unsafe-eval` and `next dev`'s eval-based
   devtool breaks under that CSP (documented in `playwright.config.ts`).
   But `next start` also sets `NODE_ENV=production`, which two prod-only
   safety guards read as "this is the live site":
   - `/api/mock-pay` refused outright (`403 Mock payments are disabled`),
     which is exactly why `goToCheckoutAndPay` timed out waiting for the
     `/order/` redirect — the pay button silently failed client-side.
   - `requireSigningSecret()` (`lib/env.ts`) threw when
     `DOWNLOAD_SIGNING_SECRET` wasn't set. `lib/fulfillment.ts` calls it via
     `downloadUrl()`, so `fulfillOrder()` threw mid-fulfillment (surfaced as
     a 500 from `/api/mock-pay`); the download route also let a throw from
     `verifyDownloadToken()` bubble up uncaught, turning a bad-signature
     request into an unhandled `500` instead of the intended `403`.

   Fix: added `env.isRealProdDeployment` (`VERCEL_ENV === "production"` —
   Vercel injects this only on actual deployments, never for a local
   prod-mode build) and moved both guards onto it, leaving `env.isProd`
   unchanged for everything else that legitimately means "this build was
   compiled with NODE_ENV=production." Also wrapped `verifyDownloadToken()`
   in the download route in a try/catch so any future signing-secret
   misconfiguration fails closed (`403`) instead of leaking a `500`.

Coverage: full happy path (spec pick -> upload -> fake-face detect -> real
pipeline/compliance/watermark -> mock Stripe checkout -> mock-pay -> order
page with all 4 signed download links) + the pre-payment clean-asset-leak
regression (response shape allowlist, no leaked asset URLs in network log,
bad-signature 403, valid-signature-but-unpaid 402) + empty-state + 404.
**Not covered by e2e** (still unit/manual only): multi-spec add-ons at
checkout, Compliance+ bump, abandoned-order recovery email, expiry-reminder
cron, admin refund flow, baby-mode UI, camera capture (only file upload is
exercised). Real MediaPipe detection is never exercised in CI (by design —
`NEXT_PUBLIC_E2E_FAKE_FACE` bypasses it; see `lib/face-detect.ts`).

## Done

### Foundation (prior session)
- Next.js 15 App Router + TS + Tailwind v4, ESLint flat config, vitest.
- Design tokens (`app/globals.css`): "Swiss precision" — ink navy, single
  blue accent, semantic checklist colors, mono for measurements,
  reduced-motion guard.
- Spec database (`data/photo-specs.ts`): 49 specs, each with `sourceUrl`; 31
  flagged `needsVerification: true` (see NEEDS HUMAN for the full list); 3
  infant specs. Helpers: `getSpec`,
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
  all 49 specs. `opengraph-image.tsx` per spec via `next/og`.
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
  project to test against in this environment); Sentry package itself not
  installed (see "Monitoring" below and NEEDS HUMAN).

### Monitoring (wiring done; package/DSN still NEEDS HUMAN)
- `lib/monitoring.ts` (server) + `lib/monitoring-client.ts` (browser): typed
  `reportError`/`reportClientError` wrappers, console-only no-op until
  `@sentry/nextjs` is installed AND `SENTRY_DSN` is set — forwards to
  `window.Sentry` / the server SDK automatically once both are present, so
  no call-site changes will be needed later.
- Wired into every failure path that matters for the business (pipeline
  failures in `/api/process`, fulfillment failures in `/api/mock-pay` and
  the Stripe webhook, download-route errors) plus a top-level error
  boundary. `tests/monitoring.test.ts` (4 tests) covers the mock forwarding
  contract.
- `@sentry/nextjs` is deliberately NOT installed — new dependency, needs
  human sign-off (see NEEDS HUMAN) before the actual DSN wiring goes live.

### Ops scaffolding
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
2. **Sentry**: wiring is done (`lib/monitoring.ts` / `lib/monitoring-client.ts`
   already call into every real failure path); `@sentry/nextjs` itself isn't
   installed. Needs a human decision to add the dependency + DSN — see NEEDS
   HUMAN.
3. Re-verify the 31 `needsVerification: true` specs against their
   `sourceUrl`s before any real launch — full list below.
4. Broaden e2e coverage: Milestone 8's happy-path + security specs are green
   (see above), but multi-spec add-ons, the Compliance+ bump, recovery/
   expiry cron emails, admin refund, baby mode, and camera capture are still
   unit/manual-only — see "Not covered by e2e" above for the full list.

## Definition-of-Done status (BUILD_PROMPT.md "## Definition of done")

| DoD item | Status | Notes |
|---|---|---|
| Deployed; full journey works with a real selfie on mobile: pick "Schengen visa" → capture → auto-processed → checklist all green → pay (test mode) → receive email → download photo + print sheet with correct physical dimensions when printed | **PARTIAL** | The full journey works end-to-end and is now regression-tested (`e2e/full-flow.spec.ts`, green) — upload → real pipeline/compliance/watermark → mock-pay → order page with all 4 signed downloads, delivery email logged via the mock Resend provider. NOT done: (a) no deploy has ever been performed (no Vercel project, no live URL — see NEEDS HUMAN "Ops"), so "works on mobile" against a real deployment is unverified; (b) the e2e run uses `NEXT_PUBLIC_E2E_FAKE_FACE` to bypass real MediaPipe detection and file-upload instead of camera capture — a real selfie / camera-capture path has never been exercised end-to-end, only unit-level (`lib/face-detect.ts` real-detector branch is untested by any automated test); (c) "correct physical dimensions when printed" for the PDF sheets is asserted mathematically (`tests/sheet-layout.test.ts`) but never verified against an actual printed page. |
| 40 SEO pages live and in sitemap; Lighthouse mobile ≥85 | **PARTIAL** | 49 spec pages exist (`data/photo-specs.ts`), exceeding the 40 minimum, all included in `app/sitemap.ts` and statically generated (confirmed via `next build`'s 72-page static output). Lighthouse mobile score has never been measured — no deployment to run it against, and it wasn't run locally this session (out of this session's scope; needs either a deploy or a local Lighthouse-CI run against the prod build). |
| Crop-math unit tests green incl. edge cases (very tall/wide photos, off-center faces) | **DONE** | `tests/crop.test.ts` — 16 tests, green, includes overflow/off-center/aspect-ratio-extreme cases per `lib/pipeline.test.ts`'s overflow case too. |

### Milestone-level status (this file's own tracking, finer-grained than the 3 DoD bullets above)
| Milestone | Status |
|---|---|
| 1. Foundation (scaffold, design tokens, spec DB, crop/sheet/sign math) | DONE |
| 2. Pipeline (ingest, bg-removal, crop/resize, face-detect UI) | DONE |
| 3. Compliance (checklist engine + signature UI interaction) | DONE |
| 4. Payments (pricing, watermark, Stripe/mock, fulfillment, admin refund, recovery/expiry crons) | DONE |
| 5. SEO (spec pages, index, comparison page, sitemap/robots, legal pages) | DONE |
| 6. Polish | PARTIAL — no dedicated screenshot-test pass across every screen/viewport, no confirmed 60fps device check on the seal-stamp animation |
| 7. Security | DONE — clean-asset-leak, purge, rate-limit, Turnstile all tested; RLS deny-test still needs a live Supabase project (see NEEDS HUMAN) |
| 8. QA/e2e | DONE this session — see "Milestone 8" above |
| 9. Deploy | NOT STARTED — no Vercel deploy has ever been performed |

## NEEDS HUMAN
- **Provider keys** (build runs on typed mocks until set — see `.env.example`):
  - `REPLICATE_API_TOKEN` — bg removal (mock returns original + `mocked: true`).
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — payments (mock checkout active).
  - `RESEND_API_KEY` — delivery + recovery + expiry emails (mock logs to console).
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY` — storage + orders (in-memory/local-fs mock
    until set). Run `supabase/schema.sql` once a project exists.
  - `NEXT_PUBLIC_POSTHOG_KEY` — analytics (wrapper no-ops cleanly without it).
  - `SENTRY_DSN` — error monitoring. Wiring is done (see "Monitoring" above);
    needs `npm install @sentry/nextjs` (a new dependency — flagging for
    approval per the "justify any new dependency" discipline) plus the
    generated `sentry.*.config.ts`/`instrumentation.ts` files. Also add
    `NEXT_PUBLIC_SENTRY_DSN` for the browser SDK when enabling.
  - `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — wired into
    `/api/process` + the create-page widget; mocked (always passes) until
    keys are set.
  - `DOWNLOAD_SIGNING_SECRET`, `CRON_SECRET`, `ADMIN_TOKEN`, `ADMIN_EMAILS`.
- **Admin auth upgrade**: `/admin` currently gates on a single shared
  `ADMIN_TOKEN` bearer typed into the page (PLAYBOOK-acceptable interim per
  "allowlist-gated" but not real per-admin auth). `ADMIN_EMAILS` env exists
  but isn't yet enforced as a real allowlist — needs a proper auth provider
  (e.g. Supabase Auth + email allowlist check) before this is production-grade.
- **Supabase RLS deny-test**: `supabase/schema.sql` defines default-deny RLS,
  but there is no automated test proving it — needs a live Supabase project
  to test against (not available in this environment).
- **Spec verification — 31 specs flagged `needsVerification: true`**, each
  needs its dimensions/background/head-eye geometry re-checked against its
  `sourceUrl` in `data/photo-specs.ts` before launch (ICAO-derived defaults
  were used where a government source didn't publish exact head/eye numbers):
  - `tsa-precheck` — TSA PreCheck Photo
  - `us-cdl-state-id` — US State ID / CDL Photo (generic)
  - `schengen-visa-baby` — Schengen Visa Photo — Baby / Infant
  - `canada-passport` — Canada Passport Photo
  - `india-passport` — India Passport Photo
  - `india-oci` — India OCI Card Photo
  - `india-visa` — India Visa / e-Visa Photo
  - `japan-visa` — Japan Visa Photo
  - `brazil-passport` — Brazil Passport Photo
  - `brazil-visa` — Brazil Visa / e-Visa Photo
  - `nigeria-passport` — Nigeria Passport Photo
  - `kenya-passport` — Kenya Passport Photo
  - `south-africa-passport` — South Africa Passport Photo
  - `uae-visa` — UAE Visa / Residence Photo
  - `saudi-visa` — Saudi Arabia Visa Photo
  - `saudi-iqama` — Saudi Iqama (Residence) Photo
  - `philippines-passport` — Philippines Passport Photo
  - `mexico-passport` — Mexico Passport Photo
  - `germany-passport` — Germany Passport Photo (Biometric)
  - `spain-passport` — Spain Passport / DNI Photo
  - `netherlands-passport` — Netherlands Passport Photo
  - `singapore-passport` — Singapore Passport Photo
  - `malaysia-passport` — Malaysia Passport Photo
  - `pakistan-passport` — Pakistan Passport / NICOP Photo
  - `bangladesh-passport` — Bangladesh e-Passport Photo
  - `indonesia-passport` — Indonesia Passport Photo
  - `vietnam-evisa` — Vietnam e-Visa Photo
  - `thailand-evisa` — Thailand Visa / e-Visa Photo
  - `turkey-passport` — Turkey Passport Photo (Biometric)
  - `russia-visa` — Russia Visa Photo
  - `ghana-passport` — Ghana Passport Photo

  (18 remaining specs — including `us-passport`, `us-visa`,
  `schengen-visa`, `uk-passport`, `australia-passport`, and others with an
  explicit government-published head/eye diagram — are NOT flagged and cite
  a `sourceUrl` with exact figures already.)
- **Ops safety note**: the mock-pay kill guard checks `STRIPE_SECRET_KEY`
  presence OR `VERCEL_ENV==="production"`. If you ever deploy anywhere other
  than Vercel, set `STRIPE_SECRET_KEY` (or remove `/api/mock-pay`) before
  going live — otherwise mock payments stay enabled.
- **Ops (no deploy performed)**: Vercel prod deploy, Stripe webhook
  registration (`vercel.json` cron schedules are defined and ready but only
  run once deployed), Supabase project creation + storage bucket + confirm
  7-day lifecycle rule alongside the purge cron, DNS/email domain
  verification for Resend, Stripe Tax + Radar enabled in dashboard, create
  the 20% `RECOVERY_PROMO_CODE` in Stripe, run a real Lighthouse-mobile
  audit once deployed (DoD requires ≥85, never measured).
- **Real selfie / camera-capture path**: never exercised end-to-end (e2e
  uses file upload + fake face detection by design — see "Milestone 8"
  above). Needs manual verification on a real mobile device with the real
  MediaPipe model before launch.
- **Screenshot-test pass (PLAYBOOK 1.1)**: every screen on a real viewport,
  plus a 60fps check on the seal-stamp animation on a real device — not yet
  done (Milestone 6 polish, still partial).
