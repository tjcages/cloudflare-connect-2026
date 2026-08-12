import { test, expect } from "@playwright/test";

test("colors mode — click wave warps colored stripes", async ({ page }) => {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    const lab = (window as any).__lab;
    lab.setConfig({
      stripesEnabled: true,
      clickWave: { enabled: true },
      colors: { mode: "colors", autoDetectBackground: true },
    });
    lab.clickAt(200, 150);
    for (let t = 0; t <= 300; t += 16) lab.renderAt(t);
  });
  await expect(page.locator("canvas")).toHaveScreenshot("colors-click.png", { maxDiffPixelRatio: 0.01 });
});
