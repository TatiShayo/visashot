# BUILD: VisaShot — Passport & Visa Photo Compliance Tool (Web App)

## Your role
Lead engineer-orchestrator. Build from scratch to deployed completion on Vercel. All decisions are in this document — do not stop to ask.

**BINDING COMPANION DOCUMENT**: a universal `PLAYBOOK.md` is supplied alongside this prompt (premium design standards, full security checklist, retention systems, monetization doctrine). Copy it into the repo root and comply with ALL of it — its Definition-of-Done addendum applies to this project.

## Product overview & business model
VisaShot turns a phone selfie into a government-compliant passport/visa/ID photo in 60 seconds: auto background replacement, auto crop to country spec, compliance checks, instant download. One-time payment $4.99 per photo set (digital files + printable 4x6/A4 sheet). No subscription — pure transactional, SEO-driven, evergreen replenishing demand (renewals, visas, new travelers).
Growth engine: programmatic SEO — one landing page per country×document combination.

## Tech stack (fixed)
- Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui, Vercel
- Supabase: Postgres (orders, specs), Storage (uploads/results, 7-day auto-purge)
- Face detection/landmarks: MediaPipe Face Landmarker running CLIENT-SIDE (@mediapipe/tasks-vision) — free, fast, private
- Background removal: Replicate API model `851-labs/background-remover` or `rembg`; compose onto spec background color with `sharp` server-side
- Stripe Checkout one-time payment; Resend for delivery emails; `@react-pdf/renderer` for print sheets

## Spec database (the moat — build carefully)
Create `/data/photo-specs.ts`: typed array of specs. Each entry:
{id, country, countryCode, docType, displayName, widthMm, heightMm, widthPx, heightPx,
 dpi, bgColor hex, headHeightPctMin, headHeightPctMax, eyeLinePctMin, eyeLinePctMax,
 glassesAllowed bool, smileAllowed bool, notes string, sourceUrl string}
Seed with 40 specs minimum, covering: US passport (2x2in, 600x600px, white), US visa, Schengen visa (35x45mm), UK passport, Canada (50x70mm), Australia, India passport + OCI, China visa, Japan, Brazil, Nigeria, Kenya, South Africa, UAE, Saudi (iqama/visa), Philippines, Mexico, Green Card/DV lottery, TSA PreCheck, US CDL/state ID generic, baby-passport variants for US/UK/Schengen. Verify dimensions against official government sources and record sourceUrl per spec. Structure so adding a spec = adding one object (each auto-generates an SEO page).

## Data model
- `orders` (id, email, spec_id, original_path, processed_path, print_sheet_path, stripe_session_id, status enum[pending,paid,delivered], compliance_report jsonb, created_at)
- `specs` mirrored to DB only for analytics; source of truth is the TS file.
No user accounts — email-based delivery. Storage bucket with 7-day lifecycle purge (cron).

## Features & implementation
1. **Upload/capture step** (`/create?spec=us-passport`): drag-drop or mobile camera capture; client-side MediaPipe face detection immediately; instant feedback overlay ("Face found ✓ / Move closer / Face the camera straight").
2. **Auto-processing pipeline**: client sends photo + landmarks to server route → Replicate background removal → sharp composes onto spec bgColor → auto-crop using eye/chin/crown landmarks so head height and eye line land mid-range of spec → output exact widthPx×heightPx at spec dpi.
3. **Compliance checker** (runs on processed result, client-side where possible): head height % in range, eye line in range, face tilt <5° (landmark symmetry), both eyes open (MediaPipe blendshapes), neutral expression if !smileAllowed, no glasses if !glassesAllowed (detect via landmarks/heuristic — if uncertain, WARN not FAIL), brightness/contrast in range, single face only. Render as a checklist: PASS ✓ / WARN ⚠ (with fix tip) / FAIL ✗ (block purchase, explain exactly how to reshoot). This checklist IS the trust-builder — make it prominent.
4. **Preview + paywall**: show processed photo WITH diagonal watermark + the passed checklist → "Download for $4.99" → Stripe Checkout (collect email) → webhook marks paid → success page with downloads + email via Resend.
5. **Deliverables per order**: digital photo (exact px), high-res 300dpi version, print sheet PDF (4x6in and A4 layouts, 4-8 photos tiled with cut guides), simple "how to print at CVS/Walgreens/at home" instructions page.
6. **Retake-friendly**: unlimited free re-processing before payment; after payment, 3 free re-runs on the same order (goodwill, reduces refunds).
7. **Programmatic SEO pages** (`/photo/[specId]`): auto-generated from spec DB — H1 "US Passport Photo Online — 2x2 inch, App-Approved", requirements table from spec fields, step-by-step, FAQ with schema.org markup, 400+ words unique templated copy with per-spec facts, internal links to related specs, CTA into /create?spec=X. Plus sitemap.xml, robots.txt, OG images per spec (vercel/og).
8. **Homepage**: spec picker (search country/doc), 3-step explainer, sample before/after, pricing, guarantee ("Rejected by the government? Full refund").
9. **Compliance disclaimer**: clear footer note — tool assists compliance, final acceptance is at issuing authority's discretion; refund policy page.

10. **Biometric consent & trust (non-negotiable — face data is sensitive under GDPR/BIPA)**: explicit consent checkbox BEFORE any processing ("My photo will be processed to generate my document photo and automatically deleted within 7 days"), linked privacy policy; "auto-deleted in 7 days" trust badge shown at upload, preview, and checkout; no face data ever used for anything else — say so.
11. **Clothing/background contrast check**: warn when clothing color is too close to the spec background color (white shirt on white background is a top real-world rejection reason); sample dominant torso color from landmarks region vs spec bgColor.
12. **Auto-enhance**: brightness/contrast/white-balance normalization via sharp before compliance checks, with a before/after toggle in preview.
13. **Multi-spec upsell at checkout (AOV booster, near-zero cost)**: "Need this photo in another format? Add US Visa version +$2.99" — same processed photo re-cropped to additional specs; suggest specs commonly bought together (passport+visa same country, passport+ID). Each add-on generates its own deliverable set.
14. **Baby mode**: infant specs flagged "beta" — eyes-open and neutral-expression checks downgraded to WARN per official infant exemptions; dedicated tips UI ("lay baby on a white sheet, shoot from above"); landmark confidence threshold relaxed with manual crop-adjust fallback (draggable crop overlay).
15. **Per-spec exemption notes**: glasses/head-covering religious & medical exemption text stored per spec and surfaced in both the compliance checker (as info, not failure) and the SEO pages.
16. **Abandoned-order recovery**: optional "Email me my result" before payment; if no purchase within 4 hours → single recovery email with a 20% code (env-flag gated, easy to disable).
17. **Comparison SEO page**: `/vs/pharmacy-passport-photos` — honest price/convenience comparison ($4.99 at home vs ~$17 retail), FAQ schema, CTA.

## Premium UI & motion direction (follow PLAYBOOK Part 1 + this art direction)
**Concept: "Swiss precision"** — what a government form would look like if Stripe designed it. Trust is the entire brand; precision aesthetics ARE the conversion strategy.
- Palette: pure functional white, ink navy #1B2A4A, single blue accent #2563EB, semantic green/amber/red only in the checklist. Type: Inter Display (tight, large) + Inter body; JetBrains Mono for order numbers, dimensions, and spec values (35×45 mm) — monospace reads as measured and official.
- **Signature interaction — the compliance sequence**: the photo slides into a document frame, then blueprint-style guide lines DRAW themselves on (head-height bracket, eye-line rule, margins) like an architect's drawing, measurements labeling in mono as they land; then checklist items tick sequentially with crisp micro-animations and a soft click feel; all-green triggers an embossed "COMPLIANT ✓" seal stamping in with a subtle scale-settle. This 4-second sequence is the trust moment AND the shareable moment.
- Background removal presented as a draggable before/after slider — let users feel the magic.
- Face-detection feedback on upload is live and calm: an alignment ring that eases from amber to blue as the face centers.
- Checkout: order summary styled like an official receipt (mono, ruled lines); trust badges (auto-delete in 7 days, refund guarantee) rendered as precise line-art stamps, not shield emoji.
- Mobile-first; zero gradients; no stock-photo people (illustrated head-position guides only); loading states are staged copy ("Removing background… Aligning to 35×45 mm…"), never spinners.

## Security (project-specific threat model — PLAYBOOK Part 2 applies in full)
- **The clean photo is the product — protect it**: watermark applied server-side in the pipeline; the un-watermarked result NEVER leaves the server before payment (no client-side watermarking, no clean asset in any pre-payment response — verify in network tab as a test).
- Face photos are sensitive biometric-adjacent data: private buckets, short-lived signed URLs, 7-day purge cron TESTED, EXIF/GPS stripped on ingest, Replicate listed as subprocessor, consent gate before processing (specced).
- Order access: nanoid order ids + signed, expiring download links bound to paid status; email-delivered links re-check payment server-side; no sequential ids anywhere.
- Upload hygiene: magic-byte checks, 15MB cap, re-encode via sharp; processing endpoint rate-limited per IP + invisible Turnstile (Replicate costs money — bots will find it).
- Stripe: signature-verified idempotent webhooks; add-on math server-side only; Radar on.
- Admin refund surface allowlist-gated + audit-logged.

## Retention & repurchase engine (churn-by-design — PLAYBOOK 3.4)
- **The expiry loop is the long-term goldmine**: after purchase, one optional question — "When does this passport/visa expire?" → automated reminder emails at 6 months and 1 month before expiry ("Renewal time — your photo specs are saved"). A $4.99 customer today is a returning customer in 2-10 years at near-zero cost; build the scheduler now.
- Email capture at delivery (already natural — files are emailed); tag by country/doc for targeted seasonal sends (DV-lottery season, summer travel, Hajj visa windows).
- Family/companion prompt on the success page: "Need photos for family members? Each additional person $3.99" (fresh photo, same session).
- Every delivered PDF footer carries quiet attribution + referral link ("Made with VisaShot — $1 off for a friend").
- Post-delivery day-3 email: "Did your photo get accepted?" → YES: review request; NO: instant guided refund (guarantee kept loudly — it feeds conversion).

## Revenue maximization (PLAYBOOK Part 4 applies)
- Core $4.99 impulse price; **attach-rate stack**: multi-spec add-on +$2.99 (specced), additional person +$3.99, order bump at checkout — "+$1.99 Compliance+ : manual-quality recheck & free reprocessing for 30 days" (pure margin, sells peace of mind).
- Abandoned-order email at +4h with 20% single-use code (specced, env-gated).
- Track attach rate and checklist-pass rate per check in admin — a check that's too strict is a conversion leak; tune with data.
- SEO is the money machine: 40 spec pages + pharmacy comparison page at launch, then add specs weekly (each new spec = new page = new keyword); internal linking hub "passport photos" → all countries.
- Later layers (fast-follow, not v1): print-at-partner affiliate, API for travel agencies (only after ≥3 organic requests).

## Cross-cutting requirements (non-negotiable)
- **Analytics**: PostHog from day one. Instrument: spec selected, photo uploaded, processing success/fail, checklist pass rate (per check — tells you which checks are too strict), preview→checkout rate, purchase, add-on attach rate, recovery-email conversion. Internal `/admin` page (email-allowlist gated): revenue, orders/day, conversion, refund button (one-click Stripe refund + re-open order), failed-processing queue.
- **Error monitoring**: Sentry client + server; alert on pipeline (Replicate/sharp) and payment failures.
- **Payments hygiene**: Stripe webhooks idempotent; Stripe Tax enabled; receipts on every charge; refund workflow documented (the "government rejected it" guarantee means refunds WILL happen — make them one click).
- **Legal & privacy**: Privacy Policy + Terms in plain language; the 7-day auto-purge cron is a compliance feature, not just cost control — verify it with a test; document data flow (browser → Supabase → Replicate) in the policy.
- **Build continuity**: maintain `PROJECT_STATE.md` at repo root — done / next / NEEDS HUMAN after every milestone. Assume resume in a fresh session with zero memory.
- **Never stall on missing keys**: Replicate/Stripe/Resend behind typed provider interfaces with mocks (mock bg-removal returns the original with a flag); missing key → mock + NEEDS HUMAN note, keep building.
- **Placeholder honesty**: any testimonials clearly marked placeholder until real.
- Extra env vars: NEXT_PUBLIC_POSTHOG_KEY, SENTRY_DSN, ADMIN_EMAILS.

## Agent orchestration
1. **Scaffold agent**: Next.js + Supabase + PostHog/Sentry wiring + PROJECT_STATE.md + CI + spec database file with all 40 verified specs (this agent does the research + sourceUrls).
2. **Pipeline agent**: upload → MediaPipe → Replicate → sharp → crop math → processed output. End-to-end with a real test portrait FIRST. Crop math needs unit tests (given landmarks + spec → crop rect).
3. **Compliance agent**: full checker + checklist UI + contrast check + auto-enhance + baby mode + exemption notes + fixtures (test portraits: tilted, glasses, smiling, dark, two faces, white-on-white clothing, infant).
4. **Payments agent**: consent gate → watermark preview → Stripe (with multi-spec add-ons) → webhook → delivery downloads + email + print-sheet PDF generation + abandoned-order recovery.
5. **SEO agent**: programmatic pages, comparison page, sitemap, OG images, homepage, copy for all specs.
6. **Polish agent**: motion pass (compliance-sequence signature interaction first), before/after slider feel, empty/error states, PLAYBOOK screenshot test on every screen — redo failures.
7. **Security agent**: PLAYBOOK Part 2 + threat model above as a checklist; verify no clean asset pre-payment (network-tab test), purge-cron test, EXIF-strip test, rate-limit script.
8. **QA agent**: Playwright e2e (upload fixture → process → checklist passes → pay test-mode → download all 3 deliverables), unit tests for crop math + PDF layout.
9. **Deploy agent**: Vercel prod, storage purge cron, webhook registered, README (env setup, adding-a-spec guide, refund workflow).
Env: SUPABASE (3), STRIPE (3), REPLICATE_API_TOKEN, RESEND_API_KEY, NEXT_PUBLIC_APP_URL.

## Definition of done
- Deployed; full journey works with a real selfie on mobile: pick "Schengen visa" → capture → auto-processed → checklist all green → pay (test mode) → receive email → download photo + print sheet with correct physical dimensions when printed
- 40 SEO pages live and in sitemap; Lighthouse mobile ≥85
- Crop-math unit tests green incl. edge cases (very tall/wide photos, off-center faces)

## Out of scope v1
Physical print fulfillment/shipping, subscriptions, accounts, mobile apps, AI outfit replacement, bulk/family orders (single photo per order only).
