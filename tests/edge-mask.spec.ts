import { test, expect } from "@playwright/test";

const edgeMask = { enabled: true, start: 0.05, end: 0.25, power: 1.5 };

test("edge mask — field", async ({ page }) => {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate((edgeMask) => {
    (window as any).__lab.setConfig({ stripesEnabled: false, edgeMask });
    (window as any).__lab.renderAt(0);
  }, edgeMask);
  await expect(page.locator("canvas")).toHaveScreenshot("edge-mask-field.png", { maxDiffPixelRatio: 0.01 });
});

test("edge mask — stripes", async ({ page }) => {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate((edgeMask) => {
    (window as any).__lab.setConfig({ stripesEnabled: true, edgeMask });
    (window as any).__lab.renderAt(0);
  }, edgeMask);
  await expect(page.locator("canvas")).toHaveScreenshot("edge-mask-stripes.png", { maxDiffPixelRatio: 0.01 });
});
