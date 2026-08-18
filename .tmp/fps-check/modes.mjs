import { chromium } from "playwright";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5180/playground";

const scenarios = [
  { name: "stripes", patch: {} },
  { name: "overlay", patch: { textureLuminance: { mode: "overlay" } } },
  { name: "colors", patch: { textureLuminance: { mode: "colors" } } },
  {
    name: "flames",
    patch: { flames: { enabled: true, intensity: 0.8, speed: 1, scale: 1, threshold: 0.35 } },
  },
];

const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--window-position=100,100", "--window-size=1400,900"],
});

for (const sc of scenarios) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(async (patch) => {
    const p = await import("/src/playground/playgroundPersistence.ts");
    const cfg = p.defaultConfigForTexture("shader");
    cfg.displayWidth = 1696;
    cfg.displayHeight = 960;
    delete cfg.shaderSource;
    Object.assign(cfg, patch);
    p.savePersistedConfig("shader", cfg);
    p.saveLastTextureId("shader");
  }, sc.patch);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        function loop() {
          frames++;
          const elapsed = performance.now() - start;
          if (elapsed < 3000) requestAnimationFrame(loop);
          else resolve(+(frames / (elapsed / 1000)).toFixed(1));
        }
        requestAnimationFrame(loop);
      }),
  );
  await page.locator("canvas").first().screenshot({ path: `mode-${sc.name}.png` });
  console.log(`${sc.name}: ${fps} fps`);
  await context.close();
}
await browser.close();
