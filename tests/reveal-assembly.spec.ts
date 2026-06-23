import { test, expect } from "@playwright/test";

test("reveal assembly — mid", async ({ page }) => {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({
      reveal: { enabled: true, type: "assembly", assembly: { order: "center" } },
      stripesEnabled: true,
    });
    (window as any).__lab.renderAt(1250);
  });
  await expect(page.locator("canvas")).toHaveScreenshot("reveal-assembly-mid.png", { maxDiffPixelRatio: 0.01 });
});
