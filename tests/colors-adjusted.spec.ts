import { test, expect } from "@playwright/test";

// Pins the GPU adjusted-domain normalization: with non-identity adjustments the max
// color distance is computed over the ADJUSTED field, so it diverges from a raw-pixel max.
test("colors mode — normalization tracks non-identity adjustments", async ({ page }) => {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({
      stripesEnabled: true,
      colors: { mode: "colors", autoDetectBackground: true },
      adjustments: { gamma: 0.5, contrast: 1.5 },
    });
    (window as any).__lab.renderAt(0);
  });
  await expect(page.locator("canvas")).toHaveScreenshot("colors-adjusted.png", { maxDiffPixelRatio: 0.01 });
});
