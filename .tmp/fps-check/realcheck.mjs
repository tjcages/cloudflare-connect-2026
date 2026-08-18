import { chromium } from "playwright";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5180/playground";

const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--window-position=100,100", "--window-size=1400,900"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
let warnings = 0;
page.on("console", (msg) => {
  if (msg.text().includes("glCopySubTextureCHROMIUM")) warnings++;
});
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  const p = await import("/src/playground/playgroundPersistence.ts");
  const cfg = p.defaultConfigForTexture("shader");
  cfg.displayWidth = 1696;
  cfg.displayHeight = 960;
  delete cfg.shaderSource;
  p.savePersistedConfig("shader", cfg);
  p.saveLastTextureId("shader");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3500);

const result = await page.evaluate(async () => {
  const perf = await import("/src/playground/playgroundPerfProfile.ts");
  return new Promise((resolve) => {
    let frames = 0;
    let ticks = 0;
    let tickSum = 0;
    let tickMax = 0;
    let last = null;
    const start = performance.now();
    function loop() {
      frames++;
      const s = perf.getLastPlaygroundPerfSample();
      if (s && s !== last) {
        last = s;
        ticks++;
        tickSum += s.tickTotalMs;
        tickMax = Math.max(tickMax, s.tickTotalMs);
      }
      const elapsed = performance.now() - start;
      if (elapsed < 4000) requestAnimationFrame(loop);
      else
        resolve({
          fps: +(frames / (elapsed / 1000)).toFixed(1),
          tickAvg: +(tickSum / Math.max(1, ticks)).toFixed(2),
          tickMax: +tickMax.toFixed(1),
        });
    }
    requestAnimationFrame(loop);
  });
});
console.log("default stripes 2x:", JSON.stringify(result), "copyWarnings:", warnings);
await page.locator("canvas").first().screenshot({ path: "real1.png" });
await page.waitForTimeout(700);
await page.locator("canvas").first().screenshot({ path: "real2.png" });
await browser.close();
