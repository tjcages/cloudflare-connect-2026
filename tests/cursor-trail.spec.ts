import { test, expect } from "@playwright/test";

const cursorTrail = {
  enabled: true,
  pushStrengthPx: 30,
};

const PATH: Array<[number, number]> = [
  [40, 60],
  [70, 80],
  [100, 110],
  [135, 130],
  [170, 145],
  [210, 150],
  [250, 148],
  [290, 140],
  [330, 125],
  [360, 105],
];

async function runPath(page: any) {
  await page.evaluate(
    ({ path, cursorTrail }: { path: Array<[number, number]>; cursorTrail: typeof cursorTrail }) => {
      const lab = (window as any).__lab;
      lab.setConfig({ cursorTrail });
      let t = 0;
      for (const [x, y] of path) {
        t += 16;
        lab.cursorTo(x, y);
        lab.renderAt(t);
      }
    },
    { path: PATH, cursorTrail },
  );
}

test("cursor trail — field", async ({ page }) => {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({ stripesEnabled: false });
  });
  await runPath(page);
  await expect(page.locator("canvas")).toHaveScreenshot("cursor-trail-field.png", { maxDiffPixelRatio: 0.01 });
});

test("cursor trail — stripes", async ({ page }) => {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => {
    (window as any).__lab.setConfig({ stripesEnabled: true });
  });
  await runPath(page);
  await expect(page.locator("canvas")).toHaveScreenshot("cursor-trail-stripes.png", { maxDiffPixelRatio: 0.01 });
});
