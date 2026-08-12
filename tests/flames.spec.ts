import { test, expect } from "@playwright/test";

const flamesConfig = {
  enabled: true,
  direction: "up" as const,
  minWidthRatio: 0.0223,
  maxWidthRatio: 0.0453,
  minHeightRatio: 0.0245,
  maxHeightRatio: 0.08,
  baseSpeedPxPerSec: 40,
  speedVariation: 1,
  spawnIntervalMs: 50,
  spawnJitterMs: 80,
  maxActive: 48,
  edgeSharpness: 1,
  opacityMin: 0.3,
  opacityMax: 1,
};

test("flames — field", async ({ page }) => {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate((flames) => {
    (window as any).__lab.setConfig({ stripesEnabled: false, flames });
    (window as any).__lab.renderAt(1000);
  }, flamesConfig);
  await expect(page.locator("canvas")).toHaveScreenshot("flames-field.png", { maxDiffPixelRatio: 0.01 });
});

test("flames — stripes", async ({ page }) => {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate((flames) => {
    (window as any).__lab.setConfig({ stripesEnabled: true, flames });
    (window as any).__lab.renderAt(1000);
  }, flamesConfig);
  await expect(page.locator("canvas")).toHaveScreenshot("flames-stripes.png", { maxDiffPixelRatio: 0.01 });
});
