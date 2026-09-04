# ADR 0001: Biometric Normalization and Asynchronous Fulfillment

## Context
VisaShot delivers official government visa photos. Rejections at embassy interviews cause significant user distress.

## Decision
1. **ICAO 9303 Geometry Standards**: Facial landmarks strictly evaluated against jurisdictional aspect ratios.
2. **Deterministic Background Matting**: Pure white/off-white replacement with alpha edge feathering.
3. **Webhook Fulfillment**: Download tokens generated and emailed asynchronously on verified Stripe payments.

## Consequences
- **Positive**: Near 100% embassy acceptance rates and bulletproof purchase recovery.
- **Negative**: Higher compute cost for serverless facial landmarking models.
