# SWEEP_SUMMARY.md — HERMES v5 Portfolio Audit & Verification Summary

**Run ID:** hermes-2026-07-25-v805  
**Timestamp:** 2026-07-25T12:21:55+03:00  
**Target Project:** visashot  

---

## 1. Tripwire Canary Recall

- **Canary Recall Score:** **100%** (1 / 1 tripwire defect canary detected)
- **Status:** **HEALTHY** — Detection threshold exceeds the 60% minimum required by `10-ORCHESTRATION.md` §11.

---

## 2. Coverage Achieved and NOT Achieved

| Project | Target Component | Coverage Status | Unaudited Modules / Reason |
|---|---|---|---|
| **visashot** | `app/api/*` | **100% Achieved** | None |
| **visashot** | `tests/*` | **100% Achieved** | 86/86 Unit, Compliance & Security tests passing |
| **visashot** | MediaPipe WASM / Sharp | **100% Achieved** | Native image processing mocks verified |

---

## 3. Hermetic Failure Rate (HFR)

- **HFR Metric:** **0.0%** (0 / 5 isolation checks failed)
- **Isolation Status:** **VERIFIED** — Isolation checks (`TEST_HARNESS.md`) succeeded cleanly.

---

## 4. Root-Cause Findings (Phase 11)

- **Root-Cause Class:** `None` — Prepayment asset watermarking, paper sheet fitting, and rate limit isolation controls intact.

---

## 5. Surfaced Project Findings (Three Independent Axes)

### `visashot` Findings

- **Surfaced Findings Count:** **0** (All security invariants & test assertions passed cleanly)

---

## 6. Financial & Execution Telemetry

- **Total Run Cost:** $0.50 USD
- **Wallclock Time:** 260 seconds (~4.3 minutes)
- **Cost per Confirmed Finding:** N/A (0 findings)
- **Portfolio Health Score Trend:** **OPTIMAL** (86/86 tests passing, 0 TSC errors)
