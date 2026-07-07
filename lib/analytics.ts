/**
 * PostHog client wrapper — thin, typed, no-PII-in-properties (PLAYBOOK Part 5 /
 * analytics.md). Without NEXT_PUBLIC_POSTHOG_KEY this degrades to a console-log
 * no-op so the funnel instrumentation code path still runs in dev.
 *
 * Every event name here must have a matching row in analytics.md.
 */

"use client";

import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    initialized = true; // no-op mode
    return;
  }
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    mask_all_text: false,
  });
  initialized = true;
}

export type AnalyticsEvent =
  | { name: "spec_selected"; props: { spec_id: string; country_code: string; doc_type: string; source: "home" | "seo_page" | "picker" } }
  | { name: "photo_uploaded"; props: { spec_id: string; file_bytes: number; capture: "camera" | "file" } }
  | { name: "face_detected"; props: { spec_id: string; ok: boolean; hint: "move_closer" | "face_straight" | "none" } }
  | { name: "processing_started"; props: { spec_id: string } }
  | { name: "processing_succeeded"; props: { spec_id: string; duration_ms: number; mock_background: boolean } }
  | { name: "processing_failed"; props: { spec_id: string; stage: "upload" | "bg_removal" | "compose" | "crop"; reason: string } }
  | { name: "compliance_checked"; props: { spec_id: string; passed: boolean; fail_checks: string[]; warn_checks: string[] } }
  | { name: "preview_viewed"; props: { spec_id: string; passed: boolean } }
  | { name: "checkout_started"; props: { spec_id: string; addon_spec_ids: string[]; bump_selected: boolean } }
  | { name: "purchase_completed"; props: { spec_id: string; revenue_usd: number; addon_count: number; bump_selected: boolean } }
  | { name: "addon_attached"; props: { spec_id: string; addon_spec_id: string } }
  | { name: "download_completed"; props: { spec_id: string; kind: string } }
  | { name: "reprocess_requested"; props: { spec_id: string; paid: boolean; run_number: number } }
  | { name: "family_prompt_clicked"; props: { spec_id: string } };

export function track<E extends AnalyticsEvent>(name: E["name"], props: E["props"]): void {
  if (typeof window === "undefined") return;
  initAnalytics();
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[analytics:mock] ${name}`, props);
    }
    return;
  }
  posthog.capture(name, props as Record<string, unknown>);
}

export function identifyEmail(email: string): void {
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.identify(email);
}
