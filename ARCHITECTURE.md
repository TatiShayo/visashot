# ARCHITECTURE — VisaShot

Passport/visa photo compliance tool. Upload a selfie, get a government-spec-sized,
background-corrected, compliance-checked photo + print sheets, behind a one-time
payment. Next.js 15 (App Router) + TypeScript + Tailwind v4, deployed on Vercel,
backed by Supabase (Postgres + private Storage), Stripe, Replicate, Resend.

Every external service has a typed provider interface with a zero-config **mock**
so the entire flow runs locally with no keys. Provider selection is purely a
function of which env vars are present (`lib/env.ts`).

## Module map

```
data/photo-specs.ts     49 government photo specs (dims, dpi, bg color, head/eye
                        geometry ranges, sourceUrl). Source of truth for cropping.
lib/
  env.ts                Central env accessor. isProd vs isRealProdDeployment
                        (VERCEL_ENV) distinction — the guard that keeps mock-pay
                        and mock-webhook from ever being reachable on a real deploy.
  crop.ts               Pure crop math: landmarks + spec -> crop rect, achieved
                        head-height% / eye-line%. Unit tested incl. overflow cases.
  pipeline.ts           processPhoto(): bg-removal -> compose on spec bg -> crop
                        -> resize to exact spec px/dpi. Returns CLEAN bytes.
  image-ingest.ts       Upload ingest: 15MB cap, magic-byte sniff, sharp re-encode
                        (strips EXIF/GPS), 60MP decompression-bomb guard
                        (limitInputPixels).
  watermark.ts          Server-side tiled diagonal watermark for the pre-pay preview.
  compliance.ts         Pure checklist engine (single-face, head-height, eye-line,
                        tilt, eyes-open, expression, glasses, brightness, contrast,
                        clothing/bg contrast). Baby-mode downgrades.
  pricing.ts            Server-side-only price math: base $4.99, +$2.99/add-on spec,
                        +$1.99 Compliance+. Client never sends totals.
  sign.ts               HMAC-SHA256 download tokens bound to orderId+kind+expiry,
                        timing-safe verify, 7-day TTL. downloadUrl() builds links.
  orders.ts             Order store interface. Supabase impl + in-memory mock.
  fulfillment.ts        Post-payment: generate per-spec deliverables (primary +
                        add-ons) from clean assets, email signed links. Idempotent.
  deliverables.ts       makeHiRes + makePrintSheetPdf (4x6 / A4, cut guides).
  sheet-layout.ts       Print-sheet tiling math (mm/pt, cut lines). Unit tested.
  rate-limit.ts         Per-IP fixed-window limiter (in-memory; per-instance).
  admin-auth.ts         Admin bearer allowlist (timing-safe), in-memory audit log.
  monitoring.ts / -client.ts  reportError wrappers; console no-op until Sentry set.
  providers/
    bg-removal.ts       Replicate (851-labs/background-remover) + mock passthrough;
                        SSRF guard on the returned URL.
    payments.ts         Stripe Checkout + mock; refund() on both.
    storage.ts          Supabase private bucket + local-fs mock; 7-day purge list.
    email.ts            Resend + console mock.
    turnstile.ts        Cloudflare Turnstile verify + mock (always passes).
app/
  create/               Consent gate -> upload/capture -> MediaPipe face landmarks
                        -> /api/process -> watermarked result + before/after slider.
  checkout/[orderId]/   Receipt-styled summary, add-on checkboxes, Compliance+ bump.
  order/[orderId]/      Post-payment download list (per spec) + upsell.
  photo/[specId]/       Programmatic SEO landing pages (49) + OG images + FAQ JSON-LD.
  api/
    process             Pipeline entry (rate limit -> Turnstile -> zod -> ingest ->
                        pipeline -> compliance -> watermark -> store). Returns ONLY
                        watermarked preview + report.
    checkout            Creates payment session; amount computed server-side.
    webhook/stripe      Signature-verified payment confirmation -> fulfillOrder.
    mock-pay            Dev-only pay confirm (killed on real deploy).
    download/[orderId]  The ONLY path to clean deliverables: HMAC token + paid
                        re-check + per-spec validation.
    admin/*             Allowlist-gated orders overview + refund (audit-logged).
    cron/*              purge (CRON_SECRET), recovery, expiry-reminders.
```

## Core data flow

1. **Create** (`/create`): consent -> MediaPipe landmarks (client) -> POST
   `/api/process` with photo + landmarks + spec.
2. **Process** (`/api/process`): rate-limit -> Turnstile -> zod -> ingest (EXIF
   strip, size/bomb caps) -> `processPhoto` (bg removal, compose, crop, resize) ->
   compliance -> **watermark**. Persists the CLEAN asset, the original, the
   watermarked preview, the compliance report, **and the landmarks** on a new
   `pending` order. Response carries only the watermarked preview + report.
3. **Checkout** (`/checkout` -> `/api/checkout`): pick add-on specs / Compliance+;
   server computes the price, persists intent, creates a Stripe (or mock) session.
4. **Pay** -> Stripe webhook (or `/api/mock-pay` in dev) marks the order `paid`
   and calls **`fulfillOrder`**.
5. **Fulfill** (`lib/fulfillment.ts`): for the primary spec AND every add-on spec,
   produce `processed`/`hires`/`sheet-4x6`/`sheet-a4` deliverables. Primary reuses
   the clean asset from step 2; each add-on re-runs `processPhoto` from the stored
   **original** using the stored **landmarks** (different aspect/geometry per spec).
   Emails per-spec signed download links. Idempotent against webhook retries.
6. **Download** (`/api/download/[orderId]?kind=&spec=&token=`): HMAC token verify
   (bound to orderId+kind+expiry) + server-side paid re-check + `spec` validated
   against the order's own spec set (primary + add-ons). Streams private bytes.

## Security model (invariants)

- **Watermark invariant**: clean bytes are stored server-side and are reachable
  ONLY through `/api/download`, which requires a valid HMAC token AND a paid order.
  No re-process route; preview is always watermarked. Regression-tested
  (`tests/security.test.ts`, `e2e/no-clean-asset-leak.spec.ts`).
- **Per-spec entitlement**: add-on specs are paid for in the same order and share
  its payment; the download route validates the requested `spec` is one the order
  actually bought, so a token cannot be repointed at an unpurchased format.
- **Money server-side only**: prices from `lib/pricing.ts`; client sends intent.
- **Mock kill-guards**: `mock-pay` and the mock webhook path 403 on a real Vercel
  deployment (`isRealProdDeployment`).
- **Payments**: Stripe signature verified; idempotent via pending->paid transition
  + fulfillment's delivered-check.
- **Admin/cron**: bearer allowlist / `CRON_SECRET`, timing-safe compares, fail
  closed when unset in real prod.

## External services & failure posture

| Service   | Client              | Mock (no key)          | Failure handling |
|-----------|---------------------|------------------------|------------------|
| Replicate | bg-removal.ts       | passthrough (mocked=T) | timeout + retry-once, graceful copy |
| Stripe    | payments.ts         | mock checkout          | signature verify, webhook retry-safe |
| Supabase  | orders/storage.ts   | Map + local fs         | throws surface as 5xx, reported |
| Resend    | email.ts            | console log            | non-fatal (order still delivered) |
| Turnstile | turnstile.ts        | always passes          | skipped when unset; rate limit remains |

## Known deferrals (see AUDIT_LOG.md / PROJECT_STATE.md NEEDS HUMAN)

Rate limiter + admin audit log + webhook event-id idempotency are in-memory
(per-instance) — move to Postgres/Upstash before multi-instance scale. Sentry
wired but package not installed. Supabase RLS deny-test needs a live project.
