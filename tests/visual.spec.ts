import { test, expect } from "@playwright/test";

async function boot(page: import("@playwright/test").Page, mode: "luminance" | "overlay") {
  // hud=0 hides the perf overlay / file picker / Leva so the golden captures only the canvas content.
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate((m) => {
    (window as any).__lab.setConfig({ field: { mode: m }, stripesEnabled: false });
    (window as any).__lab.renderAt(0);
  }, mode);
}

test("field — luminance", async ({ page }) => {
  await boot(page, "luminance");
  await expect(page.locator("canvas")).toHaveScreenshot("field-luminance.png", { maxDiffPixelRatio: 0.01 });
});

test("field — overlay", async ({ page }) => {
  await boot(page, "overlay");
  await expect(page.locator("canvas")).toHaveScreenshot("field-overlay.png", { maxDiffPixelRatio: 0.01 });
});

async function bootStripes(page: import("@playwright/test").Page, mode: "luminance" | "overlay") {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate((m) => {
    (window as any).__lab.setConfig({ field: { mode: m }, stripesEnabled: true });
    (window as any).__lab.renderAt(0);
  }, mode);
}

test("stripes — luminance", async ({ page }) => {
  await bootStripes(page, "luminance");
  await expect(page.locator("canvas")).toHaveScreenshot("stripes-luminance.png", { maxDiffPixelRatio: 0.01 });
});

test("stripes — overlay", async ({ page }) => {
  await bootStripes(page, "overlay");
  await expect(page.locator("canvas")).toHaveScreenshot("stripes-overlay.png", { maxDiffPixelRatio: 0.01 });
});
