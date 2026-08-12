import { test, expect } from "@playwright/test";

async function boot(page: import("@playwright/test").Page) {
  // hud=0 hides the perf overlay / file picker / Leva so the golden captures only the canvas content.
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({ stripesEnabled: false });
    (window as any).__lab.renderAt(0);
  });
}

test("field — luminance", async ({ page }) => {
  await boot(page);
  await expect(page.locator("canvas")).toHaveScreenshot("field-luminance.png", { maxDiffPixelRatio: 0.01 });
});

async function bootStripes(page: import("@playwright/test").Page) {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({ stripesEnabled: true });
    (window as any).__lab.renderAt(0);
  });
}

test("stripes — luminance", async ({ page }) => {
  await bootStripes(page);
  await expect(page.locator("canvas")).toHaveScreenshot("stripes-luminance.png", { maxDiffPixelRatio: 0.01 });
});
