import { chromium } from "playwright";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5180/playground";

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });

for (const scale of [2, 1]) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(
    async ({ scale }) => {
      const p = await import("/src/playground/playgroundPersistence.ts");
      const cfg = p.defaultConfigForTexture("shader");
      cfg.displayWidth = 1696;
      cfg.displayHeight = 960;
      cfg.renderScale = scale;
      delete cfg.shaderSource;
      p.savePersistedConfig("shader", cfg);
      p.saveLastTextureId("shader");
    },
    { scale },
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const info = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const canvas = document.querySelector("canvas[data-testid='playground-texture-canvas']");
        let frames = 0;
        const start = performance.now();
        function loop() {
          frames++;
          const elapsed = performance.now() - start;
          if (elapsed < 3000) requestAnimationFrame(loop);
          else
            resolve({
              fps: +(frames / (elapsed / 1000)).toFixed(1),
              backing: canvas ? `${canvas.width}x${canvas.height}` : "none",
            });
        }
        requestAnimationFrame(loop);
      }),
  );
  await page.locator("canvas").first().screenshot({ path: `scale-${scale}.png` });
  console.log(`renderScale ${scale}:`, JSON.stringify(info));
  await context.close();
}
await browser.close();
