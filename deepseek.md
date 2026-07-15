# visashot — DeepSeek Audit

**Date:** 2026-07-13
**Path:** `C:\Users\TATI\Desktop\DEV\visashot\`
**Stack:** TypeScript / Next.js 15 + MediaPipe + Stripe + Replicate
**Tier:** 2 — High
**Dependencies:** None installed

---

## 🔴 Security Vulnerabilities

| Severity | File | Line(s) | Vulnerability | Exact Fix |
|----------|------|---------|---------------|-----------|
| 🟡 MEDIUM | `lib/providers/payments.ts` | 59 | `JSON.parse(rawBody)` without try-catch — crashes on bad Stripe mock data. | Wrap in try-catch: `try { return JSON.parse(rawBody) } catch { throw new Error("Invalid payment data") }`. |
| 🟡 MEDIUM | `app/api/process/route.ts` | 131-135 | `JSON.parse(String(form.get("landmarks")))` has outer try-catch but could leak partial state on error. | Ensure rollback/cleanup on JSON parse failure. |
| ✅ | `lib/sign.ts` | — | HMAC-signed expiring download tokens. Good. | — |
| ✅ | `lib/rate-limit.ts` | — | Per-IP sliding-window rate limiter. Good. | — |
| ✅ | `lib/providers/turnstile.ts` | — | Cloudflare Turnstile CAPTCHA. Good — mock passes when no key. | — |
| ✅ | `app/api/download/[orderId]/route.ts` | — | Signed download token verification. Good. | — |
| ✅ | `app/api/cron/purge/route.ts` | — | CRON_SECRET protected. Good. | — |
| ✅ | `lib/providers/bg-removal.ts` | 107 | `fetch(safe, { signal: AbortSignal.timeout(30_000) })` — has timeout. Good. | Add retry logic for 429 rate limit responses. |

---

## 🟠 Performance Issues

| Severity | File | Line(s) | Issue | Exact Fix |
|----------|------|---------|-------|-----------|
| 🟠 HIGH | `lib/providers/bg-removal.ts` | — | No retry logic on Replicate API rate limits. A 429 response kills the entire order. | Add exponential backoff retry (max 3 attempts): `for (let attempt = 1; attempt <= 3; attempt++) { try { ... } catch (e) { if (e.status === 429) await sleep(1000 * attempt); else throw e; } }`. |
| 🟡 MEDIUM | `app/api/webhook/stripe/route.ts` | 43 | `getOrderStore().get()` called on hot path — same order looked up in multiple routes without shared cache. | Add 60s in-memory LRU cache for order lookups. |
| 🟡 MEDIUM | `app/api/download/[orderId]/route.ts` | 69 | Same — repeated order lookups. | Use shared cache. |
| 🟡 MEDIUM | `app/api/checkout/route.ts` | 48 | Same. | Use shared cache. |

---

## 🟡 UI/UX Improvements

| Severity | File | Line(s) | Issue | Exact Fix |
|----------|------|---------|-------|-----------|
| 🟠 HIGH | ALL routes | — | **No `loading.tsx` files** — no loading skeleton for Stripe checkout, admin, photo processing. Users see frozen UI during Replicate API calls (5-15s). | Add `loading.tsx` with skeleton UI matching the photo upload/preview layout. |
| 🟡 MEDIUM | `app/global-error.tsx` | 26-66 | Hardcoded colors (`#ffffff`, `#dc2626`, `#2563eb`, `#44506b`). | Tokenize: `var(--color-surface)`, `var(--color-error)`, `var(--color-accent)`. |
| 🟡 MEDIUM | `app/photo/[specId]/opengraph-image.tsx` | 22-43 | Hardcoded colors (`#2563eb`, `#1b2a4a`, `#44506b`) not referencing CSS vars. | Tokenize. |
| 🟡 MEDIUM | `app/mock-pay/page.tsx` | 8 | `<Suspense>` with no fallback UI — shows nothing while loading. | Add fallback: `<Suspense fallback={<MockPaySkeleton />}>`. |
| 🟡 MEDIUM | `app/create/CreateClient.tsx` | 237, 292 | `alt` text "Your upload" and "Processed preview (watermarked)" — could be more descriptive for screen readers. | Add context: `alt="Original passport photo uploaded by user"`, `alt="Processed visa photo with watermark overlay"`. |
| 🟡 MEDIUM | `app/create/CreateClient.tsx` | 201 | Drag-upload zone has no `aria-label`. Screen readers can't identify the drop target. | Add `aria-label="Upload passport photo — drag and drop or click to browse"`. |
| ✅ | CSS | — | Clean CSS custom properties, custom `:focus-visible` ring. Swiss-precision design. Good. | — |
| ✅ | Metadata | — | Proper OG/Twitter meta tags. Good. | — |

---

## 🔧 Session: 2026-07-14 — Multi-Agent Deep Audit Sweep (Round 1)

### Audit findings (no code changes needed)

| Severity | Finding | Status |
|----------|---------|--------|
| 🟡 | `requireSigningSecret()` returns `"dev-only-signing-secret..."` in dev — but gated behind `isRealProdDeployment` check. Best mock-kill pattern in portfolio. | Clean |
| ✅ | Full security headers via `next.config.ts` — MediaPipe-friendly CSP with `wasm-unsafe-eval` | Clean |
| ✅ | No `error.message` leaks in any API route — all generic messages | Clean |
| ✅ | Playwright e2e, vitest, typecheck, lint — `npm run verify` script | Clean |
| 🟡 | No `middleware.ts` (acceptable for unauthenticated buyer flow model, but admin routes use bearer token — interim) | Deferred |

| Category | Package | Issue | Fix |
|----------|---------|-------|-----|
| 🟡 MEDIUM | `next ^15.5.0` | Loose caret — could jump to 16.x with breaking changes. | Pin to `15.5.0` or add upper bound. |
| 🟡 MEDIUM | `@mediapipe/tasks-vision ^0.10.14` | Loose caret. | Pin. |
| 🟡 MEDIUM | `sharp ^0.34.0` | Loose caret — sharp has had major API changes. | Pin to `0.34.0` or add `^0.34.0 <0.35.0`. |
| ✅ | Dev deps | Vitest, Playwright, full verify pipeline. Good. | — |

---

## 📋 Priority Fix Queue

1. **[HIGH — No Loading States]** ALL routes — Add `loading.tsx` with skeleton UI matching the photo/checkout layout.
2. **[HIGH — No Retry]** `lib/providers/bg-removal.ts` — Add exponential backoff retry for Replicate 429 rate limits.
3. **[MEDIUM — JSON.parse]** `lib/providers/payments.ts:59` — Wrap `JSON.parse(rawBody)` in try-catch.
4. **[MEDIUM — Order Cache]** Add shared 60s LRU cache for order lookups across webhook/download/checkout routes.
5. **[MEDIUM — Colors]** Tokenize hardcoded hex in `global-error.tsx`, `opengraph-image.tsx`.
6. **[MEDIUM — Accessibility]** Add `aria-label` to drag-upload zone. Improve alt text on photo previews.
