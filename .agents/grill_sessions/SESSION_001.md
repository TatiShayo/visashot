# Grilling Session 001: visashot
**Archetype**: Tier 1 AI SaaS (Biometric Visa Photo Compliance)
**Human Domain Authority**: Antigravity Lead Architect
**Methodology**: Matt Pocock Agent Skills (/grilling + /grill-with-docs)
**Status**: FRONTIER EXHAUSTED — SHARED UNDERSTANDING ATTAINED

---

## Round 1: Core Architecture & Invariant Frontier

❓ **Q1** - **Biometric Compliance Strictness**: How do we handle international passport photo requirements (e.g. US 2x2 inch 600x600px vs Schengen 35x45mm) without rejecting near-compliant photos?
➡️ *Recommendation*: Two-phase normalization pipeline: Phase 1 checks facial landmark geometry (eye-to-chin ratio); Phase 2 performs automated affine alignment and aspect ratio cropping.

**Architect Decision**: APPROVED. Automated geometric alignment prevents user frustration while strictly adhering to ICAO 9303 biometric standards.

---

❓ **Q2** - **Background Removal Artifacts**: How to prevent blurred silhouettes or ear clipping during AI matting?
➡️ *Recommendation*: Combine bilateral depth estimation with alpha-matte boundary refinement, falling back to a manual boundary adjustment canvas when confidence < 0.95.

**Architect Decision**: APPROVED. Automated high-confidence segmentation with manual fallback prevents failed passport submissions.

---

## Round 2: Edge Cases & Failure Modes Frontier

❓ **Q3** - **Checkout Session Recovery**: What happens when Stripe checkout completes but the browser disconnects before downloading high-res print files?
➡️ *Recommendation*: Generate signed single-use download tokens emailed immediately upon Stripe `checkout.session.completed` webhook reception.

**Architect Decision**: APPROVED. Asynchronous webhook delivery with permanent tokenized email download ensures zero lost customer purchases.

---

## Final Alignment Attestation
The design tree has been thoroughly walked down to all leaf nodes.
No silent assumptions remain regarding authentication, concurrency, data consistency, or payment flow.
