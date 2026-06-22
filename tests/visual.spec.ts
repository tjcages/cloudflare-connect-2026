import { test, expect } from "@playwright/test";

test("field renders deterministically at a fixed seed/clock/dpr", async ({ page }) => {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => (window as any).__lab.renderAt(0));
  const canvas = page.locator("canvas");
  // Built-in screenshot comparison; first run writes the golden, later runs diff it.
  await expect(canvas).toHaveScreenshot("field-seed1-t0.png", { maxDiffPixelRatio: 0.01 });
});
