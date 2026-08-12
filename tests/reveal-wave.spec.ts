import { test, expect } from "@playwright/test";

test("reveal wave — mid", async ({ page }) => {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({ reveal: { enabled: true, type: "wave" }, stripesEnabled: true });
    (window as any).__lab.renderAt(650);
  });
  await expect(page.locator("canvas")).toHaveScreenshot("reveal-wave-mid.png", { maxDiffPixelRatio: 0.01 });
});

test("reveal wave — field only (stripes off)", async ({ page }) => {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({ reveal: { enabled: true, type: "wave" }, stripesEnabled: false });
    (window as any).__lab.renderAt(650);
  });
  await expect(page.locator("canvas")).toHaveScreenshot("reveal-wave-fieldonly.png", { maxDiffPixelRatio: 0.01 });
});
