# PROJECT_STATE — VisaShot — Passport & Visa Photo Compliance Tool (Web App)

> Single source of truth for build continuity. Update after every milestone.
> A fresh session with zero memory must be able to resume from this file alone.
> Trust the disk over this file if they ever disagree, then correct this file.

## Status: IN PROGRESS — scaffold verified green 2026-07-07

## Verification gate (last run 2026-07-07)
- `tsc --noEmit`: PASS
- `eslint .`: PASS (0 problems)
- `vitest run`: PASS (41/41)
- `next build`: in progress at time of writing — see README/commits for latest

## Done
- **Scaffold**: Next.js 15 App Router + TS + Tailwind v4, ESLint flat config, vitest.
- **Design tokens** (`app/globals.css`): "Swiss precision" — ink navy, single blue
  accent, semantic checklist colors, mono for measurements, reduced-motion guard.
- **Spec database** (`data/photo-specs.ts`): **50 specs** (exceeds 40+ requirement),
  covering US passport/visa/green-card-DV/baby, Schengen (+baby), UK (+baby),
  Canada, Australia, India passport+OCI, China, Japan, Brazil, Nigeria, Kenya,
  South Africa, UAE, Saudi, Philippines, Mexico, TSA PreCheck, US state ID, etc.
  Each has `sourceUrl`; 32 carry `needsVerification: true`; 3 infant specs.
  Helpers: `getSpec`, `getSpecOrThrow`, `listSpecs`, `relatedSpecs`, `upsellSpecs`,
  `formatDimensions`, `formatPixels`.
- **Crop math** (`lib/crop.ts`): pure `computeCropRect` + `landmarksFromNormalized`,
  head-height/eye-line mid-range targeting, overflow warnings. Unit tested incl.
  edge cases (tall/wide/off-center/too-small/inverted). FIXED 2026-07-07: sub-pixel
  centering drift.
- **Sheet layout** (`lib/sheet-layout.ts`): 4x6 / A4 tiling math, unit tested.
- **Download signing** (`lib/sign.ts`): HMAC expiring tokens (node:crypto), unit tested.
- **Env** (`lib/env.ts`): typed central access, `missingKeys()`, `mockPaymentsActive()`,
  `requireSigningSecret()` (prod-required, dev fallback).
- **Homepage** (`app/page.tsx`), root layout, README, analytics.md, .env.example.

## Next (milestone order from BUILD_PROMPT.md)
2. Pipeline — upload/capture + client MediaPipe face detect → server route →
   Replicate bg-removal (mock returns original+flag) → sharp compose+crop → output.
3. Compliance checker + checklist UI + contrast + auto-enhance + baby mode + fixtures.
4. Payments — consent gate → server-side watermark preview (clean asset NEVER
   pre-payment; test asserts this) → Stripe (mock) + add-ons → webhook → delivery.
5. SEO — /photo/[specId], /vs comparison, sitemap, OG images, homepage polish.
6. Polish — compliance-sequence signature interaction.
7. Security tests — no clean asset pre-payment, purge-cron, EXIF-strip, rate-limit.
8. QA — Playwright e2e + crop edge cases.

## NEEDS HUMAN
- **Provider keys** (build runs on typed mocks until set — see `.env.example`):
  - `REPLICATE_API_TOKEN` — bg removal (mock returns original + `mocked: true`).
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — payments (mock checkout active).
  - `RESEND_API_KEY` — delivery + recovery + expiry emails (mock logs to console).
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY` — storage + orders (in-memory/temp mock until set).
  - `NEXT_PUBLIC_POSTHOG_KEY`, `SENTRY_DSN` — analytics + error monitoring.
  - `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — bot protection.
  - `DOWNLOAD_SIGNING_SECRET`, `CRON_SECRET`, `ADMIN_TOKEN`, `ADMIN_EMAILS`.
- **Spec verification**: 32 specs flagged `needsVerification: true` — re-check
  dimensions/background/head geometry against each `sourceUrl` before launch.
- **Ops (no deploy performed)**: Vercel prod deploy, Stripe webhook registration,
  Supabase storage bucket + 7-day lifecycle rule, cron schedule wiring, DNS/email
  domain verification for Resend. Documented in README.
