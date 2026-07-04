import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:3002";

function selects(page: Page) {
  const all = page.locator("select");
  return { source: all.nth(0), target: all.nth(1) };
}

async function setApiKey(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem("translator_api_key", "test-key");
  });
}

test.describe("Personal Translator - UI Elements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // close the settings modal by pressing Escape
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
