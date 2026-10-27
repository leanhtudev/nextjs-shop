import { expect, test } from "@playwright/test";

/**
 * The critical user journey: product → cart → checkout (Server Action) → order confirmation.
 * Writes data (creates an order, lowers stock), so it runs in CI against a throwaway server, never in production.
 */
test.describe("purchase flow", () => {
  test("buy a product end to end", async ({ page }) => {
    // 1. Product page (ISR) + add to cart (tRPC mutation)
    await page.goto("/products/3");
    await expect(page.getByRole("heading", { level: 1, name: "Refurbished Phone Gamma 64 GB" })).toBeVisible();
    await page.getByLabel("Quantity").fill("2");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added.")).toBeVisible();

    // 2. Cart (SSR, hydrated React Query cache)
    await page.getByRole("link", { name: "View cart" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    const row = page.getByRole("row", { name: /Refurbished Phone Gamma 64 GB/ });
    await expect(row).toBeVisible();
    await expect(row.locator('[aria-live="polite"]')).toHaveText("2");

    // 3. Checkout: server-side validation errors come back from the Server Action
    await page.getByRole("link", { name: "Go to checkout" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "2 x Refurbished Phone Gamma 64 GB" })).toBeVisible();

    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page.getByText("Please fix the highlighted fields.")).toBeVisible();
    await expect(page.getByText("Postal code must be 5 digits")).toBeVisible();

    // 4. Valid submit → redirect to the order page
    await page.getByLabel("Full name").fill("Test Buyer");
    await page.getByLabel("Email").fill("buyer@example.com");
    await page.getByLabel("Street address").fill("Testikatu 1 A");
    await page.getByLabel("Postal code").fill("02100");
    await page.getByLabel("City").fill("Espoo");
    await page.getByLabel("Country").selectOption("FI");
    await page.getByRole("button", { name: /Place order/ }).click();

    await expect(page).toHaveURL(/\/orders\/ord_[0-9a-f]{12}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Thank you, order confirmed" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "2 x Refurbished Phone Gamma 64 GB" })).toBeVisible();

    // 5. The cart was cleared after the order
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });

  test("an order is private to the browser that placed it", async ({ page, browser }) => {
    await page.goto("/products/1");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added.")).toBeVisible();
    await page.goto("/checkout");
    await page.getByLabel("Full name").fill("Owner Buyer");
    await page.getByLabel("Email").fill("owner@example.com");
    await page.getByLabel("Street address").fill("Omistajantie 2");
    await page.getByLabel("Postal code").fill("00100");
    await page.getByLabel("City").fill("Helsinki");
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page).toHaveURL(/\/orders\/ord_[0-9a-f]{12}$/);
    const orderUrl = page.url();

    // A different browser (no shop_orders cookie) must not see it: 404, not 403, so ids can't be probed.
    const stranger = await browser.newContext();
    const strangerPage = await stranger.newPage();
    const res = await strangerPage.goto(orderUrl);
    expect(res?.status()).toBe(404);
    await stranger.close();
  });

  test("empty cart cannot reach checkout", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });
});
