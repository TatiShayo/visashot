import { test, expect } from "@playwright/test";
import { uploadAndProcess, goToCheckoutAndPay } from "./helpers";

/**
 * End-to-end happy path (BUILD_PROMPT Definition of Done):
 * pick "Schengen visa" -> upload a portrait -> auto-processed (mock
 * bg-removal) -> compliance checklist all-green -> pay (mock) -> order page
 * shows all four downloads.
 */
test("Schengen visa: upload -> compliant -> mock-pay -> downloads", async ({ page }) => {
  await uploadAndProcess(page);

  // Checklist rendered with only pass/warn statuses (never a blocking fail —
  // our deterministic fake-face landmarks are constructed to pass every
  // geometry check; clothing/background checks are warn-only by design).
  const failIcons = page.locator('li:has-text("✕")');
  await expect(failIcons).toHaveCount(0);

  await goToCheckoutAndPay(page);

  // All four deliverables listed with working download links.
  for (const kind of ["photo", "hires", "sheet-4x6", "sheet-a4"]) {
    const row = page.locator(`[data-download-kind="${kind}"]`);
    await expect(row).toBeVisible();
    const href = await row.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href).toContain(`/api/download/`);
    expect(href).toContain(`kind=${kind}`);
  }

  await expect(page.getByText(/sent to e2e@visashot\.test/)).toBeVisible();
});

test("empty state: /create with no spec shows the picker, not a crash", async ({ page }) => {
  await page.goto("/create");
  await expect(page.getByRole("heading", { name: "Which photo do you need?" })).toBeVisible();
});

test("404: an unknown route renders the designed not-found page", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("This page isn't on file")).toBeVisible();
});
