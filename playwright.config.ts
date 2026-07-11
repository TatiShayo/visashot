import { defineConfig, devices } from "@playwright/test";

const PORT = 3177;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Playwright e2e config.
 *
 * The dev server runs on a fixed, uncommon port (3177) so it never collides
 * with a `next dev` instance a developer might already have running on 3000.
 *
 * NEXT_PUBLIC_E2E_FAKE_FACE=true makes lib/face-detect.ts skip the real
 * MediaPipe model (CDN + real-face dependent — unreliable in CI/sandboxes)
 * and return a deterministic "good" detection, so these specs exercise the
 * REAL app logic downstream of face detection: upload -> pipeline (mock
 * bg-removal) -> compliance -> watermark -> checkout -> mock-pay -> delivery.
 *
 * RECOVERY_EMAILS_ENABLED is left unset (default off) and no provider keys
 * are set, so every provider (bg-removal, payments, email, storage) runs on
 * its typed mock — exactly the "never stall on missing keys" contract the
 * rest of the app already relies on.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // Generous: a cold `next dev` first-compile (no warm .next/cache) can
    // take well over 60s in this environment; observed ~25s once warm.
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_E2E_FAKE_FACE: "true",
      NEXT_PUBLIC_APP_URL: BASE_URL,
      // Explicitly unset so every provider stays on its typed mock.
      STRIPE_SECRET_KEY: "",
      REPLICATE_API_TOKEN: "",
      RESEND_API_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      SENTRY_DSN: "",
    },
  },
});
