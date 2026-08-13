import { test, expect } from "@playwright/test";

test("lab SVG export — exportSvg returns structured svg", async ({ page }) => {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({
      stripesEnabled: true,
      colors: { mode: "colors", autoDetectBackground: true },
    });
    (window as any).__lab.renderAt(0);
  });
  const svg = await page.evaluate(() => (window as any).__lab.exportSvg());
  expect(svg.startsWith("<svg")).toBe(true);
  expect(svg.includes("<path")).toBe(true);
});

test("lab EPS export — exportEps converts the SVG artboard", async ({ page }) => {
  await page.goto("/lab.html?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({
      stripesEnabled: true,
      colors: { mode: "colors", autoDetectBackground: true },
    });
    (window as any).__lab.renderAt(0);
  });
  const eps = await page.evaluate(() => (window as any).__lab.exportEps());
  expect(eps.startsWith("%!PS-Adobe-3.0 EPSF-3.0")).toBe(true);
  expect(eps.includes("%%BoundingBox:")).toBe(true);
  expect(eps.includes("moveto")).toBe(true);
  expect(eps.includes("showpage")).toBe(true);
});
