import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:3002";

function selects(page: Page) {
  const all = page.locator("select");
  return { source: all.nth(0), target: all.nth(1) };
}

async function setApiKey(page: Page, key: string = "test-key") {
  await page.evaluate((k) => {
    localStorage.setItem("translator_api_key", k);
  }, key);
}

async function clearApiKey(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem("translator_api_key");
  });
}

test.describe("Personal Translator - UI Elements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.keyboard.press("Escape");
  });

  test("page loads with correct title", async ({ page }) => {
    await expect(page.getByText("Personal Translator")).toBeVisible();
  });

  test("language dropdowns are present and functional", async ({ page }) => {
    const { source, target } = selects(page);
    await expect(source).toBeVisible();
    await expect(target).toBeVisible();
    await source.selectOption("hi-IN");
    expect(await source.inputValue()).toBe("hi-IN");
    await target.selectOption("pa-IN");
    expect(await target.inputValue()).toBe("pa-IN");
  });

  test("start recording button exists in idle state", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /start recording/i })
    ).toBeVisible();
  });
});

test.describe("Personal Translator - Settings Modal", () => {
  test("settings modal opens on first run and can save a key", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByText("Sarvam API Key", { exact: true })).toBeVisible();
    await page.fill('input[type="password"]', "sk_test_key");
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForTimeout(200);
    await expect(page.getByText("Sarvam API Key", { exact: true })).not.toBeVisible();
  });

  test("saved API key persists when reopening settings modal", async ({ page }) => {
    await page.goto(BASE_URL);
    // Save a key
    await page.fill('input[type="password"]', "sk_persist_key");
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForTimeout(200);
    await expect(page.getByText("Sarvam API Key", { exact: true })).not.toBeVisible();

    // Reopen settings via gear icon
    await page.getByRole("button", { name: /settings/i }).click();
    await page.waitForTimeout(300);
    // Input should be populated with the saved key
    await expect(page.locator('input[type="password"]')).toHaveValue("sk_persist_key");
    // Warning banner (shown only when no key) should NOT be visible
    await expect(page.getByText(/A Sarvam API key is required/i)).not.toBeVisible();
    // Clear button should be visible (only when a key is saved)
    await expect(page.getByRole("button", { name: /clear/i })).toBeVisible();
  });

  test("API key can be cleared", async ({ page }) => {
    // First save a key
    await page.goto(BASE_URL);
    await page.fill('input[type="password"]', "sk_to_clear");
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForTimeout(200);

    // Reopen and clear
    await page.getByRole("button", { name: /settings/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /clear/i }).click();
    await page.waitForTimeout(200);
    // Input should be empty after clear
    await expect(page.locator('input[type="password"]')).toHaveValue("");
    // Warning banner should reappear
    await expect(page.getByText(/A Sarvam API key is required/i)).toBeVisible({ timeout: 3000 });
  });

  test("empty key does not save", async ({ page }) => {
    await page.goto(BASE_URL);
    // Save button should be disabled when input is empty
    const saveBtn = page.getByRole("button", { name: /save/i });
    await expect(saveBtn).toBeDisabled();

    // Type whitespace only
    await page.fill('input[type="password"]', "   ");
    await expect(saveBtn).toBeDisabled();

    // Type a real key, verify button enables
    await page.fill('input[type="password"]', "sk_real_key");
    await expect(saveBtn).toBeEnabled();
  });
});

test.describe("Personal Translator - Error Handling", () => {
  test("shows error when starting recording without API key", async ({ page }) => {
    await page.goto(BASE_URL);
    await clearApiKey(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
    // Close the settings modal by clicking the close (X) button
    const closeBtn = page.locator(".fixed button").first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }

    await page.getByRole("button", { name: /start recording/i }).click();
    await expect(page.getByText(/No API key configured/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows error banner when invalid API key is used", async ({ page }) => {
    await page.goto(BASE_URL);
    await setApiKey(page, "sk_invalid_key");
    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /start recording/i }).click();
    await expect(page.getByRole("button", { name: /stop recording/i })).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /stop recording/i }).click();

    await page.waitForTimeout(8000);
    const errorBanner = page.locator("text=Your API key is invalid");
    await expect(errorBanner).toBeVisible({ timeout: 15000 });
  });

  test("error banner has a dismiss button", async ({ page }) => {
    await page.goto(BASE_URL);
    await clearApiKey(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
    // Close the settings modal
    const closeBtn = page.locator(".fixed button").first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }

    await page.getByRole("button", { name: /start recording/i }).click();
    await page.waitForTimeout(500);
    const dismissBtn = page.getByRole("button", { name: /dismiss/i });
    await expect(dismissBtn).toBeVisible({ timeout: 5000 });
    await dismissBtn.click();
    await expect(dismissBtn).not.toBeVisible();
  });
});

test.describe("Personal Translator - Recording Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await setApiKey(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test("clicking start recording changes state", async ({ page }) => {
    await page.getByRole("button", { name: /start recording/i }).click();
    await expect(
      page.getByRole("button", { name: /stop recording/i })
    ).toBeVisible();
    await expect(page.getByText("Recording... speak now")).toBeVisible();
  });

  test("language selection persists through recording", async ({ page }) => {
    const { source, target } = selects(page);
    await source.selectOption("pa-IN");
    await target.selectOption("hi-IN");
    await page.getByRole("button", { name: /start recording/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /stop recording/i }).click();
    await page.waitForTimeout(200);
    expect(await source.inputValue()).toBe("pa-IN");
    expect(await target.inputValue()).toBe("hi-IN");
  });
});

test.describe("Personal Translator - Pipeline End-to-End", () => {
  test("capture → translate completes without crash", async ({ page }) => {
    await page.goto(BASE_URL);
    await setApiKey(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /start recording/i }).click();
    await expect(
      page.getByRole("button", { name: /stop recording/i })
    ).toBeVisible();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /stop recording/i }).click();
    await page.waitForTimeout(10000);
    const startBtn = page.getByRole("button", { name: /start recording/i });
    await expect(
      startBtn.or(page.getByRole("button", { name: /translating/i }))
    ).toBeVisible();
  });
});
