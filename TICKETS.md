# TICKETS — VisaShot Processing Pipeline

## [TICKET-001] Biometric Profile Validator & Landmark Normalizer
- **Blocked by**: None
- **Delivers**: Dimensional and facial ratio checker adhering to ICAO Doc 9303.
- **Verification**: Geometric ratio unit tests with mock facial coordinate vectors.

## [TICKET-002] Checkout Retry & Exponential Backoff Engine
- **Blocked by**: TICKET-001
- **Delivers**: Network failure resilience for Stripe checkout session verification.
- **Verification**: `tests/checkout-retry-exponential-backoff.test.ts`

## [TICKET-003] Printable 4x6 Tiled Sheet Generator
- **Blocked by**: TICKET-002
- **Delivers**: High-DPI canvas compositor generating pharmacy-ready 300 DPI print sheets.
- **Verification**: Canvas rendering output dimensional assertions.
