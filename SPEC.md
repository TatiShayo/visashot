# SPEC 001: Biometric Photo Processing & Embassy Compliance Engine

## Problem Statement
Travelers getting visa photos taken at pharmacies face high costs and frequent embassy rejections due to strict dimensional and lighting rules.

## Solution
An automated browser-based photo studio that verifies compliance against 80+ international visa profiles, normalizes lighting/background, and generates printable photo sheets.

## User Stories
1. As a traveler, I want to select my target country profile, so that my photo matches embassy rules exactly.
2. As a traveler, I want instant compliance feedback, so that I know if my eyes, tilt, or lighting need adjustment.
3. As a paying user, I want a printable 4x6 inch sheet with 6 compliant photos, so that I can print at any local pharmacy for pennies.

## Implementation Decisions
- Implement compliance validator in `lib/compliance.ts`.
- Exponential retry utility in `lib/retry.ts`.
- Download token dispatcher in `lib/fulfillment.ts`.

## Testing Decisions
- Seam: `tests/checkout-retry-exponential-backoff.test.ts`.
- Verify retry backoff invariants and biometric validation boundaries.
