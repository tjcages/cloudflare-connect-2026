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
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

await page.addInitScript(() => {
  const config = {
    duotoneEnabled: true,
    stripesEnabled: true,
    stripes: [],
    displayWidth: 1696,
    displayHeight: 960,
  };
  localStorage.setItem(
    "section-grid-playground",
    JSON.stringify({ version: 1, lastTextureId: "shader", uploads: [], configs: { shader: config } }),
  );
});
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const result = await page.evaluate(async () => {
  const perf = await import("/src/playground/playgroundPerfProfile.ts");
  return new Promise((resolve) => {
    let frames = 0;
    let ticks = 0;
    let tickSum = 0;
    let tickMax = 0;
    let renderSum = 0;
    let sampleMax = 0;
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
        renderSum += s.renderMs;
        sampleMax = Math.max(sampleMax, s.sampleFrameMs);
      }
      const elapsed = performance.now() - start;
      if (elapsed < 4000) requestAnimationFrame(loop);
      else
        resolve({
          fps: +(frames / (elapsed / 1000)).toFixed(1),
          tickAvg: +(tickSum / Math.max(1, ticks)).toFixed(2),
          tickMax: +tickMax.toFixed(1),
          renderAvg: +(renderSum / Math.max(1, ticks)).toFixed(2),
          sampleMax: +sampleMax.toFixed(1),
        });
    }
    requestAnimationFrame(loop);
  });
});
console.log("stripes mode 2x:", JSON.stringify(result), "copyWarnings:", warnings);
await page.locator("canvas").first().screenshot({ path: "skiprender.png" });
await browser.close();
