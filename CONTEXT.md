# CONTEXT.md — Ubiquitous Domain Language (VisaShot)

## Core Entities
- **ComplianceProfile**: Target country specification (e.g. `US_PASSPORT`, `SCHENGEN_VISA`) defining mm dimensions, head height %, and eye position.
- **BiometricAssessment**: Quantitative evaluation of tilt, lighting uniformity, background neutrality, and eye visibility.
- **AffineNormalizer**: Geometry engine transforming facial coordinates to canonical alignment planes.
- **PrintSheet**: 4x6 inch standard layout containing multiple tiled compliant passport photos.

## Domain Invariants
- Photo must conform to ICAO Doc 9303 biometric passport standards.
- Background must be rendered uniform `#FFFFFF` or `#F0F0F0` according to profile jurisdiction.
- Eye-to-bottom distance must strictly sit within 56% - 69% of image height.

## Forbidden Terminology
- Do not call photos "pictures"; use "BiometricPhoto".
- Do not refer to passport countries as "options"; use "ComplianceProfile".
