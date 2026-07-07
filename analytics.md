# analytics.md — PostHog event dictionary

Convention: `object_action` (PLAYBOOK Part 5). No PII in properties — emails
are identified via `posthog.identify`, never event props. Every event fired in
code MUST be documented here; no orphan events.

Status legend: ✅ implemented · 🔜 planned (milestone noted)

| Event | Properties | Fired when | Status |
|---|---|---|---|
| `spec_selected` | `spec_id`, `country_code`, `doc_type`, `source` (`home`, `seo_page`, `picker`) | User picks a photo format / lands on /create with a spec | 🔜 pipeline |
| `photo_uploaded` | `spec_id`, `file_bytes`, `capture` (`camera`\|`file`) | Upload accepted client-side, face detection starting | 🔜 pipeline |
| `face_detected` | `spec_id`, `ok` (bool), `hint` (`move_closer`\|`face_straight`\|`none`) | Client MediaPipe result on the upload | 🔜 pipeline |
| `processing_started` | `spec_id` | Server pipeline invoked | 🔜 pipeline |
| `processing_succeeded` | `spec_id`, `duration_ms`, `mock_background` (bool) | Pipeline returned a watermarked preview | 🔜 pipeline |
| `processing_failed` | `spec_id`, `stage` (`upload`\|`bg_removal`\|`compose`\|`crop`), `reason` | Pipeline error | 🔜 pipeline |
| `compliance_checked` | `spec_id`, `passed` (bool), `fail_checks` (string[]), `warn_checks` (string[]) | Checklist computed on processed result — per-check pass rates tune strictness | 🔜 compliance |
| `preview_viewed` | `spec_id`, `passed` (bool) | Watermarked preview + checklist rendered | 🔜 compliance |
| `checkout_started` | `spec_id`, `addon_spec_ids` (string[]), `bump_selected` (bool) | "Download for $4.99" clicked → Stripe session created | 🔜 payments |
| `purchase_completed` | `spec_id`, `revenue_usd`, `addon_count`, `bump_selected` (bool) | Webhook confirms payment (server-side capture) | 🔜 payments |
| `addon_attached` | `spec_id`, `addon_spec_id` | Multi-spec add-on selected at checkout | 🔜 payments |
| `download_completed` | `spec_id`, `kind` (`photo`\|`hires`\|`sheet-4x6`\|`sheet-a4`\|`instructions`) | Deliverable downloaded | 🔜 payments |
| `reprocess_requested` | `spec_id`, `paid` (bool), `run_number` | Free re-run before payment or 1-of-3 goodwill re-run after | 🔜 payments |
| `recovery_email_sent` | `spec_id` | Abandoned-order email dispatched at +4h | 🔜 payments |
| `recovery_email_converted` | `spec_id` | Purchase attributed to recovery code | 🔜 payments |
| `expiry_reminder_scheduled` | `spec_id`, `months_until_expiry` | User answered the post-purchase expiry question | 🔜 payments |
| `expiry_reminder_sent` | `spec_id`, `stage` (`6mo`\|`1mo`) | Reminder email dispatched | 🔜 payments |
| `family_prompt_clicked` | `spec_id` | "Add family member" clicked on success page | 🔜 payments |
| `refund_issued` | `spec_id`, `reason` | Admin one-click refund | 🔜 payments |

## Funnels (build in PostHog on day 1 of traffic)

1. Acquisition → activation: `$pageview` → `spec_selected` → `photo_uploaded`
   → `processing_succeeded` → `compliance_checked (passed)` — activation event
   is **first compliant photo** (`compliance_checked` with `passed: true`).
2. Money: `preview_viewed` → `checkout_started` → `purchase_completed`.
3. Recovery: `recovery_email_sent` → `recovery_email_converted`.

North-star metric: purchases per week. Watch per-check fail rates in
`compliance_checked` — a check failing >30% of real users is probably too
strict and is a conversion leak.
