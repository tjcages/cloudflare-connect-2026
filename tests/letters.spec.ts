import { test, expect } from "@playwright/test";

test("letters — stripes", async ({ page }) => {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({
      stripesEnabled: true,
      letters: { enabled: true, coverage: 0.5 },
    });
    (window as any).__lab.renderAt(1000);
  });
  await expect(page.locator("canvas")).toHaveScreenshot("letters-stripes.png", { maxDiffPixelRatio: 0.01 });
});
