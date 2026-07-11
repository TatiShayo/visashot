import path from "node:path";
import type { Page, Response } from "@playwright/test";
import { expect } from "@playwright/test";

// Playwright transpiles spec/helper .ts files to CommonJS (no "type": "module"
// in package.json), so the plain CJS `__dirname` global is available here —
// unlike tests/fixtures/generate-portrait.mjs, which is always real ESM.
export const PORTRAIT_FIXTURE = path.join(__dirname, "..", "tests", "fixtures", "portrait.jpg");
export const SPEC_ID = "schengen-visa";

/**
 * Drives the app from the spec-picked /create page through a processed,
 * all-green compliance result. Face detection is deterministic in this run
 * (NEXT_PUBLIC_E2E_FAKE_FACE=true, set in playwright.config.ts's webServer
 * env) — see lib/face-detect.ts's fakeGoodDetection().
 *
 * Returns the /api/process response so callers can assert on its exact JSON
 * shape (e.g. that no clean-asset field ever leaks pre-payment).
 */
export async function uploadAndProcess(page: Page): Promise<Response> {
  await page.goto(`/create?spec=${SPEC_ID}`);

  // Consent gate.
  await page.getByLabel(/I consent to my photo being processed/).check();
  await page.getByRole("button", { name: "Continue" }).click();

  // Upload the fixture via the non-camera file input.
  const fileInput = page.locator('input[type="file"]:not([capture])');
  await fileInput.setInputFiles(PORTRAIT_FIXTURE);

  // Fake detection resolves near-instantly; wait for the button to enable.
  const processButton = page.getByRole("button", { name: "Process my photo" });
  await expect(processButton).toBeEnabled({ timeout: 10_000 });

  const [processResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/process") && r.request().method() === "POST"),
    processButton.click(),
  ]);

  // Compliance sequence finishes with the embossed "Compliant" seal.
  await expect(page.getByText("Compliant", { exact: true })).toBeVisible({ timeout: 10_000 });

  return processResponse;
}

/** Extracts an orderId (nanoid-shaped) from a /checkout/[orderId] or /order/[orderId] URL. */
export function orderIdFromUrl(url: string): string {
  const match = url.match(/\/(?:checkout|order)\/([^/?#]+)/);
  if (!match) throw new Error(`Could not extract orderId from URL: ${url}`);
  return match[1];
}

/** Completes checkout (email + consent + pay) starting from the create-page result stage. */
export async function goToCheckoutAndPay(page: Page, email = "e2e@visashot.test"): Promise<void> {
  await page.getByRole("link", { name: /Continue/ }).click();
  await expect(page).toHaveURL(/\/checkout\//);

  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByLabel(/I consent to my photo being processed to generate my document photo\(s\)/).check();

  await page.getByRole("button", { name: /Pay \$/ }).click();
  await expect(page).toHaveURL(/\/mock-pay\?order=/, { timeout: 10_000 });

  await page.getByRole("button", { name: "Confirm mock payment" }).click();
  await expect(page).toHaveURL(/\/order\//, { timeout: 10_000 });
  await expect(page.getByText("Payment confirmed")).toBeVisible();
}
