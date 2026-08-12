import { test, expect } from "@playwright/test";

const clickWave = { enabled: true };

async function runClickWave(page: any) {
  await page.evaluate((clickWave: { enabled: boolean }) => {
    const lab = (window as any).__lab;
    lab.setConfig({ clickWave });
    lab.clickAt(200, 150);
    for (let t = 0; t <= 300; t += 16) {
      lab.renderAt(t);
    }
  }, clickWave);
}

test("click wave — field", async ({ page }) => {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({ stripesEnabled: false });
  });
  await runClickWave(page);
  await expect(page.locator("canvas")).toHaveScreenshot("click-wave-field.png", { maxDiffPixelRatio: 0.01 });
});

test("click wave — stripes", async ({ page }) => {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({ stripesEnabled: true });
  });
  await runClickWave(page);
  await expect(page.locator("canvas")).toHaveScreenshot("click-wave-stripes.png", { maxDiffPixelRatio: 0.01 });
});
