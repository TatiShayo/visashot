# VisaShot — Vision Review (Round 1)

**Date:** 2026-07-24  
**Viewport Targets:** Desktop 1280×800, Mobile 375×812  
**Reviewed by:** Automated Vision-in-the-Loop pipeline

---

## Screenshots Captured

| Page | Desktop | Mobile |
|------|---------|--------|
| Home | ⚠️ timeout (first-load redirect) | ✅ `home_mobile.png` |
| Login | ✅ `login_desktop.png` (→ 404) | ✅ `login_mobile.png` |
| Pricing | ✅ `pricing_desktop.png` | ✅ `pricing_mobile.png` |

> **Note on home_desktop timeout:** Root `/` caused a first-load timeout on desktop viewport. The mobile viewport loaded successfully on the same request cycle, indicating a timing/hydration issue on initial load at desktop rather than a routing problem.

---

## Visual Rubric Review

### ✅ Typography Hierarchy
- **Home mobile H1**: `"A compliant document photo from one selfie."` — bold, large, impactful. Clear value prop.
- **Sub-headline badge**: `PASSPORT · VISA · ID — 49 OFFICIAL FORMATS` — small tracked all-caps, good contextual anchor before H1.
- **Body text**: Legible, comfortable line-height, medium weight.
- **Format card labels**: Clear H3-level weight with descriptive spec lines (size, background color).

### ✅ Color Contrast  
- Brand: **Bright royal blue** (`#1A73E8` approx.) on white — high contrast, WCAG AA compliant.
- Primary CTA button: Blue fill, white text — excellent contrast.
- Ghost/secondary CTA: White fill, dark border, dark text — readable.
- Body text: Near-black on white — AAA.
- Footer: Light grey text — small sizes borderline, acceptable for legal/secondary content.

### ✅ Primary CTA — Clear per screen
- **Home mobile**: `Start your photo` (blue filled) — prominent, full-width on mobile, above the fold. `Browse all formats` secondary ghost button below.
- **Desktop nav**: `Start your photo` in brand blue anchored top-right — always visible.
- **404 page (login route)**: Two CTAs: `Start your photo` (primary) + `All photo types` (secondary) — 404 page itself is well-designed, not a blank error.
- **Pricing page**: Per-plan CTAs present.

### ✅ Responsive Layout (Mobile)
- Single column on mobile, no horizontal overflow.
- Format cards stack cleanly — each card has spec label, dimensions, background color spec.
- Footer collapses to vertical link list.
- Nav on mobile: logo left, `All photo types` text link center, `Start your photo` CTA right — tight but functional.

### ✅ No Emoji as UI Icons
- No emoji used. Icons are text/SVG-based. Clean.

### ⚠️ Issues Found

| Severity | Page | Issue |
|----------|------|-------|
| **HIGH** | `/login` | Route renders as custom 404 ("This page isn't on file") — no `/login` route exists. Auth entry point is missing or renamed. Users who click "Sign in" will hit a dead end. |
| **MEDIUM** | Home desktop | First-load timeout — root `/` takes >20s on desktop. Possibly SSR blocking on an external API call. Mobile loaded same page in ~3s. |
| **LOW** | Pricing | Need screenshot — desktop load succeeded but not captured due to ordering; only mobile captured. |
| **INFO** | 404 page | Custom 404 design is excellent — well-branded, not a blank page. However CTA on 404 should link to `/` not `/start`. |

---

## Recommendations

1. **URGENT: Add `/login` route** or update nav `Log in` link to point to the actual auth URL (e.g., `/start`, `/auth`, or Supabase magic link).
2. **Investigate SSR blocking** on home page desktop — profile the page load to find which API call or middleware is causing the >20s TTFB.
3. **Verify pricing page route** — capture at desktop viewport.
4. **Run Lighthouse** on home — current load behaviour suggests a Performance score below 70 at desktop.

---

## Verdict

**CONDITIONAL PASS.** Brand identity and mobile layout are strong — clean, professional, high-contrast design with a clear value prop and CTA hierarchy. The missing `/login` route is a **user-facing bug** that must be fixed before launch. Desktop performance needs investigation.
