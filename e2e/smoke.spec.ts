import { expect, test } from "@playwright/test";

/**
 * Smoke tests: fast, read-only, safe to run against any environment.
 * CD runs ONLY this file against the deployed URL (tagged @smoke), because the purchase flow writes data.
 */
test.describe("@smoke", () => {
  test("health endpoint reports ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
    // After a deploy, CD passes the git SHA it just shipped and checks it is the one serving traffic.
    if (process.env.EXPECTED_VERSION) expect(body.version).toBe(process.env.EXPECTED_VERSION);
  });

  test("home page renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Refurb Shop" })).toBeVisible();
  });

  test("product list shows products with prices", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
    await expect(page.locator("article.card")).not.toHaveCount(0);
    await expect(page.getByRole("link", { name: "Refurbished Phone Alpha 128 GB" })).toBeVisible();
  });

  test("unknown product returns 404", async ({ page }) => {
    const res = await page.goto("/products/does-not-exist");
    expect(res?.status()).toBe(404);
  });
});
