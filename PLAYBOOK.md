# THE PLAYBOOK — Binding Standards for All Projects (Current & Future)

This document travels with every build prompt. The building agent MUST copy it into the repo root as `PLAYBOOK.md` and treat every rule as a requirement, not a suggestion. When a project prompt and this playbook conflict, the project prompt wins. Anything this playbook mandates that the prompt doesn't mention still gets built.

---

## PART 1 — DESIGN: PREMIUM OR NOTHING

### 1.1 The Screenshot Test (hard QA gate)
Before shipping, screenshot every screen and ask: "Could this appear in a listicle of generic AI-generated apps?" If yes, redo it. Concretely banned:
- Purple/blue gradients, glassmorphism cards, floating blobs
- Default Inter-on-white with violet accent (the "AI SaaS template" look)
- Emoji as UI elements or icons; hero sections with generic undraw/3D-clay illustrations
- Centered-everything layouts with three feature cards and rocket-ship copy
- Default shadcn theme shipped unmodified — shadcn is scaffolding; retheme tokens (radius, colors, fonts, shadows) before building screens

### 1.2 Typography (the #1 premium signal)
- Every product pairs ONE distinctive display face with ONE refined body face (both from Google Fonts / Fontshare, self-hosted, `font-display: swap`). Never body-font-only.
- All money, stats, timers, and counters use **tabular numerals** (`font-variant-numeric: tabular-nums`).
- Fluid type scale (clamp-based on web). Display sizes are BIG (48–96px hero), body is calm (16–18px, 1.6 line height, 65ch max measure).
- Letter-spacing: tighten display (−1% to −3%), never track out lowercase body.

### 1.3 Color & materials
- One near-neutral canvas (warm ivory or deep ink — never pure #FFF/#000), ONE signature accent used sparingly (5% of any screen), semantic green/amber/red reserved for meaning.
- Depth via layered low-opacity shadows + 1px low-contrast borders, not heavy drop shadows. Subtle grain/noise texture (2–4% opacity) on large surfaces is encouraged — it kills the "flat AI" look.
- Dark themes: layered dark surfaces (#0B0F14 → #12181F → #1A222B), desaturated accents, glow used only on the product's signature element.

### 1.4 Motion — "reactive" is the product feeling
- Library: Framer Motion (web) / Reanimated worklets (mobile). 60fps or it doesn't ship.
- Micro-interactions on EVERY interactive element: hover/press/focus states with 150–250ms spring transitions (scale 0.97 press, lift on hover). No dead clicks — every tap produces visible+haptic response within 100ms.
- Numbers never just appear: counters roll/odometer, progress rings draw in, charts animate on first view only.
- Loading: skeletons + staged progress copy ("Checking 214 listings…"), never bare spinners. Stream AI output token-by-token where possible — perceived speed IS speed.
- Optimistic UI on every mutation; reconcile in the background.
- Every product defines ONE **signature interaction** (specified in its prompt) that gets obsessive polish — this is the moment users screenshot and share.
- Respect `prefers-reduced-motion` / OS reduce-motion settings.
- Mobile: expo-haptics on meaningful moments only (success, milestone, verdict) — not on every tap.

### 1.5 Craft details that read as luxury
- Empty states: designed (custom line-art or typographic), with one clear action. Error states: human copy + recovery path. Never raw error strings.
- Icons: one consistent set (Lucide/Phosphor), one stroke weight, optically aligned.
- 8pt spacing grid; generous whitespace; align to a real grid — misalignment is the fastest way to look cheap.
- Copywriting: specific, confident, human ("Your photos are safe for 12 months" not "Manage your media assets"). No exclamation marks in UI chrome. Microcopy under every risky action.
- Real content in dev: seed data must look like real usage, never lorem ipsum.
- Accessibility is part of premium: WCAG AA contrast, visible focus rings (styled, not default blue), hit targets ≥44px, labels on all inputs.

---

## PART 2 — SECURITY: EVERY LAYER, EVERY TIME

### 2.1 Secrets & configuration
- No secret ever ships in client bundles (web JS or app binary). Server/edge-function env only. `EXPO_PUBLIC_`/`NEXT_PUBLIC_` prefixes are for genuinely public values only.
- `.env.example` committed with placeholder values + comments; real `.env` gitignored. Document rotation steps in README.

### 2.2 AuthN / AuthZ
- Supabase RLS on EVERY table, default-deny, then explicit policies. Write a test that verifies an anonymous client cannot read another user's rows.
- Service-role key used only in server routes/edge functions; every such route re-validates the caller's session and authorization — never trust client-supplied user ids or entitlement flags.
- Auth endpoints rate-limited (magic links, OTP). Session cookies httpOnly/secure/sameSite.

### 2.3 Input & upload hygiene
- zod validation on every API boundary (body, query, params). Reject, don't sanitize-and-hope.
- File uploads: enforce size caps client AND server; verify type by magic bytes (not extension/mime header); re-encode all images through sharp — this both neutralizes malformed-file attacks and **strips EXIF/GPS metadata** (mandatory for any app handling user photos); reject SVG uploads from untrusted users (XSS vector); cap video duration/size.
- Any server-side URL fetching: allow http(s) only, resolve and block private/loopback/link-local/metadata IP ranges (SSRF), enforce timeout + response size cap.

### 2.4 API & platform hardening
- Rate limiting on every public endpoint: per-IP and per-user (Upstash Ratelimit or Postgres-based). Stricter limits on expensive paths (AI, image processing).
- Security headers (web): CSP (no unsafe-inline where avoidable), HSTS, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy. next-safe-middleware or manual.
- Errors to clients are generic; details go to Sentry. No stack traces, no SQL, no internal paths in responses.
- IDs exposed in URLs are UUIDs/nanoids — never sequential integers (enumeration). Access to any object re-checks ownership server-side.
- All object storage private by default; downloads via short-lived signed URLs generated after an authorization check.
- Bot/abuse protection on unauthenticated high-value endpoints: Cloudflare Turnstile (invisible mode) + disposable-email blocklist on free tiers/trials.

### 2.5 Payments security
- Verify Stripe webhook signatures; process idempotently (persist event ids). RevenueCat: re-check entitlements on app foreground AND server-side in any backend that gates paid features.
- Prices, plans, and add-on math live server-side only. The client sends intent ("upgrade to premium"), never amounts.
- Enable Stripe Radar defaults; log payment anomalies to the admin page.

### 2.6 LLM/AI-specific security
- All user-supplied content sent to an LLM (job postings, fetched web pages, image contents, chat messages) is UNTRUSTED: wrap it in explicit delimiters, and the system prompt must instruct the model to treat delimited content as data, never as instructions. System prompts live server-side only.
- Validate every LLM response against a zod schema before use; retry once with the parse error; fail closed.
- Hard cost controls: per-user daily/monthly token budgets enforced server-side, per-request max_tokens, kill-switch env flag that disables AI features instantly without redeploy.
- Never send more PII to the model than the feature needs; never log full prompts containing user PII.
- If LLM output is displayed to OTHER users, run it through moderation first.

### 2.7 Privacy & data lifecycle
- Data minimization: collect only what a feature uses. Define a retention window for every data class in the schema (comment it) and enforce with scheduled purges — then TEST the purge.
- Self-serve deletion (account + data) wherever accounts exist; documented email process otherwise. Data export where practical (GDPR).
- Privacy policy lists actual subprocessors (Supabase, Vercel, Stripe, Anthropic, Replicate, PostHog, Sentry…). No dark-pattern consent.
- Analytics: no PII in event properties. Sentry: scrub request bodies.
- No PII in logs, ever.

### 2.8 Supply chain & ops
- Lockfiles committed; `npm audit`/`pnpm audit` in CI (fail on high/critical); prefer boring, maintained packages; pin major versions.
- Admin surfaces: allowlist-gated, actions audit-logged.
- CI never receives production secrets except deploy tokens.

---

## PART 3 — RETENTION: ENGINEERED, NOT HOPED FOR

### 3.1 Activation first
- Define THE activation event per product (first scan result, first prep pack, first guest upload, day-1 streak survived, first compliant photo) and get users there in the FIRST session, ideally <2 minutes. Instrument time-to-activation; it's the metric that predicts everything else.
- Onboarding completion target >70%; every screen's drop-off tracked; each screen earns its place or dies.

### 3.2 Lifecycle messaging matrix (build for every product)
| Trigger | Channel | Message |
|---|---|---|
| Signup, no activation in 24h | email/push | Nudge back to the aha moment |
| Trial day 2 | email/push | Show value already delivered ("Your pack is ready / 47 cravings resisted") |
| Milestone hit | push + in-app | Celebrate + shareable artifact |
| Usage stopped 7d | email/push | Win-back with a concrete reason to return |
| Payment failed | email | Dunning ×3 (day 0/3/7) with one-tap fix |
| Cancelled | email | Exit survey → pause offer → one-time win-back discount (30 days later) |
All emails via Resend with a shared, well-designed template (playbook typography). Push notifications: valuable or silent — a notification that isn't personally relevant trains users to disable them.

### 3.3 Stored value & habit
- Every product builds a compounding asset the user would lose by leaving: history, answer banks, galleries, streaks, saved specs. Surface the asset ("Your 34 scans found $2,140 in potential profit").
- Streaks where natural; investment features (notes, watchlists, favorites) everywhere.
- Timely triggers beat generic reminders: schedule from observed behavior (danger-hours, weekend thrifting, interview dates, event dates).

### 3.4 Churn-by-design products (per-event/one-time tools)
Retention = repurchase + referral + list-building:
- Capture email at the moment of delivered value; tag by use case.
- Engineer the next purchase: renewal/expiry reminders, "next event" campaigns, seasonal pushes.
- Every delivered artifact (album, photo, PDF, share card) carries tasteful attribution — the product markets itself through its outputs.
- Referral mechanics: give/get credit, shown at the peak-happiness moment (right after value delivery, never before).

### 3.5 Measure
- D1/D7/D30 retention cohorts in PostHog from week 1; one north-star metric per product, reviewed weekly.

---

## PART 4 — MONEY: MAXIMIZE EVERY STAGE OF THE FUNNEL

### 4.1 Paywall doctrine (mobile & web-app products)
- HARD paywall after a multi-step onboarding that builds investment and personalizes the pitch (benchmark: 5x conversion vs freemium; 30%+ trial-start rate is achievable).
- The paywall screen shows THEIR data (their dependency score, their questions found, their potential profit) — personalized proof, not generic promises. Blur/lock real generated value where possible.
- Weekly plan default-selected with free trial; annual/lifetime as anchor showing "% off". Price display: per-week framing for weekly, per-month framing for annual.
- Prices/copy remotely configurable (RevenueCat Offerings / server config) — never hardcoded client-side. One pricing experiment live at all times once traffic exists.
- Trial UX: deliver overwhelming value on day 1–2; day-3 conversion is won in the first hour.

### 4.2 Transactional products (per-use/per-event)
- Impulse pricing under $5 needs zero justification; $29–99 needs social proof + guarantee on the page.
- Money-back guarantee stated boldly (it lifts conversion more than it costs in refunds) + one-click admin refunds.
- **Order bumps at checkout** (one checkbox add-on, 60–80% margin) and **post-purchase one-click upsells** — implement both wherever there's a checkout.
- Abandoned checkout recovery: one email at +4h with a single-use code. Never more than one.

### 4.3 Revenue layers (stack them)
1. Core offer (sub or one-time)
2. Checkout add-ons/bumps
3. Consumable top-ups for capped features (hybrid monetization — 35% of top apps do this)
4. Affiliate/partner revenue on natural outbound intent (marketplace links, print services)
5. B2B/volume tier once ≥3 organic requests arrive (never speculatively)

### 4.4 Store & platform economics
- Weekly subs and one-time IAPs live on mobile; web checkout (Stripe) wherever the platform allows steering — 30% saved is pure margin.
- ASO: title + subtitle carry the top keyword; screenshots are a sales narrative (pain → magic moment → proof → offer), first screenshot wins or loses the install.
- Ratings prompt exactly once, at the product's peak-happiness moment (defined per prompt). Respond to every review ≤4 stars.

### 4.5 Operating cadence (the human's job, documented in every README)
- Weekly 30-min ritual: funnel review (visits → activation → trial → paid → retained) in the admin page/PostHog, pick ONE experiment, ONE retention fix, ONE distribution push. Ship all three that week.
- Kill/scale rule: <$500 total revenue after 30 days of real distribution → kill or pivot; ≥$500 → double down on the working channel.
- Track ARPU, trial→paid %, refund rate, AI cost per user (must stay <15% of ARPU).

## PART 5 — EXPERIMENTATION & ANALYTICS DISCIPLINE
- Event naming: `object_action` (`paywall_viewed`, `trial_started`, `scan_completed`). Document every event in `analytics.md` at repo root; no orphan events.
- Funnels built in PostHog on day 1: acquisition → activation → paywall → trial → paid → retained.
- One A/B test at a time, on the highest-leverage surface (paywall > onboarding > pricing > everything else). Minimum ~200 conversions per variant before calling it.
- Session replay (PostHog) on web funnels, sampled, PII-masked.

## PART 6 — DEFINITION-OF-DONE ADDENDUM (applies to every project)
Beyond the project prompt's own checklist:
- [ ] Screenshot test passed on every screen (Part 1.1)
- [ ] Signature interaction implemented and 60fps
- [ ] RLS deny-test passes; rate limits verified with a script; webhook signature + idempotency tested
- [ ] EXIF stripping verified on an uploaded photo with GPS data (where applicable)
- [ ] LLM cost caps + kill switch tested (where applicable)
- [ ] Lifecycle emails/notifications fire in staging (all rows of the 3.2 matrix that apply)
- [ ] Paywall/checkout events visible in PostHog; funnel renders end-to-end
- [ ] `analytics.md`, `PLAYBOOK.md`, `PROJECT_STATE.md` present and current
- [ ] Purge/retention jobs tested, not just written

