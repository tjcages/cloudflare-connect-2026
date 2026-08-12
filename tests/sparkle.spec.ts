import { test, expect } from "@playwright/test";

test("sparkle gaps — mid", async ({ page }) => {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({
      stripesEnabled: true,
      sparkle: {
        gaps: { enabled: true, coverage: 0.5, speed: 1 },
        width: { enabled: false, coverage: 0.3, speed: 1, swingPx: 1.25 },
      },
    });
    (window as any).__lab.renderAt(1000);
  });
  await expect(page.locator("canvas")).toHaveScreenshot("sparkle-gaps.png", { maxDiffPixelRatio: 0.01 });
});

test("sparkle width — mid", async ({ page }) => {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({
      stripesEnabled: true,
      sparkle: {
        gaps: { enabled: false, coverage: 0.22, speed: 1 },
        width: { enabled: true, coverage: 0.6, speed: 1, swingPx: 6 },
      },
    });
    (window as any).__lab.renderAt(1000);
  });
  await expect(page.locator("canvas")).toHaveScreenshot("sparkle-width.png", { maxDiffPixelRatio: 0.01 });
});
